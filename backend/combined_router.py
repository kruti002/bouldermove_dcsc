from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import networkx as nx
import geopandas as gpd
import numpy as np
import osmnx as ox
from shapely.geometry import Point
import requests
from datetime import datetime
import polyline

from weather_service import WeatherError, get_weather_and_alerts
from events_service import events_near_route
import raptor_engine

DATA_DIR = "data"
OUTPUT = os.path.join(DATA_DIR, "network_data")

app = FastAPI(title="BoulderMove Routing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------- GLOBALS -----------------------------------
G = None
nodes_gdf = None
node_ids = None
node_x = None
node_y = None
stops_gdf = None
graph_crs = None
raptor = None

# ------------------------------- ML API -----------------------------------
ML_URL = "https://bouldermove-ml-499631536778.us-central1.run.app/score_route"


def score_route(features: dict):
    try:
        print("➡ ML INPUT:", features)
        r = requests.post(ML_URL, json=features, timeout=10)
        r.raise_for_status()
        out = r.json()
        print("⬅ ML OUTPUT:", out)

        return {
            "prob_on_time": out.get("prob_on_time"),
            "expected_delay_min": out.get("expected_delay_min"),
        }

    except Exception as e:
        print("❌ ML scoring failed:", e)
        return {"prob_on_time": None, "expected_delay_min": None}


# ------------------------------- MODELS -----------------------------------
class Location(BaseModel):
    lat: float
    lon: float


class PlanTransitRequest(BaseModel):
    origin: Location
    destination: Location
    depart_at: str | None = None


# ------------------------------- LOAD DATA --------------------------------
@app.on_event("startup")
def load_data():
    global G, nodes_gdf, node_ids, node_x, node_y, stops_gdf, graph_crs, raptor

    print("Loading walking graph…")
    G = ox.load_graphml(os.path.join(OUTPUT, "walk_graph.graphml"))
    graph_crs = G.graph["crs"]

    nodes = ox.graph_to_gdfs(G, nodes=True, edges=False).to_crs(graph_crs)
    nodes_gdf = nodes
    node_ids = np.array(nodes.index)
    node_x = nodes.geometry.x.to_numpy()
    node_y = nodes.geometry.y.to_numpy()

    print("Loading stops…")
    stops = gpd.read_file(os.path.join(OUTPUT, "stops.geojson"))
    stops["stop_id"] = stops["stop_id"].astype(str)

    stops_proj = stops.to_crs(graph_crs)
    stops["_x_proj"] = stops_proj.geometry.x
    stops["_y_proj"] = stops_proj.geometry.y
    stops_gdf = stops

    print("Loading RAPTOR engine…")
    raptor = raptor_engine.RaptorEngine(
        gtfs_feeds=[
            os.path.join(DATA_DIR, "gtfs_rtd.zip"),
            os.path.join(DATA_DIR, "gtfs_bustang.zip"),
        ],
        stops_geojson_path=os.path.join(OUTPUT, "stops.geojson"),
    )

    print("Backend startup complete.")


# ------------------------------- HELPERS ----------------------------------
def nearest_graph_node(lat, lon):
    pt = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326").to_crs(graph_crs)[0]
    dx = node_x - pt.x
    dy = node_y - pt.y
    return node_ids[np.argmin(dx * dx + dy * dy)]


def path_to_latlon(path):
    if not path:
        return []
    nodes = nodes_gdf.loc[path].to_crs(epsg=4326)
    return [{"lat": row.geometry.y, "lon": row.geometry.x} for _, row in nodes.iterrows()]


def nearest_gtfs_stop(lat, lon):
    pt = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326").to_crs(graph_crs)[0]
    dx = stops_gdf["_x_proj"].to_numpy() - pt.x
    dy = stops_gdf["_y_proj"].to_numpy() - pt.y
    idx = np.argmin(dx * dx + dy * dy)
    return str(stops_gdf.iloc[idx]["stop_id"])


def format_weather(raw):
    if not raw:
        return None
    current = raw.get("current", {})
    return {
        "temp": current.get("temp"),
        "feels_like": current.get("feels_like"),
        "humidity": current.get("humidity"),
        "weather_main": current.get("weather_main"),
        "weather_desc": current.get("weather_desc"),
        "wind_speed": current.get("wind_speed"),
        "rain_1h": current.get("rain_1h", 0),
        "snow_1h": current.get("snow_1h", 0),
        "custom_alerts": raw.get("custom_alerts", []),
    }


def get_optional_weather(lat, lon):
    try:
        return format_weather(get_weather_and_alerts(lat, lon))
    except WeatherError as error:
        print(f"Weather unavailable: {error}")
        return None


def get_optional_events(polyline_points):
    try:
        return events_near_route(polyline_points) or {"count": 0, "events": []}
    except Exception as error:
        print(f"Events unavailable: {error}")
        return {"count": 0, "events": []}


# --------------------------- MAIN API -------------------------------------
@app.post("/plan_transit_full")
def plan_transit_full(req: PlanTransitRequest):
    """
    Walk -> transit -> walk routing with RAPTOR, plus weather, events, and ML scoring.
    Returns an error if RAPTOR finds no journey.
    """
    departure_iso = req.depart_at or datetime.now().replace(microsecond=0).isoformat()
    print("Using departure time:", departure_iso)

    try:
        # ORIGIN / DESTINATION STOPS
        origin_stop = nearest_gtfs_stop(req.origin.lat, req.origin.lon)
        origin_match = stops_gdf.loc[stops_gdf["stop_id"] == origin_stop]

        dest_stop = nearest_gtfs_stop(req.destination.lat, req.destination.lon)
        dest_match = stops_gdf.loc[stops_gdf["stop_id"] == dest_stop]

        # WALK TO FIRST STOP
        walk1_path = nx.shortest_path(
            G,
            nearest_graph_node(req.origin.lat, req.origin.lon),
            int(origin_match["nearest_node"].iloc[0]),
            weight="length",
        )
        walk1_latlon = path_to_latlon(walk1_path)
        print("[DEBUG] walk1_latlon points:", len(walk1_latlon))

        # TRANSIT (RAPTOR)
        transit_legs = raptor.plan(origin_stop, dest_stop, departure_iso)
        print("[DEBUG] transit_legs:", len(transit_legs))
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {
            "error": {
                "code": "no_route",
                "message": "No transit route connects those locations at this time.",
            }
        }
    except Exception as error:
        print(f"Transit routing provider failed: {error}")
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "provider_failure",
                    "message": "The transit routing service is temporarily unavailable.",
                }
            },
        )

    # ----------------- NO ROUTE IF RAPTOR FAILS -------------------
    if not transit_legs or len(transit_legs) == 0:
        return {
            "error": {
                "code": "no_route",
                "message": "No transit route connects those locations at this time.",
            }
        }

    # ----------------- NORMAL RAPTOR FLOW --------------------------
    # RAPTOR geometry (stops along the route)
    transit_geometry = []
    for leg in transit_legs:
        for sid in leg["intermediate_stops"]:
            row = stops_gdf.loc[stops_gdf["stop_id"] == sid].iloc[0]
            transit_geometry.append(
                {"lat": row["stop_lat"], "lon": row["stop_lon"]}
            )
    print("[DEBUG] transit_geometry points:", len(transit_geometry))

    # WALK TO DESTINATION
    walk3_path = nx.shortest_path(
        G,
        int(dest_match["nearest_node"].iloc[0]),
        nearest_graph_node(req.destination.lat, req.destination.lon),
        weight="length",
    )
    walk3_latlon = path_to_latlon(walk3_path)
    print("[DEBUG] walk3_latlon points:", len(walk3_latlon))

    # WEATHER + EVENTS (now that geometry exists)
    weather = get_optional_weather(req.origin.lat, req.origin.lon)
    full_geometry = walk1_latlon + transit_geometry + walk3_latlon
    print("[DEBUG] full_geometry points:", len(full_geometry))

    events = get_optional_events([(p["lat"], p["lon"]) for p in full_geometry])

    # ------------------ ML FEATURE EXTRACTION ----------------------
    duration_min = sum(leg.get("duration_min", 0) for leg in transit_legs)
    num_transfers = max(0, len(transit_legs) - 1)
    buffer_min = 5

    rain_1h = weather.get("rain_1h", 0) if weather else 0
    snow_1h = weather.get("snow_1h", 0) if weather else 0
    wind_speed = weather.get("wind_speed", 0) if weather else 0
    temp = weather.get("temp", 0) if weather else 0
    event_count = (
        events.get("count", len(events.get("events", [])))
        if isinstance(events, dict)
        else len(events)
    )
    event_risk = 1.0 if event_count > 0 else 0.0

    hour = datetime.now().hour
    is_weekend = datetime.now().weekday() >= 5

    features = {
        "duration_min": float(duration_min),
        "buffer_min": float(buffer_min),
        "num_transfers": int(num_transfers),
        "rain_1h": float(rain_1h),
        "snow_1h": float(snow_1h),
        "wind_speed": float(wind_speed),
        "temp": float(temp),
        "event_risk": float(event_risk),
        "hour": int(hour),
        "is_weekend": bool(is_weekend),
    }

    ml_output = score_route(features)

    # ------------------ FINAL RESPONSE -----------------------------
    return {
        "mode": "walk_transit_walk",
        "origin_gtfs_stop": origin_stop,
        "destination_gtfs_stop": dest_stop,
        "walk_to_stop": walk1_latlon,
        "transit": transit_legs,
        "walk_to_destination": walk3_latlon,
        "weather": weather,
        "events_nearby": events,
        "geometry": full_geometry,
        "on_time_probability": ml_output.get("prob_on_time"),
        "expected_delay_min": ml_output.get("expected_delay_min"),
        "ml_features_used": features,
    }


