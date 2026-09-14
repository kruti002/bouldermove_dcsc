import React, { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Maximize2, Plus, Minus } from "lucide-react";

// -------------------------------------------------------------
// LEAFLET CUSTOM PIN ICONS
// -------------------------------------------------------------
const createCustomIcon = (color, text) => {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 800;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">${text || ""}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const originIcon = createCustomIcon("#0d9488", "A");
const destIcon = createCustomIcon("#d97706", "B");

const userLocationIcon = L.divIcon({
  className: "custom-user-marker",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#38bdf8;border:3px solid white;box-shadow:0 0 10px rgba(56,189,248,0.8);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const stopDotIcon = L.divIcon({
  className: "custom-stop-marker",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const parkingIcon = L.divIcon({
  className: "custom-parking-marker",
  html: `<div style="width:24px;height:24px;border-radius:6px;background:#0284c7;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:12px;">P</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const DEFAULT_BOULDER_CENTER = [40.0150, -105.2705];

function MapController({ coordinates, originCoord, destCoord, userCoord, fitTrigger }) {
  const map = useMap();

  useEffect(() => {
    const points = [];
    if (coordinates && coordinates.length > 0) {
      coordinates.forEach((c) => points.push([c.lat, c.lng]));
    }
    if (originCoord) points.push([originCoord.lat, originCoord.lng]);
    if (destCoord) points.push([destCoord.lat, destCoord.lng]);

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else {
      map.setView(DEFAULT_BOULDER_CENTER, 13);
    }
  }, [map, coordinates, originCoord, destCoord, fitTrigger]);

  return null;
}

export default function MapView({
  originCoord,
  destCoord,
  userCoord,
  originName,
  destinationName,
  routeGeometry,
  alternativeGeometries = [],
  transitLegs = [],
  parkingLocations = [],
  showParking = false,
  isDarkTheme = true,
  onUseMyLocation,
}) {
  const mapRef = useRef(null);
  const [fitTrigger, setFitTrigger] = React.useState(0);

  // Convert geometry coordinates to Leaflet lat/lng
  const activePolyline = (routeGeometry || []).map((pt) => ({
    lat: pt.lat !== undefined ? pt.lat : pt[1],
    lng: pt.lon !== undefined ? pt.lon : pt[0],
  }));

  // High-detail, watermark-free OpenStreetMap tiles supporting up to zoom level 19
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleFitRoute = () => {
    setFitTrigger((prev) => prev + 1);
  };

  return (
    <div className="map-view-wrapper">
      {/* Interactive Map Overlay Controls */}
      <div className="map-floating-controls">
        <div className="map-control-group">
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
        </div>

        <div className="map-control-group">
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={handleFitRoute}
            title="Fit Route to Bounds"
            aria-label="Fit route to bounds"
          >
            <Maximize2 size={15} />
          </button>
          {onUseMyLocation && (
            <button
              type="button"
              className="map-ctrl-btn"
              onClick={onUseMyLocation}
              title="My GPS Location"
              aria-label="Use my current location"
            >
              <Crosshair size={15} />
            </button>
          )}
        </div>
      </div>

      <MapContainer
        ref={mapRef}
        center={DEFAULT_BOULDER_CENTER}
        zoom={13}
        minZoom={10}
        maxZoom={19}
        zoomControl={false}
        scrollWheelZoom={true}
        className="leaflet-map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
          maxZoom={19}
          minZoom={10}
        />

        <MapController
          coordinates={activePolyline}
          originCoord={originCoord}
          destCoord={destCoord}
          userCoord={userCoord}
          fitTrigger={fitTrigger}
        />

        {/* Alternative Routes (Subdued / Greyed out) */}
        {alternativeGeometries.map((altGeo, idx) => {
          const altPts = (altGeo || []).map((pt) => [
            pt.lat !== undefined ? pt.lat : pt[1],
            pt.lon !== undefined ? pt.lon : pt[0],
          ]);
          if (altPts.length < 2) return null;
          return (
            <Polyline
              key={`alt-${idx}`}
              positions={altPts}
              color="#94a3b8"
              weight={4}
              opacity={0.55}
              dashArray="5, 8"
            />
          );
        })}

        {/* Primary Selected Route Polyline */}
        {activePolyline.length > 1 && (
          <Polyline
            positions={activePolyline.map((p) => [p.lat, p.lng])}
            color="#0d9488"
            weight={6}
            opacity={0.92}
          />
        )}

        {/* User GPS Location Marker */}
        {userCoord && (
          <Marker position={[userCoord.lat, userCoord.lng]} icon={userLocationIcon}>
            <Popup>Your current location</Popup>
          </Marker>
        )}

        {/* Origin Marker */}
        {originCoord && (
          <Marker position={[originCoord.lat, originCoord.lng]} icon={originIcon}>
            <Popup>
              <strong>Start (A):</strong> {originName || "Origin"}
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {destCoord && (
          <Marker position={[destCoord.lat, destCoord.lng]} icon={destIcon}>
            <Popup>
              <strong>Destination (B):</strong> {destinationName || "Destination"}
            </Popup>
          </Marker>
        )}

        {/* Intermediate Transit Stops Markers */}
        {transitLegs.map((leg, lIdx) => {
          if (!leg.intermediate_stops_details) return null;
          return leg.intermediate_stops_details.map((st, sIdx) => {
            if (!st.lat || !st.lon) return null;
            return (
              <Marker
                key={`stop-${lIdx}-${sIdx}`}
                position={[st.lat, st.lon]}
                icon={stopDotIcon}
              >
                <Tooltip direction="top" offset={[0, -5]}>
                  <span>{st.stop_name}</span>
                </Tooltip>
              </Marker>
            );
          });
        })}

        {/* Parking Locations in Drive Mode */}
        {showParking &&
          parkingLocations.map((pkg, pIdx) => {
            if (!pkg.lat || !pkg.lon) return null;
            return (
              <Marker
                key={`parking-${pIdx}`}
                position={[pkg.lat, pkg.lon]}
                icon={parkingIcon}
              >
                <Popup>
                  <strong>{pkg.name || "Nearby Parking"}</strong>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    {pkg.desc || "Parking option near destination"}
                  </p>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
