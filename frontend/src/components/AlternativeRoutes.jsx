import React, { useState, useMemo } from "react";
import {
  Bus,
  Bike,
  Footprints,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowUpDown,
} from "lucide-react";

export default function AlternativeRoutes({
  alternatives = [],
  activeAlternativeId,
  onSelectAlternative,
  onSelectRecommended,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState("recommended"); // "recommended" | "fastest" | "transfers"

  if (!alternatives || alternatives.length === 0) {
    return null;
  }

  const totalCount = alternatives.length + 1; // including recommended

  const sortedAlternatives = useMemo(() => {
    const list = [...alternatives];
    if (sortBy === "fastest") {
      return list.sort((a, b) => (a.duration_min || 0) - (b.duration_min || 0));
    }
    if (sortBy === "transfers") {
      return list.sort((a, b) => (a.num_transfers || 0) - (b.num_transfers || 0));
    }
    return list; // recommended default order
  }, [alternatives, sortBy]);

  return (
    <div className="alternative-routes-accordion glass-panel">
      {/* Accordion Header */}
      <button
        type="button"
        className="alt-accordion-trigger"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="alt-trigger-left">
          <Layers size={15} className="alt-trigger-icon" />
          <span className="alt-trigger-title">
            Alternative routes ({totalCount})
          </span>
        </div>
        <div className="alt-trigger-right">
          {activeAlternativeId !== null && (
            <span className="alt-active-tag">Alternative Selected</span>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Alternative Rows */}
      {isExpanded && (
        <div className="alt-accordion-body">
          {/* Sorting Dropdown */}
          <div className="alt-sort-bar">
            <span className="sort-label">Sort by:</span>
            <div className="sort-select-wrapper">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="alt-sort-select"
              >
                <option value="recommended">Recommended</option>
                <option value="fastest">Fastest</option>
                <option value="fewest_transfers">Fewest transfers</option>
              </select>
            </div>
          </div>

          <div className="alt-rows-list">
            {/* Primary Recommended Option */}
            <div
              className={`alt-compact-row ${activeAlternativeId === null ? "selected" : ""}`}
              onClick={onSelectRecommended}
              role="button"
              tabIndex={0}
            >
              <div className="alt-row-left">
                <div className="alt-row-icon bus">
                  <Bus size={14} />
                </div>
                <div className="alt-row-info">
                  <div className="alt-row-title-line">
                    <span className="alt-route-code">Recommended Route</span>
                    <span className="alt-primary-tag">Primary</span>
                  </div>
                  <span className="alt-transfers-sub">0 transfers (Direct)</span>
                </div>
              </div>

              <div className="alt-row-right">
                <span className="alt-time-text">Optimal ETA</span>
                {activeAlternativeId === null && <CheckCircle2 size={15} className="alt-check-icon" />}
              </div>
            </div>

            {/* Alternative Options */}
            {sortedAlternatives.map((alt) => {
              const isSelected = activeAlternativeId === alt.id;
              const isBike = alt.mode === "bicycling";
              const transfersLabel = isBike
                ? "Bike Trail"
                : alt.num_transfers === 0
                ? "0 transfers"
                : `${alt.num_transfers} transfers`;

              return (
                <div
                  key={alt.id}
                  className={`alt-compact-row ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectAlternative(alt)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="alt-row-left">
                    <div className={`alt-row-icon ${isBike ? "bike" : "bus"}`}>
                      {isBike ? <Bike size={14} /> : <Bus size={14} />}
                    </div>
                    <div className="alt-row-info">
                      <div className="alt-row-title-line">
                        <span className="alt-route-code">
                          {alt.route_title || (isBike ? "Boulder Creek Path" : "RTD Transit")}
                        </span>
                        {alt.badge && <span className="alt-badge-sub">{alt.badge}</span>}
                      </div>
                      <span className="alt-transfers-sub">{transfersLabel}</span>
                    </div>
                  </div>

                  <div className="alt-row-right">
                    <span className="alt-time-text">{alt.duration_min} min</span>
                    {isSelected && <CheckCircle2 size={15} className="alt-check-icon" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
