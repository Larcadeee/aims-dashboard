// Section → export-image pipeline. We assemble a single PNG by
// stacking each chosen section vertically. Plotly sections use
// `Plotly.toImage`; non-Plotly sections (metric cards, average
// times) are rasterized via foreignObject SVG → canvas.

const PLOTLY_SECTIONS = {
  heatmap: 'mapDiv',
  donuts: 'radiusChartDiv', // we render the type chart below the radius
  trend: 'chartDiv',
};

const PLOTLY_SECTIONS_EXTRA = {
  donuts: ['typeChartDiv'],
};

// Walk the DOM, looking for the most immediate section that contains
// each element id. Returns a flat list of {id, label} for ordering.
function resolveSectionNodes(sectionIds) {
  const out = [];
  sectionIds.forEach((id) => {
    const node = document.querySelector(`[data-section="${id}"]`);
    if (node) out.push({ id, node });
  });
  return out;
}

// Snapshot a DOM node to a PNG blob using SVG foreignObject.
// Works for normal HTML (cards, lists, etc). Plotly charts go through
// Plotly.toImage instead so the canvas/legends come out crisp.
async function domNodeToPng(node, width) {
  const cloned = node.cloneNode(true);
  // Remove the copy/download button and any open choices dropdowns.
  cloned.querySelectorAll('.sidebar-close, .modal-backdrop, .open').forEach((n) => n.remove());

  const height = Math.ceil(node.getBoundingClientRect().height);
  const rectHeight = height || node.offsetHeight || 300;
  const cssText = collectCss(node);

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rectHeight}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px; height:${rectHeight}px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <style>${cssText}</style>
          ${cloned.outerHTML}
        </div>
      </foreignObject>
    </svg>`;

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = window.devicePixelRatio > 1 ? 2 : 1;
      canvas.width = width * scale;
      canvas.height = rectHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, rectHeight);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, width, height: rectHeight });
        else reject(new Error('Canvas blob conversion failed'));
      }, 'image/png');
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image load failed'));
    };
    img.src = url;
  });
}

// Inline a copy of the relevant stylesheet so the foreignObject
// clone renders identically to the live DOM. We only pull the rules
// that target our sections, to keep the SVG small.
function collectCss(rootNode) {
  const needed = new Set();
  const targetSelectors = [
    '.panel', '.metric-card', '.metrics-grid', '.mini-metric-card',
    '.layout-75-25', '.layout-30-70', 'h3', '#mapDiv', '#chartDiv',
    '#radiusChartDiv', '#typeChartDiv', '.chart-subtitle', '.chart-divider',
  ];
  const sheets = [...document.styleSheets];
  for (const sheet of sheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    if (!rules) continue;
    for (const rule of rules) {
      if (!rule.selectorText) continue;
      if (targetSelectors.some((s) => rule.selectorText.includes(s))) {
        needed.add(rule.cssText);
      }
    }
  }
  return [...needed].join('\n');
}

async function plotlyToPng(elementId, width) {
  if (!window.Plotly) throw new Error('Plotly not loaded');
  const el = document.getElementById(elementId);
  if (!el) return null;
  const dataUrl = await window.Plotly.toImage(elementId, {
    format: 'png',
    width,
    height: el.offsetHeight,
  });
  const blob = await (await fetch(dataUrl)).blob();
  return { blob, width, height: el.offsetHeight };
}

async function imageElementToPng(url, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = window.devicePixelRatio > 1 ? 2 : 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve({ blob: b, width, height }) : reject(new Error('png fail'))), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Compose a single tall PNG from a vertical stack of pre-rendered
// {blob, width, height} tiles. We add a small gap between tiles so
// the result reads like a poster.
async function composePng(tiles, gap = 12) {
  const padding = 24;
  const width = Math.max(...tiles.map((t) => t.width)) + padding * 2;
  const height = tiles.reduce((sum, t) => sum + t.height + gap, 0) + padding * 2 - gap;
  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);

  let y = padding;
  for (const tile of tiles) {
    const img = await blobToImage(tile.blob);
    ctx.drawImage(img, padding, y, tile.width, tile.height);
    y += tile.height + gap;
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compose fail'))), 'image/png');
  });
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Build a final PNG covering all `sectionIds`, in order.
export async function exportSections(sectionIds) {
  const width = 1280; // output width
  const tiles = [];
  const nodes = resolveSectionNodes(sectionIds);

  for (const { id, node } of nodes) {
    // 1) Render any Plotly charts inside this section through Plotly.toImage.
    const plotlyIds = [
      PLOTLY_SECTIONS[id],
      ...(PLOTLY_SECTIONS_EXTRA[id] || []),
    ].filter(Boolean);
    const plotlyTiles = [];
    for (const pid of plotlyIds) {
      try {
        const tile = await plotlyToPng(pid, width);
        if (tile) plotlyTiles.push({ ...tile, label: pid });
      } catch (e) {
        console.warn('Plotly toImage failed', pid, e);
      }
    }
    if (plotlyTiles.length > 0) {
      // For "donuts", stack radius + type vertically. For "trend" /
      // "heatmap", just push the single image.
      if (id === 'donuts') {
        for (const t of plotlyTiles) tiles.push(t);
      } else {
        tiles.push(plotlyTiles[0]);
      }
      continue;
    }

    // 2) No Plotly in this section — DOM snapshot the whole block.
    const tile = await domNodeToPng(node, width);
    tiles.push(tile);
  }

  if (tiles.length === 0) {
    throw new Error('Nothing selected to export');
  }
  return composePng(tiles);
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
