import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import polyline from "@mapbox/polyline";
import "./App.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
 
async function scoreRouteML(routeFeatures, signal) {
  try {
    const res = await fetch(
      "https://bouldermove-ml-499631536778.us-central1.run.app/score_route",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(routeFeatures),
        signal,
      }
    );

    if (!res.ok) throw new Error("ML scoring failed");

    return await res.json();
  } catch (err) {
    console.error("ML error:", err);
    return { prob_on_time: null, expected_delay_min: null };
  }
}
export function buildMLFeatures(route, weather) {
  const nearbyEventCount = Array.isArray(route.events_nearby)
    ? route.events_nearby.length
    : route.events_nearby?.count ?? route.events_nearby?.events?.length ?? 0;

  return {
    duration_min: route.duration_min ?? 0,
    buffer_min: 5, // constant buffer for now, or make UI-input later
    num_transfers: 0, // non-transit routes have no transfers
    rain_1h: weather?.rain_1h ?? 0,
    snow_1h: weather?.snow_1h ?? 0,
    wind_speed: weather?.wind_speed ?? 0,
    temp: weather?.temp ?? 0,
    event_risk: nearbyEventCount > 0 ? 1.0 : 0.0,
    hour: new Date().getHours(),
    is_weekend: [0,6].includes(new Date().getDay()),
  };
}

export function buildOsmRoutes(data, mode, originCoords, destinationCoords) {
  return (data.routes || []).map((route) => ({
    summary: `${mode} route`,
    duration_min: Math.round(route.duration / 60),
    distance_km: Number((route.distance / 1000).toFixed(1)),
    polylineCoords: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    start_location: { lat: originCoords.lat, lng: originCoords.lon },
    end_location: { lat: destinationCoords.lat, lng: destinationCoords.lon },
    weather: data.weather || null,
    alerts: { custom_alerts: data.weather?.custom_alerts || [] },
    events_nearby: data.events_nearby || [],
    on_time_probability: null,
    on_time: null,
  }));
}

export function buildTransitRoute(data, body) {
  return {
    summary:
      data.transit?.length > 0
        ? `Transit via ${data.transit[0].route_id || data.transit[0].trip_id}`
        : "Walk -> Transit -> Walk",
    duration_min: null,
    distance_km: null,
    polylineCoords: (data.geometry || []).map((point) => ({
      lat: point.lat,
      lng: point.lon,
    })),
    start_location: { lat: body.origin.lat, lng: body.origin.lon },
    end_location: { lat: body.destination.lat, lng: body.destination.lon },
    stops: data.transit?.flatMap((leg) => leg.intermediate_stops || []) || [],
    weather: data.weather || null,
    alerts: { custom_alerts: data.weather?.custom_alerts || [] },
    events_nearby: data.events_nearby || [],
    transit_raw: data,
    on_time_probability: data.on_time_probability,
    on_time: data.on_time,
  };
}

/* ---------------- MAP STYLE ---------------- */
const mapContainerStyle = {
  position: "relative",
  width: "100%",
  height: "520px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.20)",
  overflow: "hidden",
};

function FitRouteBounds({ paths }) {
  const map = useMap();

  useEffect(() => {
    const points = paths.flat();
    if (points.length > 0) {
      map.fitBounds(points.map((point) => [point.lat, point.lng]), {
        padding: [24, 24],
      });
    }
  }, [map, paths]);

  return null;
}

