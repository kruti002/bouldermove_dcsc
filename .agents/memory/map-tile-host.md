---
name: Map tile host
description: Environment-specific Leaflet tile-host behavior for BoulderMove.
---

The default tile.openstreetmap.org endpoint may return an access-policy block in this Replit preview environment even though Leaflet and the app are healthy. A compatible OpenStreetMap tile mirror is needed for the live preview.

**Why:** The map appeared as a blank surface while the application and Leaflet loaded without browser errors; the tile endpoint response identified the provider-side block.

**How to apply:** If the map goes blank without a React or Leaflet error, check the tile request before changing layout code. Keep attribution accurate when changing an OSM tile host.