import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Bus,
  Volume2,
  Edit3,
} from "lucide-react";

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  onConfirmPlan,
  backendUrl = "",
}) {
  const [voiceState, setVoiceState] = useState("idle"); // idle, listening, processing, confirmation, error
  const [transcript, setTranscript] = useState("");
  const [parsedTrip, setParsedTrip] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Editable confirmation form state
  const [confirmOrigin, setConfirmOrigin] = useState("");
  const [confirmDest, setConfirmDest] = useState("");
  const [confirmMode, setConfirmMode] = useState("transit");
  const [confirmTime, setConfirmTime] = useState("");
  const [confirmTimeType, setConfirmTimeType] = useState("depart_at");

  const recognitionRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setVoiceState("idle");
      setTranscript("");
      setParsedTrip(null);
      setErrorMessage("");
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isOpen]);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceState("error");
      setErrorMessage("Speech recognition is not supported in this browser. Please type your trip below.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setVoiceState("listening");
        setErrorMessage("");
      };

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          setVoiceState("idle");
          setErrorMessage("No speech detected. Try speaking again or type below.");
        } else {
          setVoiceState("error");
          setErrorMessage(`Microphone error: ${event.error}. You can type your request directly.`);
        }
      };

      recognition.onend = () => {
        if (transcript.trim()) {
          processTranscript(transcript);
        } else if (voiceState === "listening") {
          setVoiceState("idle");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition startup error:", e);
      setVoiceState("error");
      setErrorMessage("Could not start microphone. You can type your request below.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  };

  // Process natural text through backend NLP endpoint
  const processTranscript = async (queryText) => {
    if (!queryText.trim()) return;
    setVoiceState("processing");

    try {
      const resp = await fetch(`${backendUrl}/api/parse_query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText }),
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data = await resp.json();
      setParsedTrip(data);

      // Populate confirmation form
      setConfirmOrigin(data.parsed?.origin || data.origin?.name || "Current Location");
      setConfirmDest(data.parsed?.destination || data.destination?.name || "King Soopers");
      setConfirmMode(data.mode || "transit");
      setConfirmTime(data.target_time_str || "");
      setConfirmTimeType(data.time_type || "depart_at");

      setVoiceState("confirmation");
    } catch (e) {
      console.error("Voice parse error:", e);
      // Client-side fallback extraction
      const lower = queryText.toLowerCase();
      let mode = "transit";
      if (lower.includes("bike")) mode = "bicycling";
      else if (lower.includes("walk")) mode = "walking";
      else if (lower.includes("drive")) mode = "driving";

      let orig = "Williams Village";
      let dest = "King Soopers";
      if (lower.includes("from ") && lower.includes(" to ")) {
        const parts = lower.split("from ")[1].split(" to ");
        orig = parts[0].trim();
        dest = parts[1].split(" tomorrow")[0].split(" at")[0].trim();
      } else if (lower.includes("to ")) {
        dest = lower.split("to ")[1].split(" tomorrow")[0].split(" at")[0].trim();
      }

      setConfirmOrigin(orig);
      setConfirmDest(dest);
      setConfirmMode(mode);
      setConfirmTime("");
      setConfirmTimeType("depart_at");
      setVoiceState("confirmation");
    }
  };

  const handleConfirmAndExecute = () => {
    onConfirmPlan({
      origin: confirmOrigin,
      destination: confirmDest,
      mode: confirmMode,
      targetTime: confirmTime,
      timeType: confirmTimeType,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="voice-modal-overlay" role="dialog" aria-modal="true">
      <div className="voice-modal-card glass-panel">
        {/* Modal Header */}
        <div className="voice-modal-header">
          <div className="voice-modal-title">
            <Sparkles size={18} className="voice-sparkle-icon" />
            <span>BoulderMove Voice Assistant</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="voice-modal-close"
            title="Close Assistant"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="voice-modal-body">
          {/* 1. Listening / Processing Animation */}
          {voiceState === "listening" && (
            <div className="voice-state-listening">
              <div className="voice-waves-container">
                <div className="pulse-ring ring-1" />
                <div className="pulse-ring ring-2" />
                <div className="voice-mic-core active">
                  <Mic size={32} />
                </div>
              </div>
              <h3 className="voice-state-title">Listening to your request...</h3>
              <p className="voice-state-transcript">
                "{transcript || "Say where you want to go in Boulder..."}"
              </p>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  processTranscript(transcript);
                }}
                className="voice-done-speaking-btn"
                disabled={!transcript.trim()}
              >
                <span>Done Speaking</span>
              </button>
            </div>
          )}

          {/* 2. Processing State */}
          {voiceState === "processing" && (
            <div className="voice-state-processing">
              <div className="voice-spinner animate-spin" />
              <h3 className="voice-state-title">Analyzing Trip Intent...</h3>
              <p className="voice-state-hint">Extracting origin, destination, time, and transit line...</p>
            </div>
          )}

          {/* 3. Confirmation / Verification Step (CRITICAL PRODUCT REQUIREMENT) */}
          {voiceState === "confirmation" && (
            <div className="voice-state-confirmation">
              <div className="confirm-banner">
                <CheckCircle2 size={20} className="confirm-check-icon" />
                <div className="confirm-banner-text">
                  <span className="confirm-heard-title">I heard your trip request:</span>
                  <span className="confirm-heard-sub">Verify or adjust below before calculating route</span>
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div className="confirm-form-grid">
                {/* Origin */}
                <div className="confirm-field-row">
                  <label className="confirm-label">From</label>
                  <input
                    type="text"
                    value={confirmOrigin}
                    onChange={(e) => setConfirmOrigin(e.target.value)}
                    className="confirm-input"
                  />
                </div>

                {/* Destination */}
                <div className="confirm-field-row">
                  <label className="confirm-label">To</label>
                  <input
                    type="text"
                    value={confirmDest}
                    onChange={(e) => setConfirmDest(e.target.value)}
                    className="confirm-input"
                  />
                </div>

                {/* Travel Mode */}
                <div className="confirm-field-row">
                  <label className="confirm-label">Mode</label>
                  <select
                    value={confirmMode}
                    onChange={(e) => setConfirmMode(e.target.value)}
                    className="confirm-select"
                  >
                    <option value="transit">Transit (RTD & Buff Bus)</option>
                    <option value="walk_transit_walk">Multimodal (Walk + Bus)</option>
                    <option value="walking">Walk</option>
                    <option value="bicycling">Bike</option>
                    <option value="driving">Drive</option>
                  </select>
                </div>

                {/* Optional Target Time */}
                {confirmTime && (
                  <div className="confirm-field-row">
                    <label className="confirm-label">Target Time</label>
                    <div className="confirm-time-group">
                      <input
                        type="text"
                        value={confirmTime}
                        onChange={(e) => setConfirmTime(e.target.value)}
                        className="confirm-input"
                      />
                      <span className="confirm-tz">Boulder MT</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="confirm-actions-row">
                <button
                  type="button"
                  onClick={startListening}
                  className="confirm-retry-btn"
                >
                  <Mic size={15} />
                  <span>Speak Again</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndExecute}
                  className="confirm-plan-btn"
                >
                  <span>Confirm & Plan Route</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* 4. Error / Idle Fallback with Manual Input */}
          {(voiceState === "idle" || voiceState === "error") && (
            <div className="voice-state-idle">
              {errorMessage && (
                <div className="voice-error-banner">
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="voice-manual-input-box">
                <label className="manual-label">Type or speak your request:</label>
                <div className="manual-input-row">
                  <input
                    type="text"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="e.g. Fastest route from Glenwood Court to King Soopers at 9 AM"
                    className="manual-text-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && transcript.trim()) {
                        processTranscript(transcript);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={startListening}
                    className="manual-mic-action-btn"
                    title="Start Speaking"
                  >
                    <Mic size={18} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => processTranscript(transcript)}
                  className="manual-submit-btn"
                  disabled={!transcript.trim()}
                >
                  <span>Parse & Plan Trip</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
