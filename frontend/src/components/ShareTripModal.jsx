import React, { useState } from "react";
import { Share2, Copy, Check, X, MessageSquare, ExternalLink, Sparkles, Navigation } from "lucide-react";

export default function ShareTripModal({
  isOpen,
  onClose,
  origin,
  destination,
  selectedMode,
  routeData,
  backendUrl = "",
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  // Generate deep link URL
  const queryParams = new URLSearchParams({
    origin: origin || "",
    dest: destination || "",
    mode: selectedMode || "transit",
  });
  const shareableUrl = `${window.location.origin}${window.location.pathname}?${queryParams.toString()}`;

  // Extract trip values for summary
  const durationMin =
    routeData?.prediction?.predicted_duration_minutes ||
    routeData?.prediction?.base_duration_minutes ||
    (routeData?.routes?.[0]?.duration ? Math.round(routeData.routes[0].duration / 60) : 15);
  const arrivalTime = routeData?.prediction?.predicted_arrival || "On Schedule";
  const traffic = routeData?.prediction?.traffic_condition || "Moderate";
  const modeLabel =
    selectedMode === "transit"
      ? "RTD Transit"
      : selectedMode === "walk_transit_walk"
      ? "Multimodal (Walk + Bus)"
      : selectedMode === "walking"
      ? "Walking"
      : selectedMode === "bicycling"
      ? "Biking"
      : "Drive";

  const tripSummaryText = `🏔️ BoulderMove Trip\n\n${origin} → ${destination}\n• Predicted travel time: ${durationMin} min\n• Predicted arrival: ${arrivalTime}\n• Travel mode: ${modeLabel}\n• Traffic: ${traffic}\n\nPlan or view live route: ${shareableUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.warn("Failed to copy link:", err);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(tripSummaryText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (err) {
      console.warn("Failed to copy summary:", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BoulderMove Trip Plan",
          text: tripSummaryText,
          url: shareableUrl,
        });
      } catch (err) {
        console.warn("Native share cancelled or failed:", err);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-trip-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Share2 className="share-modal-icon" size={20} />
            <h2 className="modal-title">Share Trip Plan</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close share modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Trip Quick Header */}
        <div className="share-trip-preview-card">
          <div className="share-trip-route">
            <span className="share-node-origin">{origin}</span>
            <span className="share-arrow">→</span>
            <span className="share-node-dest">{destination}</span>
          </div>
          <div className="share-trip-meta">
            <span className="share-meta-tag">{modeLabel}</span>
            <span className="share-meta-time">ETA: {arrivalTime} ({durationMin} min)</span>
          </div>
        </div>

        <div className="share-actions-stack">
          {/* Native Web Share API if supported */}
          {typeof navigator !== "undefined" && navigator.share && (
            <button
              type="button"
              className="share-action-primary-btn"
              onClick={handleNativeShare}
            >
              <Share2 size={16} />
              <span>Share via Device (AirDrop, Messages, etc.)</span>
            </button>
          )}

          {/* Copy Direct Route Link */}
          <div className="share-copy-row">
            <div className="share-url-box">
              <span className="share-url-text">{shareableUrl}</span>
            </div>
            <button
              type="button"
              className={`share-copy-btn ${copiedLink ? "copied" : ""}`}
              onClick={handleCopyLink}
              aria-label="Copy route link"
            >
              {copiedLink ? <Check size={15} /> : <Copy size={15} />}
              <span>{copiedLink ? "Copied Link!" : "Copy Link"}</span>
            </button>
          </div>

          {/* Copy Text Summary */}
          <button
            type="button"
            className={`share-summary-btn ${copiedSummary ? "copied" : ""}`}
            onClick={handleCopySummary}
          >
            {copiedSummary ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedSummary ? "Summary Copied to Clipboard!" : "Copy Formatted Trip Summary"}</span>
          </button>

          {/* Slack Integration CTA */}
          <div className="share-slack-card">
            <div className="slack-card-icon-col">
              <svg className="slack-logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" width="22" height="22">
                <path fill="#e01e5a" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"/>
                <path fill="#36c5f0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z"/>
                <path fill="#2eb67d" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"/>
                <path fill="#ecb22e" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z"/>
              </svg>
            </div>
            <div className="slack-card-body">
              <span className="slack-card-title">Add BoulderMove to Slack</span>
              <span className="slack-card-desc">
                Get slash commands like <code>/bouldermove {origin} to {destination}</code> right in your team channels.
              </span>
            </div>
            <a
              href={`${backendUrl || ""}/api/slack/install`}
              target="_blank"
              rel="noopener noreferrer"
              className="slack-install-btn"
            >
              <span>Add to Slack</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
