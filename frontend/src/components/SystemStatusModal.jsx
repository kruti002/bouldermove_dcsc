import React from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Server,
  Cpu,
  CloudSun,
  MessageSquare,
  Radio,
} from "lucide-react";

export default function SystemStatusModal({
  isOpen,
  onClose,
  systemHealth,
  onRefresh,
  isLoadingHealth,
  isSlackConnected = false,
}) {
  if (!isOpen) return null;

  const isModelOk = systemHealth?.model_loaded ?? true;
  const isBackendOk = systemHealth?.status === "ok" || systemHealth?.status === "online";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="system-status-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Activity className="status-modal-icon" size={20} />
            <h2 className="modal-title">BoulderMove System Diagnostics</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close diagnostics modal"
          >
            <X size={18} />
          </button>
        </div>

        <p className="modal-subtitle">
          Real-time service availability, ML inference status, and workspace integrations.
        </p>

        <div className="status-services-list">
          {/* Routing API */}
          <div className="status-service-item">
            <div className="service-info-col">
              <div className="service-name-row">
                <Server size={16} className="service-icon" />
                <span className="service-title">Routing & Directions Engine</span>
              </div>
              <span className="service-desc">OSMnx Pedestrian & Valhalla Road Graph</span>
            </div>
            <div className={`status-pill ${isBackendOk ? "online" : "warning"}`}>
              {isBackendOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              <span>{isBackendOk ? "Available" : "Connecting..."}</span>
            </div>
          </div>

          {/* ML Delay Prediction Model */}
          <div className="status-service-item">
            <div className="service-info-col">
              <div className="service-name-row">
                <Cpu size={16} className="service-icon" />
                <span className="service-title">XGBoost Delay Prediction Engine</span>
              </div>
              <span className="service-desc">RTD Boulder Corridor Punctuality Model</span>
            </div>
            <div className={`status-pill ${isModelOk ? "online" : "warning"}`}>
              {isModelOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              <span>{isModelOk ? "Model Active" : "Standby"}</span>
            </div>
          </div>

          {/* Weather Service */}
          <div className="status-service-item">
            <div className="service-info-col">
              <div className="service-name-row">
                <CloudSun size={16} className="service-icon" />
                <span className="service-title">OpenWeather Live Feed</span>
              </div>
              <span className="service-desc">Boulder Real-Time Road Weather & Rain/Snow</span>
            </div>
            <div className="status-pill online">
              <CheckCircle2 size={13} />
              <span>Available</span>
            </div>
          </div>

          {/* Slack Integration (Backend App Config) */}
          <div className="status-service-item">
            <div className="service-info-col">
              <div className="service-name-row">
                <MessageSquare size={16} className="service-icon" />
                <span className="service-title">Slack Integration</span>
              </div>
              <span className="service-desc">OAuth V2, Slash Commands & Webhook API</span>
            </div>
            <div className="status-pill online">
              <CheckCircle2 size={13} />
              <span>Configured</span>
            </div>
          </div>

          {/* Slack Workspace Installation Status */}
          <div className="status-service-item">
            <div className="service-info-col">
              <div className="service-name-row">
                <Radio size={16} className="service-icon" />
                <span className="service-title">Slack Workspace</span>
              </div>
              <span className="service-desc">BoulderMove App Installation</span>
            </div>
            <div className={`status-pill ${isSlackConnected ? "online" : "offline"}`}>
              {isSlackConnected ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              <span>{isSlackConnected ? "Connected" : "Not connected"}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="status-refresh-btn"
            onClick={onRefresh}
            disabled={isLoadingHealth}
          >
            <RefreshCw size={14} className={isLoadingHealth ? "animate-spin" : ""} />
            <span>{isLoadingHealth ? "Checking..." : "Re-check Services"}</span>
          </button>
          <button type="button" className="status-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
