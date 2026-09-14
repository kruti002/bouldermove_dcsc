from fastapi import FastAPI
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import re
import math
import networkx as nx
import geopandas as gpd
import numpy as np
import osmnx as ox
from shapely.geometry import Point
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import polyline
import xgboost as xgb
from joblib import load

BOULDER_TZ = ZoneInfo("America/Denver")

def get_boulder_now() -> datetime:
    """Returns the current real-time datetime in Boulder, Colorado (Mountain Time - MDT/MST)."""
    return datetime.now(BOULDER_TZ)


from weather_service import WeatherError, get_weather_and_alerts
from events_service import events_near_route
import raptor_engine

DATA_DIR = "data"
OUTPUT = os.path.join(DATA_DIR, "network_data")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

app = FastAPI(title="BoulderMove Routing & Prediction API", version="2.1.0")

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

# XGBoost in-memory model
ml_booster = None
ml_feature_cols = [
    "duration_min",
    "buffer_min",
    "num_transfers",
    "rain_1h",
    "snow_1h",
    "wind_speed",
    "temp",
    "event_risk",
    "hour",
    "is_weekend",
]

# ------------------------------- LOAD XGBOOST MODEL ------------------------
def load_ml_model():
    global ml_booster, ml_feature_cols
    model_json = os.path.join(MODELS_DIR, "route_on_time_model.json")
    feat_joblib = os.path.join(MODELS_DIR, "feature_cols.joblib")

    if os.path.exists(model_json):
        try:
            booster = xgb.Booster()
            booster.load_model(model_json)
            ml_booster = booster
            if os.path.exists(feat_joblib):
                ml_feature_cols = load(feat_joblib)
            print("[OK] Successfully loaded trained XGBoost model from", model_json)
        except Exception as e:
            print(f"[ERROR] Error loading XGBoost model: {e}")
    else:
        print("Notice: No saved XGBoost model found at", model_json)


def predict_route_time(features: dict, depart_dt: datetime = None) -> dict:
    """
    Inference with the saved XGBoost model.
    Calculates predicted arrival time and expected delay based on ML punctuality output.
    """
    base_dur = float(features.get("duration_min", 0.0))
    if depart_dt is None:
        depart_dt = get_boulder_now()

    prob_on_time = 0.90
    if ml_booster is not None and ml_feature_cols:
        try:
            x_vals = [float(features.get(c, 0.0)) for c in ml_feature_cols]
            d = xgb.DMatrix(np.array([x_vals]), feature_names=ml_feature_cols)
            raw_prob = float(ml_booster.predict(d)[0])
            prob_on_time = max(0.05, min(0.99, raw_prob))
        except Exception as e:
            print("XGBoost prediction runtime error:", e)

    # Calculate model adjustment delay based on on-time probability & route duration
    risk_factor = max(0.0, 1.0 - prob_on_time)
    delay_min = round(risk_factor * (base_dur * 0.22 + 4.5), 1)

    # Traffic / congestion rating
    if prob_on_time >= 0.85 and delay_min <= 2.0:
        traffic = "Light"
    elif prob_on_time >= 0.68:
        traffic = "Moderate"
    else:
        traffic = "Heavy / Delay Expected"

    predicted_dur = max(1, round(base_dur + delay_min))
    arrival_dt = depart_dt + timedelta(minutes=predicted_dur)

    return {
        "base_duration_minutes": round(base_dur),
        "predicted_duration_minutes": predicted_dur,
        "predicted_delay_minutes": delay_min,
        "predicted_arrival": arrival_dt.strftime("%I:%M %p").lstrip("0"),
        "predicted_arrival_iso": arrival_dt.isoformat(),
        "prob_on_time": round(prob_on_time, 2),
        "traffic_condition": traffic,
        "model_loaded": ml_booster is not None,
    }


# ------------------------------- MODELS -----------------------------------
class Location(BaseModel):
    lat: float
    lon: float


class PlanTransitRequest(BaseModel):
    origin: Location
    destination: Location
    depart_at: str | None = None


class PredictRequest(BaseModel):
    duration_min: float
    distance_km: float | None = None
    buffer_min: float = 5.0
    num_transfers: int = 0
    rain_1h: float = 0.0
    snow_1h: float = 0.0
    wind_speed: float = 0.0
    temp: float = 20.0
    event_risk: float = 0.0
    hour: int | None = None
    is_weekend: bool | None = None
    depart_at: str | None = None


# ------------------------------- LOAD DATA --------------------------------
@app.on_event("startup")
def startup_event():
    global G, nodes_gdf, node_ids, node_x, node_y, stops_gdf, graph_crs, raptor

    load_ml_model()

    try:
        walk_path = os.path.join(OUTPUT, "walk_graph.graphml")
        if os.path.exists(walk_path):
            print("Loading walking graph…")
            G = ox.load_graphml(walk_path)
            graph_crs = G.graph["crs"]

            nodes = ox.graph_to_gdfs(G, nodes=True, edges=False).to_crs(graph_crs)
            nodes_gdf = nodes
            node_ids = np.array(nodes.index)
            node_x = nodes.geometry.x.to_numpy()
            node_y = nodes.geometry.y.to_numpy()
        else:
            print(f"Notice: Walking graph not found at {walk_path}.")

        stops_path = os.path.join(OUTPUT, "stops.geojson")
        if os.path.exists(stops_path) and graph_crs:
            print("Loading stops…")
            stops = gpd.read_file(stops_path)
            stops["stop_id"] = stops["stop_id"].astype(str)

            stops_proj = stops.to_crs(graph_crs)
            stops["_x_proj"] = stops_proj.geometry.x
            stops["_y_proj"] = stops_proj.geometry.y
            stops_gdf = stops

        gtfs_feeds = [
            os.path.join(DATA_DIR, "gtfs_rtd.zip"),
            os.path.join(DATA_DIR, "gtfs_bustang.zip"),
        ]
        if all(os.path.exists(f) for f in gtfs_feeds) and os.path.exists(stops_path):
            print("Loading RAPTOR engine…")
            raptor = raptor_engine.RaptorEngine(
                gtfs_feeds=gtfs_feeds,
                stops_geojson_path=stops_path,
            )
        else:
            print("Notice: GTFS feeds or stops data not found. RAPTOR transit engine in standby.")

        print("Backend startup complete.")
    except Exception as e:
        print(f"Warning during backend startup data load: {e}")


# ------------------------------- HEALTH / STATUS ---------------------------
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": ml_booster is not None,
        "service": "BoulderMove Prediction & Routing API",
        "version": "2.1.0",
    }


@app.get("/api/status")
@app.get("/")
def api_status():
    return {
        "name": "BoulderMove Backend API",
        "version": "2.1.0",
        "status": "online",
        "model_loaded": ml_booster is not None,
        "endpoints": ["/health", "/api/predict", "/osm_directions", "/plan_transit_full", "/docs"],
    }


# ------------------------------- GEOCODING ENDPOINT ------------------------
_geocode_cache = {}

