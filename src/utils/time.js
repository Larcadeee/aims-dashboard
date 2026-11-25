// Formats durations and parses date/time values from spreadsheet cells.

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

export function parseIncidentDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const raw = String(value).trim();
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial >= 20000 && serial <= 100000) {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }

  const isoDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    return new Date(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3])
    );
  }

  const numericDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    let year = Number(numericDate[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseEventDateTime(row, column) {
  const rawValue = row[column];
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return null;
  }

  const raw = String(rawValue).trim();
  const baseDate =
    parseIncidentDate(row['Date']) ||
    parseIncidentDate(row['Timestamp']) ||
    new Date(1970, 0, 1);
  const timeOnly = raw.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i
  );

  if (timeOnly) {
    let hours = Number(timeOnly[1]);
    const minutes = Number(timeOnly[2]);
    const seconds = Number(timeOnly[3] || 0);
    const meridiem = timeOnly[4]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59 || seconds > 59) return null;

    return {
      date: new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        hours,
        minutes,
        seconds
      ),
      timeOnly: true,
    };
  }

  const serialTime = Number(raw);
  if (Number.isFinite(serialTime) && serialTime >= 0 && serialTime < 1) {
    const seconds = Math.round(serialTime * 86400);
    return {
      date: new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        0,
        0,
        seconds
      ),
      timeOnly: true,
    };
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : { date, timeOnly: false };
}

export function getElapsedSeconds(row, startColumn, endColumn) {
  const start = parseEventDateTime(row, startColumn);
  const end = parseEventDateTime(row, endColumn);
  if (!start || !end) return null;

  let elapsed = (end.date.getTime() - start.date.getTime()) / 1000;
  if (elapsed < 0 && start.timeOnly && end.timeOnly) elapsed += 86400;
  return elapsed > 0 ? elapsed : null;
}

export function getAverageElapsedTime(rows, startColumn, endColumn) {
  let total = 0;
  let count = 0;
  rows.forEach((row) => {
    const elapsed = getElapsedSeconds(row, startColumn, endColumn);
    if (elapsed !== null && Number.isFinite(elapsed)) {
      total += elapsed;
      count += 1;
    }
  });
  return count ? secondsToHMS(total / count) : '00:00:00';
}
