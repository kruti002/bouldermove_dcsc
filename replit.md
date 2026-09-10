# BoulderMove on Replit

## Run

The `Start application` workflow runs both services:

- React frontend on port 5000
- FastAPI backend on port 8080

The frontend proxies API calls to the backend. Maps use React Leaflet with
OpenStreetMap tiles, Nominatim location search, and Valhalla non-transit routing.
No Google Maps API key is required.

## Optional service keys

- `OPENWEATHER_API_KEY` enables weather details for transit routes.
- `TICKETMASTER_API_KEY` enables nearby event alerts.

Transit routing uses the bundled GTFS data, RAPTOR engine, and OSMnx walking
graph.