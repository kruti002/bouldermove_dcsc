import React, { useState } from "react";
import {
  Footprints,
  Bus,
  Bike,
  Car,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckCircle2,
} from "lucide-react";

export default function NavigationSteps({ legs, travelMode, departureTime }) {
  const [expandedStops, setExpandedStops] = useState({});

  if (!legs || legs.length === 0) {
    return (
      <div className="nav-empty-state">
        <p>No navigation step details available.</p>
      </div>
    );
  }

  const toggleStops = (idx) => {
    setExpandedStops((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const formatTimeOffset = (baseStr, minutesOffset) => {
    if (!baseStr || baseStr === "Now" || baseStr === "Departing soon") {
      const d = new Date();
      d.setMinutes(d.getMinutes() + minutesOffset);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    try {
      const parts = baseStr.split(":");
      if (parts.length >= 2) {
        const d = new Date();
        d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10) + minutesOffset, 0);
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
    } catch {
      // ignore
    }
    return baseStr;
  };

  let accumulatedMinutes = 0;

  return (
    <div className="navigation-steps-container">
      <div className="nav-timeline-track">
        {legs.map((leg, idx) => {
          const isTransit = leg.mode === "TRANSIT" || leg.mode === "bus";
          const isWalk = leg.mode === "WALK" || leg.mode === "walking";
          const isBike = leg.mode === "BICYCLE" || leg.mode === "bicycling";

          const duration = leg.duration_min || (leg.duration ? Math.round(leg.duration / 60) : 3);
          const startTimeStr = leg.departure || formatTimeOffset(departureTime, accumulatedMinutes);
          accumulatedMinutes += duration;
          const endTimeStr = leg.arrival || formatTimeOffset(departureTime, accumulatedMinutes);

          const intermediateStops = leg.intermediate_stops_details || [];
          const hasIntermediateStops = intermediateStops.length > 0;
          const isStopsExpanded = !!expandedStops[idx];

          return (
            <div key={idx} className={`timeline-leg-block ${isTransit ? "transit-mode" : "walk-mode"}`}>
              {/* Departure Node (Major stop: large distinct dot) */}
              <div className="timeline-node-row major-node">
                <div className="timeline-time-col">
                  <span className="timeline-time-text">{startTimeStr}</span>
                </div>
                <div className="timeline-marker-col">
                  <div className={`timeline-major-dot ${isTransit ? "bus-dot" : "walk-dot"}`} />
                  <div className="timeline-vertical-line" />
                </div>
                <div className="timeline-info-col">
                  <span className="timeline-station-name">
                    {leg.from_stop_name || (idx === 0 ? "Williams Village" : "Transfer Point")}
                  </span>
                  {isTransit && leg.departure && (
                    <span className="timeline-stop-sub">Scheduled boarding</span>
                  )}
                </div>
              </div>

              {/* Transit / Travel Segment In-Between */}
              <div className="timeline-segment-row">
                <div className="timeline-time-col">
                  <span className="timeline-segment-duration">{duration} min</span>
                </div>
                <div className="timeline-marker-col">
                  <div className={`timeline-segment-line ${isTransit ? "solid-bus" : "dashed-walk"}`} />
                </div>
                <div className="timeline-segment-details">
                  <div className="segment-badge-card">
                    {isTransit ? (
                      <div className="transit-badge-group">
                        <div className="transit-route-pill">
                          <Bus size={13} />
                          <span className="route-code">{leg.route_id || "RTD / Buff Bus"}</span>
                        </div>
                        {leg.direction && (
                          <span className="route-direction-text">towards {leg.direction}</span>
                        )}
                      </div>
                    ) : isWalk ? (
                      <div className="walk-badge-group">
                        <Footprints size={13} className="walk-icon" />
                        <span>Walk {leg.walk_distance_m ? `~${Math.round(leg.walk_distance_m)}m` : `${duration} min`}</span>
                      </div>
                    ) : isBike ? (
                      <div className="bike-badge-group">
                        <Bike size={13} className="bike-icon" />
                        <span>Bike trail segment</span>
                      </div>
                    ) : (
                      <div className="drive-badge-group">
                        <Car size={13} className="drive-icon" />
                        <span>Drive segment</span>
                      </div>
                    )}
                  </div>

                  {/* Expandable Intermediate Stops Accordion */}
                  {hasIntermediateStops && (
                    <div className="intermediate-stops-container">
                      <button
                        type="button"
                        onClick={() => toggleStops(idx)}
                        className="stops-accordion-trigger"
                        aria-expanded={isStopsExpanded}
                      >
                        <span>
                          {isStopsExpanded ? "Hide" : "View"} {intermediateStops.length} stops
                        </span>
                        {isStopsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {isStopsExpanded && (
                        <div className="intermediate-stops-tray">
                          {intermediateStops.map((stop, sIdx) => (
                            <div key={stop.stop_id || sIdx} className="intermediate-stop-row">
                              <div className="inter-small-dot" />
                              <span className="inter-stop-label">{stop.stop_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Arrival Node on Final Leg */}
              {idx === legs.length - 1 && (
                <div className="timeline-node-row major-node destination-node">
                  <div className="timeline-time-col">
                    <span className="timeline-time-text arrival-time">{endTimeStr}</span>
                  </div>
                  <div className="timeline-marker-col">
                    <div className="timeline-major-dot dest-dot" />
                  </div>
                  <div className="timeline-info-col">
                    <span className="timeline-station-name dest-name">
                      {leg.to_stop_name || "Destination"}
                    </span>
                    <span className="timeline-stop-sub">Arrive at destination</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
