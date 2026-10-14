import { useEffect, useMemo, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';
import {
  computeMetrics,
  renderMap,
  renderRadiusChart,
  renderTrendChart,
  renderTypeChart,
} from '../utils/chart.js';
import { getAverageTime } from '../utils/time.js';

// Same live endpoints used across Dashboard, Resource, Report, Weather, and News
const DASH_SHEET_ID = '189IMJxmVEHD033kCJrprM_7CcdOg7QTTra8D9dy-Dv8';
const DASH_GID = '1297922850';
const DASH_CSV_URL = `https://docs.google.com/spreadsheets/d/${DASH_SHEET_ID}/export?format=csv&gid=${DASH_GID}`;
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/Boundary.json`;

const RES_SHEET_ID = '1AtMv03PDmXNgj9IkQVXX8iZjjEMduzHKRk4fY_8DN1A';
const RES_GID = '1800080155';
const RES_CSV_URL = `https://docs.google.com/spreadsheets/d/${RES_SHEET_ID}/export?format=csv&gid=${RES_GID}`;
const ELOG_CSV_URL = `https://docs.google.com/spreadsheets/d/${RES_SHEET_ID}/export?format=csv&gid=0`;

const WEATHER_API_URL =
  'https://api.openweathermap.org/data/2.5/weather?lat=8.9515&lon=125.5277&appid=969ca531fbd4c3fb820d95765b142485&units=metric';

const FB_PAGE_ID = '1424151444262464';
const FB_ACCESS_TOKEN =
  'EAATZAeMV0gKABSD2TSdAbYEmuMZBzwLaBSMN4D1i2JZA12LVzoIHpCvTMKzxOo7J0LZB6gZApT2WBxbuv38fFkK55TTEo1t2gZCBfLFi0h6mJNkVG7V0QC48VZB53kZAegTCusdFVjHHRS5ACk9NnW5rdin42BVP0BlDJmYXlKBCY86ZBBdRvrw4pfCRC1G7XBLBinTPsqZBjF';
const NEWS_API_URL = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/posts?fields=message,created_time,full_picture,permalink_url,story&limit=6&access_token=${FB_ACCESS_TOKEN}`;

const STORAGE_KEY = 'aims_custom_dashboard_v1';

// Available widgets from all pages
const WIDGET_CATALOG = [
  {
    type: 'kpi-metrics',
    title: 'Live Key Metrics',
    sourcePage: 'Dashboard',
    icon: 'fa-solid fa-chart-simple',
    defaultColSpan: 12,
    defaultHeight: 'compact',
    defaultTheme: 'light',
  },
  {
    type: 'heatmap',
    title: 'Butuan Incident Heat Map',
    sourcePage: 'Dashboard',
    icon: 'fa-solid fa-map-location-dot',
    defaultColSpan: 8,
    defaultHeight: 'tall',
    defaultTheme: 'light',
  },
  {
    type: 'avg-times',
    title: 'Average Response Times',
    sourcePage: 'Dashboard',
    icon: 'fa-regular fa-clock',
    defaultColSpan: 4,
    defaultHeight: 'normal',
    defaultTheme: 'ocean',
  },
  {
    type: 'tat-trend',
    title: 'Turn-Around Time Trend',
    sourcePage: 'Dashboard',
    icon: 'fa-solid fa-chart-line',
    defaultColSpan: 8,
    defaultHeight: 'normal',
    defaultTheme: 'light',
  },
  {
    type: 'donuts',
    title: 'KM Radius & Incident Types',
    sourcePage: 'Dashboard',
    icon: 'fa-solid fa-chart-pie',
    defaultColSpan: 4,
    defaultHeight: 'normal',
    defaultTheme: 'light',
  },
  {
    type: 'weather-hero',
    title: 'Live Operational Weather',
    sourcePage: 'Weather',
    icon: 'fa-solid fa-cloud-sun-rain',
    defaultColSpan: 4,
    defaultHeight: 'normal',
    defaultTheme: 'ocean',
  },
  {
    type: 'weather-atmo',
    title: 'Atmospheric & Solar Cycle',
    sourcePage: 'Weather',
    icon: 'fa-solid fa-wind',
    defaultColSpan: 4,
    defaultHeight: 'normal',
    defaultTheme: 'glass',
  },
  {
    type: 'resource-units',
    title: 'Active Fleet Units',
    sourcePage: 'Resource Tracker',
    icon: 'fa-solid fa-truck-medical',
    defaultColSpan: 6,
    defaultHeight: 'normal',
    defaultTheme: 'light',
  },
  {
    type: 'elog-recent',
    title: 'Latest E-Log Incidents',
    sourcePage: 'E-Log Reports',
    icon: 'fa-solid fa-file-lines',
    defaultColSpan: 6,
    defaultHeight: 'normal',
    defaultTheme: 'light',
  },
  {
    type: 'news-highlight',
    title: 'CDRRMD News & Advisories',
    sourcePage: 'News & Updates',
    icon: 'fa-solid fa-newspaper',
    defaultColSpan: 6,
    defaultHeight: 'normal',
    defaultTheme: 'light',
  },
];

const DEFAULT_LAYOUT = [
  {
    id: 'w-kpi-1',
    type: 'kpi-metrics',
    title: 'Live Key Metrics',
    colSpan: 12,
    height: 'compact',
    theme: 'light',
    angle: 0,
    tilt3d: 0,
    radius: 16,
  },
  {
    id: 'w-map-1',
    type: 'heatmap',
    title: 'Butuan Incident Heat Map',
    colSpan: 8,
    height: 'tall',
    theme: 'light',
    angle: 0,
    tilt3d: 0,
    radius: 16,
  },
  {
    id: 'w-wx-1',
    type: 'weather-hero',
    title: 'Live Operational Weather',
    colSpan: 4,
    height: 'tall',
    theme: 'ocean',
    angle: 0,
    tilt3d: 0,
    radius: 20,
  },
  {
    id: 'w-res-1',
    type: 'resource-units',
    title: 'Active Fleet Units',
    colSpan: 6,
    height: 'normal',
    theme: 'light',
    angle: 0,
    tilt3d: 0,
    radius: 16,
  },
  {
    id: 'w-news-1',
    type: 'news-highlight',
    title: 'CDRRMD News & Advisories',
    colSpan: 6,
    height: 'normal',
    theme: 'light',
    angle: 0,
    tilt3d: 0,
    radius: 16,
  },
];

const CANVAS_THEMES = {
  light: {
    name: 'Clean Light',
    bg: '#f1f5f9',
    dot: '#cbd5e1',
  },
  dark: {
    name: 'Slate Night',
    bg: '#0f172a',
    dot: '#334155',
  },
  ocean: {
    name: 'Ocean Mist',
    bg: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 50%, #e0e7ff 100%)',
    dot: '#93c5fd',
  },
  sand: {
    name: 'Warm Editorial',
    bg: '#f5efe6',
    dot: '#d6cbb9',
  },
};

const CARD_THEMES = {
  light: {
    label: 'Crisp White',
    bg: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    swatch: '#ffffff',
  },
  glass: {
    label: 'Frosted Glass',
    bg: 'rgba(255, 255, 255, 0.72)',
    text: '#0f172a',
    muted: '#475569',
    border: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(14px)',
    swatch: '#e2e8f0',
  },
  dark: {
    label: 'Midnight Slate',
    bg: '#1e293b',
    text: '#f8fafc',
    muted: '#94a3b8',
    border: '#334155',
    swatch: '#1e293b',
  },
  ocean: {
    label: 'Ocean Blue',
    bg: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 60%, #38bdf8 100%)',
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.82)',
    border: 'transparent',
    swatch: '#0284c7',
  },
  sunset: {
    label: 'Sunset Amber',
    bg: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.85)',
    border: 'transparent',
    swatch: '#f59e0b',
  },
  emerald: {
    label: 'Emerald Ops',
    bg: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.85)',
    border: 'transparent',
    swatch: '#10b981',
  },
};

const HEIGHT_MAP = {
  compact: 'auto',
  normal: 370,
  tall: 490,
};

export default function CustomPage({ onToggleSidebar }) {
  // Load saved layout & canvas theme from localStorage
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
          return parsed.widgets;
        }
      }
    } catch (e) {
      console.warn('Could not read custom layout:', e);
    }
    return DEFAULT_LAYOUT;
  });

  const [canvasTheme, setCanvasTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.canvasTheme && CANVAS_THEMES[parsed.canvasTheme]) {
          return parsed.canvasTheme;
        }
      }
    } catch (e) {
      // ignore
    }
    return 'light';
  });

  const [isEditing, setIsEditing] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeWidgetId, setActiveWidgetId] = useState(null);

  // Shared live datasets
  const [dashData, setDashData] = useState([]);
  const [geoJson, setGeoJson] = useState(null);
  const [resources, setResources] = useState([]);
  const [elogRows, setElogRows] = useState([]);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState([]);

  // Persist layout changes
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ widgets, canvasTheme })
      );
    } catch (e) {
      console.warn('Could not save custom layout:', e);
    }
  }, [widgets, canvasTheme]);

  // Fetch all live data feeds once
  useEffect(() => {
    let cancelled = false;

    // 1. Dashboard CSV + GeoJSON
    Promise.all([
      window.d3 ? window.d3.csv(DASH_CSV_URL) : Promise.resolve([]),
      window.d3 ? window.d3.json(GEOJSON_URL).catch(() => null) : Promise.resolve(null),
    ])
      .then(([csvData, rawMap]) => {
        if (cancelled) return;
        const cleaned = (csvData || []).map((row) => {
          const out = {};
          Object.keys(row).forEach((k) => {
            const cleanKey = k.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
            out[cleanKey] = row[k];
          });
          return out;
        });

        let geo = null;
        if (rawMap) {
          if (rawMap.type === 'Topology' && window.topojson) {
            const key = Object.keys(rawMap.objects)[0];
            geo = window.topojson.feature(rawMap, rawMap.objects[key]);
          } else {
            geo = rawMap;
          }
        }
        setDashData(cleaned);
        setGeoJson(geo);
      })
      .catch((err) => console.error('CustomPage dashboard fetch error:', err));

    // 2. Resource Tracker CSV
    fetch(RES_CSV_URL)
      .then((r) => r.text())
      .then((rawText) => {
        if (cancelled || !window.d3) return;
        const csvLines = rawText.split('\n').slice(1);
        const headers = csvLines[0].split(',');
        let statusCount = 0;
        headers.forEach((h, i) => {
          if (h.trim() === 'STATUS') {
            statusCount += 1;
            headers[i] = statusCount === 1 ? 'UNIT STATUS' : 'MISSION STATUS';
          }
        });
        csvLines[0] = headers.join(',');
        const parsed = window.d3.csvParse(csvLines.join('\n'));
        const cleaned = parsed
          .map((row) => {
            const out = {};
            Object.keys(row).forEach((k) => {
              out[k.trim()] = row[k];
            });
            if (!out['UNIT STATUS']) out['UNIT STATUS'] = 'Unknown';
            return out;
          })
          .filter((r) => r['RESOURCES'] && r['RESOURCES'].trim() !== '');
        setResources(cleaned);
      })
      .catch((err) => console.error('CustomPage resource fetch error:', err));

    // 3. E-Log Report CSV
    fetch(ELOG_CSV_URL)
      .then((r) => r.text())
      .then((rawText) => {
        if (cancelled || !window.d3) return;
        const lines = rawText.split('\n');
        let headerIndex = 0;
        for (let i = 0; i < lines.length; i += 1) {
          const l = lines[i].toLowerCase();
          if (l.includes('date') || l.includes('time')) {
            headerIndex = i;
            break;
          }
        }
        const parsed = window.d3.csvParse(lines.slice(headerIndex).join('\n'));
        const cleaned = parsed
          .map((row) => {
            const out = {};
            Object.keys(row).forEach((k) => {
              if (k.trim()) out[k.trim()] = row[k];
            });
            return out;
          })
          .filter((row) => {
            const idKey = Object.keys(row).find(
              (k) => k.toLowerCase() === 'incident id'
            );
            const id = idKey && row[idKey] ? row[idKey].trim().toUpperCase() : '';
            return id !== '' && id !== 'N/A';
          })
          .reverse()
          .slice(0, 8);
        setElogRows(cleaned);
      })
      .catch((err) => console.error('CustomPage elog fetch error:', err));

    // 4. Weather API
    fetch(WEATHER_API_URL)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setWeather(json);
      })
      .catch((err) => console.error('CustomPage weather error:', err));

    // 5. Facebook News API
    fetch(NEWS_API_URL)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.data) setNews(json.data);
      })
      .catch((err) => console.error('CustomPage news error:', err));

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-render Plotly charts inside any mounted Plotly widget
  useEffect(() => {
    if (dashData.length === 0) return;

    const timer = setTimeout(() => {
      widgets.forEach((w) => {
        if (w.type === 'heatmap' && geoJson) {
          renderMap(`custom-map-${w.id}`, dashData, geoJson);
        } else if (w.type === 'tat-trend') {
          renderTrendChart(`custom-trend-${w.id}`, dashData);
        } else if (w.type === 'donuts') {
          renderRadiusChart(`custom-radius-${w.id}`, dashData);
          renderTypeChart(`custom-type-${w.id}`, dashData);
        }
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [widgets, dashData, geoJson]);

  const metrics = useMemo(() => computeMetrics(dashData), [dashData]);
  const avgDispatch = useMemo(
    () => getAverageTime(dashData, 'COMPUTED DISPATCH TIME (N-E)'),
    [dashData]
  );
  const avgRun = useMemo(
    () => getAverageTime(dashData, 'COMPUTED RUN TIME (O-N)'),
    [dashData]
  );
  const avgResponse = useMemo(
    () => getAverageTime(dashData, 'COMPUTED RESPONSE TIME (P-E)'),
    [dashData]
  );

  // Widget CRUD & Customization Actions
  const addWidget = (catalogItem) => {
    const newWidget = {
      id: `w-${catalogItem.type}-${Date.now()}`,
      type: catalogItem.type,
      title: catalogItem.title,
      colSpan: catalogItem.defaultColSpan,
      height: catalogItem.defaultHeight,
      theme: catalogItem.defaultTheme,
      angle: 0,
      tilt3d: 0,
      radius: 16,
    };
    setWidgets((prev) => [...prev, newWidget]);
    setActiveWidgetId(newWidget.id);
  };

  const removeWidget = (id) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    if (activeWidgetId === id) setActiveWidgetId(null);
  };

  const updateWidget = (id, patch) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  };

  const moveWidget = (index, direction) => {
    setWidgets((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const resetLayout = () => {
    setWidgets(DEFAULT_LAYOUT);
    setCanvasTheme('light');
    setActiveWidgetId(null);
  };

  const activeWidget = widgets.find((w) => w.id === activeWidgetId) || null;
  const activeCanvas = CANVAS_THEMES[canvasTheme] || CANVAS_THEMES.light;

  return (
    <div className="container">
      <style>{`
        .cw-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px 18px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
        }
        .cw-toolbar-group {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .cw-canvas-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cw-canvas-pill.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }
        .cw-canvas-board {
          border-radius: 22px;
          padding: 24px;
          min-height: 75vh;
          transition: background 0.3s ease;
          border: 1px solid #e2e8f0;
          position: relative;
        }
        .cw-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 20px;
          align-items: start;
        }
        .cw-widget-shell {
          position: relative;
          display: flex;
          flex-direction: column;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.25s ease,
                      border-radius 0.2s ease;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .cw-widget-shell.is-selected {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }
        .cw-widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 18px 10px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        }
        .cw-widget-title {
          margin: 0;
          font-size: 0.98rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cw-widget-controls {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cw-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(255, 255, 255, 0.15);
          color: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cw-icon-btn:hover {
          background: rgba(37, 99, 235, 0.15);
          border-color: #2563eb;
        }
        .cw-widget-body {
          padding: 16px 18px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: auto;
        }

        /* Floating Inspector Bar when a widget is selected in Edit Mode */
        .cw-inspector {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          padding: 16px 20px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          animation: cwSlideDown 0.18s ease-out;
        }
        @keyframes cwSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cw-inspector-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cw-inspector-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }
        .cw-pill-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .cw-opt-btn {
          padding: 5px 11px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cw-opt-btn.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
        .cw-swatch-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .cw-swatch-btn.active {
          transform: scale(1.18);
          border-color: #0f172a;
          box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #2563eb;
        }

        /* Widget Catalog Drawer */
        .cw-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(3px);
          z-index: 2100;
          display: flex;
          justify-content: flex-end;
        }
        .cw-drawer {
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          height: 100%;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          box-shadow: -10px 0 30px rgba(15, 23, 42, 0.15);
          overflow-y: auto;
        }
        .cw-catalog-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          transition: all 0.15s ease;
        }
        .cw-catalog-item:hover {
          background: #ffffff;
          border-color: #93c5fd;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
        }

        @media (max-width: 1024px) {
          .cw-widget-shell {
            grid-column: span 12 !important;
          }
        }
      `}</style>

      <PageHeader title="Custom Workspace" onToggleSidebar={onToggleSidebar}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setIsEditing((e) => !e);
              if (isEditing) setActiveWidgetId(null);
            }}
          >
            <i className={`fa-solid ${isEditing ? 'fa-lock-open' : 'fa-lock'}`} />
            {isEditing ? 'Editing Mode' : 'Locked Preview'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCatalogOpen(true)}
          >
            <i className="fa-solid fa-plus" /> Add Widget
          </button>
        </div>
      </PageHeader>

      {/* Top Customization Bar: Canvas Background Theme + Reset */}
      <div className="cw-toolbar">
        <div className="cw-toolbar-group">
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginRight: 4 }}>
            <i className="fa-solid fa-palette" style={{ color: '#2563eb', marginRight: 6 }} />
            Board Theme:
          </span>
          {Object.entries(CANVAS_THEMES).map(([key, t]) => (
            <button
              key={key}
              type="button"
              className={`cw-canvas-pill ${canvasTheme === key ? 'active' : ''}`}
              onClick={() => setCanvasTheme(key)}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: t.dot,
                }}
              />
              {t.name}
            </button>
          ))}
        </div>

        <div className="cw-toolbar-group">
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {isEditing
              ? 'Click any widget below to customize its theme, size, and angle.'
              : 'Workspace is locked.'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={resetLayout}
          >
            <i className="fa-solid fa-rotate-left" /> Reset Default
          </button>
        </div>
      </div>

      {/* Active Widget Designer Inspector (Size, Theme, Angle, Tilt, Corners) */}
      {isEditing && activeWidget && (
        <div className="cw-inspector">
          <div className="cw-inspector-section">
            <span className="cw-inspector-label">Selected Widget</span>
            <input
              type="text"
              className="form-control"
              style={{ height: 34, fontSize: '0.84rem', fontWeight: 700, width: 210 }}
              value={activeWidget.title}
              onChange={(e) =>
                updateWidget(activeWidget.id, { title: e.target.value })
              }
            />
          </div>

          {/* Card Theme Swatches */}
          <div className="cw-inspector-section">
            <span className="cw-inspector-label">Widget Theme</span>
            <div className="cw-pill-group">
              {Object.entries(CARD_THEMES).map(([tKey, tObj]) => (
                <button
                  key={tKey}
                  type="button"
                  title={tObj.label}
                  className={`cw-swatch-btn ${
                    activeWidget.theme === tKey ? 'active' : ''
                  }`}
                  style={{ background: tObj.swatch }}
                  onClick={() => updateWidget(activeWidget.id, { theme: tKey })}
                />
              ))}
            </div>
          </div>

          {/* Width Span */}
          <div className="cw-inspector-section">
            <span className="cw-inspector-label">Width (Columns)</span>
            <div className="cw-pill-group">
              {[
                { label: '1/3 Small', val: 4 },
                { label: '1/2 Half', val: 6 },
                { label: '2/3 Wide', val: 8 },
                { label: 'Full Row', val: 12 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`cw-opt-btn ${
                    activeWidget.colSpan === opt.val ? 'active' : ''
                  }`}
                  onClick={() =>
                    updateWidget(activeWidget.id, { colSpan: opt.val })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Height Preset */}
          <div className="cw-inspector-section">
            <span className="cw-inspector-label">Height</span>
            <div className="cw-pill-group">
              {[
                { label: 'Compact', val: 'compact' },
                { label: 'Standard', val: 'normal' },
                { label: 'Tall', val: 'tall' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`cw-opt-btn ${
                    activeWidget.height === opt.val ? 'active' : ''
                  }`}
                  onClick={() =>
                    updateWidget(activeWidget.id, { height: opt.val })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Angle & 3D Tilt Controls */}
          <div className="cw-inspector-section">
            <span className="cw-inspector-label">
              Angle ({activeWidget.angle || 0}°) & 3D Tilt ({activeWidget.tilt3d || 0}°)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="-8"
                max="8"
                step="1"
                value={activeWidget.angle || 0}
                title="Rotation Angle"
                onChange={(e) =>
                  updateWidget(activeWidget.id, {
                    angle: Number(e.target.value),
                  })
                }
                style={{ width: 85, cursor: 'pointer' }}
              />
              <input
                type="range"
                min="-10"
                max="10"
                step="2"
                value={activeWidget.tilt3d || 0}
                title="3D Perspective Tilt"
                onChange={(e) =>
                  updateWidget(activeWidget.id, {
                    tilt3d: Number(e.target.value),
                  })
                }
                style={{ width: 85, cursor: 'pointer' }}
              />
              <button
                type="button"
                className="cw-opt-btn"
                onClick={() =>
                  updateWidget(activeWidget.id, { angle: 0, tilt3d: 0 })
                }
              >
                0°
              </button>
            </div>
          </div>

          {/* Corner Radius */}
          <div className="cw-inspector-section">
            <span className="cw-inspector-label">Corners</span>
            <div className="cw-pill-group">
              {[
                { label: 'Sharp', val: 4 },
                { label: 'Rounded', val: 16 },
                { label: 'Soft', val: 28 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`cw-opt-btn ${
                    (activeWidget.radius ?? 16) === opt.val ? 'active' : ''
                  }`}
                  onClick={() =>
                    updateWidget(activeWidget.id, { radius: opt.val })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="cw-icon-btn"
            onClick={() => setActiveWidgetId(null)}
            title="Close inspector"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Custom Canvas Board */}
      <div
        className="cw-canvas-board"
        style={{ background: activeCanvas.bg }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setActiveWidgetId(null);
        }}
      >
        {widgets.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: canvasTheme === 'dark' ? '#94a3b8' : '#64748b',
            }}
          >
            <i
              className="fa-solid fa-layer-group"
              style={{ fontSize: '2.5rem', marginBottom: 12, color: '#2563eb' }}
            />
            <h3 style={{ margin: '0 0 8px 0', color: canvasTheme === 'dark' ? '#fff' : '#0f172a' }}>
              Your Custom Workspace is Empty
            </h3>
            <p style={{ margin: '0 0 18px 0' }}>
              Pick widgets from Dashboard, Resource Tracker, E-Log, Weather, or News to build your view.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCatalogOpen(true)}
            >
              <i className="fa-solid fa-plus" /> Add First Widget
            </button>
          </div>
        ) : (
          <div className="cw-grid">
            {widgets.map((w, idx) => {
              const t = CARD_THEMES[w.theme] || CARD_THEMES.light;
              const isSelected = isEditing && activeWidgetId === w.id;
              const minH = HEIGHT_MAP[w.height] || 360;
              const rot = w.angle || 0;
              const tilt = w.tilt3d || 0;

              return (
                <div
                  key={w.id}
                  className={`cw-widget-shell ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (isEditing) setActiveWidgetId(w.id);
                  }}
                  style={{
                    gridColumn: `span ${w.colSpan || 6}`,
                    minHeight: minH,
                    background: t.bg,
                    color: t.text,
                    border: `1px solid ${t.border}`,
                    backdropFilter: t.backdropFilter || 'none',
                    borderRadius: `${w.radius ?? 16}px`,
                    transform:
                      rot !== 0 || tilt !== 0
                        ? `perspective(1000px) rotate(${rot}deg) rotateX(${tilt}deg) rotateY(${
                            -tilt / 2
                          }deg)`
                        : 'none',
                    cursor: isEditing ? 'pointer' : 'default',
                  }}
                >
                  <div className="cw-widget-header">
                    <h4 className="cw-widget-title" style={{ color: t.text }}>
                      <i
                        className={
                          WIDGET_CATALOG.find((c) => c.type === w.type)?.icon ||
                          'fa-solid fa-cube'
                        }
                        style={{ opacity: 0.8 }}
                      />
                      {w.title}
                    </h4>

                    {isEditing && (
                      <div
                        className="cw-widget-controls"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="cw-icon-btn"
                          title="Move Left / Up"
                          disabled={idx === 0}
                          onClick={() => moveWidget(idx, -1)}
                        >
                          <i className="fa-solid fa-arrow-left" />
                        </button>
                        <button
                          type="button"
                          className="cw-icon-btn"
                          title="Move Right / Down"
                          disabled={idx === widgets.length - 1}
                          onClick={() => moveWidget(idx, 1)}
                        >
                          <i className="fa-solid fa-arrow-right" />
                        </button>
                        <button
                          type="button"
                          className="cw-icon-btn"
                          title="Customize Widget"
                          onClick={() =>
                            setActiveWidgetId(
                              activeWidgetId === w.id ? null : w.id
                            )
                          }
                        >
                          <i className="fa-solid fa-sliders" />
                        </button>
                        <button
                          type="button"
                          className="cw-icon-btn"
                          title="Remove Widget"
                          onClick={() => removeWidget(w.id)}
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="cw-widget-body">
                    <WidgetContent
                      widget={w}
                      themeObj={t}
                      metrics={metrics}
                      avgDispatch={avgDispatch}
                      avgRun={avgRun}
                      avgResponse={avgResponse}
                      resources={resources}
                      elogRows={elogRows}
                      weather={weather}
                      news={news}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-out Widget Library Drawer */}
      {catalogOpen && (
        <div
          className="cw-drawer-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCatalogOpen(false);
          }}
        >
          <div className="cw-drawer">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  Widget Library
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Select any component from across AIMS pages
                </p>
              </div>
              <button
                type="button"
                className="cw-icon-btn"
                style={{ color: '#0f172a' }}
                onClick={() => setCatalogOpen(false)}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {WIDGET_CATALOG.map((item) => {
                const count = widgets.filter((w) => w.type === item.type).length;
                return (
                  <div key={item.type} className="cw-catalog-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.05rem',
                          flexShrink: 0,
                        }}
                      >
                        <i className={item.icon} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Source: <b>{item.sourcePage}</b>
                          {count > 0 ? ` • ${count} on board` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                      onClick={() => addWidget(item)}
                    >
                      <i className="fa-solid fa-plus" /> Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Renders the live body for each widget type
function WidgetContent({
  widget,
  themeObj,
  metrics,
  avgDispatch,
  avgRun,
  avgResponse,
  resources,
  elogRows,
  weather,
  news,
}) {
  const isDarkOrGradient =
    widget.theme === 'dark' ||
    widget.theme === 'ocean' ||
    widget.theme === 'sunset' ||
    widget.theme === 'emerald';

  const subCardBg = isDarkOrGradient
    ? 'rgba(255, 255, 255, 0.14)'
    : '#f8fafc';
  const subCardBorder = isDarkOrGradient
    ? 'rgba(255, 255, 255, 0.2)'
    : '#e2e8f0';

  switch (widget.type) {
    case 'kpi-metrics':
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { label: 'Total Incidents', val: metrics.total.toLocaleString() },
            { label: 'Incident Calls', val: metrics.incident.toLocaleString() },
            { label: 'Priority 1', val: metrics.p1.toLocaleString() },
            { label: 'Priority 2', val: metrics.p2.toLocaleString() },
            { label: 'Disregarded / N/A', val: metrics.disregarded.toLocaleString() },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: subCardBg,
                border: `1px solid ${subCardBorder}`,
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: themeObj.muted, fontWeight: 600 }}>
                {m.label}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>
                {m.val}
              </div>
            </div>
          ))}
        </div>
      );

    case 'heatmap':
      return (
        <div
          id={`custom-map-${widget.id}`}
          style={{ width: '100%', flex: 1, minHeight: 340, borderRadius: 12, overflow: 'hidden' }}
        />
      );

    case 'tat-trend':
      return (
        <div
          id={`custom-trend-${widget.id}`}
          style={{ width: '100%', flex: 1, minHeight: 280 }}
        />
      );

    case 'donuts':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1, minHeight: 260 }}>
          <div id={`custom-radius-${widget.id}`} style={{ width: '100%', height: 240 }} />
          <div id={`custom-type-${widget.id}`} style={{ width: '100%', height: 240 }} />
        </div>
      );

    case 'avg-times':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', flex: 1 }}>
          {[
            { label: 'Avg Dispatch Time', val: avgDispatch },
            { label: 'Avg Run Time', val: avgRun },
            { label: 'Avg Response Time', val: avgResponse },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: subCardBg,
                border: `1px solid ${subCardBorder}`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.84rem', color: themeObj.muted, fontWeight: 600 }}>
                {item.label}
              </span>
              <strong style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {item.val}
              </strong>
            </div>
          ))}
        </div>
      );

    case 'weather-hero': {
      const temp =
        weather && typeof weather.main?.temp === 'number'
          ? `${Math.round(weather.main.temp)}°C`
          : '--°C';
      const feels =
        weather && typeof weather.main?.feels_like === 'number'
          ? `${Math.round(weather.main.feels_like)}°C`
          : '--°C';
      const desc = weather?.weather?.[0]?.description || 'Syncing...';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: themeObj.muted, fontWeight: 600 }}>
              <i className="fa-solid fa-location-dot" style={{ marginRight: 6 }} />
              {weather ? `${weather.name}, ${weather.sys?.country}` : 'Butuan City, PH'}
            </div>
            <div style={{ fontSize: '3.4rem', fontWeight: 800, lineHeight: 1.05, margin: '14px 0 6px 0' }}>
              {temp}
            </div>
            <div style={{ fontSize: '0.9rem', textTransform: 'capitalize', fontWeight: 600 }}>
              {desc} • Feels like {feels}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              paddingTop: 14,
              marginTop: 16,
              borderTop: `1px solid ${subCardBorder}`,
              fontSize: '0.8rem',
            }}
          >
            <div>
              <div style={{ color: themeObj.muted }}>Humidity</div>
              <strong>{weather ? `${weather.main.humidity}%` : '--%'}</strong>
            </div>
            <div>
              <div style={{ color: themeObj.muted }}>Wind</div>
              <strong>{weather ? `${weather.wind.speed} m/s` : '--'}</strong>
            </div>
            <div>
              <div style={{ color: themeObj.muted }}>Pressure</div>
              <strong>{weather ? `${weather.main.pressure} hPa` : '--'}</strong>
            </div>
          </div>
        </div>
      );
    }

    case 'weather-atmo':
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            flex: 1,
          }}
        >
          {[
            { label: 'Humidity', val: weather ? `${weather.main.humidity}%` : '--%' },
            { label: 'Wind Speed', val: weather ? `${weather.wind.speed} m/s` : '--' },
            {
              label: 'Visibility',
              val: weather ? `${(weather.visibility / 1000).toFixed(1)} km` : '--',
            },
            { label: 'Cloud Cover', val: weather ? `${weather.clouds.all}%` : '--%' },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: subCardBg,
                border: `1px solid ${subCardBorder}`,
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: themeObj.muted, fontWeight: 600 }}>
                {m.label}
              </span>
              <strong style={{ fontSize: '1.2rem', marginTop: 4 }}>{m.val}</strong>
            </div>
          ))}
        </div>
      );

    case 'resource-units': {
      const availableUnits = resources.filter(
        (r) => r['UNIT STATUS'].trim().toLowerCase() === 'available'
      );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.8rem', color: themeObj.muted, fontWeight: 600 }}>
            {availableUnits.length} Available of {resources.length} Total Units
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
              gap: 10,
            }}
          >
            {availableUnits.slice(0, 8).map((u, i) => (
              <div
                key={`${u['RESOURCES']}-${i}`}
                style={{
                  background: subCardBg,
                  border: `1px solid ${subCardBorder}`,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {u['RESOURCES']}
                </div>
                <div style={{ fontSize: '0.73rem', color: themeObj.muted, marginTop: 3 }}>
                  {u['BASE STATION'] || 'Main Base'}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'elog-recent':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {elogRows.slice(0, 5).map((row, idx) => (
            <div
              key={idx}
              style={{
                background: subCardBg,
                border: `1px solid ${subCardBorder}`,
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                fontSize: '0.8rem',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row['NATURE OF CALL'] || row['TYPE OF CALL'] || 'Incident Call'}
                </div>
                <div style={{ fontSize: '0.73rem', color: themeObj.muted }}>
                  {row['LOCATION/DESTINATION'] || 'Butuan City'}
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', color: themeObj.muted }}>
                {row['DATE'] || ''}
              </span>
            </div>
          ))}
        </div>
      );

    case 'news-highlight':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {news.slice(0, 3).map((post, idx) => (
            <a
              key={post.id || idx}
              href={post.permalink_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 8,
                borderRadius: 10,
                background: subCardBg,
                border: `1px solid ${subCardBorder}`,
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {post.full_picture && (
                <img
                  src={post.full_picture}
                  alt="Post"
                  style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.message || post.story || 'CDRRMD Update'}
                </div>
              </div>
            </a>
          ))}
        </div>
      );

    default:
      return null;
  }
}