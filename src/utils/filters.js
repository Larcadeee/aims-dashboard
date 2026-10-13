// Priority regexes copied from Draft - 2/js/script.js — they drive both
// the dashboard's filter dropdown and the breakdown counts. Kept in one
// place so a typo can't drift between the two.

export const P1_REGEX = /Priority 1|ABC|Cardiac Arrest|DOB|Motor Vehicular Accident|MVA/i;
export const P2_REGEX = /Priority 2/i;
export const DISREGARDED_REGEX = /Not Applicable|Disregarded/i;

// Parses a flatpickr "Y-m-d" or "Y-m-d to Y-m-d" string into a predicate
// that compares against a JS Date's year/month/day.
export function makeDatePredicate(dateVal) {
  if (!dateVal) return () => true;

  const [startStr, endStr] = dateVal.split(' to ');
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const startMs = new Date(sy, sm - 1, sd).getTime();
  const endMs = endStr
    ? (() => {
        const [ey, em, ed] = endStr.split('-').map(Number);
        return new Date(ey, em - 1, ed).getTime();
      })()
    : startMs;

  return (row) => {
    if (!row['TIMESTAMP']) return false;
    const d = new Date(row['TIMESTAMP']);
    if (Number.isNaN(d.getTime())) return false;
    const rowMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return rowMs >= startMs && rowMs <= endMs;
  };
}

// Same logic as Draft - 2's `applyFilters` but factored out of the
// global so it can be reused and unit-tested.
export function applyDashboardFilters(rows, { priority, teams, dateVal }) {
  const isAllTeams = !teams || teams.length === 0;
  const datePredicate = makeDatePredicate(dateVal);

  return rows.filter((row) => {
    const dispatch = row['PRIORITY DISPATCH'] || '';

    let matchPrio = true;
    if (priority === 'Priority 1') matchPrio = P1_REGEX.test(dispatch);
    else if (priority === 'Priority 2') matchPrio = P2_REGEX.test(dispatch);

    const teamName = row['RESOURCE TEAM']?.trim();
    const matchTeam =
      isAllTeams || (teamName && teams.includes(teamName));

    return matchPrio && matchTeam && datePredicate(row);
  });
}
