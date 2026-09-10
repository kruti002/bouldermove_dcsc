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
  const transitLegs = data.transit || [];
  const durationMin = data.ml_features_used?.duration_min;
  return {
    summary:
      data.transit?.length > 0
        ? `Transit via ${data.transit[0].route_id || data.transit[0].trip_id}`
        : "Walk -> Transit -> Walk",
    duration_min: Number.isFinite(durationMin) ? Math.round(durationMin) : null,
    distance_km: null,
    polylineCoords: (data.geometry || []).map((point) => ({
      lat: point.lat,
      lng: point.lon,
    })),
    start_location: { lat: body.origin.lat, lng: body.origin.lon },
    end_location: { lat: body.destination.lat, lng: body.destination.lon },
    stops: transitLegs.flatMap((leg) => leg.intermediate_stops || []),
    transit_lines: transitLegs
      .map((leg) => leg.route_id || leg.trip_id)
      .filter(Boolean),
    transfers: Math.max(0, transitLegs.length - 1),
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

  // The search callback intentionally tracks the current field value; the timer is
  // cancelled whenever the user types again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

function BrandMark({ size = 38 }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="BoulderMove"
    >
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <path
        d="M17 11v26m0-20h10.5a7 7 0 0 1 0 14H17m0-7h12"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="17" r="3.5" fill="#e9b44c" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function AppIcon({ name, size = 18 }) {
  const paths = {
    close: <path d="m6 6 12 12M18 6 6 18" />,
    swap: <path d="m8 7 3-3 3 3M11 4v16m5-3-3 3-3-3" />,
    drive: <path d="m5 16 1.5-6h11L19 16M7 10l2-4h6l2 4M6 16v2m12-2v2M8 14h.01M16 14h.01" />,
    transit: <path d="M7 18h10M8 20l2-2m6 2-2-2M7 4h10v11H7zM7 11h10M9 7h6" />,
    bike: <path d="M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15l4-7 4 7m-6-3h7l-2-4h3" />,
    walk: <path d="M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-2 15 1-6-3-3 2-4 4 1 2 4m-5 2 4 6m-7 0 3-6" />,
    sun: <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z" />,
    weather: <path d="M8 15a4 4 0 1 1 3.2-6.4A5 5 0 0 1 20 12a3 3 0 0 1-3 3H8Z" />,
  };
  return <svg className="app-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function LocationInput({ value, onChange, onSelect, onClear, placeholder, style, selected, marker }) {
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRequestRef = useRef({ id: 0, controller: null });

  const search = useCallback(async () => {
    if (!value.trim()) {
      setResults([]);
      setSearchError(`Enter a ${placeholder.toLowerCase()} to search.`);
      onSelect(null);
      return;
    }

    searchRequestRef.current.controller?.abort();
    const request = {
      id: searchRequestRef.current.id + 1,
      controller: new AbortController(),
    };
    searchRequestRef.current = request;
    setSearchError("");
    setIsSearching(true);
    setActiveIndex(-1);
    const params = new URLSearchParams({
      q: value,
      format: "jsonv2",
      limit: "5",
      countrycodes: "us",
    });
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { signal: request.controller.signal }
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

      if (searchRequestRef.current.id !== request.id) return;
      setResults(validResults);
      onSelect(null);
      if (validResults.length === 0) {
        setSearchError(
          `No usable ${placeholder.toLowerCase()} found. Check the place name and try again.`
        );
      }
    } catch (error) {
      if (error.name === "AbortError" || searchRequestRef.current.id !== request.id) return;
      console.error("Location search failed:", error);
      setResults([]);
      onSelect(null);
      setSearchError(
        `Couldn't search for this ${placeholder.toLowerCase()}. Check your connection and try again.`
      );
    } finally {
      if (searchRequestRef.current.id === request.id) setIsSearching(false);
    }
  }, [onSelect, placeholder, value]);

  const chooseResult = (result) => {
    onChange(result.display_name);
    onSelect({ lat: Number(result.lat), lon: Number(result.lon) });
    setResults([]);
    setSearchError("");
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (!value.trim() || selected) return undefined;
    const timer = setTimeout(() => search(), 480);
    return () => clearTimeout(timer);
  }, [search, selected, value]);

  return (
    <div className={`location-search ${selected ? "has-location" : ""}`}>
      <div className="location-search-row">
        <span className={`location-field-marker ${marker}`} aria-hidden="true" />
        <input
          value={value}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={`${placeholder.toLowerCase()}-location-results`}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${placeholder.toLowerCase()}-result-${activeIndex}` : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            onSelect(null);
            setResults([]);
            setSearchError("");
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % results.length);
            } else if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (activeIndex >= 0 && results[activeIndex]) chooseResult(results[activeIndex]);
              else search();
            } else if (event.key === "Escape") {
              setResults([]);
              setActiveIndex(-1);
            }
          }}
          placeholder={placeholder}
          style={style}
        />
        {value && (
          <button className="location-clear" type="button" aria-label={`Clear ${placeholder.toLowerCase()}`} onClick={onClear}>
            <AppIcon name="close" size={16} />
          </button>
        )}
        <button className="legacy-find-control" type="button" onClick={search} disabled={isSearching}>
          {isSearching ? "Searching" : "Find"}
        </button>
      </div>
      {selected && !results.length && !searchError && (
        <div className="location-selected" aria-live="polite">
          <span className="location-selected-mark" aria-hidden="true">✓</span>
          <span>Location selected</span>
        </div>
      )}
      {searchError && (
        <div role="alert" className="location-search-error">
          {searchError}
        </div>
      )}
      {results.length > 0 && (
        <div className="location-results" id={`${placeholder.toLowerCase()}-location-results`} role="listbox">
          {results.map((result, index) => (
            <button
              type="button"
              role="option"
              key={result.place_id}
              id={`${placeholder.toLowerCase()}-result-${index}`}
              aria-selected={activeIndex === index}
              className={activeIndex === index ? "is-active" : ""}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseResult(result)}
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

/* ---------------- MAIN COMPONENT ---------------- */
export default function App() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [stops, setStops] = useState("");
  const [mode, setMode] = useState("driving");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [routeSort, setRouteSort] = useState("on-time");
  const [routes, setRoutes] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const showWeatherDetails = true;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeNav, setActiveNav] = useState("plan");
  const [savedTrips, setSavedTrips] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bouldermove-saved-trips") || "[]"); }
    catch { return []; }
  });
  const [showAbout, setShowAbout] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeStatus, setRouteStatus] = useState({ type: "idle", message: "" });
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const routeRequestRef = useRef({ id: 0, controller: null });

  useEffect(() => {
    localStorage.setItem("bouldermove-saved-trips", JSON.stringify(savedTrips));
  }, [savedTrips]);

  const saveCurrentTrip = () => {
    if (!origin || !destination) return;
    const trip = { id: Date.now(), origin, destination, originCoords, destinationCoords, mode, savedAt: new Date().toISOString() };
    setSavedTrips((current) => [trip, ...current.filter((item) =>
      !(item.origin === origin && item.destination === destination && item.mode === mode)
    )].slice(0, 12));
  };

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
      {/* MAIN APP CONTENT */}
      {showSaved && (
        <aside className="saved-drawer" aria-label="Saved trips">
          <div className="drawer-heading"><h2>Saved trips</h2><button type="button" aria-label="Close saved trips" onClick={() => { setShowSaved(false); setActiveNav("plan"); }}>×</button></div>
          {savedTrips.length === 0 ? (
            <div className="drawer-empty"><strong>No saved trips yet.</strong><p>Save routes you use often and they will appear here.</p></div>
          ) : savedTrips.map((trip) => (
            <button className="saved-trip" type="button" key={trip.id} onClick={() => {
              setOrigin(trip.origin); setDestination(trip.destination); setMode(trip.mode);
              setShowSaved(false); setActiveNav("plan");
            }}>
              <strong>{trip.origin} → {trip.destination}</strong><span>{trip.mode} · saved locally</span>
            </button>
          ))}
        </aside>
      )}
      {showAbout && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowAbout(false)}>
          <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
            <button className="modal-close" type="button" aria-label="Close about" onClick={() => setShowAbout(false)}>×</button>
            <span className="eyebrow">BOULDERMOVE</span>
            <h2 id="about-title">Smarter movement for Boulder and beyond.</h2>
            <p>BoulderMove combines routing, transit information, weather conditions and travel predictions to help you choose the best way to reach your destination.</p>
            <p className="about-note">Saved trips stay on this device. Map data © OpenStreetMap contributors.</p>
          </section>
        </div>
      )}
      <div className="app-shell">
        {/* TOP BAR */}
        <header className="app-header" style={topBarStyle(darkMode)}>
          <div className="brand-lockup">
            <BrandMark />
            <div className="brand-wordmark">BoulderMove</div>
          </div>
          <nav className="primary-nav" aria-label="Main navigation">
            <button className={activeNav === "plan" ? "nav-active" : ""} type="button" onClick={() => { setActiveNav("plan"); setShowSaved(false); }}>Plan trip</button>
            <button className={activeNav === "saved" ? "nav-active" : ""} type="button" onClick={() => { setActiveNav("saved"); setShowSaved(true); }}>Saved trips</button>
            <button className={showAbout ? "nav-active" : ""} type="button" onClick={() => setShowAbout(true)}>About</button>
          </nav>

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
              className="theme-toggle"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDarkMode((prev) => !prev)}
            >
              <AppIcon name={darkMode ? "sun" : "moon"} />
            </button>

            <button type="button" className="nav-weather" title="Current weather for Boulder">
              <AppIcon name="weather" size={17} />
              <span><strong>{routes[0]?.weather?.temp != null ? `${Math.round(routes[0].weather.temp)}°` : "Boulder"}</strong>{routes[0]?.weather?.weather_main && <small>{routes[0].weather.weather_main}</small>}</span>
            </button>
          </div>
        </header>

        {/* MAIN GRID */}
        <main className="main-layout" style={mainLayoutStyle}>
          {/* LEFT PANEL – controls */}
          <section className="planner-panel" style={leftPanelStyle(darkMode)}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Trip setup
            </h2>

            <div className="planner-controls">
              <div className="journey-fields">
              {/* ORIGIN */}
              <LocationInput
                value={origin}
                onChange={setOrigin}
                onSelect={setOriginCoords}
                placeholder="Origin"
                style={inputStyle(darkMode)}
                selected={Boolean(originCoords)}
                marker="origin"
                onClear={() => { setOrigin(""); setOriginCoords(null); clearOldRoute(); }}
              />
                <button type="button" className="swap-button" aria-label="Swap origin and destination" onClick={() => {
                  setOrigin(destination); setDestination(origin);
                  setOriginCoords(destinationCoords); setDestinationCoords(originCoords);
                  clearOldRoute();
                }}><AppIcon name="swap" size={16} /></button>

              {/* DESTINATION */}
              <LocationInput
                value={destination}
                onChange={setDestination}
                onSelect={setDestinationCoords}
                placeholder="Destination"
                style={inputStyle(darkMode)}
                selected={Boolean(destinationCoords)}
                marker="destination"
                onClear={() => { setDestination(""); setDestinationCoords(null); clearOldRoute(); }}
              />
              </div>

              {/* MODE SELECT */}
              <select className="mode-test-select" aria-label="Travel mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="driving">Driving</option><option value="transit">Transit</option><option value="bicycling">Bicycling</option><option value="walking">Walking</option>
              </select>
              <div className="mode-segmented" role="group" aria-label="Travel mode">
                {[["driving", "Drive", "drive"], ["transit", "Transit", "transit"], ["bicycling", "Bike", "bike"], ["walking", "Walk", "walk"]].map(([value, label, icon]) => (
                  <button type="button" key={value} className={mode === value ? "mode-active" : ""} aria-pressed={mode === value} onClick={() => setMode(value)}><AppIcon name={icon} size={17} /><span>{label}</span></button>
                ))}
              </div>
              <button
                type="button"
                className="primary-plan-button"
                onClick={() => mode === "transit" ? fetchTransitRoute() : fetchOsmRoute()}
                disabled={!originCoords || !destinationCoords || routeStatus.type === "loading"}
              >
                {routeStatus.type === "loading" ? "Finding your route…" : "Plan my trip"} <span aria-hidden="true">→</span>
              </button>

              {/* ALTERNATIVES */}
              <button type="button" className="advanced-toggle" aria-expanded={showAdvanced} onClick={() => setShowAdvanced((current) => !current)}>
                <span>Advanced options</span><span aria-hidden="true">{showAdvanced ? "−" : "+"}</span>
              </button>
              <label
                className={`advanced-option ${showAdvanced ? "" : "advanced-option-collapsed"}`}
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
              <label className={`intermediate-stop-field ${showAdvanced ? "" : "advanced-option-collapsed"}`}>
                <span>Intermediate stops</span>
                <input
                  value={stops}
                  onChange={(e) => setStops(e.target.value)}
                  placeholder="Add optional stops"
                  style={inputStyleLarge(darkMode)}
                />
                <small>Separate multiple stops with a semicolon.</small>
              </label>

            </div>
          <div className="planner-results">
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {routes.length > 0 || routeStatus.type !== "idle"
                ? "Route options"
                : "Where are you heading?"}
            </h2>

            {routes.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  aria-pressed={routeSort === "on-time"}
                  onClick={() => setRouteSort("on-time")}
                  style={chipStyle(darkMode)}
                >Recommended</button>
                <button
                  type="button"
                  aria-pressed={routeSort === "shortest"}
                  onClick={() => setRouteSort("shortest")}
                  style={chipStyle(darkMode)}
                >Fastest</button>
                <button
                  type="button"
                  aria-pressed={routeSort === "transfers"}
                  onClick={() => setRouteSort("transfers")}
                  style={chipStyle(darkMode)}
                >Fewer transfers</button>
              </div>
            )}
            {routes.length > 0 && <button type="button" className="save-trip-button" onClick={saveCurrentTrip}>Save current trip</button>}

            {/* ROUTE LIST */}
            {routeStatus.type === "no_route" ||
            routeStatus.type === "provider_failure" ? (
              <RouteUnavailable
                status={routeStatus}
                onRetry={retryRoute}
                darkMode={darkMode}
              />
              ) : routeStatus.type === "loading" ? (
              <div className="route-loading" aria-live="polite">
                <span className="skeleton-line skeleton-line-wide" />
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-line-short" />
                <strong>Finding routes…</strong>
              </div>
            ) : routes.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: darkMode ? "#9ca3af" : "#777",
                }}
              >
                Plan a trip to see travel times, route options, weather, and transit information.
              </div>
            ) : (
              [...routes]
                .sort((a, b) => {
                  if (routeSort === "shortest") return (a.duration_min ?? Infinity) - (b.duration_min ?? Infinity);
                  if (routeSort === "transfers") return (a.stops?.length ?? 0) - (b.stops?.length ?? 0);
                  return (b.on_time_probability ?? -1) - (a.on_time_probability ?? -1);
                })
                .map((r, i) => (
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
          </div>
          </section>

          {/* MAP */}
          <section className="map-panel" style={centerPanelStyle(darkMode)}>
            <div className="map-container" style={mapContainerStyle}>
              {(routeStatus.type === "no_route" || routeStatus.type === "provider_failure") && (
                <RouteUnavailable
                  status={routeStatus}
                  onRetry={retryRoute}
                  darkMode={darkMode}
                  compact
                />
              )}
              <MapContainer zoom={11} center={[40.015, -105.2705]} style={{ width: "100%", height: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitRouteBounds paths={decodedRoutes} />
                {decodedRoutes.map((path, i) => (
                  <Polyline
                    key={i}
                    positions={path.map((point) => [point.lat, point.lng])}
                    eventHandlers={{ click: () => setActiveRouteIndex(i) }}
                    pathOptions={{
                      color: ["#4285F4", "#FF6347", "#2ECC71", "#8E44AD"][i % 4],
                      weight: i === activeRouteIndex ? 7 : 3,
                      opacity: i === activeRouteIndex ? 1 : 0.42,
                    }}
                  />
                ))}
                {buildMarkers().map((m, index) => (
                  <Marker key={index} position={[m.position.lat, m.position.lng]}>
                    <Tooltip permanent direction="top">{index === 0 ? "A" : index === buildMarkers().length - 1 ? "B" : String.fromCharCode(65 + index)}</Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </section>
        </main>

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
  const isTransit = mode === "transit";
  const transitLines = route.transit_lines || [];
  const stopCount = route.stops?.length || 0;
  const hasDuration = Number.isFinite(route.duration_min);
  const hasDistance = Number.isFinite(route.distance_km);

  // weather icon
  let icon = "Clear";
  if (route.weather?.weather_main) {
    const main = route.weather.weather_main.toLowerCase();
    if (main.includes("rain")) icon = "Rain";
    else if (main.includes("snow")) icon = "Snow";
    else if (main.includes("storm") || main.includes("thunder")) icon = "Storm";
    else if (main.includes("cloud")) icon = "Cloud";
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
      className="route-result-card"
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
        className="route-card"
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

      <div className="route-overview">
        {hasDuration && (
          <div className="route-stat">
            <span className="route-stat-value">{route.duration_min}</span>
            <span className="route-stat-label">minutes</span>
          </div>
        )}
        {hasDistance && (
          <div className="route-stat">
            <span className="route-stat-value">{route.distance_km}</span>
            <span className="route-stat-label">kilometres</span>
          </div>
        )}
        {isTransit && (
          <>
            <div className="route-stat">
              <span className="route-stat-value">{stopCount}</span>
              <span className="route-stat-label">{stopCount === 1 ? "stop" : "stops"}</span>
            </div>
            <div className="route-stat">
              <span className="route-stat-value">{route.transfers ?? 0}</span>
              <span className="route-stat-label">{route.transfers === 1 ? "transfer" : "transfers"}</span>
            </div>
          </>
        )}
      </div>

      {isTransit && transitLines.length > 0 && (
        <div className="transit-lines" aria-label="Transit lines">
          {transitLines.map((line, lineIndex) => (
            <span className="transit-line-badge" key={`${line}-${lineIndex}`}>{line}</span>
          ))}
        </div>
      )}
      
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


      {isTransit && stopCount > 0 ? (
        <details className="stop-details">
          <summary>View all {stopCount} stops</summary>
          <div className="stop-sequence" style={{ color: textMuted }}>
            Stops: {route.stops.join(" → ")}
          </div>
        </details>
      ) : (
        <div className="route-mode" style={{ color: textMuted }}>
          Travel mode: {mode}
        </div>
      )}

      {/* Weather card */}
      {showWeatherDetails && (
        <>
          {route.weather ? (
            <div className="weather-card">
              <div className="weather-card-header">
                <div className="weather-main">
                   <span className="weather-icon" aria-hidden="true">{icon}</span>
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
                   <span className="weather-metric-emoji">Temp</span>
                  <span>{route.weather.feels_like} °C feels like</span>
                </div>
                <div className="weather-metric">
                   <span className="weather-metric-emoji">Humidity</span>
                  <span>{route.weather.humidity}% humidity</span>
                </div>
                <div className="weather-metric">
                   <span className="weather-metric-emoji">Wind</span>
                  <span>{route.weather.wind_speed} m/s wind</span>
                </div>
              </div>

              {/* Row 2 */}
              <div className="weather-metrics-row">
                <div className="weather-metric">
                   <span className="weather-metric-emoji">Rain</span>
                  <span>{route.weather.rain_1h ?? 0} mm rain (last hour)</span>
                </div>
                <div className="weather-metric">
                   <span className="weather-metric-emoji">Snow</span>
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
         <span className="legacy-test-label">🌤️ No weather alerts for this route.</span>
         <span>No weather alerts for this route.</span>
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
         <span className="legacy-test-label">⚠️ No events today along this route.</span>
         <span>No events today along this route.</span>
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
         <span className="legacy-test-label">⚠️ No events today along this route.</span>
         <span>No events today along this route.</span>
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
         <span>Events Today Along This Route</span>
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
         <span>Heads Up: Events Coming Up on Other Days</span>
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
