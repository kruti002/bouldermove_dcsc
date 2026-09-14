import React from "react";
import {
  Calendar,
  MapPin,
  ExternalLink,
  Tag,
  AlertTriangle,
} from "lucide-react";

export default function EventsCard({ eventsData, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="events-contextual-card glass-panel loading">
        <div className="events-loading-row">
          <Calendar size={15} className="animate-pulse text-muted" />
          <span>Checking destination events & traffic impact...</span>
        </div>
      </div>
    );
  }

  const eventsList = eventsData?.events || (Array.isArray(eventsData) ? eventsData : []);
  const eventCount = eventsList.length;

  if (error || eventCount === 0) {
    return (
      <div className="events-contextual-card glass-panel empty">
        <div className="events-context-header">
          <div className="events-title-row">
            <Calendar size={15} className="events-icon" />
            <h4 className="events-heading">Nearby Events</h4>
          </div>
        </div>
        <p className="events-clean-note">
          No major events near your destination today.
        </p>
      </div>
    );
  }

  // Display top 2 events
  const topEvents = eventsList.slice(0, 2);

  return (
    <div className="events-contextual-card glass-panel">
      <div className="events-context-header">
        <div className="events-title-row">
          <Calendar size={15} className="events-icon" />
          <h4 className="events-heading">Nearby Events</h4>
        </div>
        <span className="events-impact-badge">Possible corridor traffic</span>
      </div>

      <div className="events-items-stack">
        {topEvents.map((evt, idx) => {
          const title = evt.title || evt.name || "Boulder Event";
          const venue = evt.venue || evt.location || "Boulder";
          const time = evt.time || evt.date || "Today";
          const url = evt.url || evt.ticket_url;

          return (
            <div key={idx} className="event-compact-row">
              <div className="event-compact-info">
                <span className="event-compact-title">{title}</span>
                <div className="event-compact-meta">
                  <span>{venue}</span>
                  <span>•</span>
                  <span>{time}</span>
                </div>
              </div>

              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-compact-link"
                  title="View Event"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
