import { useEffect, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';

const RES_SHEET_ID = '1AtMv03PDmXNgj9IkQVXX8iZjjEMduzHKRk4fY_8DN1A';
const RES_GID = '1800080155';
const RES_CSV_URL = `https://docs.google.com/spreadsheets/d/${RES_SHEET_ID}/export?format=csv&gid=${RES_GID}`;

const COLOR_MAP = {
  Available: '#28a745',
  Assigned: '#fd7e14',
  'Not available': '#dc3545',
  'Out-of-order': '#6c757d',
  Unknown: '#adb5bd',
};

function badgeClassFor(status) {
  const s = status.toLowerCase();
  if (s === 'available') return 'resource-badge badge-available';
  if (s === 'assigned') return 'resource-badge badge-assigned';
  if (s === 'not available' || s === 'out-of-order') return 'resource-badge badge-unavailable';
  return 'resource-badge badge-default';
}

// Resource tracker. Mirrors js/resource.js: load CSV, fix duplicate
// STATUS headers, then render both the resource grid and the donut
// chart. The chart's `plotly_click` handler re-renders the grid.
export default function Resource({ onToggleSidebar }) {
  const [resources, setResources] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
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
        const headers = csvLines[0].split(',');
        let statusCount = 0;
        headers.forEach((h, i) => {
          if (h.trim() === 'STATUS') {
            statusCount += 1;
            headers[i] = statusCount === 1 ? 'UNIT STATUS' : 'MISSION STATUS';
          }
        });
        csvLines[0] = headers.join(',');

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

  // Donut chart of fleet availability.
  useEffect(() => {
    if (Object.keys(statusCounts).length === 0 || !window.Plotly) return;

    const labels = Object.keys(statusCounts);
    const values = labels.map((l) => statusCounts[l]);
    const colors = labels.map((l) => COLOR_MAP[l] || '#adb5bd');

    const trace = {
      values,
      labels,
      type: 'pie',
      hole: 0.75,
      marker: { colors },
      textinfo: 'percent',
      hoverinfo: 'label+value',
      textposition: 'inside',
      showlegend: true,
    };
    const layout = {
      margin: { t: 20, b: 20, l: 20, r: 20 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      legend: {
        orientation: 'v',
        y: 0.5,
        x: 1.05,
        yanchor: 'middle',
        font: { size: 12, color: '#475569' },
      },
    };

    const el = document.getElementById('resChartDiv');
    if (!el) return;
    window.Plotly.newPlot('resChartDiv', [trace], layout, { responsive: true });

    el.on('plotly_click', (data) => {
      if (data.points && data.points.length > 0) {
        setActiveFilter(data.points[0].label);
      }
    });
  }, [statusCounts]);

  const visible = resources.filter(
    (row) => row['UNIT STATUS'].trim().toLowerCase() === activeFilter.toLowerCase()
  );

  return (
    <div className="container">
      <PageHeader
        title="Resource Tracker"
        onToggleSidebar={onToggleSidebar}
      />
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
          <h3 id="resource-panel-title">
            Resources{' '}
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              ({activeFilter})
            </span>
          </h3>
          <div id="resList" className="resource-grid">
            {loading ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#64748b', padding: 30 }}>
                <span className="spinner" /> Loading resources...
              </div>
            ) : visible.length === 0 ? (
              <p style={{ color: '#94a3b8', gridColumn: '1 / -1', textAlign: 'center', marginTop: 20 }}>
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel">
          <h3>Fleet Availability Distribution</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 10 }}>
            Click a segment on the chart to filter the resources list.
          </p>
          <div id="resChartDiv" style={{ width: '100%', height: 450 }} />
        </div>
      </div>
    </div>
  );
}
