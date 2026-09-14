import React, { useState } from "react";
import {
  Compass,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  Bus,
  Footprints,
  Bike,
  Car,
  MapPin,
  Layers,
  ChevronDown,
  Activity,
  CheckCircle2,
  Navigation,
  CloudSun,
  Zap,
  CarFront,
  Bookmark,
  MessageSquare,
  Mic,
  Sun,
  Moon,
} from "lucide-react";

export default function LandingPage({
  onOpenPlanner,
  isDarkTheme,
  onToggleTheme,
  onOpenStatus,
}) {
  const [activePreviewTab, setActivePreviewTab] = useState("prediction");

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="landing-page-root">
      {/* 1. TOP NAVBAR */}
      <header className="landing-navbar glass-panel">
        <div className="landing-nav-container">
          <div className="landing-brand-col">
            <Compass className="landing-brand-icon" size={22} />
            <span className="landing-brand-title">BoulderMove</span>
          </div>

          <nav className="landing-nav-menu" aria-label="Landing Navigation">
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => scrollToSection("features")}
            >
              Features
            </button>
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => scrollToSection("how-it-works")}
            >
              How it works
            </button>
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => scrollToSection("preview")}
            >
              About
            </button>
          </nav>

          <div className="landing-nav-actions">
            {onToggleTheme && (
              <button
                type="button"
                className="landing-theme-btn"
                onClick={onToggleTheme}
                title="Toggle dark/light theme"
                aria-label="Toggle theme"
              >
                {isDarkTheme ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}

            <button
              type="button"
              className="landing-open-planner-btn"
              onClick={onOpenPlanner}
            >
              <span>Open Planner</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="landing-hero-section">
        <div className="hero-glow-layer" aria-hidden="true">
          <div className="hero-glow-circle-1" />
          <div className="hero-glow-circle-2" />
        </div>

        <div className="landing-hero-content">
          <div className="hero-badge-pill">
            <Sparkles size={13} className="hero-sparkle-icon" />
            <span>INTELLIGENT MULTIMODAL NAVIGATION</span>
          </div>

          <h1 className="hero-main-title">
            Plan smarter.<br />
            <span className="hero-title-accent">Arrive when you expect to.</span>
          </h1>

          <p className="hero-description">
            Multimodal Boulder transportation with intelligent routing and ML-powered arrival predictions.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              className="hero-primary-cta"
              onClick={onOpenPlanner}
            >
              <span>Plan a trip →</span>
            </button>

            <button
              type="button"
              className="hero-secondary-cta"
              onClick={() => scrollToSection("how-it-works")}
            >
              <span>See how it works</span>
              <ChevronDown size={15} />
            </button>
          </div>

          {/* Hero Application Preview Card */}
          <div className="hero-product-mockup glass-panel">
            <div className="mockup-window-header">
              <div className="mockup-window-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <span className="mockup-window-title">bouldermove.app • live trip planner</span>
              <div className="mockup-header-badge">
                <ShieldCheck size={13} />
                <span>XGBoost ML Active</span>
              </div>
            </div>

            <div className="mockup-card-body">
              {/* Left Route Info */}
              <div className="mockup-route-summary">
                <div className="mockup-endpoints">
                  <div className="endpoint-pin pin-a">A</div>
                  <div className="endpoint-text-col">
                    <span className="endpoint-label">Williams Village</span>
                    <span className="endpoint-sub">Buff Bus Hub</span>
                  </div>
                  <span className="mockup-arrow">→</span>
                  <div className="endpoint-pin pin-b">B</div>
                  <div className="endpoint-text-col">
                    <span className="endpoint-label">King Soopers (30th & Arapahoe)</span>
                    <span className="endpoint-sub">Destination</span>
                  </div>
                </div>

                <div className="mockup-mode-chips">
                  <span className="mock-chip bus">
                    <Bus size={12} />
                    <span>RTD BOUND (8 min)</span>
                  </span>
                  <span className="mock-chip walk">
                    <Footprints size={12} />
                    <span>Direct • 0 transfers</span>
                  </span>
                </div>
              </div>

              {/* Right Hero Prediction Spotlight */}
              <div className="mockup-prediction-spotlight">
                <div className="mockup-pred-header">
                  <span className="mockup-pred-label">PREDICTED ARRIVAL</span>
                  <span className="mockup-pred-time">1:41 PM</span>
                </div>
                <div className="mockup-pred-metrics">
                  <div className="metric-col">
                    <span className="metric-k">Predicted time</span>
                    <span className="metric-v">12 min</span>
                  </div>
                  <div className="metric-col">
                    <span className="metric-k">ML adjustment</span>
                    <span className="metric-v ontime">+2 min</span>
                  </div>
                  <div className="metric-col">
                    <span className="metric-k">Reliability score</span>
                    <span className="metric-v highlight">73% on-time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHY BOULDERMOVE (6 FEATURE CARDS) */}
      <section id="features" className="landing-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">KEY CAPABILITIES</span>
            <h2 className="section-title">Why BoulderMove</h2>
            <p className="section-subtitle">
              Engineered specifically for Boulder commuters, students, cyclists, and transit riders.
            </p>
          </div>

          <div className="features-six-grid">
            {/* Card 1 */}
            <div className="feature-card glass-panel">
              <div className="feature-icon-wrapper teal">
                <Layers size={20} />
              </div>
              <h3 className="feature-card-title">PLAN ACROSS EVERY MODE</h3>
              <p className="feature-card-desc">
                Transit, Buff Bus, multimodal journeys, walking, biking and driving in one unified planner.
              </p>
            </div>

            {/* Card 2 */}
            <div className="feature-card glass-panel">
              <div className="feature-icon-wrapper emerald">
                <Zap size={20} />
              </div>
              <h3 className="feature-card-title">PREDICT WHEN YOU'LL ARRIVE</h3>
              <p className="feature-card-desc">
                ML-powered journey-time and punctuality predictions go beyond basic static route durations.
              </p>
            </div>

            {/* Card 3 */}
            <div className="feature-card glass-panel">
              <div className="feature-icon-wrapper sky">
                <Bus size={20} />
              </div>
              <h3 className="feature-card-title">UNDERSTAND THE WHOLE JOURNEY</h3>
              <p className="feature-card-desc">
                See transit stops, transfer margins, weather, step timelines and ranked alternatives.
              </p>
            </div>

            {/* Card 4 */}
            <div className="feature-card glass-panel">
              <div className="feature-icon-wrapper amber">
                <CarFront size={20} />
              </div>
              <h3 className="feature-card-title">DRIVE SMARTER</h3>
              <p className="feature-card-desc">
                Find nearby parking options when driving to your destination across Boulder campus and downtown.
              </p>
            </div>

            {/* Card 5 */}
            <div className="feature-card glass-panel">
              <div className="feature-icon-wrapper rose">
                <Bookmark size={20} />
              </div>
              <h3 className="feature-card-title">SAVE & SHARE</h3>
              <p className="feature-card-desc">
                Save frequent journeys locally on your device and share useful trip plans via Slack slash command.
              </p>
            </div>

            {/* Card 6 */}
            <div className="feature-card glass-panel">
              <div className="feature-icon-wrapper purple">
                <Mic size={20} />
              </div>
              <h3 className="feature-card-title">ASK BOULDERMOVE</h3>
              <p className="feature-card-desc">
                Use voice or natural-language trip questions to explore routes, compare modes, and plan journeys.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW BOULDERMOVE WORKS (4 STEPS) */}
      <section id="how-it-works" className="landing-section alt-bg">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">SIMPLE 4-STEP FLOW</span>
            <h2 className="section-title">How BoulderMove Works</h2>
            <p className="section-subtitle">
              From origin to destination with statistical precision.
            </p>
          </div>

          <div className="steps-horizontal-flow">
            {/* Step 01 */}
            <div className="step-card glass-panel">
              <div className="step-number-tag">01</div>
              <div className="step-icon-col">
                <MapPin size={18} className="step-icon" />
              </div>
              <h3 className="step-title">Choose where you're going</h3>
              <p className="step-desc">
                Select from popular Boulder landmarks, GPS location, or enter any street address.
              </p>
            </div>

            {/* Step 02 */}
            <div className="step-card glass-panel">
              <div className="step-number-tag">02</div>
              <div className="step-icon-col">
                <Layers size={18} className="step-icon" />
              </div>
              <h3 className="step-title">Compare Transit, Multimodal, Walk, Bike & Drive</h3>
              <p className="step-desc">
                Evaluate all transport modes side-by-side with departure and arrival time flexibility.
              </p>
            </div>

            {/* Step 03 */}
            <div className="step-card glass-panel">
              <div className="step-number-tag">03</div>
              <div className="step-icon-col">
                <Activity size={18} className="step-icon" />
              </div>
              <h3 className="step-title">BoulderMove evaluates route & prediction information</h3>
              <p className="step-desc">
                Our gradient-boosted ML model evaluates live traffic, weather precipitation, time of day, and transfer windows.
              </p>
            </div>

            {/* Step 04 */}
            <div className="step-card glass-panel">
              <div className="step-number-tag">04</div>
              <div className="step-icon-col">
                <Clock size={18} className="step-icon" />
              </div>
              <h3 className="step-title">See your predicted arrival and journey reliability</h3>
              <p className="step-desc">
                Get an exact ETA, an on-time reliability score, step timeline, and parking options.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ML FEATURE SECTION & PRODUCT PREVIEW */}
      <section id="preview" className="landing-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">INTELLIGENT PREDICTION</span>
            <h2 className="section-title">ML-Powered Arrival Intelligence</h2>
            <p className="section-subtitle">
              BoulderMove combines routing information with a trained prediction model to estimate how long your journey is likely to take.
            </p>
          </div>

          <div className="preview-tab-controls">
            <button
              type="button"
              className={`preview-tab-btn ${activePreviewTab === "prediction" ? "active" : ""}`}
              onClick={() => setActivePreviewTab("prediction")}
            >
              <Zap size={14} />
              <span>Prediction & Reliability</span>
            </button>

            <button
              type="button"
              className={`preview-tab-btn ${activePreviewTab === "timeline" ? "active" : ""}`}
              onClick={() => setActivePreviewTab("timeline")}
            >
              <Clock size={14} />
              <span>Journey Timeline</span>
            </button>

            <button
              type="button"
              className={`preview-tab-btn ${activePreviewTab === "map" ? "active" : ""}`}
              onClick={() => setActivePreviewTab("map")}
            >
              <Navigation size={14} />
              <span>Interactive Map</span>
            </button>
          </div>

          <div className="preview-display-wrapper glass-panel">
            {activePreviewTab === "prediction" && (
              <div className="preview-content-grid">
                <div className="preview-info-col">
                  <span className="preview-feature-tag">XGBoost ML Engine</span>
                  <h3 className="preview-feature-title">Real-Time Delay & Reliability Scoring</h3>
                  <p className="preview-feature-desc">
                    Unlike standard mapping services that assume ideal conditions, BoulderMove estimates statistical travel time by factoring in real-world variables.
                  </p>
                  <ul className="preview-bullets">
                    <li><CheckCircle2 size={14} /> <strong>73% on-time probability</strong> score</li>
                    <li><CheckCircle2 size={14} /> Transparent <strong>Routing Estimate (10m) vs ML Adjustment (+2m)</strong></li>
                    <li><CheckCircle2 size={14} /> Real traffic and precipitation factor insights</li>
                  </ul>
                </div>

                <div className="preview-ui-box">
                  <div className="ui-box-card glass-panel">
                    <div className="ui-box-top">
                      <div className="ui-score-badge">
                        <ShieldCheck size={18} />
                        <div className="ui-score-text">
                          <span className="ui-score-label">PREDICTED ARRIVAL</span>
                          <span className="ui-score-val">1:41 PM (12 min)</span>
                        </div>
                      </div>
                    </div>

                    <div className="ui-box-breakdown">
                      <div className="ui-metric-row">
                        <span className="ui-k">Routing estimate</span>
                        <span className="ui-v">10 min</span>
                      </div>
                      <div className="ui-metric-row">
                        <span className="ui-k">ML adjustment</span>
                        <span className="ui-v ontime">+2 min</span>
                      </div>
                      <div className="ui-metric-row">
                        <span className="ui-k">On-time probability</span>
                        <span className="ui-v highlight">73%</span>
                      </div>
                      <div className="ui-metric-row">
                        <span className="ui-k">Traffic flow</span>
                        <span className="ui-v">Moderate</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === "timeline" && (
              <div className="preview-content-grid">
                <div className="preview-info-col">
                  <span className="preview-feature-tag">Step-by-Step Guidance</span>
                  <h3 className="preview-feature-title">Complete Transit Journey Timeline</h3>
                  <p className="preview-feature-desc">
                    Clear visual timeline displaying boarding times, intermediate stop counts, connection windows, and walking connections.
                  </p>
                  <ul className="preview-bullets">
                    <li><CheckCircle2 size={14} /> Major hub markers with exact departure times</li>
                    <li><CheckCircle2 size={14} /> Expandable intermediate stops list</li>
                    <li><CheckCircle2 size={14} /> Direct route and transfer indicator</li>
                  </ul>
                </div>

                <div className="preview-ui-box">
                  <div className="ui-box-card glass-panel timeline-preview-card">
                    <div className="ui-timeline-node">
                      <div className="node-time">01:30 PM</div>
                      <div className="node-dot teal" />
                      <div className="node-name">Williams Village</div>
                    </div>
                    <div className="ui-timeline-line">
                      <span className="line-tag">RTD BOUND • 8 min (1 stop)</span>
                    </div>
                    <div className="ui-timeline-node">
                      <div className="node-time">01:38 PM</div>
                      <div className="node-dot amber" />
                      <div className="node-name">30th & Arapahoe Ave</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === "map" && (
              <div className="preview-content-grid">
                <div className="preview-info-col">
                  <span className="preview-feature-tag">Leaflet & CartoDB</span>
                  <h3 className="preview-feature-title">Clean Watermark-Free Interactive Map</h3>
                  <p className="preview-feature-desc">
                    High-contrast dark and light basemaps rendered with zero API key watermarks. View primary route lines, alternative options, transit stops, and nearby parking markers.
                  </p>
                  <ul className="preview-bullets">
                    <li><CheckCircle2 size={14} /> Fit-to-bounds and zoom controls</li>
                    <li><CheckCircle2 size={14} /> Distinct A and B destination pins</li>
                    <li><CheckCircle2 size={14} /> Contextual parking markers in Drive mode</li>
                  </ul>
                </div>

                <div className="preview-ui-box">
                  <div className="ui-box-card glass-panel map-preview-art">
                    <div className="map-art-container">
                      <div className="map-art-pin-a">A</div>
                      <div className="map-art-line" />
                      <div className="map-art-pin-b">B</div>
                      <span className="map-art-label">Boulder Transit Network</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6. BUILT FOR BOULDER (3 TASTEFUL HIGHLIGHTS) */}
      <section className="landing-section alt-bg">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">LOCAL MOBILITY</span>
            <h2 className="section-title">Built for Boulder</h2>
            <p className="section-subtitle">
              Calibrated specifically to Boulder's topography, trail system, and bus routes.
            </p>
          </div>

          <div className="boulder-places-grid">
            <div className="place-card glass-panel">
              <div className="place-header">
                <span className="place-icon">⛰️</span>
                <span className="place-tag">Flatirons & Chautauqua</span>
              </div>
              <h3 className="place-title">Trailhead & Mountain Transit</h3>
              <p className="place-desc">
                Plan trips to Chautauqua Park and Flatirons trailheads with elevation-aware pedestrian paths.
              </p>
            </div>

            <div className="place-card glass-panel">
              <div className="place-header">
                <span className="place-icon">🎓</span>
                <span className="place-tag">CU Boulder & Buff Bus</span>
              </div>
              <h3 className="place-title">Campus Hubs & Student Routes</h3>
              <p className="place-desc">
                Full integration for Williams Village, UMC, C4C, East Campus, Stampede, and Buff Bus lines.
              </p>
            </div>

            <div className="place-card glass-panel">
              <div className="place-header">
                <span className="place-icon">🚴</span>
                <span className="place-tag">Creekside Bikeways</span>
              </div>
              <h3 className="place-title">Multi-Use Trails & Cycling</h3>
              <p className="place-desc">
                Boulder Creek Path and protected bicycle corridors for fast, zero-emission transportation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CALL TO ACTION */}
      <section className="landing-final-cta-section">
        <div className="final-cta-box glass-panel">
          <div className="final-cta-content">
            <h2 className="final-cta-title">Ready to move smarter?</h2>
            <p className="final-cta-subtitle">
              Plan your next Boulder journey with multimodal routing and ML-powered arrival predictions.
            </p>
            <button
              type="button"
              className="final-cta-btn"
              onClick={onOpenPlanner}
            >
              <span>Open BoulderMove →</span>
            </button>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand-col">
            <div className="footer-logo-row">
              <Compass size={17} className="footer-icon" />
              <span className="footer-title">BoulderMove</span>
            </div>
            <p className="footer-tagline">
              Multimodal Transit & Smart Navigation for Boulder, Colorado.
            </p>
          </div>

          <div className="footer-meta-col">
            <span className="footer-ack">
              Powered by RTD GTFS RAPTOR • OSMnx • OpenWeather • XGBoost
            </span>
            <div className="footer-actions-row">
              {onOpenStatus && (
                <button type="button" onClick={onOpenStatus} className="footer-status-link">
                  <Activity size={12} />
                  <span>System Diagnostics</span>
                </button>
              )}
              <button type="button" onClick={onOpenPlanner} className="footer-plan-link">
                Launch Planner →
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
