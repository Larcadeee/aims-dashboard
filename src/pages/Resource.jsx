import { useEffect, useMemo, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';

const RES_SHEET_ID = '1AtMv03PDmXNgj9IkQVXX8iZjjEMduzHKRk4fY_8DN1A';
const RES_GID = '1800080155';
const RES_CSV_URL = `https://docs.google.com/spreadsheets/d/${RES_SHEET_ID}/export?format=csv&gid=${RES_GID}`;

const STATUS_COLOR_MAP = {
  Available: '#16a34a',
  Assigned: '#ea580c',
  'Not available': '#dc2626',
  BREAKDOWN: '#64748b',
  'Out-of-order': '#475569',
  Unknown: '#94a3b8',
};

const PERSONNEL_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function getColorForStatus(status) {
  if (STATUS_COLOR_MAP[status]) return STATUS_COLOR_MAP[status];
  const foundKey = Object.keys(STATUS_COLOR_MAP).find(
    (k) => k.toLowerCase() === status.toLowerCase()
  );
  return foundKey ? STATUS_COLOR_MAP[foundKey] : '#94a3b8';
}

function badgeClassFor(status) {
  const s = status.toLowerCase();
  if (s === 'available') return 'resource-badge badge-available';
  if (s === 'assigned') return 'resource-badge badge-assigned';
  if (s === 'not available' || s === 'out-of-order' || s === 'breakdown') {
    return 'resource-badge badge-unavailable';
  }
  return 'resource-badge badge-default';
}

// Helper to count how many personnel are listed in a cell (handles comma/slash/newline separated names)
function countNamesInCell(val) {
  if (!val) return 0;
  const cleaned = String(val).trim();
  if (
    !cleaned ||
    cleaned.toUpperCase() === 'N/A' ||
    cleaned.toUpperCase() === 'NONE' ||
    cleaned === '-'
  ) {
    return 0;
  }
  return cleaned
    .split(/[,/\n]+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        s.toUpperCase() !== 'N/A' &&
        s.toUpperCase() !== 'NONE' &&
        s !== '-'
    ).length;
}

export default function Resource({ onToggleSidebar }) {
  const [resources, setResources] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [personnelCols, setPersonnelCols] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Available');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(RES_CSV_URL);
        const rawText = await response.text();

        let csvLines = rawText.split('\n').slice(1); // skip title row
        const rawHeaders = csvLines[0].split(',');
        let statusCount = 0;
        let untitledPersonnelIdx = 1;

        const headers = rawHeaders.map((h, i) => {
          const trimmed = h.replace(/[\r\n"]+/g, '').trim();
          if (trimmed === 'STATUS') {
            statusCount += 1;
            return statusCount === 1 ? 'UNIT STATUS' : 'MISSION STATUS';
          }
          // Handle merged header cells right after ALIMAT or NURSE/TEAM LEADER
          if (trimmed === '') {
            return `PERSONNEL_${untitledPersonnelIdx++}`;
          }
          return trimmed;
        });

        csvLines[0] = headers.join(',');

        // Detect the 3 personnel columns starting from ALIMAT or matching Nurse / Team Leader
        const alimatIdx = headers.findIndex((h) =>
          h.toUpperCase().includes('ALIMAT')
        );
        let detectedPersonnelCols = [];

        if (alimatIdx !== -1) {
          // Take the 3 columns starting at ALIMAT (e.g. ALIMAT, NURSE/TEAM LEADER, and the 3rd column)
          detectedPersonnelCols = headers
            .slice(alimatIdx, alimatIdx + 3)
            .filter(Boolean);
        } else {
          detectedPersonnelCols = headers
            .filter((h) =>
              /ALIMAT|NURSE|TEAM\s*LEADER|CREW|RESPONDER|DRIVER|MEDIC/i.test(h)
            )
            .slice(0, 3);
        }

        const data = window.d3.csvParse(csvLines.join('\n'));
        const cleaned = data
          .map((row) => {
            const out = {};
            Object.keys(row).forEach((k) => {
              out[k.trim()] = row[k];
            });
            if (!out['UNIT STATUS']) out['UNIT STATUS'] = 'Unknown';
            return out;
          })
          .filter((row) => row['RESOURCES'] && row['RESOURCES'].trim() !== '');

        const counts = {};
        cleaned.forEach((row) => {
          const s = row['UNIT STATUS'].trim();
          counts[s] = (counts[s] || 0) + 1;
        });

        if (!cancelled) {
          setResources(cleaned);
          setStatusCounts(counts);
          setPersonnelCols(detectedPersonnelCols);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading resources:', err);
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter visible resources based on the selected availability tab
  const visible = useMemo(() => {
    if (activeFilter === 'All') return resources;
    return resources.filter(
      (row) =>
        row['UNIT STATUS'].trim().toLowerCase() === activeFilter.toLowerCase()
    );
  }, [resources, activeFilter]);

  // Compute Personnel Distribution across the 3 personnel columns (updates dynamically with active tab or all resources)
  const personnelDistribution = useMemo(() => {
    const counts = {};
    const targetRows = visible.length > 0 ? visible : resources;

    personnelCols.forEach((col, idx) => {
      // Clean label if sheet had an unmerged sub-column
      const prettyLabel = col.startsWith('PERSONNEL_')
        ? `Responder / Crew ${idx}`
        : col;
      counts[prettyLabel] = 0;

      targetRows.forEach((row) => {
        counts[prettyLabel] += countNamesInCell(row[col]);
      });
    });

    return counts;
  }, [visible, resources, personnelCols]);

  // Render Personnel Distribution Donut Chart
  useEffect(() => {
    const el = document.getElementById('resChartDiv');
    if (!el || !window.Plotly) return;

    const labels = Object.keys(personnelDistribution);
    const values = labels.map((l) => personnelDistribution[l]);
    const totalPersonnel = values.reduce((sum, v) => sum + v, 0);

    if (labels.length === 0 || totalPersonnel === 0) {
      window.Plotly.purge('resChartDiv');
      el.innerHTML =
        "<div style='display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:0.9rem;'>No personnel assigned for this selection.</div>";
      return;
    }

    el.innerHTML = '';

    const trace = {
      values,
      labels,
      type: 'pie',
      hole: 0.72,
      marker: {
        colors: labels.map((_, i) => PERSONNEL_COLORS[i % PERSONNEL_COLORS.length]),
      },
      textinfo: 'value+percent',
      hoverinfo: 'label+value+percent',
      textposition: 'inside',
      showlegend: true,
    };

    const layout = {
      margin: { t: 20, b: 20, l: 20, r: 20 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      annotations: [
        {
          font: { size: 22, weight: 'bold', color: '#1e293b' },
          showarrow: false,
          text: `${totalPersonnel}`,
          x: 0.5,
          y: 0.55,
        },
        {
          font: { size: 11, color: '#64748b' },
          showarrow: false,
          text: 'Personnel',
          x: 0.5,
          y: 0.43,
        },
      ],
      legend: {
        orientation: 'h',
        y: -0.1,
        x: 0.5,
        xanchor: 'center',
        font: { size: 12, color: '#475569' },
      },
    };

    window.Plotly.newPlot('resChartDiv', [trace], layout, {
      responsive: true,
      displayModeBar: false,
    });
  }, [personnelDistribution]);

  // Order tabs cleanly with "Available" first, then others, then "All"
  const orderedTabs = useMemo(() => {
    const keys = Object.keys(statusCounts);
    keys.sort((a, b) => {
      if (a.toLowerCase() === 'available') return -1;
      if (b.toLowerCase() === 'available') return 1;
      return b.localeCompare(a);
    });
    return keys;
  }, [statusCounts]);

  return (
    <div className="container">
      {/* Scoped Modern Pill Tab Styles so tabs always look polished */}
      <style>{`
        .res-tabs-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 6px;
          background-color: #f1f5f9;
          border-radius: 12px;
          margin: 14px 0 20px 0;
          border: 1px solid #e2e8f0;
        }
        .res-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 9px;
          border: 1px solid transparent;
          background: transparent;
          color: #475569;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
          line-height: 1;
        }
        .res-tab-btn:hover {
          background-color: rgba(255, 255, 255, 0.65);
          color: #0f172a;
        }
        .res-tab-btn.is-active {
          background-color: #ffffff;
          color: #0f172a;
          border-color: #e2e8f0;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
        }
        .res-tab-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .res-tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          font-size: 0.73rem;
          font-weight: 700;
          background-color: #e2e8f0;
          color: #334155;
          transition: all 0.18s ease;
        }
        .res-tab-btn.is-active .res-tab-badge {
          background-color: #0f172a;
          color: #ffffff;
        }
      `}</style>

      <PageHeader title="Resource Tracker" onToggleSidebar={onToggleSidebar} />
      <p style={{ color: '#64748b', margin: '0 0 25px 0', fontSize: '0.95rem' }}>
        Monitor active units, personnel, and equipment availability here.
      </p>

      {error && (
        <div className="panel" style={{ color: '#dc3545' }}>
          Unable to load resource data.
        </div>
      )}

      <div className="chart-map-container layout-70-30" style={{ marginTop: 20 }}>
        <div className="panel" id="resource-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h3 id="resource-panel-title" style={{ margin: 0 }}>
              Resources{' '}
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                ({activeFilter})
              </span>
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
              Showing {visible.length} of {resources.length} units
            </span>
          </div>

          {/* Styled Segmented Availability Tabs */}
          {!loading && orderedTabs.length > 0 && (
            <div className="res-tabs-bar" role="tablist">
              {orderedTabs.map((status) => {
                const isActive =
                  activeFilter.toLowerCase() === status.toLowerCase();
                return (
                  <button
                    key={status}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`res-tab-btn ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveFilter(status)}
                  >
                    <span
                      className="res-tab-dot"
                      style={{ backgroundColor: getColorForStatus(status) }}
                    />
                    <span>{status}</span>
                    <span className="res-tab-badge">{statusCounts[status]}</span>
                  </button>
                );
              })}

              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'All'}
                className={`res-tab-btn ${activeFilter === 'All' ? 'is-active' : ''}`}
                onClick={() => setActiveFilter('All')}
              >
                <span
                  className="res-tab-dot"
                  style={{ backgroundColor: '#2563eb' }}
                />
                <span>All Units</span>
                <span className="res-tab-badge">{resources.length}</span>
              </button>
            </div>
          )}

          <div id="resList" className="resource-grid">
            {loading ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: '#64748b',
                  padding: 30,
                }}
              >
                <span className="spinner" /> Loading resources...
              </div>
            ) : visible.length === 0 ? (
              <p
                style={{
                  color: '#94a3b8',
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  marginTop: 20,
                }}
              >
                No resources found for this status.
              </p>
            ) : (
              visible.map((row, i) => {
                const status = row['UNIT STATUS'].trim();
                return (
                  <div className="resource-card" key={`${row['RESOURCES']}-${i}`}>
                    <div className="resource-card-header">{row['RESOURCES']}</div>
                    <div className={badgeClassFor(status)}>{status}</div>
                    <div className="resource-card-body">
                      <b>Fuel:</b> {row['FUEL'] || 'N/A'}
                      <br />
                      <b>Base:</b> {row['BASE STATION'] || 'N/A'}
                      {personnelCols.map((col, idx) => {
                        const val = row[col] ? row[col].trim() : '';
                        if (!val || val.toUpperCase() === 'N/A' || val === '-') {
                          return null;
                        }
                        const label = col.startsWith('PERSONNEL_')
                          ? `Crew ${idx}`
                          : col;
                        return (
                          <div key={col} style={{ marginTop: 4 }}>
                            <b>{label}:</b> {val}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel">
          <h3>Personnel Distribution</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 10 }}>
            Distribution of assigned personnel across{' '}
            <b>{activeFilter === 'All' ? 'All Units' : activeFilter}</b> resources.
          </p>
          <div id="resChartDiv" style={{ width: '100%', height: 420 }} />
        </div>
      </div>
    </div>
  );
}