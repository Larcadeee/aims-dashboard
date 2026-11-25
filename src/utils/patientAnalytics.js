import { PATIENT_FIELDS } from '../data/incidents.js';
import { parseIncidentDate } from './time.js';

const PLACEHOLDERS = new Set(['', 'n/a', 'na', 'n.a.', 'not applicable', '-', '--']);
const NUMERIC_VALUE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function isMissingPatientValue(value) {
  return PLACEHOLDERS.has(String(value ?? '').trim().toLowerCase());
}

function parseNumericValue(value) {
  const raw = String(value ?? '').trim();
  if (!NUMERIC_VALUE.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePatientDate(incident) {
  const dateValue = String(incident.Date ?? '').trim();
  const isoDate = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
  }
  return parseIncidentDate(dateValue) || parseIncidentDate(incident.Timestamp);
}

function getNotificationPeriod(value) {
  const raw = String(value ?? '').trim();
  if (isMissingPatientValue(raw)) return '';

  const clock = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(AM|PM)?$/i);
  let hour = null;
  if (clock) {
    hour = Number(clock[1]);
    const meridiem = clock[3]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  } else {
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial >= 0 && serial < 1) {
      hour = Math.floor(serial * 24);
    } else {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime()) && /T|\d{4}-\d{2}-\d{2}/.test(raw)) {
        hour = parsed.getHours();
      }
    }
  }

  if (hour === null || hour < 0 || hour > 23) return '';
  const start = Math.floor(hour / 6) * 6;
  return `${String(start).padStart(2, '0')}:00–${String(start + 5).padStart(2, '0')}:59`;
}

export function getPatientAgeGroup(age) {
  const raw = String(age ?? '').trim();
  if (isMissingPatientValue(raw)) return 'Age missing or unparsed';

  const normalized = raw.toLowerCase();
  if (/working age/.test(normalized)) return 'Working age (15–64, recorded)';
  if (/elderly|65 years old above/.test(normalized)) return 'Elderly (65+, recorded)';
  if (/child|young adolescent|under 15/.test(normalized)) {
    return 'Child / young adolescent (<15, recorded)';
  }
  if (/multiple patients/.test(normalized)) return 'Multiple patients (as recorded)';

  const ageInYears = parseNumericValue(raw);
  if (ageInYears === null || ageInYears < 0) return `Other recorded age: ${raw}`;
  if (ageInYears < 2) return 'Infant (0–1)';
  if (ageInYears < 13) return 'Child (2–12)';
  if (ageInYears < 18) return 'Adolescent (13–17)';
  if (ageInYears < 65) return 'Adult (18–64)';
  return 'Senior (65+)';
}

export function buildPatientRecords(incidentRows) {
  const records = [];

  incidentRows.forEach((incident, incidentIndex) => {
    const incidentRecords = [];
    for (let patientNumber = 1; patientNumber <= 3; patientNumber += 1) {
      const prefix = `P${patientNumber}`;
      const details = Object.fromEntries(
        PATIENT_FIELDS.map((field) => [
          field,
          String(incident[`${prefix} ${field}`] ?? ''),
        ])
      );

      if (!PATIENT_FIELDS.some((field) => !isMissingPatientValue(details[field]))) {
        continue;
      }

      const date = parsePatientDate(incident);
      const gender = isMissingPatientValue(details.Gender) ? '' : details.Gender.trim();
      const normalizedGender = gender.toLowerCase();
      const genderCategory =
        normalizedGender === 'm' || normalizedGender === 'male'
          ? 'Male'
          : normalizedGender === 'f' || normalizedGender === 'female'
          ? 'Female'
          : gender || 'Gender missing';

      incidentRecords.push({
        id: `${incidentIndex}-P${patientNumber}`,
        patientNumber,
        incidentIndex,
        details,
        incident,
        date,
        genderCategory,
        ageGroup: getPatientAgeGroup(details.Age),
      });
    }

    incidentRecords.forEach((record) => {
      record.incidentPatientCount = incidentRecords.length;
      records.push(record);
    });
  });

  return records;
}

export function filterPatientRecords(records, filters) {
  return records.filter((patient) => {
    const incident = patient.incident;
    if (filters.year && String(patient.date?.getFullYear() ?? '') !== filters.year) return false;
    if (
      filters.month &&
      String(patient.date?.getMonth() ?? '') !== filters.month
    ) {
      return false;
    }
    if (filters.dateFrom) {
      const from = new Date(`${filters.dateFrom}T00:00:00`);
      if (!patient.date || patient.date < from) return false;
    }
    if (filters.dateTo) {
      const to = new Date(`${filters.dateTo}T23:59:59.999`);
      if (!patient.date || patient.date > to) return false;
    }
    if (filters.barangay && incident['Barangay'] !== filters.barangay) return false;
    if (filters.type && incident['Type of Incident'] !== filters.type) return false;
    if (filters.noiMoi && incident['NOI/MOI'] !== filters.noiMoi) return false;
    if (filters.gender && patient.genderCategory !== filters.gender) return false;
    if (filters.ageGroup && patient.ageGroup !== filters.ageGroup) return false;
    return true;
  });
}