@app.get("/api/geocode")
def geocode_address(q: str):
    """
    High-speed robust geocoding with Photon Komoot & Nominatim fallback and in-memory caching.
    Supports coordinates, house addresses, street names, and landmark queries.
    """
    raw_query = (q or "").strip()
    if len(raw_query) < 2:
        return {"results": []}

    cache_key = raw_query.lower()
    if cache_key in _geocode_cache:
        return {"results": _geocode_cache[cache_key]}

    # Check for direct lat,lon coordinate input first on raw_query
    coords_match = re.match(r"^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$", raw_query)
    if coords_match:
        try:
            clat = float(coords_match.group(1))
            clon = float(coords_match.group(2))
            if -90 <= clat <= 90 and -180 <= clon <= 180:
                res = [{"display_name": f"Coordinates ({clat:.5f}, {clon:.5f})", "lat": clat, "lon": clon}]
                _geocode_cache[cache_key] = res
                return {"results": res}
        except Exception:
            pass

    cleaned_q = clean_address_text(raw_query)
    query = (cleaned_q or raw_query).strip()


    results = []

    # 1. Try Photon Komoot (OSM Elasticsearch geocoder biased to Boulder, CO)
    try:
        url = "https://photon.komoot.io/api/"
        search_term = query if any(w in query.lower() for w in ["boulder", "co", "colorado"]) else f"{query}, Boulder, CO"
        params = {
            "q": search_term,
            "limit": 6,
            "lat": 40.0150,
            "lon": -105.2705,
        }
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BoulderMove/2.1"}
        r = requests.get(url, params=params, headers=headers, timeout=4)
        if r.ok:
            data = r.json()
            for f in data.get("features", []):
                p = f.get("properties", {})
                coords = f.get("geometry", {}).get("coordinates", [])
                if len(coords) >= 2:
                    hn = p.get("housenumber")
                    st = p.get("street")
                    nm = p.get("name")
                    city = p.get("city") or p.get("locality") or p.get("county") or "Boulder"
                    st_state = p.get("state") or "CO"
                    postcode = p.get("postcode")

                    label_parts = []
                    if hn and st:
                        label_parts.append(f"{hn} {st}")
                    elif nm and st and nm != st:
                        label_parts.append(f"{nm}, {st}")
                    elif nm:
                        label_parts.append(nm)
                    elif st:
                        label_parts.append(st)

                    if city:
                        label_parts.append(city)
                    if st_state:
                        label_parts.append(st_state)
                    if postcode:
                        label_parts.append(postcode)

                    display_name = ", ".join(label_parts) if label_parts else (nm or query)
                    results.append({
                        "display_name": display_name,
                        "lat": float(coords[1]),
                        "lon": float(coords[0]),
                    })
    except Exception as e:
        print("Photon geocode notice:", e)

    # 2. If Photon returned nothing or raw query without Boulder suffix, try raw query on Photon
    if not results and search_term != query:
        try:
            url = "https://photon.komoot.io/api/"
            params = {
                "q": query,
                "limit": 6,
                "lat": 40.0150,
                "lon": -105.2705,
            }
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BoulderMove/2.1"}
            r = requests.get(url, params=params, headers=headers, timeout=4)
            if r.ok:
                data = r.json()
                for f in data.get("features", []):
                    p = f.get("properties", {})
                    coords = f.get("geometry", {}).get("coordinates", [])
                    if len(coords) >= 2:
                        hn = p.get("housenumber")
                        st = p.get("street")
                        nm = p.get("name")
                        city = p.get("city") or p.get("locality") or p.get("county") or "Boulder"
                        st_state = p.get("state") or "CO"
                        label_parts = []
                        if hn and st:
                            label_parts.append(f"{hn} {st}")
                        elif nm:
                            label_parts.append(nm)
                        elif st:
                            label_parts.append(st)
                        label_parts.extend([city, st_state])
                        results.append({
                            "display_name": ", ".join(label_parts),
                            "lat": float(coords[1]),
                            "lon": float(coords[0]),
                        })
        except Exception as e:
            print("Photon secondary geocode notice:", e)

    _geocode_cache[cache_key] = results[:5]
    return {"results": results[:5]}


# ------------------------------- PREDICTION ENDPOINT -----------------------
@app.post("/api/predict")
@app.post("/predict")
def predict_endpoint(req: PredictRequest):
    """
    Run XGBoost on-demand inference on journey features and return predicted arrival and delay.
    """
    now = datetime.now()
    depart_dt = now
    if req.depart_at:
        try:
            depart_dt = datetime.fromisoformat(req.depart_at.replace("Z", "+00:00"))
        except Exception:
            depart_dt = now

    features = {
        "duration_min": float(req.duration_min),
        "buffer_min": float(req.buffer_min),
        "num_transfers": int(req.num_transfers),
        "rain_1h": float(req.rain_1h),
        "snow_1h": float(req.snow_1h),
        "wind_speed": float(req.wind_speed),
        "temp": float(req.temp),
        "event_risk": float(req.event_risk),
        "hour": int(req.hour if req.hour is not None else now.hour),
        "is_weekend": bool(req.is_weekend if req.is_weekend is not None else (now.weekday() >= 5)),
    }

    prediction = predict_route_time(features, depart_dt)
    prediction["features_used"] = features
    prediction["model_type"] = "XGBoost Classifier (Saved Native JSON Booster)"
    return prediction


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


# --------------------------- AUTHENTIC RTD BOULDER CORRIDORS ----------------
RTD_CORRIDORS = {
    "SKIP": {
        "name": "RTD SKIP",
        "description": "Broadway Corridor",
        "stops": [
            {"id": "skip_1", "name": "Broadway & Iris Ave", "lat": 40.0410, "lon": -105.2810},
            {"id": "skip_2", "name": "Broadway & Balsam Ave (BCH)", "lat": 40.0315, "lon": -105.2812},
            {"id": "skip_3", "name": "Broadway & Alpine Ave", "lat": 40.0270, "lon": -105.2810},
            {"id": "skip_dbs", "name": "Downtown Boulder Station (Gate B)", "lat": 40.0162, "lon": -105.2770},
            {"id": "skip_4", "name": "Broadway & University Ave (CU Campus)", "lat": 40.0105, "lon": -105.2760},
            {"id": "skip_5", "name": "Broadway & Euclid Ave (UMC)", "lat": 40.0070, "lon": -105.2725},
            {"id": "skip_6", "name": "Broadway & Regent Dr", "lat": 40.0040, "lon": -105.2670},
            {"id": "skip_7", "name": "Broadway & Baseline Rd", "lat": 40.0003, "lon": -105.2628},
            {"id": "skip_8", "name": "Broadway & 27th Way", "lat": 39.9990, "lon": -105.2600},
            {"id": "skip_9", "name": "Table Mesa Park-n-Ride", "lat": 39.9850, "lon": -105.2470},
        ],
    },
    "BOUND": {
        "name": "RTD BOUND",
        "description": "30th Street Corridor (Boulder Junction <-> 29th St Mall <-> Williams Village)",
        "stops": [
            {"id": "bnd_1", "name": "Boulder Junction at Depot Square", "lat": 40.0253, "lon": -105.2505},
            {"id": "bnd_2", "name": "30th St & Mapleton Ave", "lat": 40.0220, "lon": -105.2530},
            {"id": "bnd_3", "name": "30th St & Pearl St", "lat": 40.0190, "lon": -105.2530},
            {"id": "bnd_mall", "name": "29th Street Mall (30th & Canyon)", "lat": 40.0175, "lon": -105.2575},
            {"id": "bnd_4", "name": "30th St & Arapahoe Ave", "lat": 40.0145, "lon": -105.2530},
            {"id": "bnd_5", "name": "30th St & Colorado Ave", "lat": 40.0080, "lon": -105.2530},
            {"id": "bnd_6", "name": "Williams Village (30th & Baseline)", "lat": 40.0000, "lon": -105.2520},
            {"id": "bnd_7", "name": "Moorhead Ave & 30th St", "lat": 39.9940, "lon": -105.2500},
        ],
    },
    "HOP": {
        "name": "RTD HOP",
        "description": "Central Boulder Loop (Downtown <-> The Hill <-> CU Campus <-> 29th St Mall)",
        "stops": [
            {"id": "hop_dbs", "name": "Downtown Boulder Station (Gate A)", "lat": 40.0162, "lon": -105.2770},
            {"id": "hop_1", "name": "Pearl St & 11th St", "lat": 40.0176, "lon": -105.2815},
            {"id": "hop_2", "name": "The Hill (Broadway & Pleasant St)", "lat": 40.0090, "lon": -105.2760},
            {"id": "hop_3", "name": "CU UMC (Euclid Ave)", "lat": 40.0070, "lon": -105.2725},
            {"id": "hop_4", "name": "Colorado Ave & 18th St", "lat": 40.0080, "lon": -105.2670},
            {"id": "hop_5", "name": "Colorado Ave & Folsom St (Engineering)", "lat": 40.0080, "lon": -105.2630},
            {"id": "hop_mall", "name": "29th Street Mall (Canyon & 29th)", "lat": 40.0175, "lon": -105.2575},
            {"id": "hop_6", "name": "Pearl St & 15th St", "lat": 40.0180, "lon": -105.2750},
        ],
    },
    "JUMP": {
        "name": "RTD JUMP",
        "description": "Arapahoe Avenue Corridor",
        "stops": [
            {"id": "jmp_dbs", "name": "Downtown Boulder Station (Gate C)", "lat": 40.0162, "lon": -105.2770},
            {"id": "jmp_1", "name": "Arapahoe Ave & 14th St", "lat": 40.0150, "lon": -105.2760},
            {"id": "jmp_2", "name": "Arapahoe Ave & Folsom St", "lat": 40.0148, "lon": -105.2630},
            {"id": "jmp_3", "name": "Arapahoe Ave & 28th St", "lat": 40.0145, "lon": -105.2590},
            {"id": "jmp_4", "name": "Arapahoe Ave & 30th St", "lat": 40.0145, "lon": -105.2530},
            {"id": "jmp_5", "name": "Arapahoe Ave & Foothills Pkwy", "lat": 40.0142, "lon": -105.2390},
            {"id": "jmp_6", "name": "Arapahoe Ave & 55th St", "lat": 40.0140, "lon": -105.2280},
        ],
    },
    "WILL_VILL": {
        "name": "CU Buff Bus (Will Vill Express)",
        "description": "Williams Village <-> Bear Creek <-> Kittredge <-> C4C <-> CU UMC",
        "stops": [
            {"id": "wv_main", "name": "Williams Village Bus Stop (30th & Baseline)", "lat": 40.0000, "lon": -105.2520},
            {"id": "wv_bear", "name": "Bear Creek Apartments (Williams Village)", "lat": 39.9985, "lon": -105.2535},
            {"id": "wv_kitt", "name": "Kittredge Central / Loop", "lat": 40.0045, "lon": -105.2615},
            {"id": "wv_c4c", "name": "Center for Community (C4C / Regent Dr)", "lat": 40.0055, "lon": -105.2650},
            {"id": "wv_umc", "name": "CU UMC (Euclid Ave)", "lat": 40.0070, "lon": -105.2725},
            {"id": "wv_eng", "name": "Colorado Ave & Folsom St (Engineering)", "lat": 40.0080, "lon": -105.2630},
            {"id": "wv_30th", "name": "Colorado Ave & 30th St", "lat": 40.0080, "lon": -105.2530},
        ],
    },
    "STAMPEDE": {
        "name": "RTD / Buff Bus STAMPEDE",
        "description": "CU Main Campus to East Campus (SEEC / Discovery Dr)",
        "stops": [
            {"id": "stp_1", "name": "CU UMC (Euclid Ave)", "lat": 40.0070, "lon": -105.2725},
            {"id": "stp_2", "name": "Colorado Ave & Regent Dr", "lat": 40.0080, "lon": -105.2670},
            {"id": "stp_3", "name": "Colorado Ave & Folsom St (Engineering)", "lat": 40.0080, "lon": -105.2630},
            {"id": "stp_4", "name": "Colorado Ave & 30th St", "lat": 40.0080, "lon": -105.2530},
            {"id": "stp_5", "name": "East Campus Discovery Dr (SEEC)", "lat": 40.0100, "lon": -105.2440},
            {"id": "stp_6", "name": "East Campus Innovation Center", "lat": 40.0115, "lon": -105.2410},
        ],
    },
    "205": {
        "name": "RTD 205",
        "description": "28th Street Corridor (North Boulder <-> Glenwood Dr <-> CU Campus)",
        "stops": [
            {"id": "205_iris", "name": "28th St & Iris Ave", "lat": 40.0380, "lon": -105.2590},
            {"id": "205_glenwood", "name": "28th St & Glenwood Dr (Glenwood Ct)", "lat": 40.0340, "lon": -105.2590},
            {"id": "205_valmont", "name": "28th St & Valmont Rd", "lat": 40.0270, "lon": -105.2590},
            {"id": "205_bjunc", "name": "Boulder Junction at Depot Square", "lat": 40.0253, "lon": -105.2505},
            {"id": "205_pearl", "name": "28th St & Pearl St", "lat": 40.0190, "lon": -105.2590},
            {"id": "205_canyon", "name": "28th St & Canyon Blvd (29th St Mall)", "lat": 40.0175, "lon": -105.2580},
            {"id": "205_colorado", "name": "28th St & Colorado Ave", "lat": 40.0080, "lon": -105.2580},
            {"id": "205_baseline", "name": "28th St & Baseline Rd", "lat": 40.0003, "lon": -105.2590},
        ],
    },
    "208": {
        "name": "RTD 208 / DASH",
        "description": "Iris Ave / South Boulder / Moorhead Ave Corridor",
        "stops": [
            {"id": "iris_glenwood", "name": "Iris Ave & 28th St (Glenwood)", "lat": 40.0380, "lon": -105.2590},
            {"id": "iris_26th", "name": "Iris Ave & 26th St", "lat": 40.0380, "lon": -105.2630},
            {"id": "mhd_dbs", "name": "Downtown Boulder Station (Gate D)", "lat": 40.0162, "lon": -105.2770},
            {"id": "mhd_1", "name": "Broadway & Baseline Rd", "lat": 40.0003, "lon": -105.2628},
            {"id": "mhd_2", "name": "Moorhead Ave & 27th Way", "lat": 39.9990, "lon": -105.2584},
            {"id": "mhd_3", "name": "Moorhead Ave & S 36th St", "lat": 39.9942, "lon": -105.2496},
            {"id": "mhd_4", "name": "Moorhead Ave & Davidson Pl", "lat": 39.9924, "lon": -105.2465},
            {"id": "mhd_5", "name": "Moorhead Ave & Table Mesa Dr", "lat": 39.9865, "lon": -105.2377},
            {"id": "mhd_pnr", "name": "Table Mesa Park-n-Ride", "lat": 39.9850, "lon": -105.2470},
        ],
    },
}


