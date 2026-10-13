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
  const iconCode = data?.weather?.[0]?.icon;

  return (
    <div className="container">
      <div className="weather-header">
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <button
            id="sidebarToggle"
            className="sidebar-toggle"
            onClick={(e) => {
              e.preventDefault();
              onToggleSidebar();
              const icon = e.currentTarget.querySelector("i");
              if (icon) {
                const sidebar = document.querySelector(".sidebar");
                if (sidebar?.classList.contains("collapsed")) {
                  icon.classList.remove("fa-bars");
                  icon.classList.add("fa-xmark");
                } else {
                  icon.classList.remove("fa-xmark");
                  icon.classList.add("fa-bars");
                }
              }
            }}
            style={{ marginBottom: 0 }}
          >
            <i className="fa-solid fa-bars" />
          </button>
          <div>
            <h2 style={{ margin: 0 }}>Operational Weather</h2>
            <p id="curr-date" style={{ margin: "5px 0 0 0", color: "#6b7280" }}>
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

        <div className="card hero-panel">
          <div className="hero-top">
            <img
              id="w-icon"
              src={
                iconCode
                  ? `https://openweathermap.org/img/wn/${iconCode}@2x.png`
                  : ""
              }
              alt="Weather Icon"
              style={{ display: iconCode ? "block" : "none" }}
            />
            <h3 id="loc-name">
              {data ? `${data.name}, ${data.sys.country}` : "Loading..."}
            </h3>
          </div>
          <h1 id="curr-temp" className="massive-temp">
            {tempC !== null ? `${tempC}°C` : "--°C"}
          </h1>
          <p className="feels-like">
            Feels like{" "}
            <span id="feels-like">
              {feelsLikeC !== null ? `${feelsLikeC}°C` : "--°C"}
            </span>
          </p>
          <p id="w-desc" className="desc-text">
            {data?.weather?.[0]?.description || "--"}
          </p>
        </div>

        <div className="card">
          <h3>Solar Cycle</h3>
          <div className="sun-grid">
            <div className="sun-item">
              <i className="fa-solid fa-sun" />
              <div>
                <span>Sunrise</span>
                <strong id="m-sunrise">
                  {data ? formatTime(data.sys.sunrise) : "--:--"}
                </strong>
              </div>
            </div>
            <div className="sun-item">
              <i className="fa-solid fa-moon" />
              <div>
                <span>Sunset</span>
                <strong id="m-sunset">
                  {data ? formatTime(data.sys.sunset) : "--:--"}
                </strong>
              </div>
            </div>
            <div className="sun-item">
              <i className="fa-solid fa-cloud-sun" />
              <div>
                <span>Daylight</span>
                <strong>
                  {data
                    ? formatDaylight(data.sys.sunrise, data.sys.sunset)
                    : "--"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h3>Atmospheric Conditions</h3>
          <div className="weather-metrics-grid">
            <WeatherMetric
              icon="fa-solid fa-droplet"
              label="Humidity"
              value={data ? `${data.main.humidity}%` : "--%"}
            />
            <WeatherMetric
              icon="fa-solid fa-paper-plane"
              label="Wind Speed"
              value={data ? `${data.wind.speed} m/s` : "-- m/s"}
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
            />
            <WeatherMetric
              icon="fa-solid fa-eye"
              label="Visibility"
              value={
                data ? `${(data.visibility / 1000).toFixed(1)} km` : "-- km"
              }
            />
            <WeatherMetric
              icon="fa-solid fa-cloud"
              label="Cloud Cover"
              value={data ? `${data.clouds.all}%` : "--%"}
            />
            <WeatherMetric
              icon="fa-solid fa-gauge"
              label="Pressure"
              value={data ? `${data.main.pressure} hPa` : "-- hPa"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherMetric({ icon, label, value }) {
  return (
    <div className="weather-metric-card">
      <i className={icon} />
      <span className="m-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
