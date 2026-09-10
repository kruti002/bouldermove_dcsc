import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import {
  Compass,
  Navigation,
  Bus,
  Footprints,
  Bike,
  Car,
  Clock,
  CloudSun,
  AlertTriangle,
  Calendar,
  Sparkles,
  Sun,
  Moon,
  ArrowUpDown,
  Search,
  X,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Leaf,
  Layers,
  RefreshCw,
  Info,
} from "lucide-react";
import "./App.css";

// -------------------------------------------------------------
// LEAFLET PIN CONFIGURATION
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
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 800;
          font-size: 13px;
          font-family: var(--font-heading);
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
const stopIcon = L.divIcon({
  className: "custom-stop-marker",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#0f4c3a;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// -------------------------------------------------------------
// BOULDER PRESET LANDMARKS
// -------------------------------------------------------------
const BOULDER_LANDMARKS = [
  { name: "Pearl St Mall", lat: 40.0176, lon: -105.2797, desc: "Downtown Boulder" },
  { name: "CU Boulder Campus", lat: 40.0076, lon: -105.2659, desc: "University of Colorado" },
  { name: "Chautauqua & Flatirons", lat: 39.9989, lon: -105.2828, desc: "Trails & Views" },
  { name: "Boulder Junction (RTD)", lat: 40.0253, lon: -105.2505, desc: "Transit Hub" },
  { name: "Sanitas Trailhead", lat: 40.0210, lon: -105.3015, desc: "Hiking Trail" },
  { name: "29th St District", lat: 40.0175, lon: -105.2575, desc: "Shopping & Dining" },
];

const DEFAULT_CENTER = [40.0150, -105.2705]; // Boulder, CO

// -------------------------------------------------------------
// MAP BOUNDS HELPER
// -------------------------------------------------------------
function FitBoundsToRoute({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, coordinates]);
  return null;
}

// -------------------------------------------------------------
// ML SCORING API CALL
// -------------------------------------------------------------
async function scoreRouteML(routeFeatures, signal) {
  try {
    const mlUrl =
      import.meta.env.VITE_ML_API_URL ||
      "https://bouldermove-ml-499631536778.us-central1.run.app/score_route";
    const res = await fetch(mlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(routeFeatures),
      signal,
    });
    if (!res.ok) throw new Error("ML scoring failed");
    return await res.json();
  } catch (err) {
    return { prob_on_time: null, expected_delay_min: null };
  }
}

export function buildMLFeatures(route, weather) {
  const nearbyEventCount = Array.isArray(route.events_nearby)
    ? route.events_nearby.length
    : route.events_nearby?.count ?? route.events_nearby?.events?.length ?? 0;

  return {
    duration_min: route.duration_min ?? 0,
    buffer_min: 5,
    num_transfers: route.transfers ?? 0,
    rain_1h: weather?.rain_1h ?? 0,
    snow_1h: weather?.snow_1h ?? 0,
    wind_speed: weather?.wind_speed ?? 0,
    temp: weather?.temp ?? 0,
    event_risk: nearbyEventCount > 0 ? 1.0 : 0.0,
    hour: new Date().getHours(),
    is_weekend: [0, 6].includes(new Date().getDay()),
  };
}

