// Imperative Plotly wrappers. Plotly is loaded as a global <script> in
// index.html, so we use the same `window.Plotly` API the original did —
// no `react-plotly.js` needed, which keeps the bundle small and the
// output visually identical to Draft - 2.

import { timeToSeconds } from './time.js';
import { P1_REGEX, P2_REGEX, DISREGARDED_REGEX } from './filters.js';

// --- Metric counters -----------------------------------------------------

export function computeMetrics(data) {
  let p1 = 0;
  let p2 = 0;
  let disregarded = 0;

  data.forEach((row) => {
    const dispatch = row['PRIORITY DISPATCH'] || '';
    if (P1_REGEX.test(dispatch)) p1 += 1;
    if (P2_REGEX.test(dispatch)) p2 += 1;
    if (DISREGARDED_REGEX.test(dispatch)) disregarded += 1;
  });

  return {
    total: data.length,
    incident: data.length - disregarded,
    p1,
    p2,
    disregarded,
  };
}

// --- Turn-around time trend ---------------------------------------------

export function renderTrendChart(elementId, data) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const points = data
    .map((row) => {
      const secs = timeToSeconds(row['AVERAGED TURN AROUND TIME (T-E)']);
      return {
        x: row['TIMESTAMP'] ? new Date(row['TIMESTAMP']) : null,
        y: secs !== null ? secs / 60 : null,
      };
    })
    .filter((d) => d.x && !Number.isNaN(d.x.getTime()) && d.y !== null)
    .sort((a, b) => a.x - b.x);

  if (points.length === 0) {
    if (window.Plotly) window.Plotly.purge(elementId);
    el.innerHTML =
      "<div style='display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-weight:500;'>No timeline data available for these filters.</div>";
    return;
  }

  const trace = {
    x: points.map((d) => d.x),
    y: points.map((d) => d.y),
    mode: 'lines',
    type: 'scatter',
    fill: 'tozeroy',
    fillcolor: 'rgba(37, 99, 235, 0.12)',
    line: { shape: 'spline', smoothing: 1.2, color: '#2563eb', width: 3 },
    name: 'Turn Around',
    hovertemplate:
      '<b>%{y:.1f} mins</b><br>%{x|%b %d, %I:%M %p}<extra></extra>',
  };

  const layout = {
    margin: { t: 20, r: 20, l: 50, b: 40 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'inherit', color: '#64748b' },
    hovermode: 'x unified',
    yaxis: {
      title: 'Minutes',
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1',
      zerolinewidth: 2,
    },
    xaxis: { title: '', showgrid: false, zeroline: false },
  };

  window.Plotly.newPlot(elementId, [trace], layout, {
    responsive: true,
    displayModeBar: false,
  });
}

// --- Barangay heat map (No API Key Required) -----------------------------

export function renderMap(elementId, data, geoJson) {
  const el = document.getElementById(elementId);
  if (!el || !geoJson || !window.Plotly) return;

  const counts = {};
  data.forEach((row) => {
    if (row['BARANGAY']) {
      let bg = row['BARANGAY'].toUpperCase().trim();
      bg = bg.replace(/\s*POBLACION\s*\(BARANGAY\s*\d+.*?\)\s*/g, '');
      bg = bg.replace('PORT POYOHON', 'FORT POYOHON');
      bg = bg.replace('JOSE RIZAL', 'J.P. RIZAL');
      counts[bg] = (counts[bg] || 0) + 1;
    }
  });

  const locations = [];
  const zValues = [];
  geoJson.features.forEach((feature) => {
    const name = feature.properties.BRANGAY;
    if (name) {
      locations.push(name);
      zValues.push(counts[name] || 0);
    }
  });

  const trace = {
    type: 'choroplethmapbox',
    geojson: geoJson,
    locations,
    z: zValues,
    featureidkey: 'properties.BRANGAY',
    colorscale: 'Reds',
    hoverinfo: 'location+z',
    marker: {
      opacity: 0.75,
      line: { width: 0.8, color: '#cbd5e1' },
    },
  };

  // Uses 'white-bg' with free CARTO Positron raster tiles so Plotly
  // never requests a Mapbox access token.
 const layout = {
    mapbox: {
      style: 'open-street-map', // Free built-in light map, NO API key or watermark
      center: { lat: 8.94, lon: 125.54 },
      zoom: 12.5,
    },
    margin: { t: 0, b: 0, l: 0, r: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
  };

  window.Plotly.newPlot(elementId, [trace], layout, {
    responsive: true,
    displayModeBar: false,
  });
}

// --- Donut charts (radius + incident type) ------------------------------

const SIDE_LEGEND = {
  orientation: 'v',
  y: 0.5,
  yanchor: 'middle',
  font: { size: 9, color: '#64748b' },
};

function tally(rows, column) {
  const out = {};
  rows.forEach((row) => {
    const v = row[column];
    if (v && v.trim() !== '') {
      const k = v.trim();
      out[k] = (out[k] || 0) + 1;
    }
  });
  return out;
}

const EMPTY_PLACEHOLDER =
  "<div style='display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-size: 0.85rem;'>No data available</div>";

export function renderRadiusChart(elementId, data) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const counts = tally(data, 'KM RADIUS');
  const keys = Object.keys(counts);
  if (keys.length === 0) {
    if (window.Plotly) window.Plotly.purge(elementId);
    el.innerHTML = EMPTY_PLACEHOLDER;
    return;
  }

  const trace = [
    {
      values: keys.map((k) => counts[k]),
      labels: keys,
      type: 'pie',
      hole: 0.6,
      marker: { colors: ['#2563eb', '#94a3b8'] },
      textinfo: 'none',
      hoverinfo: 'label+value+percent',
    },
  ];

  const layout = {
    margin: { t: 10, b: 10, l: 0, r: 0 },
    showlegend: true,
    legend: SIDE_LEGEND,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
  };

  window.Plotly.newPlot(elementId, trace, layout, {
    responsive: true,
    displayModeBar: false,
  });
}

const TYPE_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#64748b',
];

export function renderTypeChart(elementId, data) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const counts = tally(data, 'INCIDENT TYPE');
  const keys = Object.keys(counts);
  if (keys.length === 0) {
    if (window.Plotly) window.Plotly.purge(elementId);
    el.innerHTML = EMPTY_PLACEHOLDER;
    return;
  }

  const shortLabels = keys.map((l) =>
    l.length > 22 ? `${l.substring(0, 22)}...` : l
  );

  const trace = [
    {
      values: keys.map((k) => counts[k]),
      labels: shortLabels,
      hovertext: keys,
      type: 'pie',
      hole: 0.6,
      marker: { colors: TYPE_COLORS },
      textinfo: 'none',
      hoverinfo: 'text+percent',
    },
  ];

  const layout = {
    margin: { t: 10, b: 10, l: 0, r: 0 },
    showlegend: true,
    legend: SIDE_LEGEND,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
  };

  window.Plotly.newPlot(elementId, trace, layout, {
    responsive: true,
    displayModeBar: false,
  });
}