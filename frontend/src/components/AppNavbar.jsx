import React from "react";
import {
  Compass,
  ArrowRight,
  Activity,
  Bookmark,
  Sun,
  Moon,
  Mic,
  Home,
} from "lucide-react";

export default function AppNavbar({
  origin = "Williams Village",
  destination = "King Soopers",
  onNavigateHome,
  onOpenVoice,
  onOpenSlack,
  isSlackConnected = false,
  onOpenStatus,
  onOpenSavedTrips,
  isDarkTheme,
  onToggleTheme,
}) {
  return (
    <header className="app-persistent-header glass-panel">
      {/* LEFT: Logo & Brand */}
      <div className="header-left-col">
        <button
          type="button"
          onClick={onNavigateHome}
          className="header-brand-button"
          title="Return to BoulderMove Home"
          aria-label="BoulderMove Home"
        >
          <Compass className="header-brand-icon" size={20} />
          <span className="header-brand-text">BoulderMove</span>
        </button>

        <button
          type="button"
          onClick={onOpenSavedTrips}
          className="header-nav-pill-btn"
          title="View Saved Journeys"
        >
          <Bookmark size={13} />
          <span>Saved</span>
        </button>
      </div>

      {/* CENTER: Compact Trip Summary */}
      <div className="header-center-col">
        <div className="header-trip-pill" title="Current trip route">
          <span className="trip-node origin-text">{origin || "Origin"}</span>
          <ArrowRight size={13} className="trip-arrow-icon" />
          <span className="trip-node dest-text">{destination || "Destination"}</span>
        </div>
      </div>

      {/* RIGHT: Voice, Slack, Status, Theme */}
      <div className="header-right-col">
        {/* Voice Assistant */}
        <button
          type="button"
          onClick={onOpenVoice}
          className="header-action-btn voice-btn"
          title="Ask BoulderMove Assistant"
          aria-label="Ask BoulderMove Assistant"
        >
          <Mic size={15} />
          <span className="hide-mobile">Ask BoulderMove</span>
        </button>

        {/* Slack Integration */}
        <button
          type="button"
          onClick={onOpenSlack}
          className={`header-action-btn slack-btn ${isSlackConnected ? "connected" : ""}`}
          title={isSlackConnected ? "Slack Workspace Connected (Send trip)" : "Add BoulderMove to Slack"}
          aria-label={isSlackConnected ? "Slack Workspace Connected" : "Add BoulderMove to Slack"}
        >
          <svg className="header-slack-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" width="15" height="15">
            <path fill="#e01e5a" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"/>
            <path fill="#36c5f0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z"/>
            <path fill="#2eb67d" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"/>
            <path fill="#ecb22e" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z"/>
          </svg>
          <span className="hide-mobile">{isSlackConnected ? "Slack ✓" : "Slack"}</span>
        </button>

        {/* System Diagnostics */}
        <button
          type="button"
          onClick={onOpenStatus}
          className="header-action-btn status-btn"
          title="System Diagnostics & Service Availability"
          aria-label="System status"
        >
          <Activity size={13} className="header-status-indicator" />
          <span className="hide-mobile">Status</span>
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="header-theme-toggle-btn"
          title={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle dark and light theme"
        >
          {isDarkTheme ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