function LocationInput({ value, onChange, onSelect, placeholder, style }) {
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState("");

  const search = async () => {
    if (!value.trim()) {
      setResults([]);
      setSearchError(`Enter a ${placeholder.toLowerCase()} to search.`);
      onSelect(null);
      return;
    }

    setSearchError("");
    const params = new URLSearchParams({
      q: value,
      format: "jsonv2",
      limit: "5",
      countrycodes: "us",
    });
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );
      if (!response.ok) throw new Error("Location search failed");

      const data = await response.json();
      const validResults = Array.isArray(data)
        ? data.filter(
            (result) =>
              Number.isFinite(Number(result.lat)) &&
              Number.isFinite(Number(result.lon))
          )
        : [];

      setResults(validResults);
      onSelect(null);
      if (validResults.length === 0) {
        setSearchError(
          `No usable ${placeholder.toLowerCase()} found. Check the place name and try again.`
        );
      }
    } catch (error) {
      console.error("Location search failed:", error);
      setResults([]);
      onSelect(null);
      setSearchError(
        `Couldn't search for this ${placeholder.toLowerCase()}. Check your connection and try again.`
      );
    }
  };

  return (
    <div className="location-search">
      <div className="location-search-row">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onSelect(null);
            setResults([]);
            setSearchError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") search();
          }}
          placeholder={placeholder}
          style={style}
        />
        <button type="button" onClick={search}>
          Find
        </button>
      </div>
      {searchError && (
        <div role="alert" className="location-search-error">
          {searchError}
        </div>
      )}
      {results.length > 0 && (
        <div className="location-results">
          {results.map((result) => (
            <button
              type="button"
              key={result.place_id}
              onClick={() => {
                onChange(result.display_name);
                onSelect({
                  lat: Number(result.lat),
                  lon: Number(result.lon),
                });
                setResults([]);
                setSearchError("");
              }}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------- Shared Layout Styles (dark-mode aware) -------- */
const topBarStyle = (darkMode) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 24px",
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
  borderBottom: darkMode ? "1px solid #374151" : "1px solid #e2e2e7",
});

const mainLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "320px 1.5fr 1fr",
  gap: "16px",
  padding: "16px 24px",
};

const leftPanelStyle = (darkMode) => ({
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
  borderRadius: "12px",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
});

const centerPanelStyle = (darkMode) => ({
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
  borderRadius: "12px",
  padding: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
});

const rightPanelStyle = (darkMode) => ({
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
  borderRadius: "12px",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxHeight: "600px",
  overflowY: "auto",
});

const bottomStripStyle = (darkMode) => ({
  marginTop: "8px",
  padding: "8px 24px 18px",
  fontSize: "14px",
  color: darkMode ? "#d1d5db" : "#555",
});

/* Chip buttons */
const chipStyle = (darkMode) => ({
  fontSize: "12px",
  padding: "4px 10px",
  borderRadius: "999px",
  border: darkMode ? "1px solid #4b5563" : "1px solid #ddd",
  background: darkMode ? "#1f2937" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
  cursor: "pointer",
});

/* Input styles */
const inputStyle = (darkMode) => ({
  padding: "10px",
  borderRadius: "8px",
  border: darkMode ? "1px solid #4b5563" : "1px solid #ccc",
  fontSize: "14px",
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
});

const inputStyleLarge = (darkMode) => ({
  flex: 2,
  padding: "12px",
  borderRadius: "8px",
  border: darkMode ? "1px solid #4b5563" : "1px solid #ccc",
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
});

const selectStyle = (darkMode) => ({
  padding: "10px",
  borderRadius: "8px",
  border: darkMode ? "1px solid #4b5563" : "1px solid #ccc",
  minWidth: "150px",
  fontSize: "14px",
  background: darkMode ? "#111827" : "white",
  color: darkMode ? "#e5e7eb" : "#111827",
});

/* ---------------- MAIN COMPONENT ---------------- */
export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [landingFadeOut, setLandingFadeOut] = useState(false);

  const hideLanding = () => {
    setLandingFadeOut(true);
    setTimeout(() => setShowLanding(false), 600);
  };

  useEffect(() => {
    const t = setTimeout(hideLanding, 2800);
    return () => clearTimeout(t);
  }, []);

  const [origin, setOrigin] = useState("norlin library");
  const [destination, setDestination] = useState("Denver, CO");
  const [stops, setStops] = useState("");
  const [mode, setMode] = useState("driving");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeStatus, setRouteStatus] = useState({ type: "idle", message: "" });
  const routeRequestRef = useRef({ id: 0, controller: null });

  const beginRouteRequest = useCallback(() => {
    routeRequestRef.current.controller?.abort();
    const request = {
      id: routeRequestRef.current.id + 1,
      controller: new AbortController(),
    };
    routeRequestRef.current = request;
    return request;
  }, []);

  const isLatestRouteRequest = useCallback(
    (request) => routeRequestRef.current.id === request.id,
    []
  );

  const clearOldRoute = () => {
    setRoutes([]);
    setRouteStatus({ type: "idle", message: "" });
  };

  /* ---------------- OPENSTREETMAP ROUTING (NON-TRANSIT) ---------------- */
const fetchOsmRoute = useCallback(async () => {
  if (!originCoords || !destinationCoords) return;
  if (mode === "transit") return; // safety
  const request = beginRouteRequest();

  const params = new URLSearchParams({
    origin: `${originCoords.lat},${originCoords.lon}`,
    destination: `${destinationCoords.lat},${destinationCoords.lon}`,
    mode,
    alternatives: String(showAlternatives),
  });
  const baseUrl = process.env.REACT_APP_COMBINED_ROUTER_URL || "";
  const url = `${baseUrl}/osm_directions?${params.toString()}`;

  setRoutes([]);
  setRouteStatus({ type: "loading", message: "" });

  try {
    const res = await fetch(url, { signal: request.controller.signal });
    const data = await res.json();
    if (!isLatestRouteRequest(request)) return;

    if (!res.ok || data.error?.code === "provider_failure") {
      throw new Error(data.error?.message || "The routing service is temporarily unavailable.");
    }

    if (!data.routes || data.routes.length === 0) {
      console.warn("No routes from OpenStreetMap routing");
      if (!isLatestRouteRequest(request)) return;
      setRoutes([]);
      setRouteStatus({
        type: "no_route",
        message:
          data.error?.message ||
          "No route connects those locations for the selected travel mode.",
      });
      return;
    }

    const mappedRoutes = buildOsmRoutes(
      data,
      mode,
      originCoords,
      destinationCoords
    );

  for (let r of mappedRoutes) {
      const features = buildMLFeatures(r, r.weather);
      const ml = await scoreRouteML(features, request.controller.signal);
      if (!isLatestRouteRequest(request)) return;

      r.on_time_probability = ml.prob_on_time;
      r.expected_delay_min = ml.expected_delay_min;
}
    if (!isLatestRouteRequest(request)) return;
    setRoutes(mappedRoutes);
    setRouteStatus({ type: "success", message: "" });
  } catch (err) {
    if (!isLatestRouteRequest(request)) return;
    console.error("OpenStreetMap route fetch failed:", err);
    setRoutes([]);
    setRouteStatus({
      type: "provider_failure",
      message: err.message || "The routing service is temporarily unavailable.",
    });
  }
}, [
  originCoords,
  destinationCoords,
  mode,
  showAlternatives,
  beginRouteRequest,
  isLatestRouteRequest,
]);
             
  /* ---------------- TRANSIT BACKEND REQUEST ---------------- */
  const fetchTransitRoute = useCallback(async () => {
    if (mode !== "transit") return;
    if (!originCoords || !destinationCoords) return;
    const request = beginRouteRequest();

    clearOldRoute();
    setRouteStatus({ type: "loading", message: "" });

    const body = {
      origin: { lat: originCoords.lat, lon: originCoords.lon },
      destination: { lat: destinationCoords.lat, lon: destinationCoords.lon },
      depart_at: new Date().toISOString(),
    };

    const url = `${
      process.env.REACT_APP_COMBINED_ROUTER_URL || ""
    }/plan_transit_full`;

    console.log("DEBUG: ➜ Transit fetch STARTED");
    console.log("DEBUG: URL →", url);
    console.log("DEBUG: Sending →", body);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: request.controller.signal,
      });

      const data = await res.json();
      if (!isLatestRouteRequest(request)) return;

      if (!res.ok || data.error?.code === "provider_failure") {
        throw new Error(
          data.error?.message || "The transit routing service is temporarily unavailable."
        );
      }

      if (data.error) {
        console.log("Backend error:", data.error);
        if (!isLatestRouteRequest(request)) return;
        setRouteStatus({
          type: "no_route",
          message:
            data.error.message ||
            "No transit route connects those locations at this time.",
        });
        return;
      }

      console.log("DEBUG: Response →", data);

      const routeObj = buildTransitRoute(data, body);

      if (!isLatestRouteRequest(request)) return;
      setRoutes([routeObj]);
      setRouteStatus({ type: "success", message: "" });
    } catch (err) {
      if (!isLatestRouteRequest(request)) return;
      console.error("Transit fetch error:", err);
      setRoutes([]);
      setRouteStatus({
        type: "provider_failure",
        message: err.message || "The transit routing service is temporarily unavailable.",
      });
    }
  }, [
    mode,
    originCoords,
    destinationCoords,
    beginRouteRequest,
    isLatestRouteRequest,
  ]);

  /* Auto-run when mode/coords change */
  useEffect(() => {
    if (!originCoords || !destinationCoords) {
      routeRequestRef.current.controller?.abort();
      routeRequestRef.current.id += 1;
      return;
    }

    console.log("DEBUG: mode =", mode);
    console.log("DEBUG: originCoords =", originCoords);
    console.log("DEBUG: destinationCoords =", destinationCoords);

    if (mode === "transit") {
      fetchTransitRoute();
    } else {
      fetchOsmRoute();
    }

    return () => {
      routeRequestRef.current.controller?.abort();
      routeRequestRef.current.id += 1;
    };
  }, [mode, originCoords, destinationCoords, fetchOsmRoute, fetchTransitRoute]);

  const retryRoute = () => {
    if (mode === "transit") {
      fetchTransitRoute();
    } else {
      fetchOsmRoute();
    }
  };

  /* -------- Decode Polylines or use custom coords -------- */
  const decodedRoutes = routes.map((r) => {
    if (r.polylineCoords && r.polylineCoords.length > 0) {
      return r.polylineCoords;
    }
    if (r.polyline) {
      return polyline.decode(r.polyline).map(([lat, lng]) => ({ lat, lng }));
    }
    return [];
  });

  /* -------- Build route markers -------- */
  const buildMarkers = () => {
    if (routes.length === 0) return [];

    const r = routes[0];
    const markers = [];

    if (r.start_location) markers.push({ position: r.start_location });
    if (r.waypoint_locations)
      r.waypoint_locations.forEach((wp) => markers.push({ position: wp }));
    if (r.end_location) markers.push({ position: r.end_location });

    return markers;
  };

  /* ---------------- UI ---------------- */
  return (
    <div
      className={darkMode ? "dark-mode" : "light-mode"}
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: darkMode ? "#020617" : "#f5f5f8",
        color: darkMode ? "#e5e7eb" : "#111827",
      }}
    >
      {/* FULL-SCREEN LANDING OVERLAY */}
      {showLanding && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at top, #fdfbfb 0, #ebedee 40%, #dfe7fd 100%)",
            opacity: landingFadeOut ? 0 : 1,
            transform: landingFadeOut ? "scale(1.02)" : "scale(1)",
            transition: "opacity 600ms ease, transform 600ms ease",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.95)",
              borderRadius: "20px",
              padding: "32px 40px",
              boxShadow: "0 18px 60px rgba(15,23,42,0.18)",
              maxWidth: "540px",
              width: "90%",
              display: "flex",
              gap: 24,
              alignItems: "center",
            }}
          >
            <div style={{ width: 96, height: 96 }}>
              <DotLottieReact
                src="https://lottie.host/5a79cff1-423a-4aa6-824f-954dca862994/ezy8pcAi40.lottie"
                loop
                autoplay
                style={{ width: "96px", height: "96px" }}
              />
            </div>

            <div>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "32px",
                  fontWeight: 700,
                }}
              >
                BoulderMove
              </h1>

              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "15px",
                  color: "#4b5563",
                }}
              >
                Smart, weather-aware trip planning for Boulder and beyond.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  fontSize: "13px",
                  marginBottom: 16,
                  color: "#4b5563",
                }}
              >
                <span>🚌 Transit + 🚶 walking</span>
                <span>☁️ Live weather context</span>
                <span>📊 Route insights</span>
              </div>

              <button
                onClick={hideLanding}
                style={{
                  padding: "10px 18px",
                  borderRadius: "999px",
                  border: "none",
                  background:
                    "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 10px 30px rgba(37,99,235,0.35)",
                }}
              >
                Enter BoulderMove
              </button>

              <div
                style={{
                  marginTop: 8,
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Auto-launching in a few seconds…
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN APP CONTENT */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          filter: showLanding ? "blur(3px)" : "none",
          transition: "filter 400ms ease",
        }}
      >
        {/* TOP BAR */}
        <header style={topBarStyle(darkMode)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40 }}>
              <DotLottieReact
                src="https://lottie.host/5a79cff1-423a-4aa6-824f-954dca862994/ezy8pcAi40.lottie"
                loop
                autoplay
                style={{ width: "40px", height: "40px" }}
              />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              BoulderMove – Smart Trip Dashboard
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: darkMode ? "#ddd" : "#666",
              fontSize: "14px",
            }}
          >
            {/* Dark Mode Toggle Button */}
            <button
              onClick={() => setDarkMode((prev) => !prev)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: darkMode ? "1px solid #4b5563" : "1px solid #ccc",
                background: darkMode ? "#1f2937" : "white",
                color: darkMode ? "white" : "#333",
                cursor: "pointer",
                fontSize: "13px",
                transition: "all 0.3s ease",
              }}
            >
              {darkMode ? "🌞 Light Mode" : "🌙 Dark Mode"}
            </button>

            {/* Date-Time */}
            <span>{new Date().toLocaleString()}</span>
          </div>
        </header>

        {/* MAIN GRID */}
        <main style={mainLayoutStyle}>
          {/* LEFT PANEL – controls */}
          <section style={leftPanelStyle(darkMode)}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Trip setup
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* ORIGIN */}
              <LocationInput
                value={origin}
                onChange={setOrigin}
                onSelect={setOriginCoords}
                placeholder="Origin"
                style={inputStyle(darkMode)}
              />

              {/* STOPS */}
              <input
                value={stops}
                onChange={(e) => setStops(e.target.value)}
                placeholder="Stops — semicolon separated"
                style={inputStyleLarge(darkMode)}
              />

              {/* DESTINATION */}
              <LocationInput
                value={destination}
                onChange={setDestination}
                onSelect={setDestinationCoords}
                placeholder="Destination"
                style={inputStyle(darkMode)}
              />

              {/* MODE SELECT */}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={selectStyle(darkMode)}
              >
                <option value="driving">🚗 Driving</option>
                <option value="walking">🚶 Walking</option>
                <option value="bicycling">🚴 Bicycling</option>
                <option value="transit">🚌 Transit</option>
              </select>

              {/* ALTERNATIVES */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={showAlternatives}
                  onChange={(e) => setShowAlternatives(e.target.checked)}
                />
                Show alternative routes
              </label>

              {/* WEATHER TOGGLE */}
              <button
                onClick={() => setShowWeatherDetails((prev) => !prev)}
                style={{
                  marginTop: "4px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: darkMode ? "1px solid #4b5563" : "1px solid #ccc",
                  background: darkMode ? "#1f2937" : "#f7f7f7",
                  color: darkMode ? "#e5e7eb" : "#111827",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {showWeatherDetails
                  ? "Hide today’s weather"
                  : "Show today’s weather"}
              </button>
            </div>
          </section>

          {/* CENTER PANEL – MAP */}
          <section style={centerPanelStyle(darkMode)}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Map view
            </div>
            <div style={mapContainerStyle}>
                {(routeStatus.type === "no_route" ||
                  routeStatus.type === "provider_failure") && (
                  <RouteUnavailable
                    status={routeStatus}
                    onRetry={retryRoute}
                    darkMode={darkMode}
                    compact
                  />
                )}
                <MapContainer
                  zoom={11}
                  center={[40.015, -105.2705]}
                  style={{ width: "100%", height: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitRouteBounds paths={decodedRoutes} />
                  {/* ROUTE POLYLINES */}
                  {decodedRoutes.map((path, i) => (
                    <Polyline
                      key={i}
                      positions={path.map((point) => [point.lat, point.lng])}
                      pathOptions={{
                        color: [
                          "#4285F4",
                          "#FF6347",
                          "#2ECC71",
                          "#8E44AD",
                        ][i % 4],
                        weight: i === 0 ? 6 : 4,
                        opacity: i === 0 ? 1 : 0.7,
                      }}
                    />
                  ))}

                  {/* MARKERS */}
                  {buildMarkers().map((m, index) => (
                    <Marker
                      key={index}
                      position={[m.position.lat, m.position.lng]}
                    >
                      <Tooltip permanent direction="top">
                        {String.fromCharCode(65 + index)}
                      </Tooltip>
                    </Marker>
                  ))}
                </MapContainer>
            </div>
          </section>

          {/* RIGHT PANEL – route insights */}
          <section style={rightPanelStyle(darkMode)}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Route options
            </h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button style={chipStyle(darkMode)}>Best on-time</button>
              <button style={chipStyle(darkMode)}>Shortest</button>
              <button style={chipStyle(darkMode)}>Fewest transfers</button>
            </div>

            {/* ROUTE LIST */}
            {routeStatus.type === "no_route" ||
            routeStatus.type === "provider_failure" ? (
              <RouteUnavailable
                status={routeStatus}
                onRetry={retryRoute}
                darkMode={darkMode}
              />
            ) : routeStatus.type === "loading" ? (
              <div style={{ fontSize: 13, color: darkMode ? "#9ca3af" : "#777" }}>
                Finding routes…
              </div>
            ) : routes.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: darkMode ? "#9ca3af" : "#777",
                }}
              >
                Enter origin and destination to see route suggestions.
              </div>
            ) : (
              routes.map((r, i) => (
                <RouteCard
                  key={i}
                  route={r}
                  index={i}
                  mode={mode}
                  showWeatherDetails={showWeatherDetails}
                  darkMode={darkMode}
                />
              ))
            )}
          </section>
        </main>

        {/* BOTTOM SUMMARY */}
        <footer style={bottomStripStyle(darkMode)}>
          {routes.length > 0 ? (
            <>
              <strong>Summary:</strong>{" "}
              {routes[0].duration_min != null
                ? `Fastest route is ${routes[0].duration_min} min and ${routes[0].distance_km} km. `
                : "Route loaded. "}
              {routes[0].weather && (
                <>
                  Current weather at origin: {routes[0].weather.temp} °C,{" "}
                  {routes[0].weather.weather_main}.
                </>
              )}
            </>
          ) : (
            <>Ready when you are — set up a trip to see predictions.</>
          )}
        </footer>
      </div>
    </div>
  );
}

