import { useEffect, useMemo, useRef, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';
import { applyDashboardFilters } from '../utils/filters.js';
import { getAverageTime } from '../utils/time.js';
import {
  computeMetrics,
  renderMap,
  renderRadiusChart,
  renderTrendChart,
  renderTypeChart,
} from '../utils/chart.js';
import { useFlatpickr } from '../utils/hooks.js';
import { exportSections, triggerDownload } from '../utils/exportImage.js';

const SHEET_ID = '189IMJxmVEHD033kCJrprM_7CcdOg7QTTra8D9dy-Dv8';
const GID = '1297922850';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/Boundary.json`;

// Section registry used by the export modal. `selector` is the
// `data-section` attribute on the DOM node we want to capture. `label`
// is what the user sees in the picker.
const EXPORT_SECTIONS = [
  { id: 'metrics', label: 'Key Metrics', icon: 'fa-solid fa-chart-simple' },
  { id: 'heatmap', label: 'Heat Map', icon: 'fa-solid fa-map-location-dot' },
  { id: 'donuts', label: 'KM Radius & Incident Types', icon: 'fa-solid fa-chart-pie' },
  { id: 'averages', label: 'Average Times', icon: 'fa-regular fa-clock' },
  { id: 'trend', label: 'Turn-Around Time Trend', icon: 'fa-solid fa-chart-line' },
];

// Top-level Dashboard: loads the data once, owns filter state, and
// pushes the filtered rows down to all the chart subcomponents.
export default function Dashboard({ onToggleSidebar }) {
  const [rawData, setRawData] = useState([]);
  const [geoJson, setGeoJson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state (mirrors the four <input>s in the original header).
  const [priority, setPriority] = useState('All');
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [dateVal, setDateVal] = useState('');

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState('download'); // 'download' | 'copy'
  const [exportSectionsSelected, setExportSectionsSelected] = useState(
    () => new Set(EXPORT_SECTIONS.map((s) => s.id))
  );
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Refs for the imperative widgets.
  const teamSelectRef = useRef(null);
  const dateInputRef = useRef(null);
  const teamChoicesRef = useRef(null);

  // --- One-time data load ----------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [csvData, rawMap] = await Promise.all([
          window.d3.csv(CSV_URL),
          window.d3.json(GEOJSON_URL).catch(() => null),
        ]);

        if (cancelled) return;

        // Strip hidden Alt+Enter from headers — same fix as the original.
        const cleaned = csvData.map((row) => {
          const out = {};
          Object.keys(row).forEach((k) => {
            const cleanKey = k
              .replace(/[\r\n]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            out[cleanKey] = row[k];
          });
          return out;
        });

        let geo = null;
        if (rawMap) {
          if (rawMap.type === 'Topology') {
            const objectKey = Object.keys(rawMap.objects)[0];
            geo = window.topojson.feature(rawMap, rawMap.objects[objectKey]);
          } else {
            geo = rawMap;
          }
        }

        setRawData(cleaned);
        setGeoJson(geo);
        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Team multi-select via Choices.js --------------------------------
  const teams = useMemo(() => {
    const set = new Set();
    rawData.forEach((row) => {
      const t = row['RESOURCE TEAM'];
      if (t && t.trim() !== '') set.add(t.trim());
    });
    return [...set].sort();
  }, [rawData]);

  useEffect(() => {
    if (!window.Choices || !teamSelectRef.current) return;
    teamChoicesRef.current = new window.Choices(teamSelectRef.current, {
      removeItemButton: true,
      placeholder: true,
      placeholderValue: 'All Teams...',
      searchPlaceholderValue: 'Search teams...',
      itemSelectText: '',
    });
    const handler = () => {
      const values = teamChoicesRef.current.getValue(true);
      setSelectedTeams(values);
    };
    teamSelectRef.current.addEventListener('change', handler);
    return () => {
      if (teamChoicesRef.current) teamChoicesRef.current.destroy();
    };
  }, [teams]);

  // --- Flatpickr -------------------------------------------------------
  useFlatpickr(dateInputRef, {
    mode: 'range',
    dateFormat: 'Y-m-d',
    onChange: (selectedDates, dateStr) => setDateVal(dateStr),
  });

  // --- Filtered data + metrics ----------------------------------------
  const filtered = useMemo(
    () => applyDashboardFilters(rawData, { priority, teams: selectedTeams, dateVal }),
    [rawData, priority, selectedTeams, dateVal]
  );

  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);
  const avgDispatch = useMemo(
    () => getAverageTime(filtered, 'COMPUTED DISPATCH TIME (N-E)'),
    [filtered]
  );
  const avgRun = useMemo(
    () => getAverageTime(filtered, 'COMPUTED RUN TIME (O-N)'),
    [filtered]
  );
  const avgResponse = useMemo(
    () => getAverageTime(filtered, 'COMPUTED RESPONSE TIME (P-E)'),
    [filtered]
  );

  // --- Charts (re-render whenever filtered data changes) --------------
  useEffect(() => {
    if (loading) return;
    renderTrendChart('chartDiv', filtered);
  }, [filtered, loading]);

  useEffect(() => {
    if (loading) return;
    renderMap('mapDiv', filtered, geoJson);
  }, [filtered, geoJson, loading]);

  useEffect(() => {
    if (loading) return;
    renderRadiusChart('radiusChartDiv', filtered);
  }, [filtered, loading]);

  useEffect(() => {
    if (loading) return;
    renderTypeChart('typeChartDiv', filtered);
  }, [filtered, loading]);

  // --- Export (download / copy) ---------------------------------------
  const openExportModal = (mode) => {
    setExportMode(mode); // 'download' or 'copy'
    setExportMessage(null);
    setExportOpen(true);
  };

  const toggleExportSection = (id) => {
    setExportSectionsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runExport = async () => {
    if (exporting) return;
    const ids = [...exportSectionsSelected];
    if (ids.length === 0) {
      setExportMessage({ type: 'error', text: 'Pick at least one section.' });
      return;
    }
    setExporting(true);
    setExportMessage({ type: 'info', text: exportMode === 'copy' ? 'Rendering PNG…' : 'Generating PNG…' });
    try {
      const blob = await exportSections(ids);
      if (exportMode === 'copy') {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setExportMessage({
            type: 'success',
            text: 'Copied to clipboard! Paste into Canva with ⌘V / Ctrl+V.',
          });
        } else {
          // Fallback: trigger download if clipboard isn't available
          triggerDownload(blob, 'main-dashboard.png');
          setExportMessage({
            type: 'info',
            text: 'Clipboard not available — downloaded the PNG instead.',
          });
        }
      } else {
        triggerDownload(blob, 'main-dashboard.png');
        setExportMessage({ type: 'success', text: 'Download started.' });
      }
    } catch (err) {
      console.error('Export failed:', err);
      setExportMessage({
        type: 'error',
        text: `Export failed: ${err.message || 'unknown error'}.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    void runExport();
  };

  const handleCopy = () => {
    void runExport();
  };

  return (
    <div className="container">
      <PageHeader
        title="Live Key Metrics"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="filter-bar" data-section="filters">
        <div className="filter-card">
          <label htmlFor="filter-priority" className="filter-card-label">
            <i className="fa-solid fa-flag" /> Priority
          </label>
          <select
            id="filter-priority"
            className="form-control filter-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="All">All Priorities</option>
            <option value="Priority 1">Priority 1</option>
            <option value="Priority 2">Priority 2</option>
          </select>
        </div>

        <div className="filter-card">
          <label htmlFor="filter-team" className="filter-card-label">
            <i className="fa-solid fa-people-group" /> Team
          </label>
          <select
            id="filter-team"
            className="form-control"
            multiple
            ref={teamSelectRef}
            style={{ minWidth: 0, maxWidth: '100%' }}
          >
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-card">
          <label htmlFor="filter-date" className="filter-card-label">
            <i className="fa-regular fa-calendar" /> Date Range
          </label>
          <input
            type="text"
            id="filter-date"
            className="form-control filter-select"
            placeholder="Select date range"
            title="Filter by date range"
            ref={dateInputRef}
            style={{ backgroundColor: '#ffffff' }}
          />
        </div>
      </div>

      {error && (
        <div className="panel" style={{ color: '#dc3545' }}>
          Failed to load dashboard data.
        </div>
      )}

      {loading && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#475569' }}>
          <span className="spinner" />
          <span>Loading live metrics...</span>
        </div>
      )}

      <div className="metrics-grid" data-section="metrics">
        <MetricCard label="Total Calls" value={loading ? '…' : metrics.total.toLocaleString()} />
        <MetricCard label="Total Incident Responded" value={loading ? '…' : metrics.incident.toLocaleString()} />
        <MetricCard label="Priority 1 " value={loading ? '…' : metrics.p1.toLocaleString()} />
        <MetricCard label="Priority 2 " value={loading ? '…' : metrics.p2.toLocaleString()} />
        <MetricCard label="Disregarded / N/A" value={loading ? '…' : metrics.disregarded.toLocaleString()} />
      </div>

      <hr />

      <div className="layout-75-25" data-section="map-and-donuts">
        <div className="panel panel-no-margin" data-section="heatmap">
          <h3>Butuan City Incident Heat Map</h3>
          <div id="mapDiv" />
        </div>

        <div className="panel stacked-charts-panel" data-section="donuts">
          <h3 className="chart-subtitle">KM Radius Distribution</h3>
          <div id="radiusChartDiv" />
          <hr className="chart-divider" />
          <h3 className="chart-subtitle">Incident Types</h3>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              id="typeChartDiv"
              style={{ flex: 1, minHeight: 0, width: '100%' }}
            />
          </div>
        </div>
      </div>

      <hr />

      <div className="layout-30-70" data-section="trend-and-averages">
        <div
          className="panel panel-no-margin"
          data-section="averages"
          style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
        >
          <h3 style={{ marginBottom: 5 }}>Average Times</h3>
          <MiniMetric label="Avg Dispatch Time" value={avgDispatch} />
          <MiniMetric label="Avg Run Time" value={avgRun} />
          <MiniMetric label="Avg Response Time" value={avgResponse} />
        </div>

        <div className="panel panel-no-margin" data-section="trend">
          <h3>Turn Around Time Trend</h3>
          <div id="chartDiv" />
        </div>
      </div>

      <hr />

    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="mini-metric-card">
      <div className="mini-metric-label">{label}</div>
      <div className="mini-metric-value">{value}</div>
    </div>
  );
}