function makeDistribution(records, getValue) {
  const counts = new Map();
  records.forEach((record) => {
    const value = getValue(record);
    if (isMissingPatientValue(value)) return;
    const label = String(value).trim();
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function makeNumericDistribution(records, field) {
  let missing = 0;
  let unparsed = 0;
  const counts = new Map();

  records.forEach((record) => {
    const raw = record.details[field];
    if (isMissingPatientValue(raw)) {
      missing += 1;
      return;
    }
    const numeric = parseNumericValue(raw);
    if (numeric === null) {
      unparsed += 1;
      return;
    }
    const label = String(numeric);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return {
    distribution: [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => Number(a.label) - Number(b.label)),
    missing,
    unparsed,
  };
}

function makeAssessment(records, field) {
  let missing = 0;
  const counts = new Map();
  records.forEach((record) => {
    const raw = record.details[field];
    if (isMissingPatientValue(raw)) {
      missing += 1;
      return;
    }
    const label = String(raw).trim();
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return {
    distribution: [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    missing,
  };
}

function getMostCommon(distribution) {
  if (!distribution.length) return '—';
  const highestCount = distribution[0].count;
  return distribution
    .filter((entry) => entry.count === highestCount)
    .map((entry) => entry.label)
    .join(', ');
}

function compareRecordedPatientCounts(records) {
  const incidents = new Map();
  records.forEach((record) => {
    if (!incidents.has(record.incidentIndex)) incidents.set(record.incidentIndex, record);
  });

  const result = {
    incidents: incidents.size,
    matched: 0,
    mismatched: 0,
    missing: 0,
    unparseable: 0,
  };

  incidents.forEach((record) => {
    const rawCount = record.incident['No. of Patients'];
    if (isMissingPatientValue(rawCount)) {
      result.missing += 1;
      return;
    }

    const sourceCount = parseNumericValue(rawCount);
    if (sourceCount === null || sourceCount < 0 || !Number.isInteger(sourceCount)) {
      result.unparseable += 1;
      return;
    }
    if (sourceCount === record.incidentPatientCount) result.matched += 1;
    else result.mismatched += 1;
  });

  return result;
}

export function summarizePatientRecords(records) {
  const incidentCount = new Set(records.map((record) => record.incidentIndex)).size;
  const genderDistribution = makeDistribution(
    records.filter((record) => record.genderCategory !== 'Gender missing'),
    (record) => record.genderCategory
  );
  const ageDistribution = makeDistribution(records, (record) => record.ageGroup);

  const monthlyCounts = new Map();
  records.forEach((record) => {
    if (!record.date) return;
    const key = `${record.date.getFullYear()}-${String(record.date.getMonth() + 1).padStart(2, '0')}`;
    monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + 1);
  });

  const categoricalAssessments = ['AVPU', 'Airway', 'Breathing', 'Circulation', 'BP'];
  const numericAssessments = ['GCS', 'SpO2', 'RR', 'PR'];
  const notificationPeriods = new Map();
  records.forEach((record) => {
    const period = getNotificationPeriod(record.incident['Notification Time']);
    if (period) notificationPeriods.set(period, (notificationPeriods.get(period) || 0) + 1);
  });

  return {
    kpis: {
      totalPatients: records.length,
      patientIncidents: incidentCount,
      malePatients: records.filter((record) => record.genderCategory === 'Male').length,
      femalePatients: records.filter((record) => record.genderCategory === 'Female').length,
      otherGender: records.filter(
        (record) =>
          record.genderCategory !== 'Male' &&
          record.genderCategory !== 'Female' &&
          record.genderCategory !== 'Gender missing'
      ).length,
      missingGender: records.filter((record) => record.genderCategory === 'Gender missing').length,
      averagePatientsPerIncident: incidentCount ? records.length / incidentCount : 0,
      mostAffectedBarangay: getMostCommon(
        makeDistribution(records, (record) => record.incident['Barangay'])
      ),
      commonIncidentType: getMostCommon(
        makeDistribution(records, (record) => record.incident['Type of Incident'])
      ),
      commonNoiMoi: getMostCommon(
        makeDistribution(records, (record) => record.incident['NOI/MOI'])
      ),
    },
    sourceCountCheck: compareRecordedPatientCounts(records),
    genderDistribution,
    genderMissing: records.filter((record) => record.genderCategory === 'Gender missing').length,
    ageDistribution,
    barangayDistribution: makeDistribution(records, (record) => record.incident['Barangay']),
    typeDistribution: makeDistribution(records, (record) => record.incident['Type of Incident']),
    noiMoiDistribution: makeDistribution(records, (record) => record.incident['NOI/MOI']),
    natureOfCallDistribution: makeDistribution(records, (record) => record.incident['Nature of Call']),
    monthlyDistribution: [...monthlyCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    notificationTimeDistribution: [...notificationPeriods.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    priorityDistribution: makeDistribution(records, (record) => record.incident['Priority']),
    signsSymptomsDistribution: makeDistribution(records, (record) =>
      record.incident['Signs/Symptoms']
    ),
    assessments: {
      ...Object.fromEntries(
        categoricalAssessments.map((field) => [field, makeAssessment(records, field)])
      ),
      ...Object.fromEntries(
        numericAssessments.map((field) => [field, makeNumericDistribution(records, field)])
      ),
    },
  };
}
