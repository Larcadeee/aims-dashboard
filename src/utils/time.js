// Helpers ported from Draft - 2/js/script.js with support for 12-hour AM/PM
// timestamps, HH:MM:SS durations, and flexible column header matching so
// `NaN` values never zero out the average.

export function timeToSeconds(timeStr) {
  if (timeStr === null || timeStr === undefined) return null;
  if (typeof timeStr === 'number') {
    return Number.isFinite(timeStr) && timeStr > 0 ? timeStr : null;
  }

  const raw = String(timeStr).trim();
  if (!raw || raw.includes('#')) return null; // #DIV/0!, #VALUE!, #REF!, etc.

  // Skip text placeholders and zero-time strings
  if (/^(N\/A|NA|NONE|-|--|0|00:00:00|0:00:00|00:00|0:00)$/i.test(raw)) {
    return null;
  }

  // Extract AM/PM if present and strip any date prefix
  const ampmMatch = raw.match(/\b(AM|PM)\b/i);
  const ampm = ampmMatch ? ampmMatch[1].toUpperCase() : null;

  // Match HH:MM:SS or HH:MM (or MM:SS) numeric parts cleanly
  const timeMatch = raw.match(/(\d{1,3}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?/);
  if (!timeMatch) return null;

  let first = parseInt(timeMatch[1], 10);
  const second = parseInt(timeMatch[2], 10);
  const third = timeMatch[3] !== undefined ? parseInt(timeMatch[3], 10) : null;

  if (
    Number.isNaN(first) ||
    Number.isNaN(second) ||
    (third !== null && Number.isNaN(third))
  ) {
    return null;
  }

  // Handle 12-hour clock conversion if AM/PM is present
  if (ampm) {
    if (ampm === 'PM' && first < 12) first += 12;
    if (ampm === 'AM' && first === 12) first = 0;
    const totalSecs = first * 3600 + second * 60 + (third ?? 0);
    return totalSecs > 0 ? totalSecs : null;
  }

  // Standard 3-part HH:MM:SS
  if (third !== null) {
    const totalSecs = first * 3600 + second * 60 + third;
    return totalSecs > 0 ? totalSecs : null;
  }

  // 2-part time (HH:MM or MM:SS)
  const totalSecs = first * 60 + second;
  return totalSecs > 0 ? totalSecs : null;
}

export function secondsToHMS(totalSeconds) {
  if (!totalSeconds || Number.isNaN(totalSeconds) || totalSeconds <= 0) {
    return '00:00:00';
  }
  const rounded = Math.round(totalSeconds);
  const h = Math.floor(rounded / 3600).toString().padStart(2, '0');
  const m = Math.floor((rounded % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(rounded % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Resolves the actual column key in the CSV row even if the sheet header has
// extra spaces, slashes, or a column letter suffix like "(P)" or "(Q)".
function findMatchingColumnKey(sampleRow, colName) {
  if (!sampleRow || !colName) return colName;
  if (Object.prototype.hasOwnProperty.call(sampleRow, colName)) {
    return colName;
  }

  const keys = Object.keys(sampleRow);
  const norm = (str) =>
    String(str)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  // Strip trailing single-letter column tags like "(P)" when comparing base names
  const stripColTag = (str) =>
    String(str)
      .toUpperCase()
      .replace(/\([A-Z]\)/g, '')
      .replace(/[^A-Z0-9]/g, '');

  const targetNorm = norm(colName);
  const targetBase = stripColTag(colName);
  const isTargetComputedOrAvg = /COMPUTED|AVERAGED/i.test(colName);

  // 1. Exact alphanumeric match
  const exact = keys.find((k) => norm(k) === targetNorm);
  if (exact) return exact;

  // 2. Match ignoring single-letter parenthetical column tags like "SCENE TIME (P)"
  const baseMatch = keys.find((k) => {
    const kUpper = k.toUpperCase();
    if (
      !isTargetComputedOrAvg &&
      (kUpper.includes('COMPUTED') || kUpper.includes('AVERAGED'))
    ) {
      return false;
    }
    return stripColTag(k) === targetBase;
  });
  if (baseMatch) return baseMatch;

  // 3. Partial substring match as last resort
  const partial = keys.find((k) => {
    const kUpper = k.toUpperCase();
    if (
      !isTargetComputedOrAvg &&
      (kUpper.includes('COMPUTED') || kUpper.includes('AVERAGED'))
    ) {
      return false;
    }
    const kBase = stripColTag(k);
    return kBase.includes(targetBase) || targetBase.includes(kBase);
  });

  return partial || colName;
}

export function getAverageTime(data, colName) {
  if (!data || data.length === 0) return '00:00:00';

  const resolvedCol = findMatchingColumnKey(data[0], colName);

  let sum = 0;
  let count = 0;
  data.forEach((row) => {
    const secs = timeToSeconds(row[resolvedCol]);
    if (secs !== null && Number.isFinite(secs) && secs > 0) {
      sum += secs;
      count += 1;
    }
  });

  return count === 0 ? '00:00:00' : secondsToHMS(sum / count);
}