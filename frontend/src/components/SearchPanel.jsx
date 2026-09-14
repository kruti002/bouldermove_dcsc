import React, { useState } from "react";
import {
  ArrowLeftRight,
  Search,
  Sparkles,
  Bus,
  Footprints,
  Bike,
  Car,
  Clock,
  Mic,
  Compass,
  Activity,
  Bookmark,
} from "lucide-react";

export default function SearchPanel({
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
  onBackToLauncher,
  onOpenVoice,
  onOpenStatus,
  onOpenSavedDrawer,
  isLoading,
}) {
  const modes = [
    { id: "transit", label: "Transit", icon: Bus },
    { id: "walk_transit_walk", label: "Multimodal", icon: Sparkles },
    { id: "walking", label: "Walk", icon: Footprints },
    { id: "bicycling", label: "Bike", icon: Bike },
    { id: "driving", label: "Drive", icon: Car },
  ];

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onPlanRoute();
  };

  return (
    <div className="search-panel-glass glass-panel">
      <form onSubmit={handleFormSubmit} className="search-panel-form">
        {/* Brand Link / Home Button */}
        <div className="panel-header-row">
          <button
            type="button"
            onClick={onBackToLauncher}
            className="brand-home-link"
            title="Return to BoulderMove Home"
          >
            <Compass size={18} className="brand-compass-icon" />
            <span className="brand-name">BoulderMove</span>
          </button>

          <div className="panel-header-actions">
            {onOpenSavedDrawer && (
              <button
                type="button"
                onClick={onOpenSavedDrawer}
                className="header-action-btn"
                title="Saved & Recent Trips"
                aria-label="View saved trips"
              >
                <Bookmark size={15} />
                <span className="hide-mobile">Saved</span>
              </button>
            )}

            {onOpenStatus && (
              <button
                type="button"
                onClick={onOpenStatus}
                className="header-action-btn status-pill-btn"
                title="System Diagnostics & Health"
                aria-label="System status"
              >
                <Activity size={14} className="status-live-dot" />
                <span className="hide-mobile">Status</span>
              </button>
            )}
          </div>
        </div>

        {/* Origin / Destination Input Rows */}
        <div className="search-inputs-cluster">
          <div className="input-fields-col">
            <div className="search-field-unit origin-unit">
              <span className="input-letter-badge origin-badge">A</span>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Starting address or landmark..."
                className="panel-text-input"
                aria-label="Starting location"
              />
            </div>

            <div className="search-field-unit dest-unit">
              <span className="input-letter-badge dest-badge">B</span>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination in Boulder..."
                className="panel-text-input"
                aria-label="Destination location"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            className="swap-locations-btn"
            title="Swap Origin & Destination"
            aria-label="Swap locations"
          >
            <ArrowLeftRight size={15} />
          </button>
        </div>

        {/* Travel Mode Pills Row */}
        <div className="search-mode-selector-row">
          <div className="mode-chips-list" role="radiogroup" aria-label="Travel mode">
            {modes.map((m) => {
              const IconComp = m.icon;
              const isSelected = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMode(m.id)}
                  className={`mode-selector-chip ${isSelected ? "active" : ""}`}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <IconComp size={13} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Mode & Recalculate Row */}
        <div className="search-time-actions-row">
          <div className="time-selector-group">
            <div className="time-mode-pills">
              <button
                type="button"
                className={`time-mode-btn ${timeMode === "now" ? "active" : ""}`}
                onClick={() => setTimeMode("now")}
              >
                Leave now
              </button>
              <button
                type="button"
                className={`time-mode-btn ${timeMode === "depart_at" ? "active" : ""}`}
                onClick={() => setTimeMode("depart_at")}
              >
                Depart at
              </button>
              <button
                type="button"
                className={`time-mode-btn ${timeMode === "arrive_by" ? "active" : ""}`}
                onClick={() => setTimeMode("arrive_by")}
              >
                Arrive by
              </button>
            </div>

            {timeMode !== "now" && (
              <div className="time-picker-wrapper">
                <Clock size={14} className="time-input-icon" />
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="time-native-input"
                  aria-label="Target travel time"
                />
              </div>
            )}
          </div>

          <div className="search-submit-group">
            <button
              type="button"
              onClick={onOpenVoice}
              className="assistant-mic-btn"
              title="Voice & Assistant routing query"
              aria-label="Voice assistant query"
            >
              <Mic size={16} />
            </button>

            <button
              type="submit"
              className="replan-submit-btn"
              disabled={isLoading}
            >
              <Search size={15} />
              <span>{isLoading ? "Updating..." : "Update Route"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
