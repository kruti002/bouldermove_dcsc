import React, { useState, useEffect, useCallback } from "react";
import LandingPage from "./components/LandingPage";
import AppNavbar from "./components/AppNavbar";
import RouteResults from "./components/RouteResults";
import VoiceAssistantModal from "./components/VoiceAssistantModal";
import SystemStatusModal from "./components/SystemStatusModal";
import SlackModal from "./components/SlackModal";
import SavedTripsModal from "./components/SavedTripsModal";
import {
  getSavedTrips,
  saveTrip,
  isTripSaved as checkIsTripSaved,
  deleteTrip,
} from "./services/savedTripsService";
import { CheckCircle2, X } from "lucide-react";
import "./App.css";

// Backend URL: supports dynamic production backend host (e.g. Render/Fly.io) or relative proxy in development
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

export default function App() {
  // Navigation View State: "landing" | "planner"
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== "undefined" && window.location.search) {
      const p = new URLSearchParams(window.location.search);
      if (
        p.get("dest") ||
        p.get("destination") ||
        p.get("planner") ||
        p.get("slack") ||
        window.location.pathname.includes("/planner") ||
        window.location.pathname.includes("/app")
      ) {
        return "planner";
      }
    }
    return "landing";
  });

  // Route Form State
  const [origin, setOrigin] = useState("Williams Village");
  const [destination, setDestination] = useState("King Soopers");
  const [selectedMode, setSelectedMode] = useState("transit");
  const [timeMode, setTimeMode] = useState("now"); // "now" | "depart_at" | "arrive_by"
  const [targetTime, setTargetTime] = useState("09:00");

  // Geocoded Coordinates & GPS
  const [originCoord, setOriginCoord] = useState({ lat: 40.0000, lng: -105.2520 });
  const [destCoord, setDestCoord] = useState({ lat: 40.0145, lng: -105.2530 });
  const [userCoord, setUserCoord] = useState(null);

  // Route Results & External Data State
  const [routeData, setRouteData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [eventsData, setEventsData] = useState(null);

  // Saved Trips (Local Persistence)
  const [savedTripsList, setSavedTripsList] = useState(() => getSavedTrips());

  // Slack Connection State (OAuth persisted)
  const [isSlackConnected, setIsSlackConnected] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bouldermove_slack_connected") === "true";
    }
    return false;
  });
  const [slackToastMessage, setSlackToastMessage] = useState(null);

  // Modals & Drawers
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);

  // Status
  const [systemHealth, setSystemHealth] = useState(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // Slack OAuth URL & postMessage listener for popup window authorization
  useEffect(() => {
    // 1. Listen for postMessage from popup OAuth window
    const handleMessage = (event) => {
      if (event.data && event.data.type === "SLACK_CONNECTED") {
        setIsSlackConnected(true);
        localStorage.setItem("bouldermove_slack_connected", "true");
        setSlackToastMessage(
          event.data.team
            ? `BoulderMove was added to ${event.data.team} on Slack.`
            : "BoulderMove was added to Slack successfully."
        );
        setTimeout(() => setSlackToastMessage(null), 5000);
      }
    };
    window.addEventListener("message", handleMessage);

    // 2. Fallback check for URL params
    if (typeof window !== "undefined" && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("slack") === "connected" || params.get("slack") === "installed") {
        setIsSlackConnected(true);
        localStorage.setItem("bouldermove_slack_connected", "true");
        setSlackToastMessage("BoulderMove was added to Slack successfully.");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        const timer = setTimeout(() => setSlackToastMessage(null), 5000);
        return () => {
          window.removeEventListener("message", handleMessage);
          clearTimeout(timer);
        };
      } else if (params.get("slack") === "error") {
        const msg = params.get("msg") || "Could not complete Slack authorization.";
        setSlackToastMessage(`Slack notice: ${msg}`);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        const timer = setTimeout(() => setSlackToastMessage(null), 6000);
        return () => {
          window.removeEventListener("message", handleMessage);
          clearTimeout(timer);
        };
      }
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Theme synchronization
  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkTheme]);

  // Initial Health Check
  const fetchHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/health`);
      if (resp.ok) {
        const data = await resp.json();
        setSystemHealth(data);
      } else {
        setSystemHealth({ status: "error", model_loaded: false });
      }
    } catch (err) {
      setSystemHealth({ status: "offline", model_loaded: false });
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Save trips persistence
  const handleToggleSaveTrip = () => {
    const isSaved = checkIsTripSaved(origin, destination);
    if (isSaved) {
      const target = savedTripsList.find(
        (t) => t.origin.toLowerCase() === origin.toLowerCase() && t.destination.toLowerCase() === destination.toLowerCase()
      );
      if (target) {
        const updated = deleteTrip(target.id);
        setSavedTripsList(updated);
      }
    } else {
      const updated = saveTrip({
        origin,
        destination,
        mode: selectedMode,
        originCoord,
        destCoord,
        timePreference: timeMode,
      });
      setSavedTripsList(updated);
    }
  };

  const isCurrentTripSaved = checkIsTripSaved(origin, destination);

  // Geocode address lookup helper
  const geocodeLocation = async (query) => {
    if (!query || !query.trim()) return null;

    const lower = query.toLowerCase();
    if (lower.includes("williams village")) return { lat: 40.0000, lng: -105.2520, name: "Williams Village" };
    if (lower.includes("king soopers")) return { lat: 40.0145, lng: -105.2530, name: "King Soopers (30th & Arapahoe)" };
    if (lower.includes("glenwood")) return { lat: 40.0340, lng: -105.2590, name: "2777 Glenwood Court" };
    if (lower.includes("umc") || lower.includes("campus") || lower.includes("cu boulder")) return { lat: 40.0076, lng: -105.2659, name: "CU Boulder UMC" };
    if (lower.includes("pearl")) return { lat: 40.0176, lng: -105.2797, name: "Pearl St Mall" };
    if (lower.includes("29th")) return { lat: 40.0175, lng: -105.2575, name: "29th St Mall" };
    if (lower.includes("chautauqua")) return { lat: 39.9989, lng: -105.2828, name: "Chautauqua & Flatirons" };
    if (lower.includes("boulder junction")) return { lat: 40.0253, lng: -105.2505, name: "Boulder Junction" };

    try {
      const resp = await fetch(
        `${BACKEND_URL}/geocode_address?address=${encodeURIComponent(query)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const top = data.results[0];
          return {
            lat: top.lat,
            lng: top.lon,
            name: top.display_name || query,
          };
        }
      }
    } catch (e) {
      console.warn("Geocode fallback warning:", e);
    }
    return { lat: 40.0150, lng: -105.2705, name: query };
  };

  // Main Route Planning Handler
  const planRoute = useCallback(async (customOrigin, customDest, customMode) => {
    const origToUse = customOrigin || origin || "Williams Village";
    const destToUse = customDest || destination;
    const modeToUse = customMode || selectedMode || "transit";

    if (!destToUse || !destToUse.trim()) {
      setError("Please enter a destination to plan your route.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentView("planner");

    try {
      const origGeo = await geocodeLocation(origToUse);
      const destGeo = await geocodeLocation(destToUse);

      if (!origGeo || !destGeo) {
        throw new Error("Could not find that location. Please try another search.");
      }

      setOriginCoord({ lat: origGeo.lat, lng: origGeo.lng });
      setDestCoord({ lat: destGeo.lat, lng: destGeo.lng });

      const now = new Date();
      let departIso = now.toISOString();
      if (timeMode !== "now" && targetTime) {
        const [hours, minutes] = targetTime.split(":").map(Number);
        const targetDate = new Date();
        targetDate.setHours(hours || 9, minutes || 0, 0, 0);
        departIso = targetDate.toISOString();
      }

      let resData = null;

      if (modeToUse === "transit" || modeToUse === "walk_transit_walk") {
        const payload = {
          origin: { lat: origGeo.lat, lon: origGeo.lng },
          destination: { lat: destGeo.lat, lon: destGeo.lng },
          depart_at: departIso,
        };

        const resp = await fetch(`${BACKEND_URL}/plan_transit_full`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          throw new Error("Transit routing service is temporarily unavailable. Try road or walk mode.");
        }

        resData = await resp.json();
      } else {
        const modeParam =
          modeToUse === "bicycling"
            ? "bicycling"
            : modeToUse === "walking"
            ? "walking"
            : "driving";

        const resp = await fetch(
          `${BACKEND_URL}/osm_directions?origin=${origGeo.lat},${origGeo.lng}&destination=${destGeo.lat},${destGeo.lng}&mode=${modeParam}&alternatives=true`
        );

        if (!resp.ok) {
          throw new Error("Road routing service is currently unavailable. Please verify coordinates.");
        }

        resData = await resp.json();
      }

      setRouteData(resData);
      setWeatherData(resData.weather || null);
      setEventsData(resData.events_nearby || null);
    } catch (err) {
      console.error("Route planning error:", err);
      setError(
        err.message || "Failed to calculate route. Please verify locations and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, selectedMode, timeMode, targetTime]);

  // Auto-plan initial route when planner view is active or deep-linked
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qOrigin = urlParams.get("origin");
      const qDest = urlParams.get("dest") || urlParams.get("destination");
      const qMode = urlParams.get("mode");

      if (qOrigin) setOrigin(qOrigin);
      if (qDest) setDestination(qDest);
      if (qMode) setSelectedMode(qMode);

      if (currentView === "planner" && !routeData && !isLoading) {
        planRoute(qOrigin || origin, qDest || destination, qMode || selectedMode);
      }
    } catch (err) {
      console.warn("URL query parse warning:", err);
    }
  }, [currentView]);

  // Use My Location GPS handler
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setOrigin("Williams Village");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOriginCoord(coords);
        setUserCoord(coords);
        setOrigin("My Location (GPS)");
        setIsLocating(false);
      },
      (err) => {
        console.warn("Geolocation denied/unavailable:", err);
        setOrigin("Williams Village");
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSelectSavedTrip = (trip) => {
    setOrigin(trip.origin);
    setDestination(trip.destination);
    if (trip.mode) setSelectedMode(trip.mode);
    planRoute(trip.origin, trip.destination, trip.mode || "transit");
  };

  const handleVoiceConfirmPlan = (confirmedTrip) => {
    if (confirmedTrip.origin) setOrigin(confirmedTrip.origin);
    if (confirmedTrip.destination) setDestination(confirmedTrip.destination);
    if (confirmedTrip.mode) setSelectedMode(confirmedTrip.mode);
    if (confirmedTrip.targetTime) {
      setTimeMode(confirmedTrip.timeType || "depart_at");
      setTargetTime(confirmedTrip.targetTime);
    }

    setTimeout(() => {
      planRoute(confirmedTrip.origin, confirmedTrip.destination, confirmedTrip.mode);
    }, 100);
  };

  return (
    <div className="bouldermove-app">
      {/* Slack Post-Install Notification Banner */}
      {slackToastMessage && (
        <div className="slack-global-toast-banner" role="status">
          <div className="slack-toast-content">
            <CheckCircle2 size={16} className="text-teal" />
            <span>{slackToastMessage}</span>
          </div>
          <button
            type="button"
            className="slack-toast-close"
            onClick={() => setSlackToastMessage(null)}
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. LANDING PAGE VIEW */}
      {currentView === "landing" && (
        <LandingPage
          onOpenPlanner={() => setCurrentView("planner")}
          isDarkTheme={isDarkTheme}
          onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
          onOpenStatus={() => setIsStatusOpen(true)}
        />
      )}

      {/* 2. PLANNER APPLICATION WORKSPACE */}
      {currentView === "planner" && (
        <div className="planner-view-wrapper">
          {/* Persistent Clean Header */}
          <AppNavbar
            origin={origin}
            destination={destination}
            onNavigateHome={() => setCurrentView("landing")}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenSlack={() => setIsSlackOpen(true)}
            isSlackConnected={isSlackConnected}
            onOpenStatus={() => setIsStatusOpen(true)}
            onOpenSavedTrips={() => setIsSavedModalOpen(true)}
            isDarkTheme={isDarkTheme}
            onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
          />

          <RouteResults
            origin={origin}
            setOrigin={setOrigin}
            destination={destination}
            setDestination={setDestination}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            timeMode={timeMode}
            setTimeMode={setTimeMode}
            targetTime={targetTime}
            setTargetTime={setTargetTime}
            onPlanRoute={planRoute}
            routeData={routeData}
            weatherData={weatherData}
            eventsData={eventsData}
            isLoading={isLoading}
            error={error}
            originCoord={originCoord}
            destCoord={destCoord}
            userCoord={userCoord}
            onUseMyLocation={handleUseMyLocation}
            isDarkTheme={isDarkTheme}
            savedTrips={savedTripsList}
            onToggleSaveTrip={handleToggleSaveTrip}
            isTripSaved={isCurrentTripSaved}
            onTripsUpdated={(list) => setSavedTripsList(list)}
            onSelectSavedTrip={handleSelectSavedTrip}
            systemHealth={systemHealth}
            onRefreshHealth={fetchHealth}
            isLoadingHealth={isLoadingHealth}
            backendUrl={BACKEND_URL}
            isSlackConnected={isSlackConnected}
            setIsSlackConnected={setIsSlackConnected}
          />
        </div>
      )}

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onConfirmPlan={handleVoiceConfirmPlan}
        backendUrl={BACKEND_URL}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        origin={origin}
        destination={destination}
        selectedMode={selectedMode}
        routeData={routeData}
        backendUrl={BACKEND_URL}
        isSlackConnected={isSlackConnected}
        setIsSlackConnected={setIsSlackConnected}
      />

      {/* Saved Trips Modal */}
      <SavedTripsModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedTrips={savedTripsList}
        onSelectTrip={handleSelectSavedTrip}
        onTripsUpdated={(list) => setSavedTripsList(list)}
      />

      {/* System Diagnostics Modal */}
      <SystemStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        systemHealth={systemHealth}
        onRefresh={fetchHealth}
        isLoadingHealth={isLoadingHealth}
        isSlackConnected={isSlackConnected}
      />
    </div>
  );
}