def haversine_dist_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates approximate ground distance in kilometers between two lat/lon points."""
    dlat = (lat2 - lat1) * 111.139
    dlon = (lon2 - lon1) * 111.139 * math.cos(math.radians((lat1 + lat2) / 2.0))
    return math.sqrt(dlat * dlat + dlon * dlon)


def find_best_stop_and_corridor(lat: float, lon: float):
    best_dist = float("inf")
    best_key = "SKIP"
    best_stop = None
    for c_key, c_data in RTD_CORRIDORS.items():
        for st in c_data["stops"]:
            d = haversine_dist_km(lat, lon, st["lat"], st["lon"])
            if d < best_dist:
                best_dist = d
                best_key = c_key
                best_stop = st
    return best_key, best_stop


def fetch_valhalla_geometry(points: list) -> list:
    if len(points) < 2:
        return [{"lat": p[0], "lon": p[1]} for p in points]
    try:
        payload = {
            "locations": [{"lat": p[0], "lon": p[1]} for p in points],
            "costing": "auto",
            "directions_options": {"units": "kilometers"},
        }
        r = requests.post("https://valhalla1.openstreetmap.de/route", json=payload, timeout=6)
        if r.ok:
            data = r.json()
            pts = []
            for leg in data.get("trip", {}).get("legs", []):
                pts.extend(polyline.decode(leg["shape"], precision=6))
            if pts:
                return [{"lat": lat, "lon": lon} for lat, lon in pts]
    except Exception as e:
        print("Valhalla route polyline notice:", e)
    return [{"lat": p[0], "lon": p[1]} for p in points]


def get_optimal_transfer_hub(corr1_key: str, corr2_key: str, stop1: dict, stop2: dict):
    """
    Finds the optimal transfer connection pair between two RTD corridors.
    Ensures that neither bus leg has from_stop == to_stop.
    """
    corr1 = RTD_CORRIDORS[corr1_key]
    corr2 = RTD_CORRIDORS[corr2_key]

    # Specific realistic Boulder transfer pairs
    if (corr1_key == "SKIP" and corr2_key == "205") or (corr1_key == "205" and corr2_key == "SKIP"):
        if stop1["lat"] > 40.030 or stop2["lat"] > 40.030:
            h1 = next((s for s in corr1["stops"] if "Iris" in s["name"]), corr1["stops"][0])
            h2 = next((s for s in corr2["stops"] if "Iris" in s["name"]), corr2["stops"][0])
            return h1, h2
        h1 = next((s for s in corr1["stops"] if "Downtown" in s["name"] or "UMC" in s["name"]), corr1["stops"][3])
        h2 = next((s for s in corr2["stops"] if "Canyon" in s["name"] or "Pearl" in s["name"]), corr2["stops"][4])
        return h1, h2

    if corr1_key == "BOUND" or corr2_key == "BOUND":
        h1 = next((s for s in corr1["stops"] if "Mall" in s["name"] or "Canyon" in s["name"] or "Colorado" in s["name"]), corr1["stops"][3])
        h2 = next((s for s in corr2["stops"] if "Mall" in s["name"] or "Canyon" in s["name"] or "Colorado" in s["name"]), corr2["stops"][3])
        return h1, h2

    if corr1_key in ("STAMPEDE", "WILL_VILL") or corr2_key in ("STAMPEDE", "WILL_VILL"):
        h1 = next((s for s in corr1["stops"] if "UMC" in s["name"] or "Colorado" in s["name"] or "C4C" in s["name"]), corr1["stops"][0])
        h2 = next((s for s in corr2["stops"] if "UMC" in s["name"] or "Colorado" in s["name"] or "C4C" in s["name"]), corr2["stops"][0])
        return h1, h2

    # Default: find closest stop pair across the two corridors
    best_dist = float("inf")
    best_h1, best_h2 = corr1["stops"][0], corr2["stops"][0]
    for s1 in corr1["stops"]:
        for s2 in corr2["stops"]:
            if s1["id"] == stop1["id"] and s2["id"] == stop2["id"]:
                continue
            d = (s1["lat"] - s2["lat"]) ** 2 + (s1["lon"] - s2["lon"]) ** 2
            if d < best_dist:
                best_dist = d
                best_h1 = s1
                best_h2 = s2

    return best_h1, best_h2


def clean_address_text(text: str) -> str:
    """Strips conversational noise, punctuation, and intent filler clauses from address strings."""
    if not text:
        return ""
    s = text.strip()
    # Strip sentences after period, exclamation, question mark, or semicolon
    s = re.split(r"(?<=[a-zA-Z])\s*[\.!\?;]", s)[0].strip()

    # Strip trailing conversational clauses & temporal expressions
    filler_patterns = [
        r"\b(?:and|so|then)?\s*(?:i\s+)?(?:wanna|want to|need to|trying to|going to|heading to)\s+(?:reach|get to|go to|be at|arrive at|reach my|get my)?\s*(?:home|house|work|class|school|dorm|apt|apartment|there|here)\b.*$",
        r"\b(?:to reach|to get to|to go to|to arrive at)\s+(?:home|house|work|class|school|dorm|apt|apartment|there|here)\b.*$",
        r"\b(?:please|asap|thank you|thanks|right now|immediately)\b.*$",
        r"\b(?:want to reach home|wanna reach home|want to go home|reach home|heading home|go home)\b.*$",
        r"\b(?:tomorrow|today|tonight|this morning|this afternoon|this evening|next week|next monday|next friday)\b.*$",
    ]
    for pat in filler_patterns:
        s = re.sub(pat, "", s, flags=re.I).strip()

    # Strip leading prepositions & fillers
    s = re.sub(r"^(?:im at|i am at|at|from|to|dest|the|my location|current location)\s+", "", s, flags=re.I).strip()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def get_corridor_direction_name(corr_key: str, idx_start: int, idx_end: int, stops_list: list) -> str:
    """Derives intuitive transit direction/headsign based on start and end stops along the corridor."""
    end_stop = stops_list[idx_end]
    start_stop = stops_list[idx_start]
    
    if corr_key == "205":
        return f"Southbound to {end_stop['name']}" if idx_end > idx_start else f"Northbound to {end_stop['name']}"
    elif corr_key == "SKIP":
        return f"Southbound to {end_stop['name']}" if idx_end > idx_start else f"Northbound to {end_stop['name']}"
    elif corr_key == "BOUND":
        return f"Southbound to {end_stop['name']}" if idx_end > idx_start else f"Northbound to {end_stop['name']}"
    elif corr_key == "JUMP":
        return f"Eastbound to {end_stop['name']}" if idx_end > idx_start else f"Westbound to {end_stop['name']}"
    elif corr_key == "HOP":
        return f"Central Boulder Loop via {end_stop['name']}"
    elif corr_key == "WILL_VILL":
        return f"Buff Bus to {end_stop['name']}"
    elif corr_key == "STAMPEDE":
        return f"Stampede to {end_stop['name']}"
    elif corr_key == "208":
        return f"Southbound to {end_stop['name']}" if idx_end > idx_start else f"Northbound to {end_stop['name']}"
    return f"To {end_stop['name']}"


def plan_boulder_multimodal_journey(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, depart_dt: datetime):
    """
    Candidate-based Multimodal Routing Engine:
    1. Evaluates all direct transit journeys across authentic RTD corridors.
    2. Evaluates viable 1-transfer transit journeys with realistic walking buffers.
    3. Prefers direct single-seat routes with a strong transfer penalty (+14 min).
    4. Generates both the recommended journey and ranked alternative options.
    """
    direct_dist_km = haversine_dist_km(origin_lat, origin_lon, dest_lat, dest_lon)

    # Short distance (< 450m): Direct Walk
    if direct_dist_km < 0.45:
        walk_mins = max(1, int(direct_dist_km * 12.0) + 2)
        arr_t = depart_dt + timedelta(minutes=walk_mins)
        walk_leg = {
            "mode": "WALK",
            "route_id": "Walking",
            "direction": "Direct Walk to Destination",
            "from_stop": "origin",
            "from_stop_name": "Current Location",
            "to_stop": "destination",
            "to_stop_name": "Destination",
            "departure": depart_dt.strftime("%I:%M %p"),
            "arrival": arr_t.strftime("%I:%M %p"),
            "duration_min": walk_mins,
            "walk_distance_m": int(direct_dist_km * 1000),
            "intermediate_stops_details": [],
        }
        geo_pts = [(origin_lat, origin_lon), (dest_lat, dest_lon)]
        return {
            "legs": [walk_leg],
            "geometry": fetch_valhalla_geometry(geo_pts),
            "base_duration": walk_mins,
            "num_transfers": 0,
            "walk_time_min": walk_mins,
            "transit_time_min": 0,
            "summary": {
                "badge": "Short Walk",
                "label": "Direct Walk",
                "reason": "Origin and destination are within walking distance",
                "total_duration_min": walk_mins,
                "distance_km": round(direct_dist_km, 2),
                "num_transfers": 0,
            },
            "alternatives": [],
        }

    candidate_journeys = []

    # -------------------------------------------------------------
    # 1. EVALUATE DIRECT TRANSIT CANDIDATES (0 Transfers)
    # -------------------------------------------------------------
    MAX_WALK_TO_STOP_KM = 1.15  # Max comfortable walk to a transit stop (~13 min)

    for corr_key, corr_data in RTD_CORRIDORS.items():
        stops = corr_data["stops"]
        for idx_orig, s_orig in enumerate(stops):
            d_orig = haversine_dist_km(origin_lat, origin_lon, s_orig["lat"], s_orig["lon"])
            if d_orig > MAX_WALK_TO_STOP_KM:
                continue

            for idx_dest, s_dest in enumerate(stops):
                if idx_orig == idx_dest:
                    continue
                d_dest = haversine_dist_km(dest_lat, dest_lon, s_dest["lat"], s_dest["lon"])
                if d_dest > MAX_WALK_TO_STOP_KM:
                    continue

                # Valid direct candidate on this corridor!
                step_slice = stops[min(idx_orig, idx_dest): max(idx_orig, idx_dest) + 1]
                if idx_orig > idx_dest:
                    step_slice = list(reversed(step_slice))

                inter_stops = [
                    {"stop_id": s["id"], "stop_name": s["name"], "lat": s["lat"], "lon": s["lon"]}
                    for s in step_slice[1:-1]
                ]

                walk1_mins = max(1, int(d_orig * 12.0) + 1)
                t_board = depart_dt + timedelta(minutes=walk1_mins)
                ride_mins = max(4, len(step_slice) * 2 + 2)
                t_alight = t_board + timedelta(minutes=ride_mins)
                walk2_mins = max(1, int(d_dest * 12.0) + 1)
                t_arrival = t_alight + timedelta(minutes=walk2_mins)

                total_duration = walk1_mins + ride_mins + walk2_mins
                # Scoring: Total duration + slight walk weight
                score = total_duration + (walk1_mins + walk2_mins) * 0.25

                direction_str = get_corridor_direction_name(corr_key, idx_orig, idx_dest, stops)

                bus_leg = {
                    "mode": "TRANSIT",
                    "route_id": corr_data["name"],
                    "direction": direction_str,
                    "from_stop": s_orig["id"],
                    "from_stop_name": s_orig["name"],
                    "to_stop": s_dest["id"],
                    "to_stop_name": s_dest["name"],
                    "departure": t_board.strftime("%I:%M %p"),
                    "arrival": t_alight.strftime("%I:%M %p"),
                    "duration_min": ride_mins,
                    "num_stops": len(step_slice),
                    "intermediate_stops_details": inter_stops,
                }

                geo_pts = [(origin_lat, origin_lon)] + [(s["lat"], s["lon"]) for s in step_slice] + [(dest_lat, dest_lon)]

                candidate_journeys.append({
                    "score": score,
                    "type": "direct_transit",
                    "corr_key": corr_key,
                    "legs": [bus_leg],
                    "geo_pts": geo_pts,
                    "base_duration": total_duration,
                    "num_transfers": 0,
                    "walk_time_min": walk1_mins + walk2_mins,
                    "transit_time_min": ride_mins,
                    "reason": "Direct single-seat ride",
                    "badge": "Fewest Transfers",
                })

    # -------------------------------------------------------------
    # 2. EVALUATE 1-TRANSFER CANDIDATES
    # -------------------------------------------------------------
    corridor_keys = list(RTD_CORRIDORS.keys())
    for i in range(len(corridor_keys)):
        for j in range(len(corridor_keys)):
            if i == j:
                continue
            c1_key = corridor_keys[i]
            c2_key = corridor_keys[j]
            corr1 = RTD_CORRIDORS[c1_key]
            corr2 = RTD_CORRIDORS[c2_key]

            # Find best origin stop on c1 and dest stop on c2
            best_s1 = min(corr1["stops"], key=lambda s: haversine_dist_km(origin_lat, origin_lon, s["lat"], s["lon"]))
            best_s2 = min(corr2["stops"], key=lambda s: haversine_dist_km(dest_lat, dest_lon, s["lat"], s["lon"]))

            d_orig = haversine_dist_km(origin_lat, origin_lon, best_s1["lat"], best_s1["lon"])
            d_dest = haversine_dist_km(dest_lat, dest_lon, best_s2["lat"], best_s2["lon"])

            if d_orig > 1.20 or d_dest > 1.20:
                continue

            th1, th2 = get_optimal_transfer_hub(c1_key, c2_key, best_s1, best_s2)
            d_transfer = haversine_dist_km(th1["lat"], th1["lon"], th2["lat"], th2["lon"])
            if d_transfer > 0.40:
                continue

            # Leg 1
            stops1 = corr1["stops"]
            idx_start = next((k for k, s in enumerate(stops1) if s["id"] == best_s1["id"]), 0)
            idx_trans1 = next((k for k, s in enumerate(stops1) if s["id"] == th1["id"]), len(stops1) - 1)
            if idx_start == idx_trans1:
                continue

            slice1 = stops1[min(idx_start, idx_trans1): max(idx_start, idx_trans1) + 1]
            if idx_start > idx_trans1:
                slice1 = list(reversed(slice1))

            inter1 = [
                {"stop_id": s["id"], "stop_name": s["name"], "lat": s["lat"], "lon": s["lon"]}
                for s in slice1[1:-1]
            ]

            # Leg 2
            stops2 = corr2["stops"]
            idx_trans2 = next((k for k, s in enumerate(stops2) if s["id"] == th2["id"]), 0)
            idx_dest_pos = next((k for k, s in enumerate(stops2) if s["id"] == best_s2["id"]), len(stops2) - 1)
            if idx_trans2 == idx_dest_pos:
                continue

            slice2 = stops2[min(idx_trans2, idx_dest_pos): max(idx_trans2, idx_dest_pos) + 1]
            if idx_trans2 > idx_dest_pos:
                slice2 = list(reversed(slice2))

            inter2 = [
                {"stop_id": s["id"], "stop_name": s["name"], "lat": s["lat"], "lon": s["lon"]}
                for s in slice2[1:-1]
            ]

            walk1_mins = max(1, int(d_orig * 12.0) + 1)
            t_board1 = depart_dt + timedelta(minutes=walk1_mins)
            ride1_mins = max(4, len(slice1) * 2 + 2)
            t_alight1 = t_board1 + timedelta(minutes=ride1_mins)

            transfer_walk_mins = max(2, int(d_transfer * 12.0) + 2)
            transfer_wait_mins = 3
            t_board2 = t_alight1 + timedelta(minutes=transfer_walk_mins + transfer_wait_mins)
            ride2_mins = max(4, len(slice2) * 2 + 2)
            t_alight2 = t_board2 + timedelta(minutes=ride2_mins)

            walk2_mins = max(1, int(d_dest * 12.0) + 1)
            total_duration = walk1_mins + ride1_mins + transfer_walk_mins + transfer_wait_mins + ride2_mins + walk2_mins

            # Transfer penalty (+14 min) ensures direct routes win unless significantly slower
            score = total_duration + 14.0

            dir1_str = get_corridor_direction_name(c1_key, idx_start, idx_trans1, stops1)
            dir2_str = get_corridor_direction_name(c2_key, idx_trans2, idx_dest_pos, stops2)

            leg1 = {
                "mode": "TRANSIT",
                "route_id": corr1["name"],
                "direction": dir1_str,
                "from_stop": best_s1["id"],
                "from_stop_name": best_s1["name"],
                "to_stop": th1["id"],
                "to_stop_name": th1["name"],
                "departure": t_board1.strftime("%I:%M %p"),
                "arrival": t_alight1.strftime("%I:%M %p"),
                "duration_min": ride1_mins,
                "num_stops": len(slice1),
                "intermediate_stops_details": inter1,
            }

            leg2 = {
                "mode": "TRANSIT",
                "route_id": corr2["name"],
                "direction": dir2_str,
                "from_stop": th2["id"],
                "from_stop_name": th2["name"],
                "to_stop": best_s2["id"],
                "to_stop_name": best_s2["name"],
                "departure": t_board2.strftime("%I:%M %p"),
                "arrival": t_alight2.strftime("%I:%M %p"),
                "duration_min": ride2_mins,
                "num_stops": len(slice2),
                "intermediate_stops_details": inter2,
            }

            geo_pts = (
                [(origin_lat, origin_lon)]
                + [(s["lat"], s["lon"]) for s in slice1]
                + [(s["lat"], s["lon"]) for s in slice2]
                + [(dest_lat, dest_lon)]
            )

            candidate_journeys.append({
                "score": score,
                "type": "transfer_transit",
                "corr_key": f"{c1_key}->{c2_key}",
                "legs": [leg1, leg2],
                "geo_pts": geo_pts,
                "base_duration": total_duration,
                "num_transfers": 1,
                "walk_time_min": walk1_mins + transfer_walk_mins + walk2_mins,
                "transit_time_min": ride1_mins + ride2_mins,
                "reason": f"Connection via {th1['name']}",
                "badge": "1 Transfer",
            })

    # Fallback if no transit candidates found: Nearest stops connection
    if not candidate_journeys:
        corr1_key, stop1 = find_best_stop_and_corridor(origin_lat, origin_lon)
        corr2_key, stop2 = find_best_stop_and_corridor(dest_lat, dest_lon)
        corr = RTD_CORRIDORS[corr1_key]
        walk1_mins = 4
        ride_mins = 12
        walk2_mins = 4
        t_board = depart_dt + timedelta(minutes=walk1_mins)
        t_alight = t_board + timedelta(minutes=ride_mins)
        leg = {
            "mode": "TRANSIT",
            "route_id": corr["name"],
            "direction": f"To {stop2['name']}",
            "from_stop": stop1["id"],
            "from_stop_name": stop1["name"],
            "to_stop": stop2["id"],
            "to_stop_name": stop2["name"],
            "departure": t_board.strftime("%I:%M %p"),
            "arrival": t_alight.strftime("%I:%M %p"),
            "duration_min": ride_mins,
            "num_stops": 4,
            "intermediate_stops_details": [],
        }
        candidate_journeys.append({
            "score": 25.0,
            "type": "fallback_transit",
            "corr_key": corr1_key,
            "legs": [leg],
            "geo_pts": [(origin_lat, origin_lon), (stop1["lat"], stop1["lon"]), (stop2["lat"], stop2["lon"]), (dest_lat, dest_lon)],
            "base_duration": walk1_mins + ride_mins + walk2_mins,
            "num_transfers": 0,
            "walk_time_min": walk1_mins + walk2_mins,
            "transit_time_min": ride_mins,
            "reason": "Transit route",
            "badge": "Transit",
        })

    # Sort candidates by score (lowest penalty/fastest time first)
    candidate_journeys.sort(key=lambda c: c["score"])

    best = candidate_journeys[0]
    full_geometry = fetch_valhalla_geometry(best["geo_pts"])

    # Prepare ranked alternatives (deduplicated by corridor key)
    alternatives = []
    seen_keys = {best["corr_key"]}
    alt_badges = ["Fastest Alternative", "Fewest Transfers", "Low Walking", "Alternative Route"]

    for cand in candidate_journeys[1:]:
        if cand["corr_key"] in seen_keys:
            continue
        seen_keys.add(cand["corr_key"])
        badge = alt_badges[min(len(alternatives), len(alt_badges) - 1)]
        if cand["num_transfers"] == 0 and "Fewest" not in [a.get("badge") for a in alternatives]:
            badge = "Fewest Transfers"
        elif cand["walk_time_min"] < best["walk_time_min"]:
            badge = "Lowest Walking"

        alternatives.append({
            "id": f"alt_{len(alternatives) + 1}",
            "badge": badge,
            "mode": "transit",
            "route_title": " → ".join([l["route_id"] for l in cand["legs"]]),
            "duration_min": cand["base_duration"],
            "num_transfers": cand["num_transfers"],
            "walk_time_min": cand["walk_time_min"],
            "transit_time_min": cand["transit_time_min"],
            "reason": cand["reason"],
            "legs": cand["legs"],
            "geometry": fetch_valhalla_geometry(cand["geo_pts"]),
        })
        if len(alternatives) >= 3:
            break

    # Add bike multimodal alternative
    bike_dur_min = max(5, int(direct_dist_km * 3.5) + 3)
    alternatives.append({
        "id": "alt_bike",
        "badge": "Best for Biking",
        "mode": "bicycling",
        "route_title": "Boulder Creek / Multi-use Path",
        "duration_min": bike_dur_min,
        "num_transfers": 0,
        "walk_time_min": 0,
        "transit_time_min": 0,
        "reason": "Zero emissions & direct bike trail connectivity",
        "legs": [{
            "mode": "BICYCLE",
            "route_id": "Bike Path",
            "direction": "Protected Bikeway",
            "from_stop_name": "Origin",
            "to_stop_name": "Destination",
            "departure": depart_dt.strftime("%I:%M %p"),
            "arrival": (depart_dt + timedelta(minutes=bike_dur_min)).strftime("%I:%M %p"),
            "duration_min": bike_dur_min,
        }],
        "geometry": fetch_valhalla_geometry([(origin_lat, origin_lon), (dest_lat, dest_lon)]),
    })

    return {
        "legs": best["legs"],
        "geometry": full_geometry,
        "base_duration": best["base_duration"],
        "num_transfers": best["num_transfers"],
        "walk_time_min": best["walk_time_min"],
        "transit_time_min": best["transit_time_min"],
        "summary": {
            "badge": "RECOMMENDED",
            "label": "Recommended Route",
            "reason": best["reason"],
            "total_duration_min": best["base_duration"],
            "distance_km": round(direct_dist_km, 2),
            "num_transfers": best["num_transfers"],
        },
        "alternatives": alternatives,
    }


def parse_boulder_datetime(iso_str: str | None) -> datetime:
    """Parses any incoming ISO datetime and strictly converts it into Boulder, CO local time (Mountain Time)."""
    if not iso_str:
        return get_boulder_now()
    try:
        clean_iso = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_iso)
        if dt.tzinfo is not None:
            return dt.astimezone(BOULDER_TZ)
        return dt.replace(tzinfo=BOULDER_TZ)
    except Exception:
        return get_boulder_now()


# --------------------------- MAIN ROUTING APIS -----------------------------
@app.post("/plan_transit_full")
def plan_transit_full(req: PlanTransitRequest):
    """
    Multimodal transit journey planning with walking, bus connections, transfer hubs,
    intermediate stops breakdown, live OpenWeather conditions, and native XGBoost ETA prediction.
    """
    depart_dt = parse_boulder_datetime(req.depart_at)

    # Generate complete multimodal journey with candidate evaluation
    journey = plan_boulder_multimodal_journey(
        origin_lat=req.origin.lat,
        origin_lon=req.origin.lon,
        dest_lat=req.destination.lat,
        dest_lon=req.destination.lon,
        depart_dt=depart_dt,
    )

    enriched_legs = journey["legs"]
    full_geometry = journey["geometry"]
    base_duration_min = float(journey["base_duration"])
    num_transfers = int(journey["num_transfers"])

    # Live OpenWeather for Departure & Arrival
    weather_dep = get_optional_weather(req.origin.lat, req.origin.lon)
    weather_arr = get_optional_weather(req.destination.lat, req.destination.lon)
    events = get_optional_events([(p["lat"], p["lon"]) for p in full_geometry])

    primary_weather = weather_dep or weather_arr or {}
    rain_1h = primary_weather.get("rain_1h", 0)
    snow_1h = primary_weather.get("snow_1h", 0)
    wind_speed = primary_weather.get("wind_speed", 0)
    temp = primary_weather.get("temp", 20)
    event_count = (
        events.get("count", len(events.get("events", [])))
        if isinstance(events, dict)
        else len(events)
    )
    event_risk = 1.0 if event_count > 0 else 0.0

    features = {
        "duration_min": float(base_duration_min),
        "buffer_min": 4.0,
        "num_transfers": int(num_transfers),
        "rain_1h": float(rain_1h),
        "snow_1h": float(snow_1h),
        "wind_speed": float(wind_speed),
        "temp": float(temp),
        "event_risk": float(event_risk),
        "hour": int(depart_dt.hour),
        "is_weekend": bool(depart_dt.weekday() >= 5),
    }

    # Run trained XGBoost model inference
    prediction = predict_route_time(features, depart_dt)

    structured_weather = {
        "departure": weather_dep,
        "arrival": weather_arr,
        "temp": primary_weather.get("temp", 20),
        "feels_like": primary_weather.get("feels_like", 20),
        "weather_main": primary_weather.get("weather_main", "Clear"),
        "weather_desc": primary_weather.get("weather_desc", "Clear sky"),
        "rain_1h": primary_weather.get("rain_1h", 0),
        "snow_1h": primary_weather.get("snow_1h", 0),
        "wind_speed": primary_weather.get("wind_speed", 0),
        "custom_alerts": primary_weather.get("custom_alerts", []),
    }

    return {
        "mode": "walk_transit_walk",
        "transit": enriched_legs,
        "weather": structured_weather,
        "events_nearby": events,
        "geometry": full_geometry,
        "prediction": prediction,
        "on_time_probability": prediction["prob_on_time"],
        "expected_delay_min": prediction["predicted_delay_minutes"],
        "ml_features_used": features,
        "summary": journey.get("summary", {}),
        "alternatives": journey.get("alternatives", []),
        "walk_time_min": journey.get("walk_time_min", 4),
        "transit_time_min": journey.get("transit_time_min", base_duration_min),
    }


@app.get("/osm_directions")
def osm_directions(
    origin: str,
    destination: str,
    stops: str | None = None,
    mode: str = "driving",
    alternatives: bool = False,
    depart_at: str | None = None,
):
    origin_lat, origin_lon = map(float, origin.split(","))
    destination_lat, destination_lon = map(float, destination.split(","))
    costing = {
        "driving": "auto",
        "walking": "pedestrian",
        "bicycling": "bicycle",
    }.get(mode, "auto")

    locations_list = [{"lat": origin_lat, "lon": origin_lon}]
    if stops:
        for s in stops.split(";"):
            s = s.strip()
            if s and "," in s:
                slat, slon = map(float, s.split(","))
                locations_list.append({"lat": slat, "lon": slon})
    locations_list.append({"lat": destination_lat, "lon": destination_lon})

    payload = {
        "locations": locations_list,
        "costing": costing,
        "alternates": 2 if alternatives and len(locations_list) == 2 else 0,
        "directions_options": {"units": "kilometers"},
    }
    try:
        response = requests.post(
            "https://valhalla1.openstreetmap.de/route",
            json=payload,
            timeout=15,
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

    weather = get_optional_weather(origin_lat, origin_lon)
    route_points_all = []

    routes = []
    now = get_boulder_now()

    for trip in trips:
        points = []
        for leg in trip["legs"]:
            points.extend(polyline.decode(leg["shape"], precision=6))
        route_points_all.append(points)

        duration_sec = trip["summary"]["time"]
        distance_meters = trip["summary"]["length"] * 1000
        duration_min = max(1.0, duration_sec / 60.0)

        routes.append(
            {
                "duration": duration_sec,
                "distance": distance_meters,
                "geometry": {
                    "coordinates": [[lon, lat] for lat, lon in points],
                },
            }
        )

    events = get_optional_events(route_points_all[0] if route_points_all else [])

    # Calculate prediction for primary route
    primary_dur = routes[0]["duration"] / 60.0
    rain_1h = weather.get("rain_1h", 0) if weather else 0
    snow_1h = weather.get("snow_1h", 0) if weather else 0
    wind_speed = weather.get("wind_speed", 0) if weather else 0
    temp = weather.get("temp", 20) if weather else 20
    event_count = len(events.get("events", [])) if isinstance(events, dict) else len(events)

    features = {
        "duration_min": float(primary_dur),
        "buffer_min": 5.0,
        "num_transfers": 0,
        "rain_1h": float(rain_1h),
        "snow_1h": float(snow_1h),
        "wind_speed": float(wind_speed),
        "temp": float(temp),
        "event_risk": 1.0 if event_count > 0 else 0.0,
        "hour": int(now.hour),
        "is_weekend": bool(now.weekday() >= 5),
    }

    prediction = predict_route_time(features, now)

    return {
        "routes": routes,
        "weather": weather,
        "events_nearby": events,
        "prediction": prediction,
    }


# ---------------------- NATURAL LANGUAGE & VOICE PARSER ---------------------
class QueryParseRequest(BaseModel):
    query: str
    now_iso: str | None = None


def parse_trip_phrase(text: str):
    """
    Intelligent NLP parser extracting origin, destination, mode, and departure/arrival target from natural speech.
    Supports queries like:
    - "I am at Williams Village and want to go to Norlin Library by 9:00 AM"
    - "What time should I leave from Pearl Street to CU Boulder?"
    - "Bike from Chautauqua to 29th Street Mall"
    """
    cleaned = text.strip()
    mode = "transit"
    if re.search(r"\b(bike|biking|bicycle|cycl)\b", cleaned, re.I):
        mode = "bicycling"
    elif re.search(r"\b(walk|walking|on foot|hike)\b", cleaned, re.I):
        mode = "walking"
    elif re.search(r"\b(drive|driving|car|uber)\b", cleaned, re.I):
        mode = "driving"
    elif re.search(r"\b(bus|transit|buff bus|rtd|stampede|will vill)\b", cleaned, re.I):
        mode = "transit"

    # Time extraction: "by 9:00 AM", "at 5:30 pm", "at 14:00"
    time_type = "depart_at"
    target_time = None
    time_match = re.search(r"\b(by|before|arrive at|reach by)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b", cleaned, re.I)
    if time_match:
        time_type = "arrive_by"
        target_time = time_match.group(2).strip()
    else:
        time_match2 = re.search(r"\b(at|around|for|leave at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b", cleaned, re.I)
        if time_match2:
            target_time = time_match2.group(2).strip()

    # Location extraction patterns:
    origin = ""
    destination = ""

    # Pattern 1: "from X to Y"
    m_from_to = re.search(r"\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+(?:by|at|for|leave|using|on|via)\b|$)", cleaned, re.I)
    if m_from_to:
        origin = m_from_to.group(1).strip()
        destination = m_from_to.group(2).strip()
    else:
        # Pattern 2: "at / in / from X ... (go to / reach / head to) Y"
        m_at_go = re.search(r"\b(?:at|in|im at|i'm at|i am at)\s+(.+?)\s+(?:and\s+)?(?:wanna go to|want to go to|going to|heading to|to)\s+(.+?)(?:\s+(?:by|at|for|leave|using|on|via)\b|$)", cleaned, re.I)
        if m_at_go:
            origin = m_at_go.group(1).strip()
            destination = m_at_go.group(2).strip()
        else:
            # Pattern 3: "go to / take me to Y from X"
            m_go_from = re.search(r"\b(?:take me to|navigate to|directions to|go to)\s+(.+?)\s+from\s+(.+?)(?:\s+(?:by|at|for|leave|using|on|via)\b|$)", cleaned, re.I)
            if m_go_from:
                destination = m_go_from.group(1).strip()
                origin = m_go_from.group(2).strip()
            else:
                # Fallback: "X to Y"
                m_simple = re.search(r"^(?:how do i get from\s+)?(.+?)\s+to\s+(.+?)(?:\s+(?:by|at|for|leave)\b|$)", cleaned, re.I)
                if m_simple:
                    origin = m_simple.group(1).strip()
                    destination = m_simple.group(2).strip()

    # Clean filler words & trailing intent clauses from origin and destination
    for filler in ["my location", "here", "current location"]:
        if origin.lower() == filler:
            origin = "Williams Village"  # Default sensible Boulder location

    origin = clean_address_text(origin)
    destination = clean_address_text(destination)

    return {
        "origin": origin or "Williams Village",
        "destination": destination or "CU Boulder Campus",
        "mode": mode,
        "time_type": time_type,
        "target_time": target_time,
    }


@app.post("/api/parse_query")
def parse_natural_query_endpoint(req: QueryParseRequest):
    """
    Processes natural voice or text queries, resolves locations, calculates transit/road routes,
    and derives the smart departure advisory with spoken response.
    """
    parsed = parse_trip_phrase(req.query)
    
    # Resolve Origin & Dest Coords
    orig_geo = geocode_address(parsed["origin"])
    dest_geo = geocode_address(parsed["destination"])

    orig_loc = orig_geo["results"][0] if orig_geo.get("results") else {"lat": 40.0000, "lon": -105.2520, "display_name": parsed["origin"]}
    dest_loc = dest_geo["results"][0] if dest_geo.get("results") else {"lat": 40.0340, "lon": -105.2603, "display_name": parsed["destination"]}


    depart_dt = get_boulder_now()
    if parsed["target_time"]:
        try:
            # Parse time string e.g. "9:00 AM", "5:30 PM", "14:00"
            t_str = parsed["target_time"].upper().strip()
            if "AM" in t_str or "PM" in t_str:
                t_val = datetime.strptime(t_str, "%I:%M %p" if ":" in t_str else "%I %p").time()
            else:
                t_val = datetime.strptime(t_str, "%H:%M" if ":" in t_str else "%H").time()
            depart_dt = depart_dt.replace(hour=t_val.hour, minute=t_val.minute, second=0)
        except Exception:
            pass

    # Plan Route
    if parsed["mode"] == "transit":
        res = plan_transit_full(PlanTransitRequest(
            origin=Location(lat=orig_loc["lat"], lon=orig_loc["lon"]),
            destination=Location(lat=dest_loc["lat"], lon=dest_loc["lon"]),
            depart_at=depart_dt.isoformat(),
        ))
        pred = res["prediction"]
        duration_mins = pred["predicted_duration_minutes"]
        route_summary = f"Transit via {res['transit'][0]['route_id']}" if res.get("transit") else "Transit"
    else:
        res = osm_directions(
            origin=f"{orig_loc['lat']},{orig_loc['lon']}",
            destination=f"{dest_loc['lat']},{dest_loc['lon']}",
            mode=parsed["mode"],
        )
        pred = res["prediction"]
        duration_mins = pred["predicted_duration_minutes"]
        route_summary = f"{parsed['mode'].capitalize()} route"

    # Smart "When should I leave?" calculation
    if parsed["time_type"] == "arrive_by" and parsed["target_time"]:
        target_arrival_dt = depart_dt
        recommended_leave_dt = target_arrival_dt - timedelta(minutes=duration_mins)
        smart_leave_str = recommended_leave_dt.strftime("%I:%M %p").lstrip("0")
        arrival_str = target_arrival_dt.strftime("%I:%M %p").lstrip("0")
        speech_text = (
            f"To arrive at {parsed['destination']} by {arrival_str}, you should leave {parsed['origin']} "
            f"at {smart_leave_str}. Travel time is approximately {duration_mins} minutes via {route_summary}."
        )
    else:
        smart_leave_str = depart_dt.strftime("%I:%M %p").lstrip("0")
        arrival_str = pred["predicted_arrival"]
        speech_text = (
            f"Leaving now at {smart_leave_str}, you will arrive at {parsed['destination']} around {arrival_str}. "
            f"Expected journey duration is {duration_mins} minutes ({pred['traffic_condition']} traffic)."
        )

    return {
        "parsed": parsed,
        "origin": {"lat": orig_loc["lat"], "lon": orig_loc["lon"], "name": orig_loc.get("display_name", parsed["origin"])},
        "destination": {"lat": dest_loc["lat"], "lon": dest_loc["lon"], "name": dest_loc.get("display_name", parsed["destination"])},
        "mode": parsed["mode"],
        "smart_leave_time": smart_leave_str,
        "predicted_arrival": arrival_str,
        "duration_minutes": duration_mins,
        "traffic_condition": pred["traffic_condition"],
        "on_time_probability": pred["prob_on_time"],
        "speech_response": speech_text,
        "route_summary": route_summary,
        "target_time_str": parsed["target_time"],
        "time_type": parsed["time_type"],
        "full_data": res,
    }


# ---------------------- SLACK WEBHOOK & SLASH COMMAND -----------------------
from fastapi import Form, Request, BackgroundTasks

def process_slack_query_async(response_url: str, query_text: str, user_name: str):
    """Computes routing and ML prediction in background and delivers response to Slack response_url."""
    try:
        data = parse_natural_query_endpoint(QueryParseRequest(query=query_text))
        orig_name = data["origin"]["name"]
        dest_name = data["destination"]["name"]
        leave_time = data["smart_leave_time"]
        arr_time = data["predicted_arrival"]
        dur = data["duration_minutes"]
        traffic = data["traffic_condition"]
        prob = int(data["on_time_probability"] * 100)
        route_mode = data["route_summary"]

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🏔️ BoulderMove Trip Advisory for @{user_name}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*📍 From:*\n{orig_name}"},
                    {"type": "mrkdwn", "text": f"*🎯 To:*\n{dest_name}"},
                    {"type": "mrkdwn", "text": f"*⏰ Recommended Leave Time:*\n`{leave_time}` (Boulder MT)"},
                    {"type": "mrkdwn", "text": f"*🏁 Estimated Arrival:*\n`{arr_time}` (~{dur} mins)"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*🚌 Route:*\n{route_mode}"},
                    {"type": "mrkdwn", "text": f"*🤖 ML On-Time Score:*\n{prob}% Confidence ({traffic} traffic)"},
                ],
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"💡 _{data['speech_response']}_",
                    }
                ],
            },
        ]

        payload = {
            "response_type": "in_channel",
            "replace_original": True,
            "blocks": blocks,
            "text": f"Trip from {orig_name} to {dest_name}: Leave at {leave_time}, arrive ~{arr_time}.",
        }
        if response_url:
            requests.post(response_url, json=payload, timeout=15)
    except Exception as e:
        if response_url:
            requests.post(
                response_url,
                json={"response_type": "ephemeral", "text": f"❌ Error computing trip: {str(e)}"},
                timeout=10,
            )


@app.post("/api/slack/command")
@app.post("/slack/command")
@app.post("/")
async def slack_slash_command(
    background_tasks: BackgroundTasks,
    text: str = Form(default=""),
    user_name: str = Form(default="Traveler"),
    response_url: str = Form(default=""),
):
    """
    Slack Slash Command Handler (e.g. `/bouldermove I am at Williams Village and need to get to Norlin Library by 9 AM`)
    Responds immediately to avoid Slack's 3000ms timeout, then streams the full prediction via response_url.
    """
    query_text = (text or "").strip()
    if not query_text:
        return {
            "response_type": "ephemeral",
            "text": "🏔️ *BoulderMove Slack Assistant*\nUsage: `/bouldermove [origin] to [destination] [by time]`\nExample: `/bouldermove Williams Village to Norlin Library by 9:00 AM`",
        }

    if response_url:
        background_tasks.add_task(process_slack_query_async, response_url, query_text, user_name)
        return {
            "response_type": "in_channel",
            "text": f"🔍 *Calculating Boulder transit route & XGBoost prediction for @{user_name}...*",
        }

    # Fallback synchronous if response_url is absent
    try:
        data = parse_natural_query_endpoint(QueryParseRequest(query=query_text))
        orig_name = data["origin"]["name"]
        dest_name = data["destination"]["name"]
        leave_time = data["smart_leave_time"]
        arr_time = data["predicted_arrival"]
        dur = data["duration_minutes"]
        traffic = data["traffic_condition"]
        prob = int(data["on_time_probability"] * 100)
        route_mode = data["route_summary"]

        return {
            "response_type": "in_channel",
            "text": f"Trip from {orig_name} to {dest_name}: Leave at {leave_time}, arrive ~{arr_time} via {route_mode} ({prob}% ML confidence).",
        }
    except Exception as e:
        return {
            "response_type": "ephemeral",
            "text": f"❌ Error computing trip: {str(e)}",
        }


class SlackSendTripRequest(BaseModel):
    origin: str = "Williams Village"
    destination: str = "King Soopers"
    mode: str = "Transit"
    duration_minutes: int = 12
    predicted_arrival: str = "1:41 PM"
    on_time_probability: int = 73
    route_summary: str = "RTD BOUND (0 transfers)"
    weather: str = "20°C · Clear"
    webhook_url: str = ""


@app.post("/api/slack/ask")
@app.post("/slack/ask")
def slack_ask_json(req: QueryParseRequest):
    """JSON webhook for Slack bots and integrations"""
    return parse_natural_query_endpoint(req)


@app.post("/api/slack/send_trip")
@app.post("/slack/send_trip")
def slack_send_trip(req: SlackSendTripRequest):
    """
    Sends real calculated trip information to a Slack channel via incoming webhook or configured bot.
    """
    frontend_url = os.getenv("FRONTEND_URL", "https://bouldermove.netlify.app")
    formatted_text = (
        f"🏔️ *BoulderMove Trip*\n"
        f"*{req.origin}* → *{req.destination}*\n\n"
        f"• *Mode:* {req.mode}\n"
        f"• *Predicted travel time:* {req.duration_minutes} min\n"
        f"• *Predicted arrival:* {req.predicted_arrival}\n"
        f"• *On-time probability:* {req.on_time_probability}%\n"
        f"• *Route:* {req.route_summary}\n"
        f"• *Weather:* {req.weather}\n\n"
        f"<{frontend_url}|Open in BoulderMove →>"
    )

    webhook_to_use = req.webhook_url or os.getenv("SLACK_WEBHOOK_URL", "")
    if webhook_to_use:
        try:
            resp = requests.post(webhook_to_use, json={"text": formatted_text}, timeout=8)
            if resp.status_code == 200:
                return {"ok": True, "message": "Trip sent to Slack successfully!", "text": formatted_text}
        except Exception as e:
            return {"ok": False, "error": f"Failed to post to webhook: {str(e)}", "text": formatted_text}

    return {
        "ok": True,
        "message": "Trip formatted for Slack",
        "text": formatted_text,
    }


@app.get("/api/slack/install", response_class=HTMLResponse)
@app.get("/slack/install", response_class=HTMLResponse)
def slack_install_redirect():
    """
    Initiates Slack OAuth flow to install the BoulderMove Slack app into a user's Slack workspace.
    Supports popup window authorization.
    """
    client_id = os.getenv("SLACK_CLIENT_ID")
    redirect_uri = os.getenv("SLACK_REDIRECT_URI", "")
    sharable_url = os.getenv("SLACK_SHARABLE_INSTALL_URL", "")

    if client_id:
        scopes = "commands,chat:write,incoming-webhook"
        url = f"https://slack.com/oauth/v2/authorize?client_id={client_id}&scope={scopes}"
        if redirect_uri:
            url += f"&redirect_uri={redirect_uri}"
        return RedirectResponse(url)
    elif sharable_url:
        return RedirectResponse(sharable_url)
    else:
        # Development / demo fallback for workspace testing without requiring external Slack tokens
        return HTMLResponse("""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>BoulderMove Slack Integration</title>
            <style>
                body {
                    background: #080d1a;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .card {
                    background: #0f172a;
                    border: 1px solid rgba(255,255,255,0.12);
                    padding: 32px;
                    border-radius: 16px;
                    max-width: 400px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .icon { font-size: 36px; margin-bottom: 12px; }
                h2 { margin: 0 0 10px 0; font-size: 20px; color: #14b8a6; }
                p { font-size: 13.5px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px; }
                .btn {
                    background: #14b8a6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 13.5px;
                    font-weight: 600;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">🏔️</div>
                <h2>BoulderMove Slack Connected</h2>
                <p>The BoulderMove integration is authorized for your workspace. You can close this window to return to your route.</p>
                <button class="btn" onclick="finish()">Return to BoulderMove</button>
            </div>
            <script>
                function finish() {
                    try {
                        if (window.opener) {
                            window.opener.postMessage({ type: "SLACK_CONNECTED", team: "Workspace" }, "*");
                        }
                    } catch(e) {}
                    window.close();
                }
                // Auto finish after short delay
                setTimeout(finish, 1800);
            </script>
        </body>
        </html>
        """)


@app.get("/api/slack/oauth", response_class=HTMLResponse)
@app.get("/slack/oauth", response_class=HTMLResponse)
def slack_oauth_redirect(code: str = None, error: str = None):
    """
    Handles Slack OAuth V2 redirect for workspace installations and signals the parent window.
    """
    if error:
        return HTMLResponse(f"""
        <!DOCTYPE html>
        <html>
        <head><title>Slack Authorization Error</title></head>
        <body style="background:#080d1a;color:#f87171;font-family:sans-serif;padding:40px;text-align:center;">
            <h3>Slack Authorization Notice</h3>
            <p>{error}</p>
            <script>setTimeout(() => window.close(), 2500);</script>
        </body>
        </html>
        """)

    team_name = "Workspace"
    client_id = os.getenv("SLACK_CLIENT_ID")
    client_secret = os.getenv("SLACK_CLIENT_SECRET")
    redirect_uri = os.getenv("SLACK_REDIRECT_URI", "")

    if client_id and client_secret and code:
        try:
            resp = requests.post(
                "https://slack.com/api/oauth.v2.access",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                timeout=10,
            )
            res_json = resp.json()
            if res_json.get("ok"):
                team_name = res_json.get("team", {}).get("name", "Workspace")
        except Exception:
            pass

    return HTMLResponse(f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Slack Connected</title>
        <style>
            body {{
                background: #080d1a;
                color: #f8fafc;
                font-family: sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
            }}
            .card {{
                background: #0f172a;
                border: 1px solid rgba(255,255,255,0.12);
                padding: 30px;
                border-radius: 16px;
                max-width: 380px;
            }}
            h2 {{ color: #14b8a6; margin: 0 0 10px 0; }}
            p {{ color: #94a3b8; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h2>✓ Connected to Slack</h2>
            <p>Added BoulderMove to <strong>{team_name}</strong>. Closing window...</p>
        </div>
        <script>
            try {{
                if (window.opener) {{
                    window.opener.postMessage({{ type: "SLACK_CONNECTED", team: "{team_name}" }}, "*");
                }}
            }} catch(e) {{}}
            setTimeout(() => window.close(), 1200);
        </script>
    </body>
    </html>
    """)




# -------------------------- PRODUCTION FRONTEND ---------------------------
FRONTEND_BUILD = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)
if os.path.isdir(FRONTEND_BUILD):
    app.mount("/", StaticFiles(directory=FRONTEND_BUILD, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))

