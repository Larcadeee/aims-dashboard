export const SHEET_ID = '1Qubv-V4PdhorKcjGT48FqKljwqeqMP4omyrvbwYu_RU';
export const GID = '0';
export const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

export const INCIDENT_COLUMNS = [
  'Date',
  'Incident ID',
  'Call No.',
  'Notification Time',
  'Priority',
  'KM Radius',
  'Type of Incident',
  'Barangay',
  'Location',
  'No. of Patients',
  'NOI/MOI',
  'Nature of Call',
  'P1 Name',
  'P1 Age',
  'P1 Gender',
  'P1 Airway',
  'P1 Breathing',
  'P1 Circulation',
  'P1 AVPU',
  'P1 RR',
  'P1 PR',
  'P1 SpO2',
  'P1 BP',
  'P1 GCS',
  'P2 Name',
  'P2 Age',
  'P2 Gender',
  'P2 Airway',
  'P2 Breathing',
  'P2 Circulation',
  'P2 AVPU',
  'P2 RR',
  'P2 PR',
  'P2 SpO2',
  'P2 BP',
  'P2 GCS',
  'P3 Name',
  'P3 Age',
  'P3 Gender',
  'P3 Airway',
  'P3 Breathing',
  'P3 Circulation',
  'P3 AVPU',
  'P3 RR',
  'P3 PR',
  'P3 SpO2',
  'P3 BP',
  'P3 GCS',
  'Remarks',
  'Caller',
  'Number',
  'Actions Taken',
  'Agency',
  'Base Location',
  'Resource Team',
  'Resource Unit',
  'Team Leader',
  'Responder',
  'RVO',
  'Dispatcher',
  'Additional Resources',
  'Time Briefer Sent',
  'Dispatch Time',
  'Run Time',
  'Scene Time',
  'Enroute To Facility',
  'Arrival to Facility',
  'Time of Endorsement',
  'Proceeding Back to Base',
  'Arrival to Base',
  'Outside Base Dispatch',
  'Signs/Symptoms',
  'Allergies',
  'Meds',
  'Past Medical',
  'Last Oral',
  'Events Leading',
  'PT1 DCAPBTLS',
  'PT2 DCAPBTLS',
  'PT3 DCAPBTLS',
  'Pre-Arrival Instruction',
  'Safety Message',
  'Supervisor',
  'Day',
  'Timestamp',
];

export const PATIENT_FIELDS = [
  'Name',
  'Age',
  'Gender',
  'Airway',
  'Breathing',
  'Circulation',
  'AVPU',
  'RR',
  'PR',
  'SpO2',
  'BP',
  'GCS',
];

export function getPatientDetails(row, patientNumber) {
  const prefix = `P${patientNumber}`;
  return Object.fromEntries(
    PATIENT_FIELDS.map((field) => [
      `${prefix} ${field}`,
      row?.[`${prefix} ${field}`] ?? '',
    ])
  );
}

export function getResourceTeam(row) {
  const team = String(row?.['Resource Team'] || '').trim();
  return /^(N\/?A|NONE|NOT APPLICABLE|-|--)$/i.test(team) ? '' : team;
}

export function mapIncidentRows(rows) {
  return rows.map((row) => {
    const mapped = {};
    for (const column of INCIDENT_COLUMNS) {
      mapped[column] = row[column] ?? '';
    }
    return mapped;
  });
}

export async function fetchIncidentRows() {
  let response;
  try {
    response = await fetch(CSV_URL);
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `Unable to access the incident spreadsheet. Ensure it is shared as "Anyone with the link" (Viewer).${detail}`
    );
  }
  if (!response.ok) {
    throw new Error(`Incident spreadsheet request failed (${response.status}).`);
  }

  const csvText = await response.text();
  if (/^\s*<(?:!doctype html|html)\b/i.test(csvText)) {
    throw new Error('Incident spreadsheet returned a sign-in page instead of CSV data.');
  }
  if (!window.d3?.csvParse) {
    throw new Error('CSV parser is unavailable.');
  }

  const parsed = window.d3.csvParse(csvText);
  const headers = parsed.columns.map((header) => header.replace(/^\uFEFF/, '').trim());
  const normalizedRows = parsed.map((row) => {
    const normalized = {};
    parsed.columns.forEach((header, index) => {
      normalized[headers[index]] = row[header] ?? '';
    });
    return normalized;
  });
  const missingColumns = INCIDENT_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    console.warn(
      `Incident spreadsheet is missing ${missingColumns.length} expected column(s):`,
      missingColumns
    );
  }

  return mapIncidentRows(normalizedRows);
}
