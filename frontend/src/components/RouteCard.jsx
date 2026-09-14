import React, { useState } from "react";
import {
  Bus,
  Footprints,
  Bike,
  Car,
  Clock,
  Navigation,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CloudSun,
  MapPin,
  ArrowRight,
  Share2,
  Bookmark,
  BookmarkCheck,
  Edit2,
  RotateCcw,
  Sparkles,
  Info,
  CarFront,
} from "lucide-react";
import NavigationSteps from "./NavigationSteps";

// Static Boulder Known Parking Facilities
export const BOULDER_PARKING_LOCATIONS = [
  { name: "Euclid Parking Garage (CU)", lat: 40.0068, lon: -105.2712, desc: "0.2 mi from main campus • Multi-level covered parking" },
  { name: "14th & Canyon Lot", lat: 40.0163, lon: -105.2762, desc: "0.3 mi from downtown • Surface lot near transit center" },
  { name: "Pearl Street Garage (11th & Spruce)", lat: 40.0185, lon: -105.2818, desc: "Downtown parking garage near pedestrian mall" },
  { name: "30th & Arapahoe Surface Lot", lat: 40.0142, lon: -105.2538, desc: "0.1 mi from King Soopers retail corridor" },
];

export default function RouteCard({
  routeData,
  originName,
  destinationName,
  weatherData,
  selectedMode,
  onSelectMode,
  timeMode,
  onSelectTimeMode,
  targetTime,
  onTargetTimeChange,
  departureTime,
  onOpenShare,
  onOpenSlack,
  onToggleSaveTrip,
  isTripSaved = false,
  onUpdateLocations,
  isSlackConnected = false,
}) {
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [tempOrigin, setTempOrigin] = useState(originName || "Williams Village");
  const [tempDest, setTempDest] = useState(destinationName || "King Soopers");
  const [showPredictionFactors, setShowPredictionFactors] = useState(false);
  const [showParkingAccordion, setShowParkingAccordion] = useState(false);

  if (!routeData) return null;

  const modes = [
    { id: "transit", label: "Transit", icon: Bus },
    { id: "walk_transit_walk", label: "Multimodal", icon: Sparkles },
    { id: "walking", label: "Walk", icon: Footprints },
    { id: "bicycling", label: "Bike", icon: Bike },
    { id: "driving", label: "Drive", icon: Car },
  ];

  // Extract core metrics
  const isTransit = selectedMode === "transit" || selectedMode === "walk_transit_walk" || !!routeData.transit;
  const isDrive = selectedMode === "driving";
  const legs = routeData.transit || (routeData.legs ? routeData.legs : []);

  const baseMinutes =
    routeData.prediction?.base_duration_minutes ||
    (routeData.routes?.[0]?.duration ? Math.round(routeData.routes[0].duration / 60) : 10);
  const predictedMinutes =
    routeData.prediction?.predicted_duration_minutes || baseMinutes;
  const expectedDelay = routeData.prediction?.predicted_delay_minutes ?? 0;
  const mlAdjustment =
    predictedMinutes !== undefined && baseMinutes !== undefined
      ? Math.round(predictedMinutes - baseMinutes)
      : expectedDelay;

  const formatArrivalTime = () => {
    if (routeData.prediction?.predicted_arrival) {
      return routeData.prediction.predicted_arrival;
    }
    const d = new Date();
    d.setMinutes(d.getMinutes() + predictedMinutes);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const arrivalTime = formatArrivalTime();
  const numTransfers = routeData.ml_features_used?.num_transfers ?? routeData.num_transfers ?? 0;
  const probOnTime = Math.round((routeData.on_time_probability ?? routeData.prediction?.prob_on_time ?? 0.73) * 100);
  const traffic = routeData.prediction?.traffic_condition || "Moderate";

  const weatherTemp = weatherData?.temp ?? routeData.weather?.temp ?? 20;
  const weatherDesc = weatherData?.weather_desc ?? routeData.weather?.weather_desc ?? "Overcast";
  const rainMm = routeData.ml_features_used?.rain_1h ?? weatherData?.rain_1h ?? 0;
  const snowMm = routeData.ml_features_used?.snow_1h ?? weatherData?.snow_1h ?? 0;
  const currentHour = routeData.ml_features_used?.hour ?? new Date().getHours();
  const isWeekend = routeData.ml_features_used?.is_weekend ?? [0, 6].includes(new Date().getDay());

  const handleApplyEdit = (e) => {
    e.preventDefault();
    if (onUpdateLocations) {
      onUpdateLocations(tempOrigin, tempDest);
    }
    setIsEditingTrip(false);
  };

  return (
    <div className="route-main-planner-card glass-panel">
      {/* 1. WHERE AM I GOING? (Compact summary + Save Trip + Edit Trip) */}
      <div className="trip-summary-header-block">
        {!isEditingTrip ? (
          <div className="trip-endpoints-view-row">
            <div className="endpoints-text-group">
              <span className="endpoint-node">{originName || "Williams Village"}</span>
              <ArrowRight size={13} className="endpoint-arrow" />
              <span className="endpoint-node dest">{destinationName || "King Soopers"}</span>
            </div>
            <div className="top-header-actions-group">
              <button
                type="button"
                onClick={onToggleSaveTrip}
                className={`top-save-trip-btn ${isTripSaved ? "saved" : ""}`}
                title={isTripSaved ? "Saved to your journeys" : "Save this journey"}
                aria-label="Save journey"
              >
                {isTripSaved ? <BookmarkCheck size={13} className="text-amber" /> : <Bookmark size={13} />}
                <span>{isTripSaved ? "Saved" : "Save trip"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempOrigin(originName);
                  setTempDest(destinationName);
                  setIsEditingTrip(true);
                }}
                className="edit-trip-btn"
                title="Edit origin and destination"
                aria-label="Edit trip locations"
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleApplyEdit} className="trip-endpoints-edit-form">
            <div className="edit-inputs-stack">
              <input
                type="text"
                value={tempOrigin}
                onChange={(e) => setTempOrigin(e.target.value)}
                placeholder="Origin address..."
                className="edit-text-field"
              />
              <input
                type="text"
                value={tempDest}
                onChange={(e) => setTempDest(e.target.value)}
                placeholder="Destination address..."
                className="edit-text-field"
              />
            </div>
            <div className="edit-actions-row">
              <button type="submit" className="save-edit-btn">
                Apply
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTrip(false)}
                className="cancel-edit-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. HOW AM I TRAVELLING? (Always Visible Travel Modes & Timing) */}
      <div className="travel-controls-section">
        <div className="section-label-row">
          <span className="control-section-label">TRAVEL MODE</span>
        </div>

        <div className="modes-horizontal-selector" role="radiogroup" aria-label="Travel mode">
          {modes.map((m) => {
            const IconComponent = m.icon;
            const isSelected = selectedMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMode(m.id)}
                className={`mode-selector-button ${isSelected ? "active" : ""}`}
                role="radio"
                aria-checked={isSelected}
              >
                <IconComponent size={14} className="mode-btn-icon" />
                <span className="mode-btn-text">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Trip Timing Controls directly underneath */}
        <div className="timing-controls-row">
          <div className="timing-pills-group">
            <button
              type="button"
              className={`timing-pill-btn ${timeMode === "now" ? "active" : ""}`}
              onClick={() => onSelectTimeMode("now")}
            >
              Leave now
            </button>
            <button
              type="button"
              className={`timing-pill-btn ${timeMode === "depart_at" ? "active" : ""}`}
              onClick={() => onSelectTimeMode("depart_at")}
            >
              Depart at
            </button>
            <button
              type="button"
              className={`timing-pill-btn ${timeMode === "arrive_by" ? "active" : ""}`}
              onClick={() => onSelectTimeMode("arrive_by")}
            >
              Arrive by
            </button>
          </div>

          {timeMode !== "now" && (
            <div className="time-input-box">
              <Clock size={13} className="text-muted" />
              <input
                type="time"
                value={targetTime}
                onChange={(e) => onTargetTimeChange(e.target.value)}
                className="native-time-input"
                aria-label="Target Time"
              />
            </div>
          )}
        </div>
      </div>

      <div className="card-divider" />

      {/* 3. WHEN WILL I ARRIVE? (HERO RESULT) */}
      <div className="hero-predicted-arrival-section">
        <span className="hero-pred-caption">PREDICTED ARRIVAL</span>
        <div className="hero-pred-time-display">
          <Clock className="hero-pred-clock" size={24} />
          <span className="hero-pred-time-value">{arrivalTime}</span>
        </div>
        <span className="hero-pred-duration-sub">
          <strong>{predictedMinutes} min</strong> predicted travel time
        </span>
      </div>

      {/* 4. CONSOLIDATED PREDICTION & RELIABILITY CARD */}
      <div className="consolidated-prediction-card">
        <div className="consolidated-metrics-grid">
          <div className="metric-cell">
            <span className="metric-cell-label">Routing estimate</span>
            <span className="metric-cell-val">{baseMinutes} min</span>
          </div>

          <div className="metric-cell">
            <span className="metric-cell-label">ML adjustment</span>
            <span className={`metric-cell-val ${mlAdjustment > 0 ? "delay" : "ontime"}`}>
              {mlAdjustment > 0 ? `+${mlAdjustment} min` : mlAdjustment < 0 ? `${mlAdjustment} min` : "0 min"}
            </span>
          </div>

          <div className="metric-cell">
            <span className="metric-cell-label">On-time probability</span>
            <span className="metric-cell-val highlight">{probOnTime}%</span>
          </div>

          <div className="metric-cell">
            <span className="metric-cell-label">Traffic flow</span>
            <span className="metric-cell-val capitalize">{traffic}</span>
          </div>
        </div>

        <div className="prediction-tray-toggle-row">
          <span className="prediction-updated-text">Updated just now</span>
          <button
            type="button"
            className="why-prediction-btn"
            onClick={() => setShowPredictionFactors(!showPredictionFactors)}
            aria-expanded={showPredictionFactors}
          >
            <span>Why this prediction?</span>
            {showPredictionFactors ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Real Model Factors Expandable Tray */}
        {showPredictionFactors && (
          <div className="prediction-factors-tray">
            <div className="factors-table">
              <div className="factor-line">
                <span className="factor-k">Traffic Condition</span>
                <span className="factor-v">{traffic}</span>
              </div>
              <div className="factor-line">
                <span className="factor-k">Time of Day</span>
                <span className="factor-v">
                  {currentHour}:00 ({isWeekend ? "Weekend schedule" : "Weekday"})
                </span>
              </div>
              <div className="factor-line">
                <span className="factor-k">Weather</span>
                <span className="factor-v">
                  {rainMm > 0
                    ? `${rainMm} mm/h rain slowdown`
                    : snowMm > 0
                    ? `${snowMm} mm/h snow buffer`
                    : `${Math.round(weatherTemp)}°C · Clear`}
                </span>
              </div>
              <div className="factor-line">
                <span className="factor-k">Transfers & Buffer</span>
                <span className="factor-v">
                  {numTransfers === 0 ? "Direct (0 transfers)" : `${numTransfers} transfer`}
                </span>
              </div>
              <div className="factor-line">
                <span className="factor-k">Historical Punctuality</span>
                <span className="factor-v">
                  {probOnTime >= 75 ? "Consistent historical corridor on-time rate" : "Moderate historical delay variability"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. COMPACT WEATHER */}
      <div className="compact-weather-strip">
        <CloudSun size={14} className="weather-strip-icon" />
        <span className="weather-strip-text">
          {Math.round(weatherTemp)}°C · {weatherDesc} — {rainMm > 0 ? "Rain advisory active" : "No significant weather delay expected"}
        </span>
      </div>

      <div className="card-divider" />

      {/* 6. WHAT DOES MY JOURNEY LOOK LIKE? (Summary + Timeline) */}
      <div className="journey-timeline-section">
        <div className="journey-summary-badge-line">
          <div className="summary-left-tag">
            <Bus size={13} className="text-teal" />
            <span className="summary-route-name">
              {legs[0]?.route_id ? `RTD / Buff Bus ${legs[0].route_id}` : "Direct Route"}
            </span>
          </div>
          <span className="summary-meta-tag">
            {predictedMinutes} min • {numTransfers === 0 ? "Direct" : `${numTransfers} transfer`}
          </span>
        </div>

        <NavigationSteps
          legs={legs}
          travelMode={selectedMode}
          departureTime={departureTime}
        />
      </div>

      {/* 7. DRIVE MODE + PARKING NEAR DESTINATION */}
      {isDrive && (
        <div className="parking-contextual-accordion">
          <button
            type="button"
            className="parking-trigger-btn"
            onClick={() => setShowParkingAccordion(!showParkingAccordion)}
            aria-expanded={showParkingAccordion}
          >
            <div className="parking-trigger-left">
              <CarFront size={14} className="text-sky" />
              <span className="parking-title">Nearby parking options</span>
            </div>
            {showParkingAccordion ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showParkingAccordion && (
            <div className="parking-accordion-body">
              {BOULDER_PARKING_LOCATIONS.map((pkg, pIdx) => (
                <div key={pIdx} className="parking-item-row">
                  <div className="parking-p-badge">P</div>
                  <div className="parking-item-info">
                    <span className="parking-name">{pkg.name}</span>
                    <span className="parking-desc">{pkg.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. ACTIONS ROW: SAVE | SHARE | SLACK */}
      <div className="route-bottom-actions-row">
        <button
          type="button"
          onClick={onToggleSaveTrip}
          className={`action-btn save-btn ${isTripSaved ? "saved" : ""}`}
          aria-label="Save trip"
        >
          {isTripSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          <span>{isTripSaved ? "Saved" : "Save"}</span>
        </button>

        <button
          type="button"
          onClick={onOpenShare}
          className="action-btn share-btn"
          aria-label="Share trip"
        >
          <Share2 size={14} />
          <span>Share</span>
        </button>

        <button
          type="button"
          onClick={onOpenSlack}
          className={`action-btn slack-btn ${isSlackConnected ? "connected" : ""}`}
          aria-label={isSlackConnected ? "Send trip to Slack" : "Add BoulderMove to Slack"}
          title={isSlackConnected ? "Send trip to Slack" : "Add BoulderMove to Slack (Install app)"}
        >
          <svg className="slack-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.8 122.8" width="14" height="14">
            <path fill="#e01e5a" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"/>
            <path fill="#36c5f0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z"/>
            <path fill="#2eb67d" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"/>
            <path fill="#ecb22e" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z"/>
          </svg>
          <span>{isSlackConnected ? "Send trip to Slack" : "Add BoulderMove to Slack"}</span>
        </button>
      </div>
    </div>
  );
}
