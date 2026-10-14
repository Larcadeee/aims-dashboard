import { useEffect, useState } from "react";

const WEATHER_API_URL =
  "https://api.openweathermap.org/data/2.5/weather?lat=8.9515&lon=125.5277&appid=969ca531fbd4c3fb820d95765b142485&units=metric";

function formatTime(unixTs) {
  return new Date(unixTs * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDaylight(sunrise, sunset) {
  if (!sunrise || !sunset) return "--";
  const ms = sunset * 1000 - sunrise * 1000;
  if (ms <= 0) return "--";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

// Operational weather. Mirrors js/weather.js: fetch OpenWeather, render
// hero / sun cycle / atmospheric metrics / forecast, and
// auto-refresh every 5 minutes.
export default function Weather({ onToggleSidebar }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [syncedAt, setSyncedAt] = useState(
    "Syncing live meteorological data...",
  );

  async function fetchWeather() {
    setSyncedAt("Syncing live meteorological data...");
    try {
      const curRes = await fetch(WEATHER_API_URL);
      const json = await curRes.json();
      setData(json);
      setError(null);

      const now = new Date();
      const opts = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      setSyncedAt(`Last synced: ${now.toLocaleDateString("en-US", opts)}`);
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
      setError(err);
      setSyncedAt("System Offline: Unable to reach servers.");
    }
  }

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const tempC =
    data && typeof data.main?.temp === "number"
      ? Math.round(data.main.temp)
      : null;
  const feelsLikeC =
    data && typeof data.main?.feels_like === "number"
      ? Math.round(data.main.feels_like)
      : null;
  const tempMaxC =
    data && typeof data.main?.temp_max === "number"
      ? Math.round(data.main.temp_max)
      : null;
  const tempMinC =
    data && typeof data.main?.temp_min === "number"
      ? Math.round(data.main.temp_min)
      : null;
  const iconCode = data?.weather?.[0]?.icon;
  const description = data?.weather?.[0]?.description || "Loading weather...";

  return (
    <div className="container">
      {/* Scoped Weather UI Styles for colorful, modern cards */}
      <style>{`
        .wx-hero-card {
          position: relative;
          background: linear-gradient(135deg, #1d4ed8 0%, #0284c7 55%, #38bdf8 100%) !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 16px !important;
          padding: 24px !important;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          box-shadow: 0 12px 28px -6px rgba(2, 132, 199, 0.35) !important;
          min-height: 310px;
        }
        .wx-hero-card::before {
          content: "";
          position: absolute;
          top: -50px;
          right: -50px;
          width: 190px;
          height: 190px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%);
          pointer-events: none;
        }
        .wx-hero-card::after {
          content: "";
          position: absolute;
          bottom: -60px;
          left: -40px;
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 70%);
          pointer-events: none;
        }
        .wx-hero-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        .wx-loc-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 1.15rem;
          font-weight: 700;
          color: #ffffff !important;
          margin: 0 !important;
          letter-spacing: -0.01em;
        }
        .wx-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(6px);
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #ffffff;
          margin-top: 6px;
        }
        .wx-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #4ade80;
          box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.3);
        }
        .wx-icon-box {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }
        .wx-icon-box img {
          width: 64px;
          height: 64px;
          object-fit: contain;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
        }
        .wx-hero-main {
          position: relative;
          z-index: 1;
          margin: 18px 0;
        }
        .wx-temp-row {
          display: flex;
          align-items: baseline;
          gap: 14px;
          flex-wrap: wrap;
        }
        .wx-massive-temp {
          font-size: 4rem !important;
          font-weight: 800 !important;
          line-height: 1 !important;
          margin: 0 !important;
          color: #ffffff !important;
          letter-spacing: -0.03em;
        }
        .wx-desc-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 600;
          text-transform: capitalize;
          backdrop-filter: blur(4px);
        }
        .wx-feels-like {
          margin: 8px 0 0 0;
          font-size: 0.92rem;
          color: rgba(255, 255, 255, 0.88);
          font-weight: 500;
        }
        .wx-hero-footer {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        .wx-mini-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .wx-mini-stat span {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 600;
        }
        .wx-mini-stat strong {
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
        }

        /* Solar Cycle Card */
        .wx-solar-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .wx-solar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .wx-solar-header h3 {
          margin: 0 !important;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.05rem;
        }
        .wx-sun-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .wx-sun-tile {
          border-radius: 14px;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          border: 1px solid transparent;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wx-sun-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.06);
        }
        .wx-sun-tile.sunrise {
          background: linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%);
          border-color: #fde68a;
        }
        .wx-sun-tile.sunset {
          background: linear-gradient(145deg, #f5f3ff 0%, #ede9fe 100%);
          border-color: #ddd6fe;
        }
        .wx-sun-tile.daylight {
          background: linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 100%);
          border-color: #bae6fd;
        }
        .wx-sun-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.05rem;
          flex-shrink: 0;
        }
        .wx-sun-tile.sunrise .wx-sun-icon {
          background-color: #f59e0b;
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);
        }
        .wx-sun-tile.sunset .wx-sun-icon {
          background-color: #7c3aed;
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);
        }
        .wx-sun-tile.daylight .wx-sun-icon {
          background-color: #0284c7;
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);
        }
        .wx-sun-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .wx-sun-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #64748b;
        }
        .wx-sun-value {
          font-size: 1.02rem;
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
        }

        /* Atmospheric Conditions Grid */
        .wx-atmo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 14px;
        }
        .wx-metric-tile {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .wx-metric-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          border-color: #cbd5e1;
        }
        .wx-metric-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          flex-shrink: 0;
        }
        .wx-metric-content {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .wx-metric-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #64748b;
        }
        .wx-metric-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
        }

        @media (max-width: 520px) {
          .wx-sun-grid {
            grid-template-columns: 1fr;
          }
          .wx-sun-tile {
            flex-direction: row;
            align-items: center;
          }
        }
      `}</style>

      <div className="weather-header">
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <button
            id="sidebarToggle"
            className="sidebar-toggle"
            onClick={(e) => {
              e.preventDefault();
              onToggleSidebar();
            }}
            style={{ marginBottom: 0 }}
          >
            <i className="fa-solid fa-bars" />
          </button>
          <div>
            <h2 style={{ margin: 0 }}>Operational Weather</h2>
            <p id="curr-date" style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: "0.88rem" }}>
              {syncedAt}
            </p>
          </div>
        </div>
        <button
          id="btn-refresh"
          className="btn btn-primary"
          onClick={fetchWeather}
        >
          <i className="fa-solid fa-rotate-right" /> Refresh Data
        </button>
      </div>

      <div className="weather-grid">
        <div className="weather-map-panel">
          <iframe
            width="650"
            height="450"
            title="Windy Live Weather Monitoring"
            src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=default&metricTemp=default&metricWind=default&zoom=5&overlay=wind&product=ecmwf&level=surface&lat=11.321&lon=121.283&detailLat=14.5971&detailLon=120.9798&marker=true"
            className="weather-map-frame"
            frameBorder={0}
            allowFullScreen
          />
          <div className="weather-forecast-panel">
            <h3>Weather Forecast</h3>
            <iframe
              width="650"
              height="170"
              title="Windy Weather Forecast"
              src="https://embed.windy.com/embed.html?type=forecast&location=coordinates&detail=true&detailLat=8.9474561&detailLon=125.54319730000002&metricTemp=default&metricRain=default&metricWind=default"
              className="weather-forecast-frame"
              frameBorder={0}
              allowFullScreen
            />
          </div>
        </div>

        {/* Hero Weather Card */}
        <div className="card wx-hero-card">
          <div className="wx-hero-header">
            <div>
              <h3 id="loc-name" className="wx-loc-badge">
                <i className="fa-solid fa-location-dot" />
                {data ? `${data.name}, ${data.sys.country}` : "Loading..."}
              </h3>
              <div className="wx-live-pill">
                <span className="wx-live-dot" /> Live Station
              </div>
            </div>

            <div className="wx-icon-box">
              {iconCode ? (
                <img
                  id="w-icon"
                  src={`https://openweathermap.org/img/wn/${iconCode}@2x.png`}
                  alt="Weather Icon"
                />
              ) : (
                <i className="fa-solid fa-cloud-sun" style={{ fontSize: "1.8rem", color: "#fff" }} />
              )}
            </div>
          </div>

          <div className="wx-hero-main">
            <div className="wx-temp-row">
              <h1 id="curr-temp" className="wx-massive-temp">
                {tempC !== null ? `${tempC}°C` : "--°C"}
              </h1>
              <span id="w-desc" className="wx-desc-pill">
                <i className="fa-solid fa-cloud-rain" />
                {description}
              </span>
            </div>
            <p className="wx-feels-like">
              Feels like{" "}
              <strong id="feels-like">
                {feelsLikeC !== null ? `${feelsLikeC}°C` : "--°C"}
              </strong>
            </p>
          </div>

          <div className="wx-hero-footer">
            <div className="wx-mini-stat">
              <span>High / Low</span>
              <strong>
                {tempMaxC !== null && tempMinC !== null
                  ? `${tempMaxC}° / ${tempMinC}°`
                  : "--° / --°"}
              </strong>
            </div>
            <div className="wx-mini-stat">
              <span>Humidity</span>
              <strong>{data ? `${data.main.humidity}%` : "--%"}</strong>
            </div>
            <div className="wx-mini-stat">
              <span>Wind</span>
              <strong>{data ? `${data.wind.speed} m/s` : "-- m/s"}</strong>
            </div>
          </div>
        </div>

        {/* Solar Cycle Card */}
        <div className="card wx-solar-card">
          <div className="wx-solar-header">
            <h3>
              <i className="fa-solid fa-sun" style={{ color: "#f59e0b" }} />
              Solar Cycle
            </h3>
            <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
              Local Time
            </span>
          </div>

          <div className="wx-sun-grid">
            <div className="wx-sun-tile sunrise">
              <div className="wx-sun-icon">
                <i className="fa-solid fa-sun" />
              </div>
              <div className="wx-sun-info">
                <span className="wx-sun-label">Sunrise</span>
                <strong id="m-sunrise" className="wx-sun-value">
                  {data ? formatTime(data.sys.sunrise) : "--:--"}
                </strong>
              </div>
            </div>

            <div className="wx-sun-tile sunset">
              <div className="wx-sun-icon">
                <i className="fa-solid fa-moon" />
              </div>
              <div className="wx-sun-info">
                <span className="wx-sun-label">Sunset</span>
                <strong id="m-sunset" className="wx-sun-value">
                  {data ? formatTime(data.sys.sunset) : "--:--"}
                </strong>
              </div>
            </div>

            <div className="wx-sun-tile daylight">
              <div className="wx-sun-icon">
                <i className="fa-solid fa-cloud-sun" />
              </div>
              <div className="wx-sun-info">
                <span className="wx-sun-label">Daylight</span>
                <strong className="wx-sun-value">
                  {data
                    ? formatDaylight(data.sys.sunrise, data.sys.sunset)
                    : "--"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Atmospheric Conditions Card */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <i className="fa-solid fa-wind" style={{ color: "#0284c7" }} />
            Atmospheric Conditions
          </h3>
          <div className="wx-atmo-grid">
            <WeatherMetric
              icon="fa-solid fa-droplet"
              label="Humidity"
              value={data ? `${data.main.humidity}%` : "--%"}
              bg="#eff6ff"
              color="#2563eb"
            />
            <WeatherMetric
              icon="fa-solid fa-paper-plane"
              label="Wind Speed"
              value={data ? `${data.wind.speed} m/s` : "-- m/s"}
              bg="#ecfdf5"
              color="#10b981"
            />
            <WeatherMetric
              icon="fa-solid fa-arrow-up-right-dots"
              label="Wind Gust"
              value={
                data
                  ? data.wind.gust
                    ? `${data.wind.gust} m/s`
                    : "0 m/s"
                  : "-- m/s"
              }
              bg="#fffbeb"
              color="#f59e0b"
            />
            <WeatherMetric
              icon="fa-solid fa-eye"
              label="Visibility"
              value={
                data ? `${(data.visibility / 1000).toFixed(1)} km` : "-- km"
              }
              bg="#f5f3ff"
              color="#8b5cf6"
            />
            <WeatherMetric
              icon="fa-solid fa-cloud"
              label="Cloud Cover"
              value={data ? `${data.clouds.all}%` : "--%"}
              bg="#f0f9ff"
              color="#0284c7"
            />
            <WeatherMetric
              icon="fa-solid fa-gauge"
              label="Pressure"
              value={data ? `${data.main.pressure} hPa` : "-- hPa"}
              bg="#fef2f2"
              color="#ef4444"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherMetric({ icon, label, value, bg, color }) {
  return (
    <div className="wx-metric-tile">
      <div
        className="wx-metric-icon"
        style={{ backgroundColor: bg, color: color }}
      >
        <i className={icon} />
      </div>
      <div className="wx-metric-content">
        <span className="wx-metric-label">{label}</span>
        <strong className="wx-metric-val">{value}</strong>
      </div>
    </div>
  );
}