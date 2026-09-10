# events_service.py
import os
import requests
from geopy.distance import distance
from polyline import decode
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

TICKETMASTER_API_KEY = os.getenv("TICKETMASTER_API_KEY")
CU_EVENTS_URL = "https://calendar.colorado.edu/api/2/events"

# -----------------------------------------------------------
# 1. Ticketmaster: Fetch events near route midpoint
# -----------------------------------------------------------
def fetch_ticketmaster_along_route(polyline_points, radius_km=20):
    if not polyline_points or not TICKETMASTER_API_KEY:
        print("Ticketmaster: No points or missing API key")
        return []

    # Use midpoint of route
    lats = [p[0] for p in polyline_points]
    lons = [p[1] for p in polyline_points]
    center_lat = (min(lats) + max(lats)) / 2
    center_lon = (min(lons) + max(lons)) / 2

    url = "https://app.ticketmaster.com/discovery/v2/events.json"
    params = {
        "apikey": TICKETMASTER_API_KEY,
        "size": 100,
        "radius": radius_km,
        "unit": "km",
        "latlong": f"{center_lat},{center_lon}",
        "sort": "date,asc"
    }

    try:
        r = requests.get(url, params=params, timeout=5)
        r.raise_for_status()
        data = r.json()
        events_raw = data.get("_embedded", {}).get("events", [])
        events = []

        for e in events_raw:
            venues = e.get("_embedded", {}).get("venues", [])
            if not venues:
                continue

            venue = venues[0]
            loc = venue.get("location", {})
            lat = float(loc.get("latitude", 0))
            lon = float(loc.get("longitude", 0))

            capacity = venue.get("capacity")
            if capacity is not None:
                try:
                    capacity = int(capacity)
                    if capacity < 100:
                        continue
                except:
                    pass

            events.append({
                "id": f"tm_{e.get('id')}",
                "name": e.get("name"),
                "venue_name": venue.get("name"),
                "capacity": capacity,
                "description": e.get("info") or "",
                "date_time": e.get("dates", {}).get("start", {}).get("dateTime"),
                "url": e.get("url"),
                "lat": lat,
                "lon": lon,
                "source": "ticketmaster",
            })

        print(f"Ticketmaster: Found {len(events)} events")
        return events

    except Exception as ex:
        print("Ticketmaster fetch error:", ex)
        return []

# -----------------------------------------------------------
# 2. CU Boulder Calendar
# -----------------------------------------------------------
def fetch_cu():
    try:
        r = requests.get(CU_EVENTS_URL, params={"days": 14}, timeout=5)
        data = r.json()
        events = []

        for e in data.get("events", []):
            if not isinstance(e, dict):
                continue
            ev = e.get("event", {})
            if not isinstance(ev, dict):
                continue
            loc = ev.get("location", {})
            venue_name = "CU Boulder"
            lat = 0.0
            lon = 0.0
            if isinstance(loc, dict):
                venue_name = loc.get("name", "CU Boulder")
                try:
                    lat = float(loc.get("latitude") or 0)
                    lon = float(loc.get("longitude") or 0)
                except (ValueError, TypeError):
                    pass
            elif isinstance(loc, str) and loc:
                venue_name = loc

            events.append({
                "id": f"cu_{ev.get('id', '')}",
                "name": ev.get("title"),
                "venue_name": venue_name,
                "description": ev.get("description", ""),
                "date_time": ev.get("localist_start_time"),
                "url": ev.get("url"),
                "lat": lat,
                "lon": lon,
                "capacity": None,
                "source": "cu_calendar",
            })
        return events
    except Exception as ex:
        print("CU fetch error:", ex)
        return []


# -----------------------------------------------------------
# 3. Match events along route using geodesic distance
# -----------------------------------------------------------
def events_near_route(polyline_points, max_dist_m=1500):
    """Return events near route within max_dist_m (meters)."""
    if not polyline_points:
        return {"count": 0, "events": []}

    all_events = fetch_ticketmaster_along_route(polyline_points)
    all_events.extend(fetch_cu())

    if not all_events:
        return {"count": 0, "events": []}

    # Sample polyline to avoid excessive geodesic computations
    step = max(1, len(polyline_points) // 40)
    sampled_points = polyline_points[::step]
    if polyline_points[-1] not in sampled_points:
        sampled_points.append(polyline_points[-1])

    final_events = []
    for ev in all_events:
        if ev["lat"] == 0 or ev["lon"] == 0:
            continue
        pt_event = (ev["lat"], ev["lon"])
        try:
            for pt_route in sampled_points:
                pt_poly = (pt_route[0], pt_route[1])
                d_m = distance(pt_event, pt_poly).meters
                if d_m <= max_dist_m:
                    ev["distance_from_route_m"] = round(d_m, 1)
                    final_events.append(ev)
                    break
        except Exception:
            continue

    print(f"[DEBUG] Found {len(final_events)} events along route")


    return {
        "count": len(final_events),
        "events": [
            {
                "name": ev["name"],
                "venue_name": ev["venue_name"],
                "date_time": ev["date_time"],
                "url": ev["url"],
                "source": ev["source"],
                "distance_from_route_m": ev.get("distance_from_route_m"),
            }
            for ev in final_events
        ],
    }