function RouteUnavailable({ status, onRetry, darkMode, compact = false }) {
  const providerFailed = status.type === "provider_failure";

  return (
    <div
      role="alert"
      style={{
        ...(compact
          ? {
              position: "absolute",
              zIndex: 1000,
              top: 12,
              left: 12,
              right: 12,
            }
          : {}),
        padding: compact ? "10px 12px" : "14px",
        borderRadius: 10,
        border: `1px solid ${providerFailed ? "#f59e0b" : "#94a3b8"}`,
        background: darkMode ? "rgba(31, 41, 55, 0.96)" : "rgba(255, 255, 255, 0.96)",
        color: darkMode ? "#f3f4f6" : "#1f2937",
        boxShadow: compact ? "0 4px 14px rgba(0,0,0,0.18)" : "none",
        fontSize: 13,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>
        {providerFailed ? "Routing service unavailable" : "No route found"}
      </strong>
      {!compact && <div style={{ marginBottom: 10 }}>{status.message}</div>}
      <button
        type="button"
        onClick={onRetry}
        style={{
          border: 0,
          borderRadius: 7,
          padding: "7px 11px",
          background: "#2563eb",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RouteCard */
/* -------------------------------------------------------------------------- */
function RouteCard({ route, index, mode, showWeatherDetails, darkMode }) {
  const label = String.fromCharCode(65 + index);
  const color = ["#4285F4", "#FF6347", "#2ECC71", "#8E44AD"][index % 4];
  const [expandEvents, setExpandEvents] = useState(false);

  // weather icon
  let icon = "🌤️";
  if (route.weather?.weather_main) {
    const main = route.weather.weather_main.toLowerCase();
    if (main.includes("rain")) icon = "🌧️";
    else if (main.includes("snow")) icon = "❄️";
    else if (main.includes("storm") || main.includes("thunder")) icon = "⛈️";
    else if (main.includes("cloud")) icon = "☁️";
    else if (main.includes("clear")) icon = "☀️";
  }

  // impact level
  const alerts = route.alerts?.custom_alerts || [];
  let impactLevel = "low";
  if (alerts.some((a) => a.severity === "high")) impactLevel = "high";
  else if (alerts.some((a) => a.severity === "medium")) impactLevel = "medium";
  const impactLabel =
    impactLevel === "high"
      ? "High impact"
      : impactLevel === "medium"
      ? "Moderate impact"
      : "Low impact";

  const cardBg = darkMode ? "#020617" : "#fafafa";
  const cardBorder = darkMode ? "#334155" : "#ddd";
  const textMuted = darkMode ? "#9ca3af" : "#666";

  return (
    <div
      style={{
        marginBottom: "8px",
        padding: "10px 12px",
        borderRadius: "10px",
        border: `1px solid ${cardBorder}`,
        background: cardBg,
        fontSize: "14px",
        color: darkMode ? "#e5e7eb" : "#111827",
      }}
    >
      {/* Route basics */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <b style={{ color }}>
          Route {label} — {route.summary}
        </b>
      </div>

      <div>
        {route.duration_min} min • {route.distance_km} km
      </div>
      
            {/* ---------------- ML ON-TIME PREDICTION ---------------- */}
      {route.on_time_probability !== undefined && route.on_time_probability !== null && (
        <div
          style={{
            marginTop: "6px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: darkMode ? "#0f172a" : "#eef6ff",
            border: `1px solid ${darkMode ? "#1d4ed8" : "#bcd2ff"}`,
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            <strong>On-time probability:</strong>{" "}
            {(route.on_time_probability * 100).toFixed(1)}%
          </span>

          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 600,
              color: "white",
              background:
                route.on_time_probability >= 0.75
                  ? "#16a34a" /* green */
                  : route.on_time_probability >= 0.5
                  ? "#eab308" /* yellow */
                  : "#dc2626", /* red */
            }}
          >
            {route.on_time_probability >= 0.75
              ? "Likely On Time"
              : route.on_time_probability >= 0.5
              ? "Possibly Delayed"
              : "High Delay Risk"}
          </span>
        </div>
      )}


      <div style={{ color: textMuted }}>
        Stops: {route.stops?.join(" → ") || "None"}
      </div>

      <div style={{ color: textMuted }}>Mode: {mode}</div>

      {/* Weather card */}
      {showWeatherDetails && (
        <>
          {route.weather ? (
            <div className="weather-card">
              <div className="weather-card-header">
                <div className="weather-main">
                  <span className="weather-icon">{icon}</span>
                  <div>
                    <div className="weather-main-title">
                      {route.weather.temp} °C · {route.weather.weather_main}
                    </div>
                    <div className="weather-main-sub">
                      {route.weather.weather_desc}
                    </div>
                  </div>
                </div>
                <span className={"impact-badge impact-" + impactLevel}>
                  {impactLabel}
                </span>
              </div>

              {/* Row 1 */}
              <div className="weather-metrics-row">
                <div className="weather-metric">
                  <span className="weather-metric-emoji">🌡️</span>
                  <span>{route.weather.feels_like} °C feels like</span>
                </div>
                <div className="weather-metric">
                  <span className="weather-metric-emoji">💧</span>
                  <span>{route.weather.humidity}% humidity</span>
                </div>
                <div className="weather-metric">
                  <span className="weather-metric-emoji">🌬️</span>
                  <span>{route.weather.wind_speed} m/s wind</span>
                </div>
              </div>

              {/* Row 2 */}
              <div className="weather-metrics-row">
                <div className="weather-metric">
                  <span className="weather-metric-emoji">🌧️</span>
                  <span>{route.weather.rain_1h ?? 0} mm rain (last hour)</span>
                </div>
                <div className="weather-metric">
                  <span className="weather-metric-emoji">❄️</span>
                  <span>{route.weather.snow_1h ?? 0} mm snow (last hour)</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: "6px",
                fontSize: "13px",
                color: textMuted,
              }}
            >
              Weather data unavailable for this route.
            </div>
          )}
        </>
      )}

      {/* Alerts */}
      {renderAlerts(route.alerts?.custom_alerts, darkMode)}

      {/* Events */}
      {renderEvents(route.events_nearby, expandEvents, setExpandEvents, darkMode)}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ALERTS RENDER */
/* -------------------------------------------------------------------------- */
const severityColorsLight = {
  high: "#ffe5e5",
  medium: "#fff5d6",
  low: "#e5ffe5",
};

const severityColorsDark = {
  high: "#7f1d1d",
  medium: "#78350f",
  low: "#065f46",
};

const renderAlerts = (alerts, darkMode) => {
  /* ------------------ NO ALERTS ------------------ */
  if (!alerts || alerts.length === 0) {
    return (
      <div
        style={{
          marginTop: "12px",
          padding: "14px 16px",
          borderRadius: "12px",
          background: darkMode ? "#0f172a" : "#f0f4ff",
          border: `1px solid ${darkMode ? "#1d4ed8" : "#ccd9ff"}`,
          color: darkMode ? "#bfdbfe" : "#003eaa",
          fontSize: "16px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        🌤️ No weather alerts for this route.
      </div>
    );
  }

  /* ------------------ ALERTS EXIST ------------------ */
  return alerts.map((a, idx) => {
    const bg = darkMode
      ? severityColorsDark[a.severity] || "#111827"
      : severityColorsLight[a.severity] || "#f5f5f5";

    return (
      <div
        key={idx}
        style={{
          marginTop: "10px",
          padding: "12px",
          borderRadius: "12px",
          background: bg,
          border: "1px solid #ddd",
          fontSize: "14px",
          color: darkMode ? "#e5e7eb" : "#111827",
        }}
      >
        <strong style={{ fontSize: "15px" }}>{a.title}</strong>

        <div style={{ fontSize: "13px", marginTop: "4px" }}>{a.message}</div>

        <div
          style={{
            fontSize: "12px",
            fontStyle: "italic",
            marginTop: "6px",
            color: darkMode ? "#e5e7eb" : "#555",
          }}
        >
          Severity: {a.severity}
        </div>
      </div>
    );
  });
};

/* -------------------------------------------------------------------------- */
/* EVENTS RENDER */
/* -------------------------------------------------------------------------- */
const renderEvents = (eventsWrapper, expanded, setExpanded, darkMode) => {
  const rawEvents = Array.isArray(eventsWrapper)
    ? eventsWrapper
    : eventsWrapper?.events ?? [];

  /* ------------------ NO EVENTS AT ALL ------------------ */
  if (!rawEvents || rawEvents.length === 0) {
    return (
      <div
        style={{
          marginTop: "10px",
          padding: "14px 16px",
          borderRadius: "12px",
          background: darkMode ? "#450a0a" : "#fff5f5",
          border: `1px solid ${darkMode ? "#fecaca" : "#ffcccc"}`,
          color: darkMode ? "#fecaca" : "#b10000",
          fontSize: "16px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        ⚠️ No events today along this route.
      </div>
    );
  }

  /* ------------------ GROUP BY DAY ------------------ */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groupsByDate = new Map();

  for (const e of rawEvents) {
    const timeStr = e.date_time || e.start_time;
    if (!timeStr) continue;

    const time = new Date(timeStr);
    const dateKey = new Date(time);
    dateKey.setHours(0, 0, 0, 0);

    const k = dateKey.getTime();
    if (!groupsByDate.has(k)) groupsByDate.set(k, []);

    groupsByDate.get(k).push({ base: e, time });
  }

  const todayEvents = groupsByDate.get(today.getTime()) || [];
  const otherDayGroups = [...groupsByDate.entries()].filter(
    ([key]) => key !== today.getTime()
  );

  const ui = [];

  /* ------------------ TODAY SECTION ------------------ */
  if (todayEvents.length === 0) {
    ui.push(
      <div
        key="today-missing"
        style={{
          marginTop: "10px",
          padding: "16px",
          borderRadius: "12px",
          background: darkMode ? "#450a0a" : "#fff5f5",
          border: `1px solid ${darkMode ? "#fecaca" : "#ffcccc"}`,
          color: darkMode ? "#fecaca" : "#b10000",
          fontSize: "18px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        ⚠️ No events today along this route.
      </div>
    );
  } else {
    ui.push(
      <div
        key="today-header"
        style={{
          marginTop: "10px",
          fontSize: "17px",
          fontWeight: 700,
          color: darkMode ? "#bfdbfe" : "#0055cc",
        }}
      >
        🎟️ Events Today Along This Route
      </div>
    );

    todayEvents.forEach((ev, idx) => {
      const base = ev.base;
      const time = ev.time;

      ui.push(
        <div
          key={`today-${idx}`}
          style={{
            marginTop: "10px",
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${darkMode ? "#1d4ed8" : "#cce0ff"}`,
            background: darkMode ? "#0f172a" : "#f0f6ff",
            color: darkMode ? "#e5e7eb" : "#111827",
          }}
        >
          <strong
            style={{
              fontSize: "15px",
              color: darkMode ? "#bfdbfe" : "#003e99",
            }}
          >
            {base.name || base.title}
          </strong>

          <div style={{ marginTop: 4, fontSize: 13 }}>
            {time.toLocaleString()}
          </div>

          {base.venue_name && (
            <div
              style={{
                fontSize: 13,
                color: darkMode ? "#e5e7eb" : "#444",
              }}
            >
              Venue: {base.venue_name}
            </div>
          )}

          <a
            href={base.url}
            target="_blank"
            rel="noreferrer"
            style={{
              color: darkMode ? "#93c5fd" : "#0066ff",
              marginTop: 4,
              display: "inline-block",
              fontSize: 13,
            }}
          >
            View Event →
          </a>
        </div>
      );
    });
  }

  /* ------------------ OTHER DAYS (ACCORDION) ------------------ */
  if (otherDayGroups.length > 0) {
    ui.push(
      <div
        key="accordion-header"
        onClick={() => setExpanded(!expanded)}
        style={{
          marginTop: "16px",
          padding: "12px",
          borderRadius: "10px",
          background: darkMode ? "#020617" : "#fafafa",
          border: `1px solid ${darkMode ? "#4b5563" : "#ddd"}`,
          fontSize: "15px",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: darkMode ? "#e5e7eb" : "#111827",
        }}
      >
        <span>📅 Heads Up: Events Coming Up on Other Days</span>
        <span style={{ fontSize: "20px" }}>{expanded ? "▲" : "▼"}</span>
      </div>
    );

    if (expanded) {
      otherDayGroups.forEach(([dateKey, events], idx) => {
        const dateLabel = new Date(Number(dateKey)).toDateString();

        ui.push(
          <div
            key={`day-${idx}`}
            style={{
              marginTop: "10px",
              fontSize: "15px",
              fontWeight: 600,
              color: darkMode ? "#e5e7eb" : "#111827",
            }}
          >
            {dateLabel}
          </div>
        );

        events.forEach((ev, j) => {
          const base = ev.base;
          const time = ev.time;

          ui.push(
            <div
              key={`other-${idx}-${j}`}
              style={{
                marginTop: "8px",
                padding: "12px",
                borderRadius: "10px",
                border: `1px solid ${darkMode ? "#4b5563" : "#eee"}`,
                background: darkMode ? "#020617" : "#fff",
                color: darkMode ? "#e5e7eb" : "#111827",
              }}
            >
              <strong style={{ fontSize: "15px" }}>
                {base.name || base.title}
              </strong>

              <div style={{ marginTop: 4, fontSize: 13 }}>
                {time.toLocaleString()}
              </div>

              {base.venue_name && (
                <div
                  style={{
                    fontSize: 13,
                    color: darkMode ? "#e5e7eb" : "#555",
                  }}
                >
                  Venue: {base.venue_name}
                </div>
              )}

              <a
                href={base.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: darkMode ? "#93c5fd" : "#0066ff",
                  marginTop: 4,
                  display: "inline-block",
                  fontSize: 13,
                }}
              >
                View Event →
              </a>
            </div>
          );
        });
      });
    }
  }

  return ui;
};

/* -------------------------------------------------------------------------- */