// Export picker. Lets the user pick which sections of the dashboard
// to capture, then either downloads the PNG or copies it to the
// clipboard (for pasting into Canva, etc).
function ExportModal({
  open,
  onClose,
  onDownload,
  onCopy,
  sections,
  selected,
  onToggle,
  mode,
  exporting,
  message,
}) {
  if (!open) return null;

  const isCopy = mode === 'copy';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>
            <i className={isCopy ? 'fa-regular fa-copy' : 'fa-solid fa-download'} />{' '}
            {isCopy ? 'Copy to clipboard' : 'Download PNG'}
          </h3>
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p style={{ marginTop: 0, color: '#64748b' }}>
          {isCopy
            ? 'Pick the sections to capture. We’ll copy a single PNG to your clipboard so you can paste it into Canva with ⌘V / Ctrl+V.'
            : 'Pick the sections to include in the exported PNG.'}
        </p>

        <div className="export-grid">
          {sections.map((s) => {
            const checked = selected.has(s.id);
            return (
              <label key={s.id} className={`export-tile ${checked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(s.id)}
                />
                <i className={s.icon} />
                <span>{s.label}</span>
              </label>
            );
          })}
        </div>

        {message && (
          <div className={`export-message ${message.type}`}>
            {message.type === 'info' && <span className="spinner" style={{ marginRight: 8 }} />}
            {message.text}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          {isCopy ? (
            <button className="btn btn-primary" type="button" onClick={onCopy} disabled={exporting}>
              <i className="fa-regular fa-copy" /> Copy as Image
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={onDownload} disabled={exporting}>
              <i className="fa-solid fa-download" /> Download PNG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
