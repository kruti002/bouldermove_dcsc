import React, { useState } from "react";
import {
  Bookmark,
  X,
  Trash2,
  Edit2,
  Check,
  ArrowRight,
  Bus,
  Footprints,
  Bike,
  Car,
  Sparkles,
  RotateCcw,
  HardDrive,
} from "lucide-react";
import { deleteTrip, updateTripName } from "../services/savedTripsService";

export default function SavedTripsModal({
  isOpen,
  onClose,
  savedTrips = [],
  onSelectTrip,
  onTripsUpdated,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  if (!isOpen) return null;

  const handleStartRename = (trip) => {
    setEditingId(trip.id);
    setEditingName(trip.name || `${trip.origin} → ${trip.destination}`);
  };

  const handleSaveRename = (tripId) => {
    if (editingName.trim()) {
      const updated = updateTripName(tripId, editingName.trim());
      if (onTripsUpdated) onTripsUpdated(updated);
    }
    setEditingId(null);
  };

  const handleDelete = (tripId, e) => {
    e.stopPropagation();
    const updated = deleteTrip(tripId);
    if (onTripsUpdated) onTripsUpdated(updated);
  };

  const handleSelect = (trip) => {
    if (onSelectTrip) {
      onSelectTrip(trip);
      onClose();
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case "walking":
        return <Footprints size={14} className="text-emerald" />;
      case "bicycling":
        return <Bike size={14} className="text-amber" />;
      case "driving":
        return <Car size={14} className="text-sky" />;
      case "walk_transit_walk":
        return <Sparkles size={14} className="text-teal" />;
      default:
        return <Bus size={14} className="text-teal" />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="saved-trips-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Bookmark className="modal-header-icon" size={18} />
            <h2 className="modal-title">Saved Trips</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close saved trips modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="saved-trips-storage-banner">
          <HardDrive size={13} />
          <span>Saved locally on this device • Selecting a trip recalculates fresh real-time ETAs</span>
        </div>

        {savedTrips.length === 0 ? (
          <div className="saved-trips-empty-state">
            <Bookmark size={32} className="empty-icon text-muted" />
            <h3>No saved journeys yet</h3>
            <p>Click "Save trip" on any route calculation to quickly access your favorite journeys here.</p>
          </div>
        ) : (
          <div className="saved-trips-list">
            {savedTrips.map((trip) => {
              const isEditing = editingId === trip.id;
              return (
                <div
                  key={trip.id}
                  className="saved-trip-item glass-panel"
                  onClick={() => !isEditing && handleSelect(trip)}
                >
                  <div className="saved-trip-icon-col">
                    {getModeIcon(trip.mode)}
                  </div>

                  <div className="saved-trip-main-col">
                    {isEditing ? (
                      <div className="rename-input-row" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="rename-text-input"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(trip.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          className="save-rename-btn"
                          onClick={() => handleSaveRename(trip.id)}
                          title="Save name"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="saved-trip-custom-name">
                          {trip.name || `${trip.origin} → ${trip.destination}`}
                        </span>
                        <div className="saved-trip-endpoints">
                          <span>{trip.origin}</span>
                          <ArrowRight size={12} className="text-muted" />
                          <span>{trip.destination}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="saved-trip-actions-col">
                    {!isEditing && (
                      <button
                        type="button"
                        className="trip-action-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(trip);
                        }}
                        title="Rename trip"
                        aria-label="Rename trip"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="trip-action-icon-btn delete-btn"
                      onClick={(e) => handleDelete(trip.id, e)}
                      title="Delete saved trip"
                      aria-label="Delete trip"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
