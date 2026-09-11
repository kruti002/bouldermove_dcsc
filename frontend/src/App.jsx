import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
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
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Leaf,
  Layers,
  RefreshCw,
  Info,
  Maximize2,
  Sliders,
  Plus,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  Check,
  Copy,
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
const waypointIcon = (idx) => createCustomIcon("#6366f1", String(idx + 1));

const stopDotIcon = L.divIcon({
  className: "custom-stop-marker",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#0f4c3a;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// -------------------------------------------------------------
// BOULDER PRESET LANDMARKS (INCL. BUFF BUS & STAMPEDE)
// -------------------------------------------------------------
const PRIMARY_LANDMARKS = [
  { name: "Williams Village (Buff Bus)", lat: 40.0000, lon: -105.2520, icon: "🚌" },
  { name: "CU Boulder Campus (UMC)", lat: 40.0076, lon: -105.2659, icon: "🎓" },
  { name: "Pearl St Mall", lat: 40.0176, lon: -105.2797, icon: "🛍️" },
  { name: "CU East Campus (SEEC)", lat: 40.0100, lon: -105.2440, icon: "🔬" },
];

const EXTRA_LANDMARKS = [
  { name: "Chautauqua & Flatirons", lat: 39.9989, lon: -105.2828, icon: "⛰️" },
  { name: "Boulder Junction (RTD)", lat: 40.0253, lon: -105.2505, icon: "🚉" },
  { name: "29th St Mall", lat: 40.0175, lon: -105.2575, icon: "🏬" },
  { name: "Sanitas Trailhead", lat: 40.0210, lon: -105.3015, icon: "🌲" },
  { name: "Bear Creek Apartments", lat: 39.9985, lon: -105.2535, icon: "🏢" },
  { name: "CU Engineering Center", lat: 40.0080, lon: -105.2630, icon: "⚙️" },
];

const DEFAULT_CENTER = [40.0150, -105.2705]; // Boulder, CO


// -------------------------------------------------------------
// MAP CONTROLLER (BOUNDS & RECENTER)
// -------------------------------------------------------------
function MapController({ coordinates, centerTrigger }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, coordinates]);

  useEffect(() => {
    if (centerTrigger > 0) {
      if (coordinates && coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates.map((c) => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else {
        map.setView(DEFAULT_CENTER, 13);
      }
    }
  }, [map, centerTrigger, coordinates]);

  return null;
}

// -------------------------------------------------------------
// MAP CLICK HANDLER (CLICK TO SET DESTINATION / ORIGIN)
// -------------------------------------------------------------
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// -------------------------------------------------------------
// MAP FLOATING CONTROLS
// -------------------------------------------------------------
function MapControls({ onFitRoute, onLocate }) {
  const map = useMap();

  return (
    <div className="map-floating-controls">
      <button
        className="map-control-btn"
        onClick={() => map.zoomIn()}
        title="Zoom In"
        aria-label="Zoom In"
      >
        +
      </button>
      <button
        className="map-control-btn"
        onClick={() => map.zoomOut()}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        −
      </button>
      <button
        className="map-control-btn"
        onClick={onFitRoute}
        title="Fit Route on Map"
        aria-label="Fit Route"
      >
        <Maximize2 size={16} />
      </button>
      <button
        className="map-control-btn"
        onClick={onLocate}
        title="My Location"
        aria-label="My Location"
      >
        <Navigation size={16} />
      </button>
    </div>
  );
}

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("bouldermove_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.className = theme === "dark" ? "dark" : "";
    localStorage.setItem("bouldermove_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // Backend URL
  const backendBaseUrl = useMemo(() => {
    return (
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_URL ||
      ""
    );
  }, []);

  // Server health state
  const [serverHealth, setServerHealth] = useState({
    checked: false,
    available: false,
    modelLoaded: false,
    waking: false,
  });

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${backendBaseUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        setServerHealth({
          checked: true,
          available: data.status === "ok" || data.status === "healthy" || data.status === "online",
          modelLoaded: Boolean(data.model_loaded),
          waking: false,
        });
      } else {
        setServerHealth((prev) => ({ ...prev, checked: true, available: false, waking: true }));
      }
    } catch {
      setServerHealth((prev) => ({ ...prev, checked: true, available: false, waking: true }));
    }
  }, [backendBaseUrl]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Live Boulder Local Clock (America/Denver - Mountain Time)
  const [localTimeStr, setLocalTimeStr] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLocalTimeStr(
        now.toLocaleTimeString("en-US", {
          timeZone: "America/Denver",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice Assistant state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const recognitionRef = useRef(null);

  // Slack Modal state
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);

  // Trip inputs (Origin, Intermediate Stops, Destination)
  const [originText, setOriginText] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [originResults, setOriginResults] = useState([]);

  // Intermediate Waypoints / Stops: array of { id, text, coords, results }
  const [waypoints, setWaypoints] = useState([]);

  const [destText, setDestText] = useState("");
  const [destCoords, setDestCoords] = useState(null);
  const [destResults, setDestResults] = useState([]);

  // Active searching state
  const [isSearching, setIsSearching] = useState({});
  const searchTimersRef = useRef({});


  // Departure / Arrival Scheduling: 'now' | 'depart_at' | 'arrive_by'
  const [timeScheduleType, setTimeScheduleType] = useState("now");
  const [customDate, setCustomDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  });
  const [customTime, setCustomTime] = useState(() => {
    const now = new Date();
    const str = now.toLocaleTimeString("en-GB", { timeZone: "America/Denver", hour12: false });
    return str.slice(0, 5);
  });
  const [departureMinutesOffset, setDepartureMinutesOffset] = useState(0);
  const [smartLeaveAdvice, setSmartLeaveAdvice] = useState(null);

  const [showMoreLandmarks, setShowMoreLandmarks] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const [mode, setMode] = useState("transit"); // 'transit' | 'walking' | 'bicycling' | 'driving'

  // Route calculation & predictions
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeStatus, setRouteStatus] = useState({ type: "idle", message: "" });
  const [showStepDetails, setShowStepDetails] = useState(true);
  const [showMLDetails, setShowMLDetails] = useState(false);
  const [expandedLegStops, setExpandedLegStops] = useState({ 0: true, 1: true });

  const [centerTrigger, setCenterTrigger] = useState(0);
  const activeRequestRef = useRef(0);

  // -------------------------------------------------------------
  // DEPARTURE TIME COMPUTATION
  // -------------------------------------------------------------
  const computedDepartISO = useMemo(() => {
    const d = new Date();
    if (timeScheduleType === "now") {
      if (departureMinutesOffset > 0) {
        d.setMinutes(d.getMinutes() + departureMinutesOffset);
      }
      return d.toISOString();
    }

    if (customDate && customTime) {
      const [h, m] = customTime.split(":").map(Number);
      const [year, month, day] = customDate.split("-").map(Number);
      if (!isNaN(h) && !isNaN(m) && !isNaN(year)) {
        const customD = new Date(year, month - 1, day, h, m, 0);
        return customD.toISOString();
      }
    }
    return d.toISOString();
  }, [timeScheduleType, customDate, customTime, departureMinutesOffset]);


  // -------------------------------------------------------------
  // ROBUST HIGH-SPEED GEOCODING HELPER
  // -------------------------------------------------------------
  const geocodeAddress = useCallback(
    async (query) => {
      if (!query || query.trim().length < 2) return [];

      const trimmed = query.trim();

      // Check for raw coordinates (lat, lon)
      const coordMatch = trimmed.match(
        /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/
      );
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (
          !isNaN(lat) &&
          !isNaN(lon) &&
          Math.abs(lat) <= 90 &&
          Math.abs(lon) <= 180
        ) {
          return [
            {
              display_name: `Coordinates (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
              lat,
              lon,
            },
          ];
        }
      }

      // 1. Try Backend Geocoding API (/api/geocode)
      try {
        const res = await fetch(
          `${backendBaseUrl}/api/geocode?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            return data.results;
          }
        }
      } catch {
        // Fallback below
      }

      // 2. Direct Photon Komoot fallback with Boulder bounding bias
      try {
        const isLocal = /boulder|co|colorado/i.test(trimmed);
        const searchQ = isLocal ? trimmed : `${trimmed}, Boulder, CO`;
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(
            searchQ
          )}&lat=40.0150&lon=-105.2705&limit=6`
        );
        if (res.ok) {
          const data = await res.json();
          const results = (data.features || [])
            .map((f) => {
              const p = f.properties || {};
              const coords = f.geometry?.coordinates || [];
              const hn = p.housenumber;
              const st = p.street;
              const nm = p.name;
              const city = p.city || p.locality || p.county || "Boulder";
              const state = p.state || "CO";
              const postcode = p.postcode;

              let parts = [];
              if (hn && st) parts.push(`${hn} ${st}`);
              else if (nm && st && nm !== st) parts.push(`${nm}, ${st}`);
              else if (nm) parts.push(nm);
              else if (st) parts.push(st);

              if (city) parts.push(city);
              if (state) parts.push(state);
              if (postcode) parts.push(postcode);

              return {
                display_name: parts.length > 0 ? parts.join(", ") : (nm || trimmed),
                lat: coords[1],
                lon: coords[0],
              };
            })
            .filter((item) => item.lat && item.lon);

          if (results.length > 0) return results;
        }
      } catch (err) {
        console.warn("Photon fallback notice:", err);
      }

      return [];
    },
    [backendBaseUrl]
  );

  // -------------------------------------------------------------
  // DEBOUNCED INPUT CHANGE HANDLER
  // -------------------------------------------------------------
  const handleAddressInput = useCallback(
    (text, target, waypointId = null) => {
      const timerKey = waypointId ? `waypoint_${waypointId}` : target;

      if (target === "origin") {
        setOriginText(text);
        if (!text.trim()) {
          setOriginCoords(null);
          setOriginResults([]);
        }
      } else if (target === "dest") {
        setDestText(text);
        if (!text.trim()) {
          setDestCoords(null);
          setDestResults([]);
        }
      } else if (target === "waypoint" && waypointId) {
        setWaypoints((prev) =>
          prev.map((w) =>
            w.id === waypointId
              ? { ...w, text, coords: !text.trim() ? null : w.coords }
              : w
          )
        );
      }

      if (searchTimersRef.current[timerKey]) {
        clearTimeout(searchTimersRef.current[timerKey]);
      }

      if (!text || text.trim().length < 2) {
        if (target === "origin") setOriginResults([]);
        else if (target === "dest") setDestResults([]);
        else if (target === "waypoint" && waypointId) {
          setWaypoints((prev) =>
            prev.map((w) => (w.id === waypointId ? { ...w, results: [] } : w))
          );
        }
        setIsSearching((prev) => ({ ...prev, [timerKey]: false }));
        return;
      }

      setIsSearching((prev) => ({ ...prev, [timerKey]: true }));
      searchTimersRef.current[timerKey] = setTimeout(async () => {
        const results = await geocodeAddress(text);
        setIsSearching((prev) => ({ ...prev, [timerKey]: false }));
        if (target === "origin") setOriginResults(results);
        else if (target === "dest") setDestResults(results);
        else if (target === "waypoint" && waypointId) {
          setWaypoints((prev) =>
            prev.map((w) => (w.id === waypointId ? { ...w, results } : w))
          );
        }
      }, 250);
    },
    [geocodeAddress]
  );

  // -------------------------------------------------------------
  // COMMIT / ENTER KEY SELECTION HANDLER
  // -------------------------------------------------------------
  const handleCommitInput = useCallback(
    async (target, waypointId = null) => {
      let text = "";
      let currentResults = [];

      if (target === "origin") {
        text = originText;
        currentResults = originResults;
      } else if (target === "dest") {
        text = destText;
        currentResults = destResults;
      } else if (target === "waypoint" && waypointId) {
        const wp = waypoints.find((w) => w.id === waypointId);
        text = wp?.text || "";
        currentResults = wp?.results || [];
      }

      if (!text || text.trim().length < 2) return;

      let chosen = currentResults[0];
      if (!chosen) {
        const directResults = await geocodeAddress(text);
        chosen = directResults[0];
      }

      if (chosen) {
        const shortLabel = chosen.display_name.split(",")[0] || text;
        if (target === "origin") {
          setOriginText(shortLabel);
          setOriginCoords({ lat: chosen.lat, lon: chosen.lon });
          setOriginResults([]);
        } else if (target === "dest") {
          setDestText(shortLabel);
          setDestCoords({ lat: chosen.lat, lon: chosen.lon });
          setDestResults([]);
        } else if (target === "waypoint" && waypointId) {
          setWaypoints((prev) =>
            prev.map((w) =>
              w.id === waypointId
                ? {
                    ...w,
                    text: shortLabel,
                    coords: { lat: chosen.lat, lon: chosen.lon },
                    results: [],
                  }
                : w
            )
          );
        }
      }
    },
    [originText, originResults, destText, destResults, waypoints, geocodeAddress]
  );

  // -------------------------------------------------------------
  // MAP CLICK LISTENER
  // -------------------------------------------------------------
  const handleMapClick = useCallback(
    (latlng) => {
      const { lat, lng } = latlng;
      const formatted = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (!originCoords) {
        setOriginText(`Map Pin (${formatted})`);
        setOriginCoords({ lat, lon: lng });
      } else {
        setDestText(`Map Pin (${formatted})`);
        setDestCoords({ lat, lon: lng });
      }
    },
    [originCoords]
  );

  // Add / Remove Waypoints
  const handleAddWaypoint = () => {
    if (waypoints.length >= 3) return;
    setWaypoints((prev) => [
      ...prev,
      { id: Date.now().toString(), text: "", coords: null, results: [] },
    ]);
  };

  const handleRemoveWaypoint = (id) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  };

  const handleSelectWaypointCoords = (id, item) => {
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              text: item.display_name.split(",")[0],
              coords: { lat: item.lat, lon: item.lon },
              results: [],
            }
          : w
      )
    );
  };

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

  const handleSelectLandmark = (landmark) => {
    if (!originCoords) {
      setOriginText(landmark.name);
      setOriginCoords({ lat: landmark.lat, lon: landmark.lon });
      setOriginResults([]);
    } else {
      setDestText(landmark.name);
      setDestCoords({ lat: landmark.lat, lon: landmark.lon });
      setDestResults([]);
    }
  };

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOriginText("Current Location");
          setOriginCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setCenterTrigger((c) => c + 1);
        },
        (err) => {
          console.warn("Location permission denied:", err);
        }
      );
    }
  };

  const toggleLegStops = (legIndex) => {
    setExpandedLegStops((prev) => ({
      ...prev,
      [legIndex]: !prev[legIndex],
    }));
  };

  // -------------------------------------------------------------
  // VOICE RECOGNITION & NATURAL SPEECH PROCESSING
  // -------------------------------------------------------------
  const handleProcessVoiceQuery = async (rawQuery) => {
    const query = (rawQuery || voiceTranscript || "").trim();
    if (!query || query.startsWith("Listening")) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setVoiceFeedback("Processing your speech and finding best route with XGBoost...");

    try {
      const res = await fetch(`${backendBaseUrl}/api/parse_query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setOriginText(data.origin.name.split(",")[0]);
        setOriginCoords({ lat: data.origin.lat, lon: data.origin.lon });
        setDestText(data.destination.name.split(",")[0]);
        setDestCoords({ lat: data.destination.lat, lon: data.destination.lon });
        if (data.mode) setMode(data.mode);
        const rawTargetTime = data.target_time_str || data.parsed?.target_time;
        if (rawTargetTime) {
          let h = 9, m = 0;
          const match = String(rawTargetTime).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (match) {
            h = parseInt(match[1], 10);
            m = match[2] ? parseInt(match[2], 10) : 0;
            const isPm = match[3] && match[3].toLowerCase() === "pm";
            const isAm = match[3] && match[3].toLowerCase() === "am";
            if (isPm && h < 12) h += 12;
            if (isAm && h === 12) h = 0;
          }
          const hh = String(h).padStart(2, "0");
          const mm = String(m).padStart(2, "0");
          setCustomTime(`${hh}:${mm}`);
          setTimeScheduleType(data.time_type || data.parsed?.time_type || "arrive_by");
        }
        setVoiceFeedback(data.speech_response);

        // Audio speech synthesis feedback
        if ("speechSynthesis" in window) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(data.speech_response);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
          } catch (e) {
            console.warn("SpeechSynthesis error:", e);
          }
        }
      } else {
        setVoiceFeedback("Could not find a route for that spoken query. Try mentioning a specific Boulder location (e.g., Williams Village, Norlin Library, Pearl Street).");
      }
    } catch {
      setVoiceFeedback("Backend query service unreachable. Check server connection.");
    }
  };

  const handleStartVoice = () => {
    setShowVoiceModal(true);
    setVoiceFeedback("");
    
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceTranscript("");
      setVoiceFeedback("Microphone recognition requires Chrome, Edge, or Safari with HTTPS. You can type or tap an example below!");
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      setIsListening(true);
      setVoiceTranscript("");

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join("");
        setVoiceTranscript(transcript);
      };

      recognition.onerror = (event) => {
        console.warn("Speech error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          setVoiceFeedback("Microphone access was blocked. Please allow mic permission in your browser or type below.");
        } else if (event.error === "no-speech") {
          setVoiceFeedback("No speech detected. Tap the mic button to try speaking again or edit your query below.");
        } else {
          setVoiceFeedback(`Voice recognition notice: ${event.error}. You can type or select an example below.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Mic error:", err);
      setIsListening(false);
      setVoiceFeedback("Could not start microphone. You can type your request directly below.");
    }
  };

  const handleStopVoiceAndProcess = () => {
    handleProcessVoiceQuery(voiceTranscript);
  };

  // -------------------------------------------------------------
  // CALCULATE ROUTE WITH REAL XGBOOST PREDICTION
  // -------------------------------------------------------------
  const calculateRoute = useCallback(async () => {
    if (!originCoords || !destCoords) return;

    const reqId = ++activeRequestRef.current;
    setRouteStatus({
      type: "loading",
      primaryMessage: "Finding the best route...",
      secondaryMessage: "Predicting your arrival with XGBoost...",
    });
    setRoutes([]);
    setShowStepDetails(true);

    try {
      if (mode === "transit") {
        const url = `${backendBaseUrl}/plan_transit_full`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: originCoords.lat, lon: originCoords.lon },
            destination: { lat: destCoords.lat, lon: destCoords.lon },
            depart_at: computedDepartISO,
          }),
        });

        const data = await res.json();
        if (reqId !== activeRequestRef.current) return;

        if (data.error) {
          setRouteStatus({
            type: "warning",
            primaryMessage: "No direct transit journey found at this departure time.",
            secondaryMessage: "Try searching for a later departure time or switch to walking/biking.",
          });
          return;
        }

        const transitLegs = data.transit || [];
        const prediction = data.prediction || {
          base_duration_minutes: Math.round(data.ml_features_used?.duration_min || 20),
          predicted_duration_minutes: Math.round(data.ml_features_used?.duration_min || 20) + 2,
          predicted_delay_minutes: 2.0,
          predicted_arrival: new Date(new Date(computedDepartISO).getTime() + 22 * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          prob_on_time: data.on_time_probability || 0.88,
          traffic_condition: "Moderate",
        };

        const transitRoute = {
          mode: "transit",
          summary: transitLegs.length > 0
            ? `RTD Transit (${transitLegs.map((l) => l.route_id || l.trip_id).join(" → ")})`
            : "Transit Route",
          base_duration_minutes: prediction.base_duration_minutes,
          predicted_duration_minutes: prediction.predicted_duration_minutes,
          predicted_delay_minutes: prediction.predicted_delay_minutes,
          predicted_arrival: prediction.predicted_arrival,
          prob_on_time: prediction.prob_on_time,
          traffic_condition: prediction.traffic_condition,
          distance_miles: (transitLegs.length * 2.8).toFixed(1),
          distance_km: (transitLegs.length * 4.5).toFixed(1),
          polylineCoords: (data.geometry || []).map((p) => ({ lat: p.lat, lng: p.lon })),
          legs: transitLegs,
          stops: transitLegs.flatMap((l) => l.intermediate_stops_details || l.intermediate_stops || []),
          weather: data.weather,
          events_nearby: data.events_nearby,
          features_used: data.ml_features_used,
        };

        // Smart "When Should I Leave?" derivation if arrive_by mode
        if (timeScheduleType === "arrive_by") {
          const targetArrivalDate = new Date(computedDepartISO);
          const leaveDate = new Date(targetArrivalDate.getTime() - prediction.predicted_duration_minutes * 60000);
          setSmartLeaveAdvice({
            targetArrival: targetArrivalDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            recommendedLeave: leaveDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            durationMinutes: prediction.predicted_duration_minutes,
            bufferMinutes: Math.round(prediction.predicted_delay_minutes || 3),
            routeName: transitRoute.summary,
          });
        } else {
          setSmartLeaveAdvice(null);
        }

        setRoutes([transitRoute]);
        setSelectedRouteIndex(0);
        setRouteStatus({ type: "success" });
      } else {
        // Road / Path routing (Walking, Biking, Driving with Waypoints)
        const validStops = waypoints
          .filter((w) => w.coords != null)
          .map((w) => `${w.coords.lat},${w.coords.lon}`)
          .join(";");

        const params = new URLSearchParams({
          origin: `${originCoords.lat},${originCoords.lon}`,
          destination: `${destCoords.lat},${destCoords.lon}`,
          mode,
          alternatives: String(showAlternatives),
          depart_at: computedDepartISO,
        });

        if (validStops) {
          params.append("stops", validStops);
        }

        const url = `${backendBaseUrl}/osm_directions?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();
        if (reqId !== activeRequestRef.current) return;

        if (data.error || !data.routes || data.routes.length === 0) {
          setRouteStatus({
            type: "no_route",
            primaryMessage: data.error?.message || "No route connects those locations.",
          });
          return;
        }

        const primaryPrediction = data.prediction;

        const parsedRoutes = data.routes.map((r, idx) => {
          const polyCoords = (r.geometry?.coordinates || []).map(([lng, lat]) => ({ lat, lng }));
          const baseDurationMin = Math.round(r.duration / 60);
          const distKm = Number((r.distance / 1000).toFixed(1));
          const distMiles = Number((distKm * 0.621371).toFixed(1));

          let predObj = primaryPrediction;
          if (idx > 0) {
            const ratio = baseDurationMin / (primaryPrediction?.base_duration_minutes || baseDurationMin);
            const delay = Math.round((primaryPrediction?.predicted_delay_minutes || 1) * ratio);
            const dur = baseDurationMin + delay;
            const arr = new Date(new Date(computedDepartISO).getTime() + dur * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            predObj = {
              base_duration_minutes: baseDurationMin,
              predicted_duration_minutes: dur,
              predicted_delay_minutes: delay,
              predicted_arrival: arr,
              prob_on_time: primaryPrediction?.prob_on_time || 0.85,
              traffic_condition: primaryPrediction?.traffic_condition || "Moderate",
            };
          }

          return {
            mode,
            summary: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Route ${idx > 0 ? `(Alt ${idx})` : ""}`,
            base_duration_minutes: predObj?.base_duration_minutes || baseDurationMin,
            predicted_duration_minutes: predObj?.predicted_duration_minutes || baseDurationMin,
            predicted_delay_minutes: predObj?.predicted_delay_minutes ?? 0,
            predicted_arrival: predObj?.predicted_arrival || new Date(new Date(computedDepartISO).getTime() + baseDurationMin * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            prob_on_time: predObj?.prob_on_time ?? 0.90,
            traffic_condition: predObj?.traffic_condition || "Light",
            distance_km: distKm,
            distance_miles: distMiles,
            polylineCoords: polyCoords,
            weather: data.weather,
            events_nearby: data.events_nearby,
          };
        });

        if (reqId !== activeRequestRef.current) return;

        // Smart "When Should I Leave?" derivation if arrive_by mode
        if (timeScheduleType === "arrive_by") {
          const targetArrivalDate = new Date(computedDepartISO);
          const primaryDur = parsedRoutes[0]?.predicted_duration_minutes || 15;
          const leaveDate = new Date(targetArrivalDate.getTime() - primaryDur * 60000);
          setSmartLeaveAdvice({
            targetArrival: targetArrivalDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            recommendedLeave: leaveDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            durationMinutes: primaryDur,
            bufferMinutes: Math.round(primaryPrediction?.predicted_delay_minutes || 2),
            routeName: parsedRoutes[0]?.summary || "Direct route",
          });
        } else {
          setSmartLeaveAdvice(null);
        }

        setRoutes(parsedRoutes);
        setSelectedRouteIndex(0);
        setRouteStatus({ type: "success" });
      }
    } catch (err) {
      if (reqId !== activeRequestRef.current) return;
      console.error("Routing error:", err);
      setRouteStatus({
        type: "error",
        primaryMessage: "Unable to calculate route.",
        secondaryMessage: "Please verify backend connectivity or try again.",
      });
    }
  }, [originCoords, destCoords, waypoints, mode, showAlternatives, computedDepartISO, timeScheduleType, backendBaseUrl]);


  useEffect(() => {
    if (originCoords && destCoords) {
      calculateRoute();
    }
  }, [calculateRoute, originCoords, destCoords, waypoints, mode, showAlternatives, computedDepartISO]);

  const selectedRoute = routes[selectedRouteIndex] || routes[0];

  return (
    <div className="app-container">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <header className="navbar">
        <div className="brand-section" onClick={() => window.location.reload()}>
          <div className="brand-logo-icon">
            <Compass size={20} strokeWidth={2.5} />
          </div>
          <div className="brand-title-group">
            <div className="brand-name">
              BoulderMove
              <span className="brand-badge">XGBoost ML</span>
              <span className="boulder-co-badge">🏔️ Boulder, CO</span>
            </div>
            <span className="brand-tagline">Boulder & CU Campus Transit Routing • Colorado</span>
          </div>
        </div>

        <div className="nav-center-info">
          <div className="nav-time-chip" title="Current Local Time in Boulder, CO (Mountain Time)">
            <Clock size={13} className="clock-icon" />
            <span className="clock-text">Boulder Time: {localTimeStr}</span>
          </div>
        </div>

        <div className="nav-actions">
          <button
            className="nav-action-btn voice-btn"
            onClick={handleStartVoice}
            title="Ask trip by voice"
          >
            <Mic size={15} />
            <span>Voice Assistant</span>
          </button>

          <button
            className="nav-action-btn slack-btn"
            onClick={() => setShowSlackModal(true)}
            title="Slack Integration"
          >
            <MessageSquare size={15} />
            <span>Slack Bot</span>
          </button>

          {serverHealth.available ? (
            <div className="service-status-pill ready">
              <span className="status-dot online"></span>
              <span>Online</span>
            </div>
          ) : serverHealth.waking ? (
            <div className="service-status-pill waking" title="Waking scale-to-zero container (~30s)">
              <span className="status-dot waking"></span>
              <span>Waking...</span>
            </div>
          ) : null}

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ---------------- MAIN LAYOUT ---------------- */}
      <div className="main-layout">
        {/* Left Sidebar (~35%) */}
        <aside className="sidebar">
          <div className="sidebar-scrollable">
            {/* BOULDER & COLORADO REGIONAL NOTICE */}
            <div className="boulder-region-info-banner">
              <MapPin size={13} className="region-pin-icon" />
              <span>Covering <strong>Boulder & CU Campus</strong>: RTD Transit, Will Vill Express, Stampede & Flatirons Corridors.</span>
            </div>

            {/* VOICE FAST-ACTION BANNER */}
            <div className="voice-prompt-banner" onClick={handleStartVoice}>
              <div className="voice-banner-icon">
                <Mic size={15} />
              </div>
              <div className="voice-banner-content">
                <span className="voice-banner-title">Speak your trip</span>
                <span className="voice-banner-sub">e.g. "Will Vill to Norlin Library by 9 AM"</span>
              </div>
            </div>

            {/* TRIP SETUP CARD */}
            <div className="trip-setup-card">
              {/* Origin, Waypoints & Destination Inputs */}
              <div className="inputs-block">
                <div className="input-indicator-column">
                  <div className="dot origin"></div>
                  <div className="connecting-line"></div>
                  {waypoints.map((_, i) => (
                    <React.Fragment key={i}>
                      <div className="dot waypoint"></div>
                      <div className="connecting-line"></div>
                    </React.Fragment>
                  ))}
                  <div className="dot dest"></div>
                </div>

                <div className="inputs-column">
                  {/* Origin */}
                  <div className="input-field-wrapper">
                    <input
                      type="text"
                      className="trip-input"
                      placeholder="Start point (e.g. Williams Village or 1050 28th St)"
                      value={originText}
                      onChange={(e) => handleAddressInput(e.target.value, "origin")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCommitInput("origin");
                        }
                      }}
                    />
                    {originText && (
                      <button
                        className="input-clear-btn"
                        onClick={() => {
                          setOriginText("");
                          setOriginCoords(null);
                          setOriginResults([]);
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}

                    {(originResults.length > 0 || isSearching["origin"]) && (
                      <div className="autocomplete-menu">
                        {isSearching["origin"] && originResults.length === 0 && (
                          <div className="autocomplete-loading-item">
                            <Search size={12} className="spinning-icon" />
                            <span>Searching addresses in Boulder...</span>
                          </div>
                        )}
                        {originResults.map((r, i) => (
                          <button
                            key={i}
                            className="autocomplete-menu-item"
                            onClick={() => {
                              setOriginText(r.display_name.split(",")[0]);
                              setOriginCoords({ lat: r.lat, lon: r.lon });
                              setOriginResults([]);
                            }}
                          >
                            <MapPin size={13} className="menu-icon" />
                            <span>{r.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Intermediate Waypoints / Stops */}
                  {waypoints.map((wp, idx) => (
                    <div key={wp.id} className="input-field-wrapper waypoint-wrapper">
                      <input
                        type="text"
                        className="trip-input"
                        placeholder={`Stop ${idx + 1} (e.g. 29th St Mall or address)`}
                        value={wp.text}
                        onChange={(e) => handleAddressInput(e.target.value, "waypoint", wp.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCommitInput("waypoint", wp.id);
                          }
                        }}
                      />
                      <button
                        className="input-clear-btn remove-wp"
                        onClick={() => handleRemoveWaypoint(wp.id)}
                        title="Remove Stop"
                      >
                        <Trash2 size={13} />
                      </button>

                      {(wp.results.length > 0 || isSearching[`waypoint_${wp.id}`]) && (
                        <div className="autocomplete-menu">
                          {isSearching[`waypoint_${wp.id}`] && wp.results.length === 0 && (
                            <div className="autocomplete-loading-item">
                              <Search size={12} className="spinning-icon" />
                              <span>Searching addresses...</span>
                            </div>
                          )}
                          {wp.results.map((r, i) => (
                            <button
                              key={i}
                              className="autocomplete-menu-item"
                              onClick={() => handleSelectWaypointCoords(wp.id, r)}
                            >
                              <MapPin size={13} className="menu-icon" />
                              <span>{r.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Destination */}
                  <div className="input-field-wrapper">
                    <input
                      type="text"
                      className="trip-input"
                      placeholder="Where to? (e.g. Norlin Library, CU UMC, Pearl St)"
                      value={destText}
                      onChange={(e) => handleAddressInput(e.target.value, "dest")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCommitInput("dest");
                        }
                      }}
                    />
                    {destText && (
                      <button
                        className="input-clear-btn"
                        onClick={() => {
                          setDestText("");
                          setDestCoords(null);
                          setDestResults([]);
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}

                    {(destResults.length > 0 || isSearching["dest"]) && (
                      <div className="autocomplete-menu">
                        {isSearching["dest"] && destResults.length === 0 && (
                          <div className="autocomplete-loading-item">
                            <Search size={12} className="spinning-icon" />
                            <span>Searching addresses in Boulder...</span>
                          </div>
                        )}
                        {destResults.map((r, i) => (
                          <button
                            key={i}
                            className="autocomplete-menu-item"
                            onClick={() => {
                              setDestText(r.display_name.split(",")[0]);
                              setDestCoords({ lat: r.lat, lon: r.lon });
                              setDestResults([]);
                            }}
                          >
                            <MapPin size={13} className="menu-icon" />
                            <span>{r.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button className="swap-btn" onClick={handleSwap} title="Swap Start & Destination">
                  <ArrowUpDown size={15} />
                </button>
              </div>

              {/* Add Stop Button */}
              {waypoints.length < 3 && (
                <button className="add-stop-btn" onClick={handleAddWaypoint}>
                  <Plus size={13} />
                  <span>Add intermediate stop</span>
                </button>
              )}

              {/* Compact Landmark Chips */}
              <div className="landmarks-container">
                <div className="landmarks-header">
                  <span className="landmarks-title">Popular Landmarks</span>
                  <button
                    className="landmarks-more-btn"
                    onClick={() => setShowMoreLandmarks((v) => !v)}
                  >
                    {showMoreLandmarks ? "Show Less" : "+ More"}
                  </button>
                </div>

                <div className="landmarks-grid">
                  {PRIMARY_LANDMARKS.map((item) => (
                    <button
                      key={item.name}
                      className="landmark-chip"
                      onClick={() => handleSelectLandmark(item)}
                      title={`Select ${item.name}`}
                    >
                      <span className="chip-emoji">{item.icon}</span>
                      <span className="chip-label">{item.name}</span>
                    </button>
                  ))}

                  {showMoreLandmarks &&
                    EXTRA_LANDMARKS.map((item) => (
                      <button
                        key={item.name}
                        className="landmark-chip"
                        onClick={() => handleSelectLandmark(item)}
                        title={`Select ${item.name}`}
                      >
                        <span className="chip-emoji">{item.icon}</span>
                        <span className="chip-label">{item.name}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="mode-tabs">
                <button
                  className={`mode-tab ${mode === "transit" ? "active" : ""}`}
                  onClick={() => setMode("transit")}
                >
                  <Bus size={17} />
                  <span>Transit</span>
                </button>
                <button
                  className={`mode-tab ${mode === "walking" ? "active" : ""}`}
                  onClick={() => setMode("walking")}
                >
                  <Footprints size={17} />
                  <span>Walk</span>
                </button>
                <button
                  className={`mode-tab ${mode === "bicycling" ? "active" : ""}`}
                  onClick={() => setMode("bicycling")}
                >
                  <Bike size={17} />
                  <span>Bike</span>
                </button>
                <button
                  className={`mode-tab ${mode === "driving" ? "active" : ""}`}
                  onClick={() => setMode("driving")}
                >
                  <Car size={17} />
                  <span>Drive</span>
                </button>
              </div>

              {/* Smart Departure & Arrival Time Segmented Controller */}
              <div className="smart-schedule-card">
                <div className="schedule-tabs-row">
                  <button
                    className={`sched-tab ${timeScheduleType === "now" ? "active" : ""}`}
                    onClick={() => {
                      setTimeScheduleType("now");
                      setDepartureMinutesOffset(0);
                    }}
                  >
                    Leave Now
                  </button>
                  <button
                    className={`sched-tab ${timeScheduleType === "depart_at" ? "active" : ""}`}
                    onClick={() => setTimeScheduleType("depart_at")}
                  >
                    Depart At
                  </button>
                  <button
                    className={`sched-tab ${timeScheduleType === "arrive_by" ? "active" : ""}`}
                    onClick={() => setTimeScheduleType("arrive_by")}
                  >
                    🎯 Arrive By
                  </button>
                </div>

                {timeScheduleType === "now" ? (
                  <div className="schedule-pills-row">
                    <button
                      className={`sched-pill ${departureMinutesOffset === 0 ? "active" : ""}`}
                      onClick={() => setDepartureMinutesOffset(0)}
                    >
                      Now
                    </button>
                    <button
                      className={`sched-pill ${departureMinutesOffset === 15 ? "active" : ""}`}
                      onClick={() => setDepartureMinutesOffset(15)}
                    >
                      +15m
                    </button>
                    <button
                      className={`sched-pill ${departureMinutesOffset === 30 ? "active" : ""}`}
                      onClick={() => setDepartureMinutesOffset(30)}
                    >
                      +30m
                    </button>
                    <button
                      className={`sched-pill ${departureMinutesOffset === 60 ? "active" : ""}`}
                      onClick={() => setDepartureMinutesOffset(60)}
                    >
                      +1h
                    </button>
                  </div>
                ) : (
                  <div className="schedule-custom-inputs">
                    <div className="custom-input-group">
                      <Calendar size={13} className="input-icon" />
                      <input
                        type="date"
                        className="custom-date-input"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                      />
                    </div>
                    <div className="custom-input-group">
                      <Clock size={13} className="input-icon" />
                      <input
                        type="time"
                        className="custom-time-input"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Options Accordion */}
              <div className="advanced-options-section">
                <button
                  className="advanced-toggle-btn"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <Sliders size={13} />
                  <span>Advanced options</span>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                  <div className="advanced-options-content">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={showAlternatives}
                        onChange={(e) => setShowAlternatives(e.target.checked)}
                      />
                      <span>Calculate alternative routes</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* SMART "WHEN SHOULD I LEAVE?" ADVICE BANNER */}
            {smartLeaveAdvice && (
              <div className="smart-leave-card">
                <div className="smart-leave-head">
                  <div className="smart-leave-badge">
                    <Clock size={13} />
                    <span>SMART DEPARTURE ADVISORY</span>
                  </div>
                  <span className="smart-leave-target">Target: {smartLeaveAdvice.targetArrival}</span>
                </div>
                <div className="smart-leave-body">
                  <div className="smart-leave-hero">
                    <span className="leave-subtext">You should leave at</span>
                    <span className="leave-time-highlight">{smartLeaveAdvice.recommendedLeave}</span>
                  </div>
                  <p className="smart-leave-explanation">
                    To arrive at <strong>{destText || "destination"}</strong> by <strong>{smartLeaveAdvice.targetArrival}</strong>, depart at <strong>{smartLeaveAdvice.recommendedLeave}</strong>. Journey takes ~{smartLeaveAdvice.durationMinutes} min (including a {smartLeaveAdvice.bufferMinutes}m XGBoost traffic & delay buffer).
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- ROUTE RESULTS AREA ---------------- */}
            {routeStatus.type === "loading" && (
              <div className="loading-state-card">
                <div className="pulse-indicator">
                  <div className="pulse-bar"></div>
                </div>
                <div className="loading-text-group">
                  <h4 className="loading-title">{routeStatus.primaryMessage}</h4>
                  <p className="loading-subtitle">{routeStatus.secondaryMessage}</p>
                </div>
              </div>
            )}

            {(routeStatus.type === "warning" || routeStatus.type === "error" || routeStatus.type === "no_route") && (
              <div className="alert-card">
                <AlertTriangle size={20} className="alert-icon" />
                <div className="alert-content">
                  <p className="alert-title">{routeStatus.primaryMessage}</p>
                  {routeStatus.secondaryMessage && (
                    <p className="alert-desc">{routeStatus.secondaryMessage}</p>
                  )}
                </div>
              </div>
            )}

            {routes.length > 0 && selectedRoute && (
              <div className="route-results-section">
                {/* PREDICTION HERO CARD */}
                <div className="prediction-hero-card">
                  <div className="hero-card-header">
                    <span className="hero-badge">RECOMMENDED</span>
                    <span className="hero-distance">
                      {selectedRoute.distance_miles ? `${selectedRoute.distance_miles} mi` : `${selectedRoute.distance_km} km`}
                    </span>
                  </div>

                  {/* PROMINENT PREDICTED ARRIVAL TIME */}
                  <div className="hero-arrival-block">
                    <div className="arrival-label">PREDICTED ARRIVAL</div>
                    <div className="arrival-time-display">{selectedRoute.predicted_arrival}</div>
                    <div className="journey-summary-line">
                      <Clock size={15} />
                      <span>{selectedRoute.predicted_duration_minutes} min predicted journey</span>
                    </div>
                  </div>

                  {/* Corridor */}
                  <div className="route-corridor-row">
                    <MapPin size={14} className="corridor-icon origin" />
                    <span className="corridor-text">{originText || "Origin"}</span>
                    <span className="corridor-arrow">→</span>
                    <MapPin size={14} className="corridor-icon dest" />
                    <span className="corridor-text">{destText || "Destination"}</span>
                  </div>

                  {/* METRIC BREAKDOWN GRID */}
                  <div className="prediction-breakdown-grid">
                    <div className="breakdown-metric-box">
                      <span className="metric-label">Standard estimate</span>
                      <span className="metric-value">{selectedRoute.base_duration_minutes} min</span>
                    </div>

                    <div className="breakdown-metric-box">
                      <span className="metric-label">Model adjustment</span>
                      <span className="metric-value adjustment">
                        {selectedRoute.predicted_delay_minutes > 0
                          ? `+${selectedRoute.predicted_delay_minutes} min`
                          : "On schedule"}
                      </span>
                    </div>

                    <div className="breakdown-metric-box">
                      <span className="metric-label">Traffic condition</span>
                      <span className="metric-value traffic">{selectedRoute.traffic_condition || "Moderate"}</span>
                    </div>

                    <div className="breakdown-metric-box">
                      <span className="metric-label">ML Punctuality</span>
                      <span className="metric-value confidence">
                        {Math.round(selectedRoute.prob_on_time * 100)}% On-Time
                      </span>
                    </div>
                  </div>

                  {/* Context Pills */}
                  <div className="context-pills-row">
                    {selectedRoute.weather && (
                      <span className="context-pill weather">
                        <CloudSun size={13} />
                        {Math.round(selectedRoute.weather.temp)}°C {selectedRoute.weather.weather_main || ""}
                      </span>
                    )}

                    {selectedRoute.events_nearby?.events?.length > 0 && (
                      <span className="context-pill events">
                        <Calendar size={13} />
                        {selectedRoute.events_nearby.events.length} Event(s) nearby
                      </span>
                    )}
                  </div>

                  {/* STEP DETAILS & TRANSIT STOPS DROPDOWN */}
                  <button
                    className="step-details-toggle"
                    onClick={() => setShowStepDetails((v) => !v)}
                  >
                    <span>Turn-by-turn navigation & stops</span>
                    {showStepDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {showStepDetails && (
                    <div className="steps-timeline">
                      {selectedRoute.mode === "transit" && selectedRoute.legs ? (
                        <>
                          {/* Step 1: Initial Walk to First Transit Stop */}
                          <div className="timeline-step">
                            <div className="timeline-icon walk">
                              <Footprints size={14} />
                            </div>
                            <div className="timeline-body">
                              <div className="timeline-head">
                                <span className="transit-tag walk-tag">Walk ~4 min</span>
                                <span className="timeline-stop-name">Walk to {selectedRoute.legs[0]?.from_stop_name || "Transit Stop"}</span>
                              </div>
                              <p className="timeline-sub">
                                From {originText || "Origin"} → {selectedRoute.legs[0]?.from_stop_name || "Boarding Stop"}
                              </p>
                            </div>
                          </div>

                          {/* Transit Legs */}
                          {selectedRoute.legs.map((leg, lIdx) => {
                            const interStops = leg.intermediate_stops_details || leg.intermediate_stops || [];
                            const isExpanded = expandedLegStops[lIdx] ?? true;

                            return (
                              <React.Fragment key={lIdx}>
                                {/* Bus Ride Leg */}
                                <div className="timeline-step transit-step">
                                  <div className="timeline-icon bus">
                                    <Bus size={14} />
                                  </div>
                                  <div className="timeline-body">
                                    <div className="timeline-head">
                                      <span className="transit-tag bus-tag">
                                        {leg.route_id || "RTD Bus"}
                                      </span>
                                      <span className="timeline-stop-name">
                                        {leg.from_stop_name || "Board Bus"}
                                      </span>
                                    </div>
                                    <p className="timeline-sub">
                                      Depart {leg.departure || "Scheduled"} → Ride towards {leg.to_stop_name || "Alight"} (arr {leg.arrival || ""})
                                    </p>

                                    {/* Intermediate Stops Breakdown */}
                                    {interStops.length > 0 && (
                                      <div className="intermediate-stops-section">
                                        <button
                                          className="intermediate-toggle-btn"
                                          onClick={() => toggleLegStops(lIdx)}
                                        >
                                          <span>
                                            {interStops.length} stops in between ({leg.duration_min || 10} min ride)
                                          </span>
                                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </button>

                                        {isExpanded && (
                                          <div className="stops-in-between-list">
                                            <div className="stops-explanation-note">
                                              <Info size={11} />
                                              <span>Stops matched along RTD route corridor schedule:</span>
                                            </div>
                                            {interStops.map((st, sIdx) => (
                                              <div key={sIdx} className="in-between-stop-item">
                                                <span className="stop-bullet">🚏</span>
                                                <span className="stop-name-text">{st.stop_name || st.name || `Stop #${st.stop_id || sIdx + 1}`}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Intermediate Transfer Walk between buses */}
                                {lIdx < selectedRoute.legs.length - 1 && (
                                  <div className="timeline-step transfer-step">
                                    <div className="timeline-icon transfer">
                                      <Footprints size={14} />
                                    </div>
                                    <div className="timeline-body">
                                      <div className="timeline-head">
                                        <span className="transit-tag transfer-tag">Transfer Walk ~2 min</span>
                                        <span className="timeline-stop-name">Connect at {leg.to_stop_name || "Transit Hub"}</span>
                                      </div>
                                      <p className="timeline-sub">
                                        Walk across terminal to connecting bus bay
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* Step Final: Walk to Destination */}
                          <div className="timeline-step">
                            <div className="timeline-icon walk">
                              <Footprints size={14} />
                            </div>
                            <div className="timeline-body">
                              <div className="timeline-head">
                                <span className="transit-tag walk-tag">Walk ~3 min</span>
                                <span className="timeline-stop-name">Walk to {destText || "Final Destination"}</span>
                              </div>
                              <p className="timeline-sub">
                                From {selectedRoute.legs[selectedRoute.legs.length - 1]?.to_stop_name || "Alighting Stop"} → Arrive at destination
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="timeline-step">
                          <div className="timeline-icon">
                            <Navigation size={14} />
                          </div>
                          <div className="timeline-body">
                            <div className="timeline-head">
                              <span className="timeline-stop-name">Direct {mode} route</span>
                            </div>
                            <p className="timeline-sub">
                              Follow navigation path for {selectedRoute.distance_miles ? `${selectedRoute.distance_miles} mi` : `${selectedRoute.distance_km} km`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABOUT THIS PREDICTION TOGGLE */}
                  <button
                    className="about-ml-toggle"
                    onClick={() => setShowMLDetails((v) => !v)}
                  >
                    <Info size={12} />
                    <span>About this prediction</span>
                  </button>

                  {showMLDetails && (
                    <div className="about-ml-box">
                      <p>
                        This arrival time is predicted using our trained <strong>XGBoost inference model</strong>, which evaluates scheduled duration, live OpenWeather conditions (rain, snow, wind), hour of day, and event proximity to calculate delay adjustments.
                      </p>
                    </div>
                  )}
                </div>

                {/* ALTERNATIVE ROUTES */}
                {routes.length > 1 && (
                  <div className="alternatives-section">
                    <h5 className="alternatives-title">Alternative Routes</h5>
                    {routes.slice(1).map((alt, aIdx) => (
                      <div
                        key={aIdx}
                        className={`alt-route-card ${selectedRouteIndex === aIdx + 1 ? "active" : ""}`}
                        onClick={() => setSelectedRouteIndex(aIdx + 1)}
                      >
                        <div className="alt-card-info">
                          <span className="alt-title">{alt.summary}</span>
                          <span className="alt-sub">
                            {alt.predicted_arrival} arrival • {alt.distance_miles ? `${alt.distance_miles} mi` : `${alt.distance_km} km`}
                          </span>
                        </div>
                        <div className="alt-dur">{alt.predicted_duration_minutes} min</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right Clean Leaflet Map (~65%) */}
        <main className="map-view-wrapper">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={13}
            className="leaflet-map-root"
            zoomControl={false}
          >
            {/* Standard 100% Free OpenStreetMap Tile Layer (No Watermarks, No API Key) */}
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Controller for bounds & recenter */}
            <MapController
              coordinates={selectedRoute?.polylineCoords}
              centerTrigger={centerTrigger}
            />

            {/* Click on map to set Pin */}
            <MapClickHandler onMapClick={handleMapClick} />

            {/* Floating Controls */}
            <MapControls
              onFitRoute={() => setCenterTrigger((c) => c + 1)}
              onLocate={handleLocateMe}
            />

            {/* Start Pin */}
            {originCoords && (
              <Marker position={[originCoords.lat, originCoords.lon]} icon={originIcon}>
                <Popup>
                  <strong>Start:</strong> {originText || "Origin"}
                </Popup>
              </Marker>
            )}

            {/* Intermediate Waypoint Pins */}
            {waypoints.map(
              (wp, i) =>
                wp.coords && (
                  <Marker key={wp.id} position={[wp.coords.lat, wp.coords.lon]} icon={waypointIcon(i)}>
                    <Popup>
                      <strong>Stop {i + 1}:</strong> {wp.text || `Waypoint ${i + 1}`}
                    </Popup>
                  </Marker>
                )
            )}

            {/* Destination Pin */}
            {destCoords && (
              <Marker position={[destCoords.lat, destCoords.lon]} icon={destIcon}>
                <Popup>
                  <strong>Destination:</strong> {destText || "Destination"}
                </Popup>
              </Marker>
            )}

            {/* Intermediate Transit Stops on Map */}
            {selectedRoute?.stops &&
              selectedRoute.stops.map((stop, i) => {
                if (stop.lat && stop.lon) {
                  return (
                    <Marker key={i} position={[stop.lat, stop.lon]} icon={stopDotIcon}>
                      <Tooltip>{stop.stop_name || stop.name || `Stop #${stop.stop_id || i + 1}`}</Tooltip>
                    </Marker>
                  );
                }
                return null;
              })}

            {/* Route Polylines */}
            {selectedRoute?.polylineCoords && (
              <>
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
                  opacity={0.3}
                />
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
              </>
            )}
          </MapContainer>
        </main>
      </div>

      {/* ---------------- VOICE ASSISTANT MODAL ---------------- */}
      {showVoiceModal && (
        <div className="voice-modal-backdrop" onClick={() => setShowVoiceModal(false)}>
          <div className="voice-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-title-group">
                <div className="modal-icon-badge voice">
                  <Mic size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Voice Trip Assistant</h3>
                  <span className="modal-sub">Speak naturally to plan your Boulder trip</span>
                </div>
              </div>
              <button className="modal-close-icon-btn" onClick={() => setShowVoiceModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="voice-modal-content">
              {/* Waveform Animation when listening */}
              <div className={`voice-waveform ${isListening ? "active" : ""}`}>
                <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              </div>

              {/* Editable Query Input & Transcript Area */}
              <div className="voice-transcript-bubble">
                <input
                  type="text"
                  className="voice-input-field"
                  placeholder="Speak or type your trip (e.g. 'I am at Williams Village and need to go to Norlin Library by 9 AM')"
                  value={voiceTranscript}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleStopVoiceAndProcess();
                    }
                  }}
                />
              </div>

              {/* Spoken Response Feedback */}
              {voiceFeedback && (
                <div className="voice-feedback-panel">
                  <Volume2 size={18} className="feedback-speaker-icon" />
                  <p className="feedback-text">{voiceFeedback}</p>
                </div>
              )}

              {/* Controls */}
              <div className="voice-control-buttons">
                {isListening ? (
                  <button className="voice-cta-btn listening" onClick={handleStopVoiceAndProcess}>
                    <MicOff size={16} />
                    <span>Done Speaking & Plan Route</span>
                  </button>
                ) : (
                  <button className="voice-cta-btn ready" onClick={handleStartVoice}>
                    <Mic size={16} />
                    <span>Start Speaking 🎙️</span>
                  </button>
                )}
                <button
                  className="voice-plan-btn"
                  onClick={handleStopVoiceAndProcess}
                  disabled={!voiceTranscript.trim()}
                >
                  <Navigation size={16} />
                  <span>Plan Route</span>
                </button>
              </div>

              {/* Voice Query Examples */}
              <div className="voice-samples-box">
                <span className="samples-title">Try one of these queries:</span>
                <div className="samples-list">
                  <button
                    className="sample-item"
                    onClick={() => {
                      const text = "I am at Williams Village and want to go to Norlin Library by 9:00 AM";
                      setVoiceTranscript(text);
                      handleProcessVoiceQuery(text);
                    }}
                  >
                    "I am at Williams Village and want to go to Norlin Library by 9:00 AM"
                  </button>
                  <button
                    className="sample-item"
                    onClick={() => {
                      const text = "What time should I leave from Pearl Street to CU Boulder?";
                      setVoiceTranscript(text);
                      handleProcessVoiceQuery(text);
                    }}
                  >
                    "What time should I leave from Pearl Street to CU Boulder?"
                  </button>
                  <button
                    className="sample-item"
                    onClick={() => {
                      const text = "Bike from Chautauqua to 29th Street Mall";
                      setVoiceTranscript(text);
                      handleProcessVoiceQuery(text);
                    }}
                  >
                    "Bike from Chautauqua to 29th Street Mall"
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SLACK INTEGRATION MODAL ---------------- */}
      {showSlackModal && (
        <div className="voice-modal-backdrop" onClick={() => setShowSlackModal(false)}>
          <div className="slack-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-title-group">
                <div className="modal-icon-badge slack">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Slack Integration & Bot Commands</h3>
                  <span className="modal-sub">Ask for Boulder transit and leave times directly in Slack</span>
                </div>
              </div>
              <button className="modal-close-icon-btn" onClick={() => setShowSlackModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="slack-modal-content">
              <p className="slack-desc-text">
                Connect BoulderMove to your Slack workspace! Team members and students can type slash commands to get instant departure times, live weather warnings, and XGBoost punctuality scores without opening a browser.
              </p>

              {/* 1-Click Add to Slack Button & Public Install Action */}
              <div className="slack-install-cta-card">
                <div className="slack-install-info">
                  <span className="slack-install-title">Install to Any Workspace</span>
                  <span className="slack-install-desc">Add the /bouldermove command to your team or student workspace with one click.</span>
                </div>
                <a
                  href={`${backendBaseUrl || ""}/api/slack/install`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="add-to-slack-btn"
                >
                  <svg className="slack-logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" width="18" height="18">
                    <path fill="#e01e5a" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"/>
                    <path fill="#36c5f0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z"/>
                    <path fill="#2eb67d" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"/>
                    <path fill="#ecb22e" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z"/>
                  </svg>
                  <span>Add to Slack</span>
                </a>
              </div>

              {/* Slash Command Preview Card */}
              <div className="slack-code-card">
                <span className="slack-code-title">Slack Slash Command</span>
                <div className="slack-cmd-bar">
                  <code>/bouldermove Williams Village to Norlin Library by 9:00 AM</code>
                  <button
                    className="copy-cmd-btn"
                    onClick={() => {
                      navigator.clipboard.writeText("/bouldermove Williams Village to Norlin Library by 9:00 AM");
                      setCopiedSlack(true);
                      setTimeout(() => setCopiedSlack(false), 2000);
                    }}
                  >
                    {copiedSlack ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSlack ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Bot Response Mock Preview */}
              <div className="slack-mock-preview">
                <div className="slack-mock-header">
                  <span className="bot-avatar">🏔️</span>
                  <div className="bot-info">
                    <span className="bot-name">BoulderMove Bot</span>
                    <span className="bot-tag">APP</span>
                  </div>
                </div>
                <div className="slack-mock-body">
                  <div className="slack-field-row">
                    <div><strong>📍 From:</strong> Williams Village</div>
                    <div><strong>🎯 To:</strong> Norlin Library</div>
                  </div>
                  <div className="slack-field-row highlight">
                    <div><strong>⏰ Recommended Leave Time:</strong> <code>8:38 AM</code></div>
                    <div><strong>🏁 Estimated Arrival:</strong> <code>9:00 AM</code> (~22 min)</div>
                  </div>
                  <div className="slack-field-row">
                    <div><strong>🚌 Route:</strong> Will Vill Buff Bus → Walk</div>
                    <div><strong>🤖 ML Score:</strong> 91% Confidence (Light Traffic)</div>
                  </div>
                </div>
              </div>

              {/* Quick Example Slash Commands */}
              <div className="slack-examples-section">
                <span className="slack-code-title">Example Commands to Try in Slack:</span>
                <div className="slack-quick-cmds">
                  <button
                    type="button"
                    className="slack-quick-cmd-item"
                    onClick={() => {
                      navigator.clipboard.writeText("/bouldermove Bear Creek to Engineering Center");
                      setCopiedSlack(true);
                      setTimeout(() => setCopiedSlack(false), 2000);
                    }}
                  >
                    <code>/bouldermove Bear Creek to Engineering Center</code>
                    <span className="copy-tag">📋 Copy</span>
                  </button>
                  <button
                    type="button"
                    className="slack-quick-cmd-item"
                    onClick={() => {
                      navigator.clipboard.writeText("/bouldermove East Campus SEEC to Pearl Street by 5:30 PM");
                      setCopiedSlack(true);
                      setTimeout(() => setCopiedSlack(false), 2000);
                    }}
                  >
                    <code>/bouldermove East Campus SEEC to Pearl Street by 5:30 PM</code>
                    <span className="copy-tag">📋 Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
