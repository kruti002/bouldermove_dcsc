import React, { useState, useEffect } from "react";
import RouteCard, { BOULDER_PARKING_LOCATIONS } from "./RouteCard";
import AlternativeRoutes from "./AlternativeRoutes";
import EventsCard from "./EventsCard";
import MapView from "./MapView";
import ShareTripModal from "./ShareTripModal";
import SlackModal from "./SlackModal";
import SavedTripsModal from "./SavedTripsModal";
import SystemStatusModal from "./SystemStatusModal";
import {
  AlertCircle,
  RefreshCw,
  Sparkles,
  Map as MapIcon,
  List,
} from "lucide-react";

export default function RouteResults({
  origin,
  setOrigin,
  destination,
  setDestination,
  selectedMode,
  setSelectedMode,
  timeMode,
  setTimeMode,
  targetTime,
  setTargetTime,
  onPlanRoute,
  routeData,
  weatherData,
  eventsData,
  isLoading,
  error,
  originCoord,
  destCoord,
  userCoord,
  onUseMyLocation,
  isDarkTheme,
  savedTrips = [],
  onToggleSaveTrip,
  isTripSaved = false,
  onTripsUpdated,
  onSelectSavedTrip,
  systemHealth,
  onRefreshHealth,
  isLoadingHealth,
  backendUrl = "",
  isSlackConnected = false,
  setIsSlackConnected,
}) {
  const [activeAlt, setActiveAlt] = useState(null);
  const [mobileTab, setMobileTab] = useState("route"); // "route" | "map"
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  // Staged loading text progression
  useEffect(() => {
    if (!isLoading) {
      setLoadingStage(0);
      return;
    }
    const timer1 = setTimeout(() => setLoadingStage(1), 1000);
    const timer2 = setTimeout(() => setLoadingStage(2), 2200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isLoading]);

  const loadingMessages = [
    { title: "Finding routes...", sub: "Evaluating multimodal networks & RTD feeds" },
    { title: "Checking travel conditions...", sub: "Analyzing road weather, traffic & transfer margins" },
    { title: "Predicting your arrival...", sub: "Computing punctuality score with XGBoost model" },
  ];

  // Active displayed route (Recommended vs selected Alternative)
  const activeRouteData = activeAlt
    ? {
        ...routeData,
        transit: activeAlt.legs,
        geometry: activeAlt.geometry,
        prediction: {
          ...routeData?.prediction,
          predicted_duration_minutes: activeAlt.duration_min,
          base_duration_minutes: activeAlt.duration_min,
        },
        summary: {
          ...routeData?.summary,
          badge: activeAlt.badge,
          reason: activeAlt.reason,
          total_duration_min: activeAlt.duration_min,
          num_transfers: activeAlt.num_transfers,
        },
      }
    : routeData;

  const activeGeometry =
    activeAlt?.geometry ||
    routeData?.geometry ||
    (routeData?.routes?.[0]?.geometry?.coordinates?.map((c) => ({ lat: c[1], lon: c[0] })) || []);
  const transitLegs = activeRouteData?.transit || activeRouteData?.legs || [];

  const altGeometries = (routeData?.alternatives || [])
    .filter((a) => !activeAlt || a.id !== activeAlt.id)
    .map((a) => a.geometry)
    .filter(Boolean);

  const handleModeChange = (newMode) => {
    setSelectedMode(newMode);
    setActiveAlt(null);
    onPlanRoute(origin, destination, newMode);
  };

  const handleUpdateLocations = (newOrig, newDest) => {
    setOrigin(newOrig);
    setDestination(newDest);
    setActiveAlt(null);
    onPlanRoute(newOrig, newDest, selectedMode);
  };

  return (
    <div className="route-results-layout">
      {/* Mobile View Toggle */}
      <div className="mobile-view-toggle">
        <button
          type="button"
          onClick={() => setMobileTab("route")}
          className={`mobile-tab-btn ${mobileTab === "route" ? "active" : ""}`}
        >
          <List size={15} />
          <span>Trip & Arrival</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("map")}
          className={`mobile-tab-btn ${mobileTab === "map" ? "active" : ""}`}
        >
          <MapIcon size={15} />
          <span>Interactive Map</span>
        </button>
      </div>

      {/* Main Split View: 38-40% Left Sidebar / 60-62% Sticky Leaflet Map */}
      <div className="results-split-container">
        {/* Left Results Column */}
        <div className={`results-sidebar ${mobileTab === "map" ? "mobile-hidden" : ""}`}>
          {/* Staged Loading State */}
          {isLoading && (
            <div className="results-loading-state glass-panel">
              <div className="loading-spinner-large animate-spin" />
              <h3 className="loading-stage-title">{loadingMessages[loadingStage].title}</h3>
              <p className="loading-stage-sub">{loadingMessages[loadingStage].sub}</p>
              <div className="loading-progress-bar-track">
                <div
                  className="loading-progress-bar-fill"
                  style={{ width: `${((loadingStage + 1) / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Graceful Error State */}
          {error && !isLoading && (
            <div className="results-error-state glass-panel">
              <AlertCircle size={32} className="error-icon" />
              <h3 className="error-title">Route calculation notice</h3>
              <p className="error-desc">{error}</p>
              <div className="error-actions-row">
                <button
                  type="button"
                  onClick={() => onPlanRoute(origin, destination, selectedMode)}
                  className="error-retry-btn"
                >
                  <RefreshCw size={14} />
                  <span>Retry Search</span>
                </button>
              </div>
            </div>
          )}

          {/* Successful Route Results Flow */}
          {!isLoading && !error && routeData && (
            <div className="results-content-stack">
              {/* 1-5: Main Route & Prediction Card */}
              <RouteCard
                routeData={activeRouteData}
                originName={origin}
                destinationName={destination}
                weatherData={weatherData}
                selectedMode={selectedMode}
                onSelectMode={handleModeChange}
                timeMode={timeMode}
                onSelectTimeMode={setTimeMode}
                targetTime={targetTime}
                onTargetTimeChange={setTargetTime}
                departureTime={timeMode !== "now" ? targetTime : "Now"}
                onOpenShare={() => setIsShareOpen(true)}
                onOpenSlack={() => setIsSlackOpen(true)}
                onToggleSaveTrip={onToggleSaveTrip}
                isTripSaved={isTripSaved}
                onUpdateLocations={handleUpdateLocations}
                isSlackConnected={isSlackConnected}
              />

              {/* 6. Collapsible Alternative Routes Accordion */}
              {routeData.alternatives && routeData.alternatives.length > 0 && (
                <AlternativeRoutes
                  alternatives={routeData.alternatives}
                  activeAlternativeId={activeAlt ? activeAlt.id : null}
                  onSelectAlternative={(alt) => setActiveAlt(alt)}
                  onSelectRecommended={() => setActiveAlt(null)}
                />
              )}

              {/* 7. Contextual Nearby Events Card */}
              <EventsCard
                eventsData={eventsData || routeData.events_nearby}
                isLoading={isLoading}
              />

              {/* Footer Signature Credit */}
              <footer className="sidebar-author-footer">
                <span className="footer-author-brand">BoulderMove</span>
                <span className="footer-dot">•</span>
                <span className="footer-author-credit">Kruti Shah © 2026</span>
              </footer>
            </div>
          )}
        </div>

        {/* Right Sticky Map Column */}
        <div className={`results-map-pane ${mobileTab === "route" ? "mobile-hidden-map" : ""}`}>
          <MapView
            originCoord={originCoord}
            destCoord={destCoord}
            userCoord={userCoord}
            originName={origin}
            destinationName={destination}
            routeGeometry={activeGeometry}
            alternativeGeometries={altGeometries}
            transitLegs={transitLegs}
            parkingLocations={BOULDER_PARKING_LOCATIONS}
            showParking={selectedMode === "driving"}
            isDarkTheme={isDarkTheme}
            onUseMyLocation={onUseMyLocation}
          />
        </div>
      </div>

      {/* Share Trip Modal */}
      <ShareTripModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        origin={origin}
        destination={destination}
        selectedMode={selectedMode}
        routeData={activeRouteData}
        backendUrl={backendUrl}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        origin={origin}
        destination={destination}
        selectedMode={selectedMode}
        routeData={activeRouteData}
        backendUrl={backendUrl}
        isSlackConnected={isSlackConnected}
        setIsSlackConnected={setIsSlackConnected}
      />

      {/* Saved Trips Management Modal */}
      <SavedTripsModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedTrips={savedTrips}
        onSelectTrip={onSelectSavedTrip}
        onTripsUpdated={onTripsUpdated}
      />

      {/* System Status Diagnostics Modal */}
      <SystemStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        systemHealth={systemHealth}
        onRefresh={onRefreshHealth}
        isLoadingHealth={isLoadingHealth}
        isSlackConnected={isSlackConnected}
      />
    </div>
  );
}