export default function App() {
  // Theme State (Dark / Light)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("bouldermove_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.className = theme === "dark" ? "dark" : "";
    localStorage.setItem("bouldermove_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // Backend URL config
  const backendBaseUrl = useMemo(() => {
    return (
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_URL ||
      ""
    );
  }, []);

  // Server health state (for cold-start detection on free cloud backends)
  const [serverStatus, setServerStatus] = useState("checking"); // 'online' | 'waking' | 'offline'

  const checkServerHealth = useCallback(async () => {
    try {
      const res = await fetch(`${backendBaseUrl}/health`, { method: "GET" });
      if (res.ok) {
        setServerStatus("online");
      } else {
        setServerStatus("waking");
      }
    } catch {
      setServerStatus("waking");
    }
  }, [backendBaseUrl]);

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 25000);
    return () => clearInterval(interval);
  }, [checkServerHealth]);

  // Route Planning State
  const [originText, setOriginText] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [originResults, setOriginResults] = useState([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);

  const [destText, setDestText] = useState("");
  const [destCoords, setDestCoords] = useState(null);
  const [destResults, setDestResults] = useState([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  const [mode, setMode] = useState("transit"); // 'transit' | 'walking' | 'bicycling' | 'driving'
  const [showAlternatives, setShowAlternatives] = useState(true);

  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeStatus, setRouteStatus] = useState({ type: "idle", message: "" });

  const activeRequestRef = useRef(0);

  // -------------------------------------------------------------
  // NOMINATIM GEOCODING (DEBOUNCED SEARCH)
  // -------------------------------------------------------------
  const searchLocation = async (query, isOrigin) => {
    if (!query || query.trim().length < 2) {
      if (isOrigin) setOriginResults([]);
      else setDestResults([]);
      return;
    }

    if (isOrigin) setIsSearchingOrigin(true);
    else setIsSearchingDest(true);

    try {
      // Prioritize Colorado / Boulder area
      const params = new URLSearchParams({
        q: `${query}, Boulder, CO`,
        format: "jsonv2",
        limit: "5",
        countrycodes: "us",
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        const valid = data.map((d) => ({
          display_name: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        }));
        if (isOrigin) setOriginResults(valid);
        else setDestResults(valid);
      }
    } catch (err) {
      console.warn("Geocoding failed:", err);
    } finally {
      if (isOrigin) setIsSearchingOrigin(false);
      else setIsSearchingDest(false);
    }
  };

  // Swap Origin and Destination
  const handleSwap = () => {
    const tempText = originText;
    const tempCoords = originCoords;
    setOriginText(destText);
    setOriginCoords(destCoords);
    setDestText(tempText);
    setDestCoords(tempCoords);
    setOriginResults([]);
    setDestResults([]);
  };

  // Select Preset Landmark
  const handleSelectPreset = (preset, field) => {
    if (field === "origin" || (!originCoords && field !== "dest")) {
      setOriginText(preset.name);
      setOriginCoords({ lat: preset.lat, lon: preset.lon });
      setOriginResults([]);
    } else {
      setDestText(preset.name);
      setDestCoords({ lat: preset.lat, lon: preset.lon });
      setDestResults([]);
    }
  };

  // -------------------------------------------------------------
  // FETCH ROUTE (TRANSIT VIA RAPTOR OR VALHALLA OSM)
  // -------------------------------------------------------------
  const fetchRoute = useCallback(async () => {
    if (!originCoords || !destCoords) return;

    const reqId = ++activeRequestRef.current;
    setRouteStatus({ type: "loading", message: "Calculating best route & ML delays..." });
    setRoutes([]);

    try {
      if (mode === "transit") {
        const url = `${backendBaseUrl}/plan_transit_full`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: originCoords.lat, lon: originCoords.lon },
            destination: { lat: destCoords.lat, lon: destCoords.lon },
            depart_at: new Date().toISOString(),
          }),
        });

        const data = await res.json();
        if (reqId !== activeRequestRef.current) return;

        if (data.error) {
          // Fallback to walking if no transit route is found
          setRouteStatus({
            type: "warning",
            message: data.error.message || "No direct transit available at this hour. Showing walking options.",
          });
          return;
        }

        const transitLegs = data.transit || [];
        const totalDuration = data.ml_features_used?.duration_min || 0;

        const transitRoute = {
          mode: "transit",
          summary: transitLegs.length > 0 ? `RTD Transit (${transitLegs.map(l => l.route_id || l.trip_id).join(" → ")})` : "Transit Route",
          duration_min: Math.round(totalDuration) || 15,
          distance_km: null,
          polylineCoords: (data.geometry || []).map((p) => ({ lat: p.lat, lng: p.lon })),
          legs: transitLegs,
          stops: transitLegs.flatMap((l) => l.intermediate_stops || []),
          weather: data.weather,
          events_nearby: data.events_nearby,
          on_time_probability: data.on_time_probability,
          expected_delay_min: data.expected_delay_min,
          carbon_saved_kg: (totalDuration * 0.04).toFixed(1),
          calories: Math.round(totalDuration * 3.5),
        };

        setRoutes([transitRoute]);
        setSelectedRouteIndex(0);
        setRouteStatus({ type: "success", message: "" });
        setServerStatus("online");
      } else {
        // OSM Valhalla Directions
        const params = new URLSearchParams({
          origin: `${originCoords.lat},${originCoords.lon}`,
          destination: `${destCoords.lat},${destCoords.lon}`,
          mode,
          alternatives: String(showAlternatives),
        });

        const url = `${backendBaseUrl}/osm_directions?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();
        if (reqId !== activeRequestRef.current) return;

        if (data.error || !data.routes || data.routes.length === 0) {
          setRouteStatus({
            type: "no_route",
            message: data.error?.message || "No routes found for the selected mode.",
          });
          return;
        }

        const parsedRoutes = await Promise.all(
          data.routes.map(async (r, idx) => {
            const polyCoords = (r.geometry?.coordinates || []).map(([lng, lat]) => ({ lat, lng }));
            const durationMin = Math.round(r.duration / 60);
            const distKm = Number((r.distance / 1000).toFixed(1));

            const routeObj = {
              mode,
              summary: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Route ${idx > 0 ? `(Alt ${idx})` : ""}`,
              duration_min: durationMin,
              distance_km: distKm,
              polylineCoords: polyCoords,
              weather: data.weather,
              events_nearby: data.events_nearby,
              carbon_saved_kg: mode === "driving" ? "0.0" : (distKm * 0.19).toFixed(1),
              calories: mode === "walking" ? Math.round(distKm * 65) : mode === "bicycling" ? Math.round(distKm * 32) : 0,
            };

            const mlFeatures = buildMLFeatures(routeObj, data.weather);
            const ml = await scoreRouteML(mlFeatures);
            routeObj.on_time_probability = ml.prob_on_time;
            routeObj.expected_delay_min = ml.expected_delay_min;
            return routeObj;
          })
        );

        if (reqId !== activeRequestRef.current) return;
        setRoutes(parsedRoutes);
        setSelectedRouteIndex(0);
        setRouteStatus({ type: "success", message: "" });
        setServerStatus("online");
      }
    } catch (err) {
      if (reqId !== activeRequestRef.current) return;
      console.error("Routing error:", err);
      setRouteStatus({
        type: "error",
        message: "Couldn't reach routing server. If on a free cloud backend, it may be waking up.",
      });
      setServerStatus("waking");
    }
  }, [originCoords, destCoords, mode, showAlternatives, backendBaseUrl]);

  useEffect(() => {
    if (originCoords && destCoords) {
      fetchRoute();
    }
  }, [fetchRoute, originCoords, destCoords, mode, showAlternatives]);

  const selectedRoute = routes[selectedRouteIndex] || routes[0];

  return (
    <div className="app-container">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <header className="navbar">
        <div className="brand-section" onClick={() => window.location.reload()}>
          <div className="brand-logo-icon">
            <Compass size={22} strokeWidth={2.5} />
          </div>
          <div className="brand-title-group">
            <div className="brand-name">
              BoulderMove
              <span className="brand-badge">CO Transit</span>
            </div>
            <span className="brand-tagline">Multimodal RTD & Smart Navigation</span>
          </div>
        </div>

        <div className="nav-actions">
          {/* Cloud Server Health Status */}
          <div
            className="server-status-badge"
            title={
              serverStatus === "online"
                ? "Backend API is online and responding"
                : "Free backend tier sleeping/starting up (~30s cold start)"
            }
          >
            <span className={`status-indicator ${serverStatus}`}></span>
            <span>{serverStatus === "online" ? "API Online" : serverStatus === "waking" ? "Waking Backend..." : "Offline"}</span>
          </div>

          {/* Theme Switcher */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* ---------------- MAIN LAYOUT ---------------- */}
      <div className="main-layout">
        {/* Left Controls & Route Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-content">
            {/* Free Backend Waking Banner */}
            {serverStatus === "waking" && (
              <div className="backend-banner">
                <Info size={18} color="var(--accent-amber)" />
                <div>
                  <strong>Cloud Backend Cold-Starting:</strong> Free tier containers sleep when idle. First route calculation may take ~30s.
                </div>
                <button onClick={checkServerHealth}>
                  <RefreshCw size={12} style={{ marginRight: 4 }} /> Ping
                </button>
              </div>
            )}

            {/* Origin & Destination Inputs Card */}
            <div className="route-inputs-card">
              <div className="input-row-group">
                <div className="input-points-indicator">
                  <div className="point-dot origin"></div>
                  <div className="point-line"></div>
                  <div className="point-dot dest"></div>
                </div>

                <div className="inputs-fields">
                  {/* Origin Input */}
                  <div className="input-container">
                    <input
                      type="text"
                      className="location-input"
                      placeholder="Start point (e.g. CU Boulder, Downtown)"
                      value={originText}
                      onChange={(e) => {
                        setOriginText(e.target.value);
                        searchLocation(e.target.value, true);
                      }}
                    />
                    <div className="input-icon-right">
                      {originText && (
                        <button
                          className="icon-btn-subtle"
                          onClick={() => {
                            setOriginText("");
                            setOriginCoords(null);
                            setOriginResults([]);
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Origin Autocomplete */}
                    {originResults.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {originResults.map((r, i) => (
                          <button
                            key={i}
                            className="autocomplete-item"
                            onClick={() => {
                              setOriginText(r.display_name.split(",")[0]);
                              setOriginCoords({ lat: r.lat, lon: r.lon });
                              setOriginResults([]);
                            }}
                          >
                            <MapPin size={14} className="autocomplete-item-icon" />
                            <span className="autocomplete-item-text">{r.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Destination Input */}
                  <div className="input-container">
                    <input
                      type="text"
                      className="location-input"
                      placeholder="Where to? (e.g. Pearl St, Flatirons)"
                      value={destText}
                      onChange={(e) => {
                        setDestText(e.target.value);
                        searchLocation(e.target.value, false);
                      }}
                    />
                    <div className="input-icon-right">
                      {destText && (
                        <button
                          className="icon-btn-subtle"
                          onClick={() => {
                            setDestText("");
                            setDestCoords(null);
                            setDestResults([]);
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Dest Autocomplete */}
                    {destResults.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {destResults.map((r, i) => (
                          <button
                            key={i}
                            className="autocomplete-item"
                            onClick={() => {
                              setDestText(r.display_name.split(",")[0]);
                              setDestCoords({ lat: r.lat, lon: r.lon });
                              setDestResults([]);
                            }}
                          >
                            <MapPin size={14} className="autocomplete-item-icon" />
                            <span className="autocomplete-item-text">{r.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="swap-btn-container">
                  <button className="swap-btn" onClick={handleSwap} title="Swap origin and destination">
                    <ArrowUpDown size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Boulder Shortcuts */}
            <div className="boulder-presets-section">
              <div className="section-label">
                <span>Popular Boulder Landmarks</span>
              </div>
              <div className="presets-chips">
                {BOULDER_LANDMARKS.map((landmark) => (
                  <button
                    key={landmark.name}
                    className="preset-chip"
                    onClick={() => handleSelectPreset(landmark)}
                  >
                    <MapPin size={12} />
                    {landmark.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel Mode Selector */}
            <div className="mode-selector">
              <button
                className={`mode-btn ${mode === "transit" ? "active" : ""}`}
                onClick={() => setMode("transit")}
              >
                <Bus size={18} />
                <span>Transit</span>
              </button>
              <button
                className={`mode-btn ${mode === "walking" ? "active" : ""}`}
                onClick={() => setMode("walking")}
              >
                <Footprints size={18} />
                <span>Walk</span>
              </button>
              <button
                className={`mode-btn ${mode === "bicycling" ? "active" : ""}`}
                onClick={() => setMode("bicycling")}
              >
                <Bike size={18} />
                <span>Bike</span>
              </button>
              <button
                className={`mode-btn ${mode === "driving" ? "active" : ""}`}
                onClick={() => setMode("driving")}
              >
                <Car size={18} />
                <span>Drive</span>
              </button>
            </div>

            {/* Options Toggle */}
            <div className="options-bar">
              <label className="toggle-label">
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showAlternatives}
                    onChange={(e) => setShowAlternatives(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </div>
                <span>Alternative Routes</span>
              </label>

              {routes.length > 0 && (
                <button
                  className="icon-btn-subtle"
                  onClick={fetchRoute}
                  title="Refresh Route"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>

            {/* ---------------- ROUTE RESULTS & DETAILS ---------------- */}
            {routeStatus.type === "loading" && (
              <div className="status-card">
                <div className="spinner"></div>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{routeStatus.message}</p>
              </div>
            )}

            {routeStatus.type === "no_route" && (
              <div className="status-card">
                <AlertTriangle size={24} color="var(--accent-amber)" />
                <p style={{ fontSize: 13 }}>{routeStatus.message}</p>
              </div>
            )}

            {routeStatus.type === "error" && (
              <div className="status-card">
                <AlertTriangle size={24} color="var(--accent-rose)" />
                <p style={{ fontSize: 13 }}>{routeStatus.message}</p>
                <button
                  onClick={fetchRoute}
                  style={{
                    marginTop: 8,
                    padding: "6px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent-primary)",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Retry Route
                </button>
              </div>
            )}

            {routes.length > 0 && (
              <div className="results-container">
                {routes.map((route, idx) => (
                  <div
                    key={idx}
                    className={`route-card ${selectedRouteIndex === idx ? "selected" : ""}`}
                    onClick={() => setSelectedRouteIndex(idx)}
                  >
                    <div className="route-card-header">
                      <div className="route-title-group">
                        <span className="route-primary-title">{route.summary}</span>
                        <span className="route-subtitle">
                          {mode === "transit"
                            ? `${route.legs?.length || 1} leg(s) • RTD Network`
                            : `${route.distance_km} km via Valhalla OSM`}
                        </span>
                      </div>
                      <div className="route-duration-badge">
                        <span className="duration-number">{route.duration_min} min</span>
                        {route.distance_km && <span className="distance-text">{route.distance_km} km</span>}
                      </div>
                    </div>

                    {/* Badges: On-Time ML, Weather, Events, Eco */}
                    <div className="route-badges-row">
                      {/* ML Reliability Badge */}
                      {route.on_time_probability != null && (
                        <span
                          className={`badge-pill ${
                            route.on_time_probability >= 0.8
                              ? "ontime-high"
                              : route.on_time_probability >= 0.6
                              ? "ontime-med"
                              : "ontime-low"
                          }`}
                          title={`Machine Learning model prediction based on weather & transit traffic`}
                        >
                          <ShieldCheck size={13} />
                          {Math.round(route.on_time_probability * 100)}% On-Time
                          {route.expected_delay_min > 0 && ` (+${Math.round(route.expected_delay_min)}m)`}
                        </span>
                      )}

                      {/* Weather Info */}
                      {route.weather && (
                        <span className="badge-pill weather-pill">
                          <CloudSun size={13} />
                          {Math.round(route.weather.temp)}°C {route.weather.weather_main || ""}
                        </span>
                      )}

                      {/* Carbon Savings */}
                      {route.carbon_saved_kg && route.carbon_saved_kg !== "0.0" && (
                        <span className="badge-pill green-pill">
                          <Leaf size={13} />
                          -{route.carbon_saved_kg} kg CO₂
                        </span>
                      )}

                      {/* Events alert */}
                      {route.events_nearby?.events?.length > 0 && (
                        <span className="badge-pill event-pill">
                          <Calendar size={13} />
                          {route.events_nearby.events.length} Event(s)
                        </span>
                      )}
                    </div>

                    {/* Step-by-Step Breakdown for Selected Route */}
                    {selectedRouteIndex === idx && (
                      <div className="route-steps-container">
                        {route.legs && route.legs.length > 0 ? (
                          route.legs.map((leg, legIdx) => (
                            <div key={legIdx} className="step-item">
                              <div className="step-icon-wrapper">
                                <Bus size={14} />
                              </div>
                              <div className="step-content">
                                <div className="step-title">
                                  <span className="transit-line-badge">{leg.route_id || leg.trip_id}</span>
                                  {leg.from_stop_name || "Board Bus"}
                                </div>
                                <div className="step-description">
                                  Depart {leg.departure_time || "on schedule"} • {leg.intermediate_stops?.length || 0} stops ({leg.duration_min || 10} min)
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="step-item">
                            <div className="step-icon-wrapper">
                              <Navigation size={14} />
                            </div>
                            <div className="step-content">
                              <div className="step-title">Direct {mode} Path</div>
                              <div className="step-description">
                                Follow navigation path for {route.distance_km || "~"} km ({route.duration_min} min)
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Leaflet Map */}
        <main className="map-view-wrapper">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={13}
            className="leaflet-map-root"
            zoomControl={false}
          >
            {/* Tile Layer (CartoDB Positron for light, Dark Matter for dark) */}
            <TileLayer
              url={
                theme === "dark"
                  ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              }
              attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />

            {/* Origin Pin */}
            {originCoords && (
              <Marker position={[originCoords.lat, originCoords.lon]} icon={originIcon}>
                <Popup>
                  <strong>Start:</strong> {originText || "Origin"}
                </Popup>
              </Marker>
            )}

            {/* Destination Pin */}
            {destCoords && (
              <Marker position={[destCoords.lat, destCoords.lon]} icon={destIcon}>
                <Popup>
                  <strong>Destination:</strong> {destText || "Destination"}
                </Popup>
              </Marker>
            )}

            {/* Intermediate Transit Stops */}
            {selectedRoute?.stops &&
              selectedRoute.stops.map((stop, i) => {
                if (stop.lat && stop.lon) {
                  return (
                    <Marker key={i} position={[stop.lat, stop.lon]} icon={stopIcon}>
                      <Tooltip>{stop.name || `Stop ${i + 1}`}</Tooltip>
                    </Marker>
                  );
                }
                return null;
              })}

            {/* Route Polylines (Glow Layer + Core Line) */}
            {selectedRoute?.polylineCoords && (
              <>
                {/* Outer Glow */}
                <Polyline
                  positions={selectedRoute.polylineCoords}
                  color={
                    mode === "transit"
                      ? "#10b981"
                      : mode === "bicycling"
                      ? "#38bdf8"
                      : mode === "walking"
                      ? "#f59e0b"
                      : "#6366f1"
                  }
                  weight={8}
                  opacity={0.35}
                />
                {/* Core Line */}
                <Polyline
                  positions={selectedRoute.polylineCoords}
                  color={
                    mode === "transit"
                      ? "#059669"
                      : mode === "bicycling"
                      ? "#0284c7"
                      : mode === "walking"
                      ? "#d97706"
                      : "#4f46e5"
                  }
                  weight={4}
                  opacity={0.95}
                />
                <FitBoundsToRoute coordinates={selectedRoute.polylineCoords} />
              </>
            )}
          </MapContainer>
        </main>
      </div>
    </div>
  );
}
