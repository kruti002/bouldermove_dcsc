import React from "react";
import {
  CloudSun,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  AlertTriangle,
  Compass,
} from "lucide-react";

export default function WeatherCard({ weather, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="weather-card glass-panel loading">
        <div className="weather-loading-row">
          <CloudSun size={20} className="animate-pulse text-muted" />
          <span>Loading live Boulder weather...</span>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="weather-card glass-panel unavailable">
        <div className="weather-header">
          <div className="weather-title">
            <CloudSun size={18} />
            <span>Weather</span>
          </div>
          <span className="weather-status-tag">Live</span>
        </div>
        <p className="weather-empty-msg">
          Weather conditions temporarily unavailable.
        </p>
      </div>
    );
  }

  const dep = weather.departure || weather;
  const arr = weather.arrival;
  const temp = Math.round(weather.temp ?? dep?.temp ?? 20);
  const feelsLike = Math.round(weather.feels_like ?? dep?.feels_like ?? temp);
  const desc = weather.weather_desc || dep?.weather_desc || "Clear";
  const rain1h = weather.rain_1h ?? dep?.rain_1h ?? 0;
  const snow1h = weather.snow_1h ?? dep?.snow_1h ?? 0;
  const windSpeed = Math.round(weather.wind_speed ?? dep?.wind_speed ?? 0);
  const alerts = weather.custom_alerts || dep?.custom_alerts || [];

  // Weather Icon resolution
  const getWeatherIcon = (conditionDesc = "") => {
    const lower = conditionDesc.toLowerCase();
    if (lower.includes("rain") || lower.includes("drizzle")) {
      return <CloudRain size={24} className="weather-glyph rain" />;
    }
    if (lower.includes("snow") || lower.includes("ice")) {
      return <CloudSnow size={24} className="weather-glyph snow" />;
    }
    if (lower.includes("clear") || lower.includes("sun")) {
      return <Sun size={24} className="weather-glyph sun" />;
    }
    return <CloudSun size={24} className="weather-glyph clouds" />;
  };

  return (
    <div className="weather-card glass-panel">
      {/* Weather Header */}
      <div className="weather-header">
        <div className="weather-title">
          <CloudSun size={18} />
          <span>Weather Conditions</span>
        </div>
        <span className="weather-loc-tag">Boulder, CO</span>
      </div>

      {/* Main Temperature & Condition Row */}
      <div className="weather-hero-row">
        <div className="weather-temp-group">
          {getWeatherIcon(desc)}
          <div className="temp-numbers">
            <span className="current-temp">{temp}°C</span>
            <span className="feels-like">Feels like {feelsLike}°C</span>
          </div>
        </div>
        <div className="weather-condition-tag capitalize">
          {desc}
        </div>
      </div>

      {/* Weather Context Details */}
      <div className="weather-meta-grid">
        <div className="weather-meta-pill">
          <Droplets size={14} className="meta-icon" />
          <span>
            {rain1h > 0 ? `${rain1h} mm rain` : snow1h > 0 ? `${snow1h} mm snow` : "0% rain chance"}
          </span>
        </div>
        <div className="weather-meta-pill">
          <Wind size={14} className="meta-icon" />
          <span>{windSpeed} m/s wind</span>
        </div>
      </div>

      {/* Contextual Departure vs Arrival Comparison if available */}
      {arr && arr.temp !== undefined && (
        <div className="weather-context-comparison">
          <div className="context-col">
            <span className="context-label">At Departure</span>
            <span className="context-val">{Math.round(dep?.temp ?? temp)}°C • {dep?.weather_main || "Fair"}</span>
          </div>
          <div className="context-divider" />
          <div className="context-col">
            <span className="context-label">At Destination</span>
            <span className="context-val">{Math.round(arr.temp)}°C • {arr.weather_main || "Fair"}</span>
          </div>
        </div>
      )}

      {/* Custom Alerts if present */}
      {alerts && alerts.length > 0 && (
        <div className="weather-alerts-list">
          {alerts.map((al, idx) => (
            <div key={idx} className={`weather-alert-banner severity-${al.severity || "medium"}`}>
              <AlertTriangle size={15} className="alert-icon" />
              <div className="alert-text">
                <span className="alert-title">{al.title}</span>
                <span className="alert-msg">{al.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
