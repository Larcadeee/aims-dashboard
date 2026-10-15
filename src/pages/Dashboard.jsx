import { useEffect, useMemo, useRef, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';
import { applyDashboardFilters, P1_REGEX, P2_REGEX } from '../utils/filters.js';
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

// Section registry used by the export modal.
const EXPORT_SECTIONS = [
  { id: 'metrics', label: 'Key Metrics', icon: 'fa-solid fa-chart-simple' },
  { id: 'heatmap', label: 'Heat Map', icon: 'fa-solid fa-map-location-dot' },
  { id: 'donuts', label: 'KM Radius & Incident Types', icon: 'fa-solid fa-chart-pie' },
  { id: 'averages', label: 'Average Times', icon: 'fa-regular fa-clock' },
  { id: 'trend', label: 'Turn-Around Time Trend', icon: 'fa-solid fa-chart-line' },
];

// Only the 10 Computed & Averaged time columns requested
const AVERAGE_TIME_COLUMNS = [
  {
    label: 'Computed Dispatch Time (N-E)',
    column: 'COMPUTED DISPATCH TIME (N-E)',
  },
  {
    label: 'Computed Run Time (O-N)',
    column: 'COMPUTED RUN TIME (O-N)',
  },
  {
    label: 'Computed Response Mobilization Time (P-O)',
    column: 'COMPUTED RESPONSE MOBILIZATION TIME (P-O)',
  },
  {
    label: 'Computed Response Time (P-E)',
    column: 'COMPUTED RESPONSE TIME (P-E)',
  },
  {
    label: 'Computed Scene Time (Q-P)',
    column: 'COMPUTED SCENE TIME (Q-P)',
  },
  {
    label: 'Computed Transport Time (R-Q)',
    column: 'COMPUTED TRANSPORT TIME (R-Q)',
  },
  {
    label: 'Averaged Arrival to Facility Time',
    column: 'AVERAGED ARRIVAL TO FACILITY TIME',
  },
  {
    label: 'Averaged Endorsement Time (S-R)',
    column: 'AVERAGED ENDORSEMENT TIME (S-R)',
  },
  {
    label: 'Averaged Arrival at Base Time (T-S)',
    column: 'AVERAGED ARRIVAL AT BASE TIME (T-S)',
  },
  {
    label: 'Averaged Turn Around Time (T-E)',
    column: 'AVERAGED TURN AROUND TIME (T-E)',
  },
];

// Matches "Trauma (Health Related Emergency)" and "Medical (Health Related Emergency)"
// while tolerating extra internal spaces in the Google Sheet.
const TRAUMA_MEDICAL_REGEX =
  /^(trauma|medical)\s*\(\s*health\s*related\s*emergency\s*\)$/i;

// Realistic Average Time Filter:
// - If a row is Priority 1: INCIDENT TYPE must be Trauma or Medical only.
// - If a row is Priority 2: All valid Priority 2 incident types are included.
// - Because `filtered` already respects the top Priority dropdown ('All', 'Priority 1', 'Priority 2'),
//   selecting Priority 1 shows P1 (Trauma & Medical), selecting Priority 2 shows P2, and 'All' combines both.
function isRealisticAvgTimeRow(row) {
  const rawType = (row['INCIDENT TYPE'] || '').replace(/\s+/g, ' ').trim();
  const rawPriority = (row['PRIORITY DISPATCH'] || '').trim();

  const isPriority1 = P1_REGEX
    ? P1_REGEX.test(rawPriority)
    : /priority\s*1|\bp1\b/i.test(rawPriority);

  const isPriority2 = P2_REGEX
    ? P2_REGEX.test(rawPriority)
    : /priority\s*2|\bp2\b/i.test(rawPriority);

  if (isPriority1) {
    return (
      TRAUMA_MEDICAL_REGEX.test(rawType) ||
      rawType.toLowerCase().startsWith('trauma') ||
      rawType.toLowerCase().startsWith('medical')
    );
  }

  if (isPriority2) {
    // Exclude disregarded/prank/N/A calls if any exist under P2
    return (
      rawType !== '' &&
      !/^(n\/a|none|disregarded|prank)/i.test(rawType)
    );
  }

  return false;
}

export default function Dashboard({ onToggleSidebar }) {
  const [rawData, setRawData] = useState([]);
  const [geoJson, setGeoJson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [priority, setPriority] = useState('All');
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [dateVal, setDateVal] = useState('');

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState('download');
  const [exportSectionsSelected, setExportSectionsSelected] = useState(
    () => new Set(EXPORT_SECTIONS.map((s) => s.id))
  );
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Refs for the imperative widgets
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

        // Strip hidden Alt+Enter from headers
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
    () =>
      applyDashboardFilters(rawData, {
        priority,
        teams: selectedTeams,
        dateVal,
      }),
    [rawData, priority, selectedTeams, dateVal]
  );

  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);

  // Filter rows for realistic Average Times based on the active Priority selection:
  // - Priority 1 rows only include Trauma & Medical
  // - Priority 2 rows include valid Priority 2 dispatches
  const avgTimesFiltered = useMemo(
    () => filtered.filter(isRealisticAvgTimeRow),
    [filtered]
  );

  // Compute the average time for the 10 Computed & Averaged columns
  const averageTimesList = useMemo(() => {
    return AVERAGE_TIME_COLUMNS.map((item) => ({
      ...item,
      value: loading ? '…' : getAverageTime(avgTimesFiltered, item.column),
    }));
  }, [avgTimesFiltered, loading]);

  // Dynamic badge & subtitle reflecting whether Priority 1, Priority 2, or All is selected
  const avgFilterBadge =
    priority === 'Priority 1'
      ? `P1 • Trauma & Medical (${avgTimesFiltered.length})`
      : priority === 'Priority 2'
      ? `Priority 2 (${avgTimesFiltered.length})`
      : `P1 (Trauma/Med) & P2 (${avgTimesFiltered.length})`;

  const avgFilterSubtitle =
    priority === 'Priority 1'
      ? 'Priority 1 — Trauma & Medical (Health Related Emergency) only'
      : priority === 'Priority 2'
      ? 'Showing Priority 2 dispatches'
      : 'P1 (Trauma & Medical only) + Priority 2 dispatches';

  // --- Charts (re-render whenever filtered data changes) --------------
  useEffect(() => {
    if (loading) return;
    renderTrendChart('chartDiv', avgTimesFiltered);
  }, [avgTimesFiltered, loading]);

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
    setExportMessage({
      type: 'info',
      text: exportMode === 'copy' ? 'Rendering PNG…' : 'Generating PNG…',
    });
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

  return (
    <div className="container">
      {/* Clean 2-column scrollable grid for the 10 Average Time cards */}
      <style>{`
        .avg-all-panel {
          display: flex;
          flex-direction: column;
          max-height: 430px;
        }
        .avg-all-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }
        .avg-filter-note {
          font-size: 0.72rem;
          color: #64748b;
          margin-bottom: 10px;
          font-weight: 500;
        }
        .avg-all-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          overflow-y: auto;
          padding-top: 2px;
          padding-right: 4px;
        }
        .avg-all-grid::-webkit-scrollbar {
          width: 5px;
        }
        .avg-all-grid::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        @media (max-width: 540px) {
          .avg-all-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
        <div
          className="panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#475569',
          }}
        >
          <span className="spinner" />
          <span>Loading live metrics...</span>
        </div>
      )}

      <div className="metrics-grid" data-section="metrics">
        <MetricCard
          label="Total Incident"
          value={loading ? '…' : metrics.total.toLocaleString()}
        />
        <MetricCard
          label="Incident Calls"
          value={loading ? '…' : metrics.incident.toLocaleString()}
        />
        <MetricCard
          label="Priority 1 "
          value={loading ? '…' : metrics.p1.toLocaleString()}
        />
        <MetricCard
          label="Priority 2 "
          value={loading ? '…' : metrics.p2.toLocaleString()}
        />
        <MetricCard
          label="Disregarded / N/A"
          value={loading ? '…' : metrics.disregarded.toLocaleString()}
        />
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
          className="panel panel-no-margin avg-all-panel"
          data-section="averages"
        >
          <div className="avg-all-header">
            <h3 style={{ margin: 0 }}>Average Times</h3>
            <span style={{ fontSize: '0.73rem', color: '#2563eb', fontWeight: 700 }}>
              {avgFilterBadge}
            </span>
          </div>
          <div className="avg-filter-note">{avgFilterSubtitle}</div>

          <div className="avg-all-grid">
            {averageTimesList.map((item) => (
              <MiniMetric
                key={item.column}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>

        <div className="panel panel-no-margin" data-section="trend">
          <h3>Turn Around Time Trend</h3>
          <div id="chartDiv" />
        </div>
      </div>

      <hr />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onDownload={() => void runExport()}
        onCopy={() => void runExport()}
        sections={EXPORT_SECTIONS}
        selected={exportSectionsSelected}
        onToggle={toggleExportSection}
        mode={exportMode}
        exporting={exporting}
        message={exportMessage}
      />
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
      <div className="mini-metric-label" style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
        {label}
      </div>
      <div className="mini-metric-value" style={{ fontSize: '1.15rem' }}>
        {value}
      </div>
    </div>
  );
}

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
            <i
              className={
                isCopy ? 'fa-regular fa-copy' : 'fa-solid fa-download'
              }
            />{' '}
            {isCopy ? 'Copy to clipboard' : 'Download PNG'}
          </h3>
          <button
            className="sidebar-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
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
              <label
                key={s.id}
                className={`export-tile ${checked ? 'checked' : ''}`}
              >
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
            {message.type === 'info' && (
              <span className="spinner" style={{ marginRight: 8 }} />
            )}
            {message.text}
          </div>
        )}

        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={exporting}
          >
            Cancel
          </button>
          {isCopy ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={onCopy}
              disabled={exporting}
            >
              <i className="fa-regular fa-copy" /> Copy as Image
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              onClick={onDownload}
              disabled={exporting}
            >
              <i className="fa-solid fa-download" /> Download PNG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}