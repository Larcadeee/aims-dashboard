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

// Section registry used by the export modal.
const EXPORT_SECTIONS = [
  { id: 'metrics', label: 'Key Metrics', icon: 'fa-solid fa-chart-simple' },
  { id: 'heatmap', label: 'Heat Map', icon: 'fa-solid fa-map-location-dot' },
  { id: 'donuts', label: 'KM Radius & Incident Types', icon: 'fa-solid fa-chart-pie' },
  { id: 'averages', label: 'Average Times', icon: 'fa-regular fa-clock' },
  { id: 'trend', label: 'Turn-Around Time Trend', icon: 'fa-solid fa-chart-line' },
];

// Organized groups for all requested Average Time columns.
// Each item lists candidate column names so it matches either the formula header or short header.
const AVG_TIME_GROUPS = [
  {
    id: 'response',
    label: 'Response',
    icon: 'fa-solid fa-bolt',
    items: [
      {
        label: 'Computed Dispatch Time',
        code: 'N-E',
        color: '#2563eb',
        candidates: ['COMPUTED DISPATCH TIME (N-E)', 'DISPATCH TIME'],
      },
      {
        label: 'Computed Run Time',
        code: 'O-N',
        color: '#0284c7',
        candidates: ['COMPUTED RUN TIME (O-N)', 'RUN TIME'],
      },
      {
        label: 'Response Mobilization',
        code: 'P-O',
        color: '#4f46e5',
        candidates: [
          'COMPUTED RESPONSE MOBILIZATION TIME (P-O)',
          'RESPONSE MOBILIZATION TIME',
        ],
      },
      {
        label: 'Computed Response Time',
        code: 'P-E',
        color: '#7c3aed',
        candidates: ['COMPUTED RESPONSE TIME (P-E)', 'RESPONSE TIME'],
      },
    ],
  },
  {
    id: 'scene',
    label: 'Scene & Transport',
    icon: 'fa-solid fa-truck-medical',
    items: [
      {
        label: 'Computed Scene Time',
        code: 'Q-P',
        color: '#0d9488',
        candidates: ['COMPUTED SCENE TIME (Q-P)', 'SCENE TIME'],
      },
      {
        label: 'Computed Transport Time',
        code: 'R-Q',
        color: '#059669',
        candidates: [
          'COMPUTED TRANSPORT TIME (R-Q)',
          'EN ROUTE TO HIGHER FACILITY',
        ],
      },
      {
        label: 'Arrival to Facility Time',
        code: 'Facility',
        color: '#d97706',
        candidates: [
          'AVERAGED ARRIVAL TO FACILITY TIME',
          'ARRIVAL TO HIGHER FACILITY',
        ],
      },
      {
        label: 'En Route to Higher Facility',
        code: 'En Route',
        color: '#ea580c',
        candidates: [
          'EN ROUTE TO HIGHER FACILITY',
          'COMPUTED TRANSPORT TIME (R-Q)',
        ],
      },
    ],
  },
  {
    id: 'turnover',
    label: 'Base & Turnaround',
    icon: 'fa-solid fa-rotate',
    items: [
      {
        label: 'Endorsement Time',
        code: 'S-R',
        color: '#e11d48',
        candidates: ['AVERAGED ENDORSEMENT TIME (S-R)', 'ENDORSEMENT TIME'],
      },
      {
        label: 'Arrival at Base Time',
        code: 'T-S',
        color: '#475569',
        candidates: [
          'AVERAGED ARRIVAL AT BASE TIME (T-S)',
          'ARRIVAL AT BASE TIME',
        ],
      },
      {
        label: 'Turn Around Time',
        code: 'T-E',
        color: '#1d4ed8',
        candidates: [
          'AVERAGED TURN AROUND TIME (T-E)',
          'TURN AROUND TIME',
        ],
      },
    ],
  },
];

