import React, { useState } from "react";
import {
  Compass,
  MapPin,
  Navigation,
  Bus,
  Footprints,
  Bike,
  Car,
  Clock,
  Sparkles,
  Mic,
  ArrowRight,
  ShieldCheck,
  Search,
  Activity,
  Bookmark,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";

export const PRIMARY_PRESETS = [
  { name: "Williams Village", label: "Williams Village", icon: "🚌", desc: "Buff Bus Hub", lat: 40.0000, lon: -105.2520 },
  { name: "CU Boulder (UMC)", label: "CU Campus", icon: "🎓", desc: "Main Campus", lat: 40.0076, lon: -105.2659 },
  { name: "Pearl St Mall", label: "Pearl Street", icon: "🛍️", desc: "Downtown Boulder", lat: 40.0176, lon: -105.2797 },
  { name: "Chautauqua & Flatirons", label: "Chautauqua", icon: "⛰️", desc: "Flatirons Trailhead", lat: 39.9989, lon: -105.2828 },
];

export const EXTRA_PRESETS = [
  { name: "29th St Mall", label: "29th Street Mall", icon: "🏬", desc: "Retail District", lat: 40.0175, lon: -105.2575 },
  { name: "Boulder Junction (RTD)", label: "Boulder Junction", icon: "🚉", desc: "Transit Station", lat: 40.0253, lon: -105.2505 },
  { name: "Sanitas Trailhead", label: "Mount Sanitas", icon: "🥾", desc: "Trailhead", lat: 40.0210, lon: -105.2970 },
  { name: "East Campus (Aerospace)", label: "CU East Campus", icon: "🚀", desc: "Research Park", lat: 40.0105, lon: -105.2445 },
];

export default function LauncherPage({
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
  onOpenVoice,
  onUseMyLocation,
  isLocating,
  isLoading,
  savedTrips = [],
  recentTrips = [],
  onSelectSavedTrip,
  onOpenStatus,
  isDarkTheme,
  onToggleTheme,
}) {
  const [showMorePresets, setShowMorePresets] = useState(false);
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");

  const modes = [
    { id: "transit", label: "Transit", icon: Bus, desc: "RTD & Buff Bus" },
    { id: "walk_transit_walk", label: "Multimodal", icon: Sparkles, desc: "Walk + Bus" },
    { id: "walking", label: "Walk", icon: Footprints, desc: "Pedestrian Paths" },
    { id: "bicycling", label: "Bike", icon: Bike, desc: "Boulder Creekside Trails" },
    { id: "driving", label: "Drive", icon: Car, desc: "Real-time Traffic" },
  ];

  const assistantQuerySuggestions = [
    "Fastest way to Pearl Street?",
    "Can I bike there?",
    "Which transit route has fewer transfers?",
    "Will I arrive before 2 PM?",
  ];

  const handlePresetSelect = (preset) => {
    setDestination(preset.name);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onPlanRoute();
  };

  const handleRunAssistantQuery = (query) => {
    if (onOpenVoice) {
      onOpenVoice(query);
    }
  };

  return (
    <div className="launcher-page">
      {/* Background Graphic Glow */}
      <div className="launcher-bg-mountain" aria-hidden="true">
        <div className="launcher-mountain-glow" />
      </div>

      {/* Top Utility Bar */}
      <div className="launcher-top-bar">
        <div className="brand-header-mini">
          <Compass className="brand-header-icon" size={18} />
          <span className="brand-header-text">BOULDER, COLORADO</span>
        </div>

        <div className="launcher-top-actions">
          {onOpenStatus && (
            <button
              type="button"
              className="top-utility-btn"
              onClick={onOpenStatus}
              title="System & ML Service Status"
              aria-label="System Diagnostics"
            >
              <Activity size={14} className="status-live-indicator" />
              <span>System Status</span>
            </button>
          )}

          {onToggleTheme && (
            <button
              type="button"
              className="top-utility-btn theme-btn"
              onClick={onToggleTheme}
              title="Toggle Theme"
              aria-label="Toggle dark/light theme"
            >
              {isDarkTheme ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>
      </div>

      <div className="launcher-container">
        {/* Compact Hero Section */}
        <header className="launcher-header compact">
          <h1 className="launcher-title">BoulderMove</h1>
          <p className="launcher-tagline">
            Smarter multimodal travel, accurate RTD transit routes, and ML punctuality predictions.
          </p>
        </header>

        {/* Saved / Recent Trips Quick Bar (if any) */}
        {(savedTrips.length > 0 || recentTrips.length > 0) && (
          <div className="launcher-saved-quick-bar">
            <span className="quick-bar-label">
              <Bookmark size={13} />
              <span>Quick Trips:</span>
            </span>
            <div className="quick-trips-scroll">
              {savedTrips.slice(0, 3).map((trip, idx) => (
                <button
                  key={`saved-${idx}`}
                  type="button"
                  className="quick-trip-chip saved"
                  onClick={() => onSelectSavedTrip(trip)}
                >
                  <span>★ {trip.origin} → {trip.destination}</span>
                </button>
              ))}
              {recentTrips.slice(0, 2).map((trip, idx) => (
                <button
                  key={`recent-${idx}`}
                  type="button"
                  className="quick-trip-chip recent"
                  onClick={() => onSelectSavedTrip(trip)}
                >
                  <RotateCcw size={11} />
                  <span>{trip.origin} → {trip.destination}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Launcher Search Form Card */}
        <form onSubmit={handleFormSubmit} className="launcher-card glass-panel">
          {/* Origin & Destination Inputs */}
          <div className="launcher-inputs-group">
            {/* Origin */}
            <div className="launcher-input-wrapper">
              <div className="launcher-input-icon-col">
                <div className="launcher-dot origin-dot">A</div>
                <div className="launcher-connector-line" />
              </div>
              <div className="launcher-input-body">
                <label htmlFor="launcher-origin-input" className="launcher-input-label">
                  From
                </label>
                <div className="launcher-input-field-row">
                  <input
                    id="launcher-origin-input"
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Enter origin address or landmark..."
                    className="launcher-text-input"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={onUseMyLocation}
                    className="launcher-action-btn"
                    title="Use my current GPS location"
                    disabled={isLocating}
                    aria-label="Use current location"
                  >
                    <Navigation size={14} className={isLocating ? "animate-spin" : ""} />
                    <span>{isLocating ? "Locating..." : "My location"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Destination */}
            <div className="launcher-input-wrapper">
              <div className="launcher-input-icon-col">
                <div className="launcher-dot dest-dot">B</div>
              </div>
              <div className="launcher-input-body">
                <label htmlFor="launcher-dest-input" className="launcher-input-label">
                  To
                </label>
                <div className="launcher-input-field-row">
                  <input
                    id="launcher-dest-input"
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Enter destination in Boulder..."
                    className="launcher-text-input"
                    autoComplete="off"
                  />
                  {destination && (
                    <button
                      type="button"
                      onClick={() => setDestination("")}
                      className="launcher-clear-btn"
                      title="Clear destination"
                      aria-label="Clear destination"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Popular Boulder Presets with + More toggle */}
          <div className="launcher-presets-section">
            <span className="launcher-section-subtitle">POPULAR BOULDER DESTINATIONS:</span>
            <div className="launcher-presets-grid">
              {PRIMARY_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`launcher-preset-pill ${destination === p.name ? "selected" : ""}`}
                >
                  <span className="preset-icon">{p.icon}</span>
                  <span className="preset-label">{p.label}</span>
                </button>
              ))}

              {showMorePresets &&
                EXTRA_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`launcher-preset-pill extra ${destination === p.name ? "selected" : ""}`}
                  >
                    <span className="preset-icon">{p.icon}</span>
                    <span className="preset-label">{p.label}</span>
                  </button>
                ))}

              <button
                type="button"
                onClick={() => setShowMorePresets(!showMorePresets)}
                className="launcher-preset-pill more-toggle-btn"
              >
                <span>{showMorePresets ? "− Less" : "+ More"}</span>
              </button>
            </div>
          </div>

          {/* Departure / Arrival Time Options */}
          <div className="launcher-time-section">
            <div className="launcher-time-pills">
              <button
                type="button"
                className={`time-pill ${timeMode === "now" ? "active" : ""}`}
                onClick={() => setTimeMode("now")}
              >
                Leave now
              </button>
              <button
                type="button"
                className={`time-pill ${timeMode === "depart_at" ? "active" : ""}`}
                onClick={() => setTimeMode("depart_at")}
              >
                Depart at
              </button>
              <button
                type="button"
                className={`time-pill ${timeMode === "arrive_by" ? "active" : ""}`}
                onClick={() => setTimeMode("arrive_by")}
              >
                Arrive by
              </button>
            </div>

            {timeMode !== "now" && (
              <div className="time-picker-row">
                <Clock size={15} className="time-picker-icon" />
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="launcher-native-time-input"
                  aria-label="Target Departure or Arrival time"
                />
              </div>
            )}
          </div>

          {/* Travel Mode Cards */}
          <div className="launcher-modes-section">
            <span className="launcher-section-subtitle">TRAVEL MODE:</span>
            <div className="launcher-modes-grid" role="radiogroup" aria-label="Travel mode">
              {modes.map((m) => {
                const IconComponent = m.icon;
                const isSelected = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={`launcher-mode-card ${isSelected ? "selected" : ""}`}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <IconComponent className="mode-card-icon" size={20} />
                    <span className="mode-card-label">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            className="launcher-submit-btn"
            disabled={isLoading || !destination.trim()}
          >
            <Search size={18} />
            <span>{isLoading ? "Planning Boulder Journey..." : "Plan route →"}</span>
          </button>
        </form>

        {/* Collapsible BoulderMove Assistant Bar */}
        <div className="launcher-assistant-drawer glass-panel">
          <div
            className="assistant-drawer-header"
            onClick={() => setIsAssistantExpanded(!isAssistantExpanded)}
          >
            <div className="assistant-header-left">
              <div className="assistant-mic-badge">
                <Mic size={15} />
              </div>
              <div className="assistant-header-text">
                <span className="assistant-main-title">Ask BoulderMove</span>
                <span className="assistant-sub-prompt">
                  Voice or smart natural language trip questions
                </span>
              </div>
            </div>
            <button
              type="button"
              className="assistant-toggle-arrow"
              aria-expanded={isAssistantExpanded}
            >
              {isAssistantExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isAssistantExpanded && (
            <div className="assistant-drawer-body">
              <div className="assistant-chips-row">
                {assistantQuerySuggestions.map((query, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    className="assistant-query-chip"
                    onClick={() => handleRunAssistantQuery(query)}
                  >
                    <span>"{query}"</span>
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (assistantInput.trim()) {
                    handleRunAssistantQuery(assistantInput.trim());
                    setAssistantInput("");
                  }
                }}
                className="assistant-custom-input-row"
              >
                <input
                  type="text"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  placeholder="Ask anything (e.g. 'Can I bike to Pearl St at 3 PM?')..."
                  className="assistant-text-field"
                />
                <button
                  type="submit"
                  className="assistant-ask-btn"
                  disabled={!assistantInput.trim()}
                >
                  Ask
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
