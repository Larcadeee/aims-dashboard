// Helpers ported verbatim from Draft - 2/js/script.js (with a few
// `null`/`undefined` guards tightened up so they survive real-world
// data without throwing).

export function timeToSeconds(timeStr) {
  if (!timeStr) return null;
  if (typeof timeStr === 'number') return Number.isFinite(timeStr) ? timeStr : null;
  if (String(timeStr).includes('#')) return null; // #DIV/0!, #VALUE!, etc.

  const parts = String(timeStr).trim().split(':');
  if (parts.length === 3) {
    return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
  }
  if (parts.length === 2) {
    return (+parts[0]) * 60 + (+parts[1]);
  }
  return null;
}

export function secondsToHMS(totalSeconds) {
  if (!totalSeconds || Number.isNaN(totalSeconds)) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function getAverageTime(data, colName) {
  let sum = 0;
  let count = 0;
  data.forEach((row) => {
    const secs = timeToSeconds(row[colName]);
    if (secs !== null) {
      sum += secs;
      count += 1;
    }
  });
  return count === 0 ? '00:00:00' : secondsToHMS(sum / count);
}