// Helper that resolves the matching column header in the dataset (case-insensitive & tolerant of extra spaces)
function computeSmartAverage(rows, candidates) {
  if (!rows || rows.length === 0) return '00:00:00';
  const sampleKeys = Object.keys(rows[0] || {});

  for (const cand of candidates) {
    const normalizedCand = cand.toUpperCase().replace(/\s+/g, ' ').trim();
    // 1. Exact case-insensitive match
    let matchedKey = sampleKeys.find(
      (k) => k.toUpperCase().replace(/\s+/g, ' ').trim() === normalizedCand
    );
    // 2. Partial includes match if exact wasn't found
    if (!matchedKey) {
      matchedKey = sampleKeys.find((k) =>
        k.toUpperCase().replace(/\s+/g, ' ').includes(normalizedCand)
      );
    }
    if (matchedKey) {
      const val = getAverageTime(rows, matchedKey);
      if (val && val !== '00:00:00' && val !== '--') {
        return val;
      }
    }
  }

  // Fallback to first candidate
  return getAverageTime(rows, candidates[0]);
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

  // Active tab for organized Average Times panel ('all' | 'response' | 'scene' | 'turnover')
  const [avgTab, setAvgTab] = useState('all');

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState('download');
  const [exportSectionsSelected, setExportSectionsSelected] = useState(
    () => new Set(EXPORT_SECTIONS.map((s) => s.id))
  );
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Refs for imperative widgets
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

  // Compute all organized Average Time metrics
  const computedAvgGroups = useMemo(() => {
    return AVG_TIME_GROUPS.map((group) => ({
      ...group,
      computedItems: group.items.map((item) => ({
        ...item,
        value: loading ? '…' : computeSmartAverage(filtered, item.candidates),
      })),
    }));
  }, [filtered, loading]);

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

  const visibleGroups =
    avgTab === 'all'
      ? computedAvgGroups
      : computedAvgGroups.filter((g) => g.id === avgTab);

  return (
    <div className="container">
      {/* Scoped styles for the organized Average Times panel */}
      <style>{`
        .avg-panel-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 440px;
        }
        .avg-panel-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }
        .avg-tabs-bar {
          display: flex;
          gap: 5px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          margin-bottom: 12px;
          overflow-x: auto;
        }
        .avg-tab-pill {
          flex: 1;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 0.73rem;
          font-weight: 700;
          padding: 6px 8px;
          border-radius: 7px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .avg-tab-pill:hover {
          color: #0f172a;
        }
        .avg-tab-pill.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
        }
        .avg-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .avg-scroll-area::-webkit-scrollbar {
          width: 5px;
        }
        .avg-scroll-area::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .avg-group-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .avg-group-title {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
          padding-left: 2px;
        }
        .avg-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .avg-cards-grid.single-col {
          grid-template-columns: 1fr;
        }
        .avg-metric-tile {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left-width: 3px;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          transition: background-color 0.15s ease, transform 0.15s ease;
        }
        .avg-metric-tile:hover {
          background: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.04);
        }
        .avg-metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .avg-metric-name {
          font-size: 0.74rem;
          font-weight: 600;
          color: #475569;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .avg-metric-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          flex-shrink: 0;
        }
        .avg-metric-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: #1e293b;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
        @media (max-width: 520px) {
          .avg-cards-grid {
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
        {/* Organized Average Times Column */}
        <div
          className="panel panel-no-margin avg-panel-wrapper"
          data-section="averages"
        >
          <div className="avg-panel-top">
            <h3 style={{ margin: 0 }}>Average Times</h3>
            <span
              style={{
                fontSize: '0.73rem',
                color: '#64748b',
                fontWeight: 600,
              }}
            >
              HH:MM:SS
            </span>
          </div>

          {/* Category Filter Tabs */}
          <div className="avg-tabs-bar" role="tablist">
            <button
              type="button"
              className={`avg-tab-pill ${avgTab === 'all' ? 'active' : ''}`}
              onClick={() => setAvgTab('all')}
            >
              All (11)
            </button>
            {AVG_TIME_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`avg-tab-pill ${avgTab === g.id ? 'active' : ''}`}
                onClick={() => setAvgTab(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Scrollable Categorized Time Metrics */}
          <div className="avg-scroll-area">
            {visibleGroups.map((group) => (
              <div key={group.id} className="avg-group-block">
                <div className="avg-group-title">
                  <i className={group.icon} />
                  <span>{group.label}</span>
                </div>
                <div
                  className={`avg-cards-grid ${
                    avgTab !== 'all' ? 'single-col' : ''
                  }`}
                >
                  {group.computedItems.map((item) => (
                    <div
                      key={item.label}
                      className="avg-metric-tile"
                      style={{ borderLeftColor: item.color }}
                      title={item.candidates.join(' / ')}
                    >
                      <div className="avg-metric-top">
                        <span className="avg-metric-name">{item.label}</span>
                        <span className="avg-metric-badge">{item.code}</span>
                      </div>
                      <div
                        className="avg-metric-val"
                        style={{ color: item.color }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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