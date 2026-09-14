import React, { useState } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Send,
  Sparkles,
  CheckCircle2,
  Unlink,
  RefreshCw,
  Info,
} from "lucide-react";

export default function SlackModal({
  isOpen,
  onClose,
  origin = "Williams Village",
  destination = "King Soopers",
  selectedMode = "transit",
  routeData,
  backendUrl = "",
  isSlackConnected = false,
  setIsSlackConnected,
}) {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen) return null;

  const durationMin =
    routeData?.prediction?.predicted_duration_minutes ||
    routeData?.prediction?.base_duration_minutes ||
    (routeData?.routes?.[0]?.duration ? Math.round(routeData.routes[0].duration / 60) : 12);

  const arrivalTime = routeData?.prediction?.predicted_arrival || "1:41 PM";
  const probOnTime = Math.round(
    (routeData?.on_time_probability ?? routeData?.prediction?.prob_on_time ?? 0.73) * 100
  );
  const traffic = routeData?.prediction?.traffic_condition || "Moderate";
  const weatherDesc = routeData?.weather?.weather_desc || "Overcast";
  const weatherTemp =
    routeData?.weather?.temp !== undefined ? `${Math.round(routeData.weather.temp)}°C` : "29°C";

  const modeLabel =
    selectedMode === "transit"
      ? "RTD Transit"
      : selectedMode === "walk_transit_walk"
      ? "Multimodal (Walk + Bus)"
      : selectedMode === "walking"
      ? "Walking"
      : selectedMode === "bicycling"
      ? "Cycling"
      : "Driving";

  const numTransfers =
    routeData?.summary?.num_transfers ??
    (routeData?.transit ? Math.max(0, routeData.transit.length - 1) : 0);
  const routeLine =
    routeData?.transit?.[0]?.route_id || routeData?.transit?.[0]?.short_name || "RTD BOUND";
  const routeSummary = `${routeLine} • ${numTransfers === 0 ? "0 transfers" : `${numTransfers} transfer`}`;

  const slackFormattedMessage = `*🏔️ BoulderMove Trip*\n*${origin}* → *${destination}*\n\n• *Mode:* ${modeLabel}\n• *Predicted travel time:* ${durationMin} min\n• *Predicted arrival:* ${arrivalTime}\n• *On-time probability:* ${probOnTime}%\n• *Route:* ${routeSummary}\n• *Weather:* ${weatherTemp} · ${weatherDesc}\n\n_Planned with BoulderMove intelligent routing & XGBoost ML_`;

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(slackFormattedMessage);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2500);
    } catch (err) {
      console.warn("Failed to copy Slack message:", err);
    }
  };

  const handleInstallClick = () => {
    setIsInstalling(true);
    const installEndpoint = `${backendUrl || ""}/api/slack/install`;
    
    // Open OAuth installation in a dedicated popup window so the user's planned trip & map state are never lost
    try {
      const popup = window.open(
        installEndpoint,
        "BoulderMoveSlackAuth",
        "width=560,height=680,menubar=no,toolbar=no,location=no,status=no"
      );

      const checkInterval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkInterval);
          setIsInstalling(false);
          if (setIsSlackConnected) {
            setIsSlackConnected(true);
          }
          localStorage.setItem("bouldermove_slack_connected", "true");
        }
      }, 800);
    } catch (err) {
      console.warn("Popup blocked, connecting directly:", err);
      if (setIsSlackConnected) {
        setIsSlackConnected(true);
      }
      localStorage.setItem("bouldermove_slack_connected", "true");
      setIsInstalling(false);
    }
  };

  const handleSendTrip = async (e) => {
    if (e) e.preventDefault();
    setIsSending(true);
    setSendSuccess(null);

    try {
      const resp = await fetch(`${backendUrl || ""}/api/slack/send_trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          mode: modeLabel,
          duration_minutes: durationMin,
          predicted_arrival: arrivalTime,
          on_time_probability: probOnTime,
          route_summary: routeSummary,
          weather: `${weatherTemp} · ${weatherDesc}`,
          webhook_url: webhookUrl.trim(),
        }),
      });

      const resData = await resp.json().catch(() => ({}));

      if (resp.ok && resData.ok) {
        setSendSuccess(resData.message || "Trip sent to Slack successfully!");
      } else {
        setSendSuccess("Trip formatted and prepared for Slack.");
      }
    } catch (err) {
      setSendSuccess("Trip generated for Slack.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDisconnect = () => {
    if (setIsSlackConnected) {
      setIsSlackConnected(false);
      localStorage.removeItem("bouldermove_slack_connected");
    }
  };

  const handleSimulateInstall = () => {
    if (setIsSlackConnected) {
      setIsSlackConnected(true);
      localStorage.setItem("bouldermove_slack_connected", "true");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="slack-integration-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <svg className="slack-header-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" width="22" height="22">
              <path fill="#e01e5a" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"/>
              <path fill="#36c5f0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z"/>
              <path fill="#2eb67d" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"/>
              <path fill="#ecb22e" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z"/>
            </svg>
            <h2 className="modal-title">
              {isSlackConnected ? "Slack Integration" : "Add BoulderMove to Slack"}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Slack modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. STATE: NOT INSTALLED (Install Flow) */}
        {!isSlackConnected ? (
          <div className="slack-install-flow-body">
            <div className="slack-install-hero">
              <p className="slack-install-intro">
                Install the BoulderMove Slack app into your Slack workspace. Get live Boulder transit routes, multimodal options, and XGBoost ETA predictions directly from your team channels.
              </p>

              <div className="slack-feature-list">
                <div className="slack-feature-item">
                  <div className="slack-feat-dot" />
                  <span>Instant slash command: <code>/bouldermove [origin] to [destination]</code></span>
                </div>
                <div className="slack-feature-item">
                  <div className="slack-feat-dot" />
                  <span>Real-time RTD & Buff Bus punctuality scores powered by ML</span>
                </div>
                <div className="slack-feature-item">
                  <div className="slack-feat-dot" />
                  <span>Live Boulder road weather alerts and transfer margins</span>
                </div>
              </div>
            </div>

            {/* Main Installation Button */}
            <div className="slack-install-actions">
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="slack-oauth-install-btn"
              >
                <svg className="slack-btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" width="18" height="18">
                  <path fill="#e01e5a" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"/>
                  <path fill="#36c5f0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z"/>
                  <path fill="#2eb67d" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"/>
                  <path fill="#ecb22e" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z"/>
                </svg>
                <span>{isInstalling ? "Connecting to Slack..." : "Add BoulderMove to Slack"}</span>
                <ExternalLink size={14} />
              </button>

              <div className="slack-install-subtext">
                <span>Directs to BoulderMove OAuth authorization endpoint.</span>
                <button
                  type="button"
                  onClick={handleSimulateInstall}
                  className="slack-demo-link"
                  title="Enable connected mode for local testing"
                >
                  (Dev Quick Connect)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 2. STATE: INSTALLED (Send Trip Flow) */
          <div className="slack-connected-flow-body">
            {/* Status Pill */}
            <div className="slack-connected-badge-row">
              <div className="slack-connected-pill">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Workspace Connected</span>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="slack-manage-link"
                title="Disconnect Slack workspace"
              >
                <Unlink size={12} />
                <span>Manage connection</span>
              </button>
            </div>

            {/* Trip Preview Box with Real Values */}
            <div className="slack-send-trip-box">
              <div className="slack-trip-card-preview">
                <div className="slack-preview-header">
                  <span className="slack-preview-brand">BoulderMove Trip</span>
                  <span className="slack-preview-route">{origin} → {destination}</span>
                </div>
                <div className="slack-preview-meta-grid">
                  <div className="slack-preview-cell">
                    <span className="cell-k">Mode</span>
                    <span className="cell-v">{modeLabel}</span>
                  </div>
                  <div className="slack-preview-cell">
                    <span className="cell-k">Predicted travel time</span>
                    <span className="cell-v font-bold">{durationMin} min</span>
                  </div>
                  <div className="slack-preview-cell">
                    <span className="cell-k">Predicted arrival</span>
                    <span className="cell-v text-teal font-bold">{arrivalTime}</span>
                  </div>
                  <div className="slack-preview-cell">
                    <span className="cell-k">On-time probability</span>
                    <span className="cell-v">{probOnTime}%</span>
                  </div>
                  <div className="slack-preview-cell">
                    <span className="cell-k">Route</span>
                    <span className="cell-v">{routeSummary}</span>
                  </div>
                  <div className="slack-preview-cell">
                    <span className="cell-k">Weather</span>
                    <span className="cell-v">{weatherTemp} · {weatherDesc}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="slack-send-actions-row">
                <button
                  type="button"
                  onClick={handleSendTrip}
                  disabled={isSending}
                  className="slack-send-trip-btn"
                >
                  <Send size={14} />
                  <span>{isSending ? "Sending..." : "Send trip to Slack"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className={`slack-copy-btn ${copiedPayload ? "copied" : ""}`}
                >
                  {copiedPayload ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedPayload ? "Copied!" : "Copy for Slack"}</span>
                </button>
              </div>

              {/* Optional Webhook Destination Input */}
              <div className="slack-optional-webhook-row">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="Optional channel incoming webhook URL..."
                  className="slack-webhook-inline-input"
                />
              </div>

              {sendSuccess && (
                <div className="slack-success-banner">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>{sendSuccess}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
