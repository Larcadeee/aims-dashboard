import { useMemo, useState } from 'react';

import {
  buildPatientRecords,
  filterPatientRecords,
  isMissingPatientValue,
  summarizePatientRecords,
} from '../utils/patientAnalytics.js';
import { SkeletonCard, SkeletonTable } from './Skeletons.jsx';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const EMPTY_FILTERS = {
  dateFrom: '',
  dateTo: '',
  year: '',
  month: '',
  barangay: '',
  type: '',
  noiMoi: '',
  gender: '',
  ageGroup: '',
};

const CLINICAL_FIELDS = [
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

function uniqueOptions(records, getValue) {
  return [...new Set(records.map(getValue).filter((value) => !isMissingPatientValue(value)))].sort(
    (a, b) => String(a).localeCompare(String(b))
  );
}

function displayValue(value) {
  return isMissingPatientValue(value) ? '—' : String(value).trim();
}

function formatMonthLabel(key) {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function matchesSearch(patient, query) {
  if (!query) return true;
  const values = [
    ...Object.values(patient.details),
    patient.incident['Date'],
    patient.incident['Incident ID'],
    patient.incident['Call No.'],
    patient.incident['Barangay'],
    patient.incident['Location'],
    patient.incident['Type of Incident'],
    patient.incident['NOI/MOI'],
    patient.incident['Priority'],
  ];
  return values.some((value) => String(value ?? '').toLowerCase().includes(query));
}

export default function PatientAnalytics({ incidentRows, loading }) {
  const allPatients = useMemo(() => buildPatientRecords(incidentRows), [incidentRows]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [page, setPage] = useState(1);

  const patients = useMemo(
    () => filterPatientRecords(allPatients, filters),
    [allPatients, filters]
  );
  const summary = useMemo(() => summarizePatientRecords(patients), [patients]);
  const filteredAndSearched = useMemo(
    () => patients.filter((patient) => matchesSearch(patient, search.trim().toLowerCase())),
    [patients, search]
  );
  const sortedPatients = useMemo(
    () =>
      [...filteredAndSearched].sort(
        (a, b) =>
          (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0) ||
          b.incidentIndex - a.incidentIndex ||
          a.patientNumber - b.patientNumber
      ),
    [filteredAndSearched]
  );

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(sortedPatients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visiblePatients = sortedPatients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) || null;

  const years = uniqueOptions(allPatients, (patient) =>
    patient.date ? String(patient.date.getFullYear()) : ''
  ).sort((a, b) => Number(b) - Number(a));
  const barangays = uniqueOptions(allPatients, (patient) => patient.incident['Barangay']);
  const incidentTypes = uniqueOptions(allPatients, (patient) => patient.incident['Type of Incident']);
  const noiMoiValues = uniqueOptions(allPatients, (patient) => patient.incident['NOI/MOI']);
  const genders = uniqueOptions(
    allPatients.filter((patient) => patient.genderCategory !== 'Gender missing'),
    (patient) => patient.genderCategory
  );
  const ageGroups = uniqueOptions(allPatients, (patient) => patient.ageGroup);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    setPage(1);
  };

  const monthEntries = summary.monthlyDistribution.map((item) => ({
    ...item,
    label: formatMonthLabel(item.label),
  }));

  if (loading) {
    return (
      <section className="patient-analytics patient-initial-skeleton" aria-label="Loading patient analytics">
        <div className="patient-filter-panel patient-filter-skeleton" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <SkeletonCard key={index} variant="metric" />
          ))}
        </div>
        <div className="patient-kpi-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} variant="metric" />
          ))}
        </div>
        <div className="soft-skeleton-charts">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
        <SkeletonTable columns={3} label="Loading patient records" />
      </section>
    );
  }

  return (
    <section className="patient-analytics" aria-label="Patient analytics">
      <div className="patient-dashboard-layout">
        <aside className="patient-filter-panel">
          <div className="patient-panel-heading">
            <div>
              <span className="patient-eyebrow">Explore the incident database</span>
              <h2>Filters</h2>
            </div>
            <i className="fa-solid fa-sliders" aria-hidden="true" />
          </div>

          <FilterSelect
            label="Year"
            value={filters.year}
            options={years}
            onChange={(value) => setFilter('year', value)}
          />
          <FilterSelect
            label="Month"
            value={filters.month}
            options={MONTHS.map((label, index) => [String(index), label])}
            onChange={(value) => setFilter('month', value)}
          />
          <div className="patient-filter-field patient-date-filter">
            <label htmlFor="patient-date-from">Date range</label>
            <div className="patient-date-range">
              <input
                id="patient-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilter('dateFrom', event.target.value)}
                aria-label="Start date"
              />
              <span>to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilter('dateTo', event.target.value)}
                aria-label="End date"
              />
            </div>
          </div>
          <FilterSelect
            label="Barangay"
            value={filters.barangay}
            options={barangays}
            onChange={(value) => setFilter('barangay', value)}
          />
          <FilterSelect
            label="Type of incident"
            value={filters.type}
            options={incidentTypes}
            onChange={(value) => setFilter('type', value)}
          />
          <FilterSelect
            label="NOI/MOI"
            value={filters.noiMoi}
            options={noiMoiValues}
            onChange={(value) => setFilter('noiMoi', value)}
          />
          <FilterSelect
            label="Gender"
            value={filters.gender}
            options={[
              ...genders,
              ...(allPatients.some((patient) => patient.genderCategory === 'Gender missing')
                ? [['__missing_gender__', 'Missing / not recorded']]
                : []),
            ]}
            onChange={(value) =>
              setFilter('gender', value === '__missing_gender__' ? 'Gender missing' : value)
            }
          />
          <FilterSelect
            label="Patient age group"
            value={filters.ageGroup}
            options={ageGroups}
            onChange={(value) => setFilter('ageGroup', value)}
          />
          <button className="patient-clear-filters" type="button" onClick={clearFilters}>
            <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Clear filters
          </button>
          <p className="patient-filter-note">
            Filters apply together to all patient metrics, charts, and records.
          </p>
        </aside>

        <div className="patient-dashboard-content">
          <div className="patient-results-heading">
            <div>
              <span className="patient-eyebrow">CDRRMD · Patient analytics</span>
              <h2>Patient Overview</h2>
            </div>
            <div className="patient-overview-context">
              <span className="patient-record-count">
                {patients.length.toLocaleString()} patients in this view
              </span>
            </div>
          </div>

          <div className="patient-kpi-grid">
            <KpiCard
              label="Total patients"
              value={summary.kpis.totalPatients.toLocaleString()}
              icon="fa-solid fa-hospital-user"
              accent="blue"
            />
            <KpiCard
              label="Patient incidents"
              value={summary.kpis.patientIncidents.toLocaleString()}
              icon="fa-solid fa-file-medical"
              accent="navy"
            />
            <GenderKpiCard
              label="Male patients"
              value={summary.kpis.malePatients.toLocaleString()}
              icon="fa-solid fa-person"
              tone="blue"
              note="Recorded values"
            />
            <GenderKpiCard
              label="Female patients"
              value={summary.kpis.femalePatients.toLocaleString()}
              icon="fa-solid fa-person-dress"
              tone="orange"
              note="Recorded values"
            />
          </div>

          <section className="patient-section">
            <SectionHeading
              eyebrow="Incident-linked distribution"
              title="Where and why patients need care"
              description="Patient records grouped by the barangay and incident details on their source record."
            />
            <div className="patient-distribution-grid">
              <BarListCard
                className="patient-distribution-wide"
                title="Patients by barangay"
                icon="fa-solid fa-map-location-dot"
                entries={summary.barangayDistribution}
                limit={10}
              />
              <DonutListCard
                title="Patients by incident type"
                icon="fa-solid fa-truck-medical"
                entries={summary.typeDistribution}
              />
              <DonutListCard
                title="Patients by NOI/MOI"
                icon="fa-solid fa-notes-medical"
                entries={summary.noiMoiDistribution}
              />
              <DonutListCard
                title="Patients by nature of call"
                icon="fa-solid fa-clipboard-list"
                entries={summary.natureOfCallDistribution}
              />
              <DonutListCard
                title="Patients by priority"
                icon="fa-solid fa-flag"
                entries={summary.priorityDistribution}
              />
            </div>
          </section>

          <section className="patient-section">
            <SectionHeading
              eyebrow="What was recorded"
              title="Clinical assessments"
              description="Recorded values and missing counts are shown as entered, without clinical interpretation."
            />
            <ClinicalSummaryCard
              fields={CLINICAL_FIELDS}
              assessments={summary.assessments}
            />
          </section>

          <section className="patient-section">
            <SectionHeading
              eyebrow="When and where"
              title="Incident patterns"
              description="Monthly patient volume and timing based on the incident date and notification time."
            />
            <div className="patient-chart-grid patient-pattern-grid">
              <MonthColumnCard entries={monthEntries} />
              <BarListCard
                title="Patients by notification time"
                icon="fa-regular fa-clock"
                entries={summary.notificationTimeDistribution}
                limit={4}
                note="Six-hour groups from recorded Notification Time."
              />
            </div>
          </section>

          <section className="patient-section patient-records-section">
            <SectionHeading
              eyebrow="Patient-level source records"
              title="Detailed patient records"
              description="Select a row to inspect that patient and their associated incident."
            />
            <div className="patient-record-tools">
              <label className="patient-search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search patient or incident fields…"
                  aria-label="Search patient records"
                />
              </label>
              <span>{filteredAndSearched.length.toLocaleString()} matching records</span>
            </div>

            <div className="patient-record-layout">
              <div className="patient-table-wrap">
                <table className="patient-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Incident ID</th>
                      <th>Call No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePatients.map((patient) => (
                      <tr
                        key={patient.id}
                        className={selectedPatientId === patient.id ? 'is-selected' : ''}
                        tabIndex={0}
                        aria-selected={selectedPatientId === patient.id}
                        aria-label={`Patient ${patient.patientNumber}, ${displayValue(patient.details.Name)}, incident ${displayValue(patient.incident['Incident ID'])}`}
                        title={`Patient ${patient.patientNumber}: ${displayValue(patient.details.Name)}`}
                        onClick={() => setSelectedPatientId(patient.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedPatientId(patient.id);
                          }
                        }}
                      >
                        <td>{displayValue(patient.incident['Date'])}</td>
                        <td>{displayValue(patient.incident['Incident ID'])}</td>
                        <td>{displayValue(patient.incident['Call No.'])}</td>
                      </tr>
                    ))}
                    {visiblePatients.length === 0 && (
                      <tr>
                        <td className="patient-empty-cell" colSpan="3">
                          No patient records match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="patient-pagination">
                  <span>
                    Page {currentPage} of {pageCount}
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={currentPage >= pageCount}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <PatientDetail patient={selectedPatient} />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  const normalizedOptions = options.map((option) =>
    Array.isArray(option) ? option : [option, option]
  );
  const id = `patient-filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const allLabel = {
    Year: 'All years',
    Month: 'All months',
    Barangay: 'All barangays',
    'Type of incident': 'All incident types',
    'NOI/MOI': 'All NOI/MOI values',
    Gender: 'All genders',
    'Patient age group': 'All age groups',
  }[label] || `All ${label.toLowerCase()}`;
  return (
    <div className="patient-filter-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {normalizedOptions.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function KpiCard({ label, value, icon, accent, note }) {
  return (
    <article className={`patient-kpi-card accent-${accent}`}>
      <div className="patient-kpi-top">
        <span>{label}</span>
        <i className={icon} aria-hidden="true" />
      </div>
      <strong title={value}>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="patient-section-heading">
      <span className="patient-eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function ChartHeading({ title, icon }) {
  return (
    <div className="patient-chart-heading">
      <i className={icon} aria-hidden="true" />
      <h4>{title}</h4>
    </div>
  );
}

function GenderKpiCard({ label, value, icon, tone, note }) {
  return (
    <article className={`patient-gender-kpi tone-${tone}`}>
      <i className={icon} aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function BarListCard({ title, icon, entries, note, limit = 8, className = '' }) {
  const visible = entries.slice(0, limit);
  const remaining = entries.slice(limit).reduce((total, entry) => total + entry.count, 0);
  const max = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <article className={`patient-chart-card ${className}`.trim()}>
      <ChartHeading title={title} icon={icon} />
      {visible.length ? (
        <div className="patient-bar-list">
          {visible.map((entry) => (
            <div className="patient-bar-row" key={entry.label} title={`${entry.label}: ${entry.count}`}>
              <span className="patient-bar-label">{entry.label}</span>
              <span className="patient-bar-track">
                <span style={{ width: `${(entry.count / max) * 100}%` }} />
              </span>
              <strong>{entry.count.toLocaleString()}</strong>
            </div>
          ))}
          {remaining > 0 && (
            <div className="patient-chart-note">
              + {remaining.toLocaleString()} in other recorded values
            </div>
          )}
        </div>
      ) : (
        <div className="patient-chart-empty">No recorded values in this filtered view.</div>
      )}
      {note && <p className="patient-chart-note">{note}</p>}
    </article>
  );
}

function DonutListCard({ title, icon, entries, note }) {
  const colors = ['#184b8f', '#ed8425', '#42a9ce', '#76b4e2', '#526d91', '#d2a153'];
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  let running = 0;
  const segments = entries.map((entry, index) => {
    const start = total ? (running / total) * 100 : 0;
    running += entry.count;
    const end = total ? (running / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <article className="patient-chart-card">
      <ChartHeading title={title} icon={icon} />
      {total ? (
        <div className="patient-donut-layout">
          <div
            className="patient-donut"
            role="img"
            aria-label={`${total} recorded values across ${entries.length} categories`}
            style={{ background: `conic-gradient(${segments.join(', ')})` }}
          >
            <span>{total.toLocaleString()}</span>
            <small>patients</small>
          </div>
          <ul className="patient-donut-legend">
            {entries.slice(0, 6).map((entry, index) => (
              <li key={entry.label} title={entry.label}>
                <span style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="patient-legend-label">{entry.label}</span>
                <strong>
                  {entry.count.toLocaleString()} · {((entry.count / total) * 100).toFixed(1)}%
                </strong>
              </li>
            ))}
            {entries.length > 6 && (
              <li className="patient-legend-more">
                + {entries.slice(6).reduce((sum, entry) => sum + entry.count, 0).toLocaleString()} more
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="patient-chart-empty">No recorded values in this filtered view.</div>
      )}
      {note && <p className="patient-chart-note">{note}</p>}
    </article>
  );
}

function MonthColumnCard({ entries }) {
  const recent = entries.slice(-8);
  const max = Math.max(1, ...recent.map((entry) => entry.count));

  return (
    <article className="patient-chart-card patient-month-card">
      <ChartHeading title="Patient count by month" icon="fa-solid fa-chart-column" />
      {recent.length ? (
        <div
          className="patient-month-chart"
          role="img"
          aria-label={recent
            .map((entry) => `${entry.label}: ${entry.count} patients`)
            .join('; ')}
        >
          {recent.map((entry, index) => (
            <div className="patient-month-column" key={entry.label} title={`${entry.label}: ${entry.count}`}>
              <strong>{entry.count.toLocaleString()}</strong>
              <span className="patient-month-track">
                <span
                  className={index === recent.length - 1 ? 'is-current' : ''}
                  style={{ height: `${Math.max(4, (entry.count / max) * 100)}%` }}
                />
              </span>
              <small>
                {`${entry.label.replace(/ \d{4}$/, '').slice(0, 3)} ’${entry.label.slice(-2)}`}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="patient-chart-empty">No dated patient records in this filtered view.</div>
      )}
    </article>
  );
}

function ClinicalSummaryCard({ fields, assessments }) {
  return (
    <article className="patient-chart-card patient-clinical-summary">
      <ChartHeading title="Recorded assessments" icon="fa-solid fa-stethoscope" />
      <div className="patient-clinical-list">
        {fields.map((field) => {
          const assessment = assessments[field];
          const recorded = assessment.distribution.reduce((total, item) => total + item.count, 0);
          const examples = assessment.distribution.slice(0, 3);
          const otherValues = assessment.distribution.length - examples.length;
          return (
            <div className="patient-clinical-row" key={field}>
              <strong>{field}</strong>
              <span className="patient-clinical-values">
                {examples.length
                  ? examples.map((item) => `${item.label} · ${item.count}`).join(' / ')
                  : 'No recorded values'}
                {otherValues > 0 && ` / +${otherValues} values`}
              </span>
              <small>
                {recorded.toLocaleString()} recorded · {assessment.missing.toLocaleString()} missing
                {assessment.unparsed > 0 && ` · ${assessment.unparsed.toLocaleString()} unparsed`}
              </small>
            </div>
          );
        })}
      </div>
      <p className="patient-chart-note">
        Values remain as recorded; no clinical categories or diagnoses are inferred.
      </p>
    </article>
  );
}

function PatientDetail({ patient }) {
  if (!patient) {
    return (
      <aside className="patient-detail-panel patient-detail-empty">
        <i className="fa-regular fa-id-card" aria-hidden="true" />
        <h4>Select a patient record</h4>
        <p>Patient and associated incident details will appear here.</p>
      </aside>
    );
  }

  const { details, incident, patientNumber } = patient;
  const sections = [
    {
      title: 'Patient information',
      fields: [
        ['Name', details.Name],
        ['Age', details.Age],
        ['Gender', details.Gender],
      ],
    },
    {
      title: 'Clinical assessment',
      fields: [
        ['Airway', details.Airway],
        ['Breathing', details.Breathing],
        ['Circulation', details.Circulation],
        ['AVPU', details.AVPU],
        ['RR', details.RR],
        ['PR', details.PR],
        ['SpO2', details.SpO2],
        ['BP', details.BP],
        ['GCS', details.GCS],
      ],
    },
    {
      title: 'Additional information',
      fields: [
        ['Signs/Symptoms', incident['Signs/Symptoms']],
        ['Allergies', incident['Allergies']],
        ['Meds', incident['Meds']],
        ['Past Medical', incident['Past Medical']],
        ['Last Oral', incident['Last Oral']],
        ['Events Leading', incident['Events Leading']],
        [`PT${patientNumber} DCAPBTLS`, incident[`PT${patientNumber} DCAPBTLS`]],
      ],
    },
    {
      title: 'Associated incident',
      fields: [
        ['Incident ID', incident['Incident ID']],
        ['Call No.', incident['Call No.']],
        ['Date', incident['Date']],
        ['Barangay', incident['Barangay']],
        ['Location', incident['Location']],
        ['Type of Incident', incident['Type of Incident']],
        ['Priority', incident['Priority']],
      ],
    },
  ];

  return (
    <aside className="patient-detail-panel">
      <div className="patient-detail-heading">
        <span className="patient-eyebrow">Selected patient</span>
        <h4>{displayValue(details.Name)}</h4>
        <span className="patient-slot-badge">Patient {patientNumber}</span>
      </div>
      {sections.map((section) => (
        <section className="patient-detail-section" key={section.title}>
          <h5>{section.title}</h5>
          <dl>
            {section.fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </aside>
  );
}