@app.get("/osm_directions")
def osm_directions(
    origin: str,
    destination: str,
    mode: str = "driving",
    alternatives: bool = False,
):
    origin_lat, origin_lon = map(float, origin.split(","))
    destination_lat, destination_lon = map(float, destination.split(","))
    costing = {
        "driving": "auto",
        "walking": "pedestrian",
        "bicycling": "bicycle",
    }.get(mode, "auto")

    payload = {
        "locations": [
            {"lat": origin_lat, "lon": origin_lon},
            {"lat": destination_lat, "lon": destination_lon},
        ],
        "costing": costing,
        "alternates": 2 if alternatives else 0,
        "directions_options": {"units": "kilometers"},
    }
    try:
        response = requests.post(
            "https://valhalla1.openstreetmap.de/route",
            json=payload,
            timeout=20,
        )
        if response.status_code in (400, 404):
            return {
                "routes": [],
                "error": {
                    "code": "no_route",
                    "message": "No route connects those locations for the selected travel mode.",
                },
            }
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError, KeyError) as error:
        print(f"OpenStreetMap routing provider failed: {error}")
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "provider_failure",
                    "message": "The road routing service is temporarily unavailable.",
                }
            },
        )

    if "trip" not in data:
        return {
            "routes": [],
            "error": {
                "code": "no_route",
                "message": "No route connects those locations for the selected travel mode.",
            },
        }
    trips = [data["trip"]]
    trips.extend(alternate["trip"] for alternate in data.get("alternates", []))

    routes = []
    route_points = []
    for trip in trips:
        points = []
        for leg in trip["legs"]:
            points.extend(polyline.decode(leg["shape"], precision=6))
        route_points.append(points)
        routes.append(
            {
                "duration": trip["summary"]["time"],
                "distance": trip["summary"]["length"] * 1000,
                "geometry": {
                    "coordinates": [[lon, lat] for lat, lon in points],
                },
            }
        )

    weather = get_optional_weather(origin_lat, origin_lon)
    events = get_optional_events(route_points[0])

    return {
        "routes": routes,
        "weather": weather,
        "events_nearby": events,
    }


# -------------------------- PRODUCTION FRONTEND ---------------------------
FRONTEND_BUILD = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
)
if os.path.isdir(FRONTEND_BUILD):
    app.mount("/", StaticFiles(directory=FRONTEND_BUILD, html=True), name="frontend")


# ----------------------------- LOCAL RUNNER -------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))
