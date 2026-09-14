import React, { useState } from "react";
import {
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Calendar,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";

export default function PunctualityCard({ prediction, mlFeatures, onTimeProbability, weatherData }) {
  const [showExplanation, setShowExplanation] = useState(false);

  if (!prediction && onTimeProbability === undefined) {
    return (
      <div className="punctuality-pill-empty">
        <ShieldCheck size={14} />
        <span>Punctuality prediction unavailable</span>
      </div>
    );
  }

  const probPercent = prediction
    ? Math.round((prediction.prob_on_time ?? 0.88) * 100)
    : Math.round((onTimeProbability ?? 0.88) * 100);

  const traffic = prediction?.traffic_condition || "Moderate";
  const expectedDelay = prediction?.predicted_delay_minutes || 0;
  const baseMinutes = prediction?.base_duration_minutes;
  const predictedMinutes = prediction?.predicted_duration_minutes;
  const mlAdjustment =
    predictedMinutes !== undefined && baseMinutes !== undefined
      ? Math.round(predictedMinutes - baseMinutes)
      : expectedDelay;

  // Determine color theme
  let colorTheme = "emerald";
  if (probPercent < 70) colorTheme = "rose";
  else if (probPercent < 85) colorTheme = "amber";

  // Derive model factors from actual mlFeatures / weather
  const currentHour = mlFeatures?.hour ?? new Date().getHours();
  const isWeekend = mlFeatures?.is_weekend ?? [0, 6].includes(new Date().getDay());
  const rainMm = mlFeatures?.rain_1h ?? weatherData?.rain_1h ?? 0;
  const snowMm = mlFeatures?.snow_1h ?? weatherData?.snow_1h ?? 0;
  const tempC = mlFeatures?.temp ?? weatherData?.temp ?? 20;
  const transfers = mlFeatures?.num_transfers ?? 0;
  const eventRisk = mlFeatures?.event_risk ?? 0;

  return (
    <div className={`punctuality-card-wrapper theme-${colorTheme}`}>
      {/* Header Bar */}
      <div className="punctuality-header-row">
        <div className="punctuality-title-badge">
          <ShieldCheck size={16} className="punctuality-icon" />
          <div className="punctuality-title-col">
            <span className="punctuality-caption">ML PUNCTUALITY & RELIABILITY</span>
            <span className="punctuality-score">
              {probPercent}% on-time probability
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="punctuality-explain-btn"
          title="Toggle prediction factors breakdown"
          aria-expanded={showExplanation}
        >
          <Info size={14} />
          <span>Why this prediction?</span>
          {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Hero Prediction Comparison Row */}
      <div className="prediction-breakdown-row">
        {baseMinutes !== undefined && (
          <div className="pred-breakdown-item">
            <span className="pred-breakdown-label">Routing estimate</span>
            <span className="pred-breakdown-val">{baseMinutes} min</span>
          </div>
        )}

        <div className="pred-breakdown-item adjustment">
          <span className="pred-breakdown-label">ML adjustment</span>
          <span className={`pred-breakdown-val ${mlAdjustment > 0 ? "delay" : "ontime"}`}>
            {mlAdjustment > 0 ? `+${mlAdjustment} min` : mlAdjustment < 0 ? `${mlAdjustment} min` : "0 min"}
          </span>
        </div>

        <div className="pred-breakdown-item">
          <span className="pred-breakdown-label">Traffic flow</span>
          <span className="pred-breakdown-val capitalize">{traffic}</span>
        </div>
      </div>

      {/* Expandable Explanation Factors */}
      {showExplanation && (
        <div className="punctuality-explanation-box glass-panel">
          <div className="explanation-section-title">
            <Sparkles size={14} />
            <span>XGBoost Model Input Factors</span>
          </div>
          <p className="explanation-desc">
            Calculated by BoulderMove's trained gradient-boosted decision trees using real-time Boulder transit telemetry and environmental feeds.
          </p>

          <div className="model-factors-table">
            <div className="factor-row">
              <span className="factor-key">Traffic Condition</span>
              <span className="factor-value highlight">{traffic}</span>
            </div>

            <div className="factor-row">
              <span className="factor-key">Time of Day</span>
              <span className="factor-value">
                {currentHour}:00 ({isWeekend ? "Weekend schedule" : currentHour >= 7 && currentHour <= 9 || currentHour >= 16 && currentHour <= 18 ? "Peak commute" : "Off-peak"})
              </span>
            </div>

            <div className="factor-row">
              <span className="factor-key">Weather Condition</span>
              <span className="factor-value">
                {rainMm > 0
                  ? `${rainMm} mm/h rain (surface slowdown)`
                  : snowMm > 0
                  ? `${snowMm} mm/h snow (winter traction)`
                  : `${Math.round(tempC)}°C · Clear dry roads`}
              </span>
            </div>

            <div className="factor-row">
              <span className="factor-key">Transfers & Buffers</span>
              <span className="factor-value">
                {transfers === 0 ? "Direct (0 transfers)" : `${transfers} transfer (${mlFeatures?.buffer_min ?? 5} min buffer)`}
              </span>
            </div>

            <div className="factor-row">
              <span className="factor-key">Event Activity</span>
              <span className="factor-value">
                {eventRisk > 0 ? "Elevated corridor event volume" : "Normal corridor flow"}
              </span>
            </div>

            {prediction?.prob_on_time !== undefined && (
              <div className="factor-row">
                <span className="factor-key">Historical Punctuality</span>
                <span className="factor-value">
                  {prediction.prob_on_time >= 0.85 ? "High historical reliability" : "Moderate variability"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
