import { useEffect, useMemo, useRef, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';
import { useFlatpickr } from '../utils/hooks.js';

// Default personnel: same names as the original print template, but
// these will be edited in a modal right before printing.
const DEFAULT_INCOMING = [
  { name: 'JERRY MIAH P. BAGUTSAY', role: 'DMS-ETC' },
  { name: 'ARJHON AMADO', role: 'DMS-ETC' },
  { name: 'GRACELLE B. ESPERE, RPM', role: 'DMS-DISPATCH SUPERVISOR' },
  { name: 'ZAIRA MARIE P. SANCHEZ', role: 'EWS-EWDA' },
];

const DEFAULT_OUTGOING = [
  { name: 'APRIL MAE V. TUAZON', role: 'DMS-ETC' },
  { name: 'RINALYN D. QUEJADA', role: 'DMS-ETC' },
  { name: 'MELVIN B. MENDOZA, RN, MN', role: 'DMS-DISPATCH SUPERVISOR' },
  { name: 'KATHLYN KLEENE R. GENERALO, RCRM', role: 'EWS-EWDA' },
  { name: 'JOVENICE JC V. ALQUIZAR, RN', role: 'EWS-EWDA' },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ELOG_SHEET_ID = '1AtMv03PDmXNgj9IkQVXX8iZjjEMduzHKRk4fY_8DN1A';
const ELOG_GID = '0';
const ELOG_CSV_URL = `https://docs.google.com/spreadsheets/d/${ELOG_SHEET_ID}/export?format=csv&gid=${ELOG_GID}`;

const ORDERED_HEADERS = [
  'DATE', 'INCIDENT ID', 'CALL STATUS', 'NOTIFICATON TIME', 'DISPATCH TIME',
  'TYPE OF CALL', '# OF PATIENTS/# OF PERSONNEL ONBOARD', 'LOCATION/DESTINATION',
  'SPECIFIC LOCATION/ LAND MARK', 'NATURE OF ILLNESS/MOI', 'NATURE OF CALL',
  'REMARKS', 'ACTIONS TAKEN', 'FACILATED BY (Name of Agency)', 'RESPONSE UNIT',
  'BASE', 'ADDITIONAL RESOURCES', 'TRANSPORTED TO', 'RESPONSE TEAM',
  'RESPONSE TEAM LEADER/PILOT', 'DISPATCHER/EWSETC/EWS', 'SUPERVISOR',
  'FOR BRIEFER', 'CALLER', 'CONTACT NUMBER', 'PROCEEDING TO AREA',
  'ARRIVE AT SCENE/ DESTINATION', 'PROCEEDING TO HOS/RES.', 'ARRIVAL AT HOS/RES.',
  'ENDORSED', 'PROCEEDING TO BASE', 'OUTSIDE BASE DISPATCH', 'ARRIVE AT BASE',
  'BRIEFER SENT TO HOO AND SUPERVISOR (TIME)', 'MONTH',
];

const PRINT_COLUMNS = [
  'DATE', 'NOTIFICATON TIME', 'TYPE OF CALL', 'NATURE OF CALL',
  'RESPONSE UNIT', 'LOCATION/DESTINATION', 'DISPATCH TIME',
  'PROCEEDING TO AREA', 'ARRIVE AT SCENE/ DESTINATION',
  'PROCEEDING TO HOS/RES.', 'ARRIVAL AT HOS/RES.',
];

// E-Log records. Mirrors js/report.js: load CSV (skipping the
// pre-header rows), pick a column order, filter, then optionally
// print a batch logbook to a popup window.
export default function Report({ onToggleSidebar }) {
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [dateVal, setDateVal] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState(null);
  const dateInputRef = useRef(null);

  // Personnel used by the print layout. The modal edits these right
  // before printing; the rest of the page leaves them alone.
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [incoming, setIncoming] = useState(DEFAULT_INCOMING);
  const [outgoing, setOutgoing] = useState(DEFAULT_OUTGOING);
  const [shiftLabel, setShiftLabel] = useState('PM SHIFT');
  const [turnoverText, setTurnoverText] = useState(
    '08:00 AM TURN-OVER OF DUTIES AND RESPONSIBILITIES AT THE CDRRMD OPERATION CENTER TO INCOMING SHIFT'
  );
  const [assumedText, setAssumedText] = useState(
    '8:00 PM ASSUMED DUTIES AND RESPONSIBILITIES AT THE CDRRMD OPERATIONS CENTER'
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(ELOG_CSV_URL);
        const rawText = await response.text();
        const lines = rawText.split('\n');

        let headerIndex = 0;
        for (let i = 0; i < lines.length; i += 1) {
          const l = lines[i].toLowerCase();
          if (l.includes('date') || l.includes('time')) {
            headerIndex = i;
            break;
          }
        }

        const cleanedText = lines.slice(headerIndex).join('\n');
        const raw = window.d3.csvParse(cleanedText);

        const rawHeaders = raw.columns.map((c) => c.trim()).filter((c) => c.length > 0);

        const ordered = [];
        ORDERED_HEADERS.forEach((wanted) => {
          const m = rawHeaders.find((rh) => rh.toLowerCase() === wanted.toLowerCase());
          if (m) ordered.push(m);
        });
        rawHeaders.forEach((rh) => {
          if (!ordered.includes(rh)) ordered.push(rh);
        });

        const cleaned = raw
          .map((row) => {
            const out = {};
            Object.keys(row).forEach((k) => {
              if (k.trim()) out[k.trim()] = row[k];
            });
            return out;
          })
          .filter((row) => {
            const hasContent = Object.values(row).some((v) => v && v.trim() !== '');
            const idKey = Object.keys(row).find((k) => k.toLowerCase() === 'incident id');
            const id = idKey && row[idKey] ? row[idKey].trim().toUpperCase() : '';
            return hasContent && id !== '' && id !== 'N/A';
          })
          .reverse();

        if (!cancelled) {
          setHeaders(ordered);
          setAllRows(cleaned);
        }
      } catch (err) {
        console.error('Error loading E-Log data:', err);
        if (!cancelled) setError(err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useFlatpickr(dateInputRef, {
    mode: 'range',
    dateFormat: 'Y-m-d',
    onChange: (_, dateStr) => setDateVal(dateStr),
  });

  const filtered = useMemo(() => {
    const lowerTime = timeInput.toLowerCase().trim();
    const lowerSearch = searchInput.toLowerCase().trim();
    const isFiltered = dateVal !== '' || lowerTime !== '' || lowerSearch !== '';

    let result = allRows.filter((row) => {
      let matches = true;

      if (dateVal) {
        const dateKey =
          headers.find((h) => h.toLowerCase() === 'date') ||
          headers.find((h) => h.toLowerCase().includes('date'));
        const rowDateStr = dateKey && row[dateKey] ? row[dateKey].trim() : '';
        const rowDate = new Date(rowDateStr);

        if (!Number.isNaN(rowDate)) {
          if (dateVal.includes(' to ')) {
            const [startStr, endStr] = dateVal.split(' to ');
            const [sy, sm, sd] = startStr.split('-').map(Number);
            const start = new Date(sy, sm - 1, sd).getTime();
            const [ey, em, ed] = endStr.split('-').map(Number);
            const end = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
            if (rowDate.getTime() < start || rowDate.getTime() > end) matches = false;
          } else {
            const [sy, sm, sd] = dateVal.split('-').map(Number);
            const single = new Date(sy, sm - 1, sd);
            if (
              rowDate.getFullYear() !== single.getFullYear() ||
              rowDate.getMonth() !== single.getMonth() ||
              rowDate.getDate() !== single.getDate()
            ) {
              matches = false;
            }
          }
        } else {
          matches = false;
        }
      }

      if (matches && lowerTime) {
        const timeKey = headers.find(
          (h) => h.toLowerCase().includes('notificat') || h.toLowerCase().includes('time')
        );
        const rowTime = timeKey && row[timeKey] ? row[timeKey].toLowerCase() : '';
        if (!rowTime.includes(lowerTime)) matches = false;
      }

      if (matches && lowerSearch) {
        const blob = Object.values(row).join(' ').toLowerCase();
        if (!blob.includes(lowerSearch)) matches = false;
      }

      return matches;
    });

    return { rows: isFiltered ? result : result.slice(0, 10), isFiltered, total: result.length };
  }, [allRows, dateVal, timeInput, searchInput, headers]);

  const printEnabled = dateVal !== '' && filtered.rows.length > 0;

  function clearAll() {
    if (dateInputRef.current && dateInputRef.current._flatpickr) {
      dateInputRef.current._flatpickr.clear();
    }
    setDateVal('');
    setTimeInput('');
    setSearchInput('');
  }

  function startPrint() {
    if (!dateVal) {
      alert('Please select a date range first!');
      return;
    }
    if (filtered.rows.length === 0) {
      alert('There are no records for this date to print!');
      return;
    }
    setShowPersonnelModal(true);
  }

  function buildPrintHtml() {
    const getVal = (row, keyStr) => {
      const key =
        headers.find((h) => h.toLowerCase() === keyStr.toLowerCase()) ||
        headers.find((h) => h.toLowerCase().includes(keyStr.toLowerCase()));
      return key && row[key] && row[key].trim() !== '' ? row[key] : '';
    };

    const tableRowsHtml = filtered.rows
      .map(
        (row) =>
          `<tr>${PRINT_COLUMNS.map((c) => `<td>${getVal(row, c)}</td>`).join('')}</tr>`
      )
      .join('');

    const sigBlock = (title, people) => `
      <div class="sig-block">
        <div class="sig-title">${title}</div>
        <div class="sig-grid">
          ${people
            .filter((p) => p.name && p.name.trim() !== '')
            .map(
              (p) => `<div class="sig-person">
                <div class="sig-name">${escapeHtml(p.name)}</div>
                <div class="sig-role">${escapeHtml(p.role || '')}</div>
              </div>`
            )
            .join('')}
        </div>
      </div>`;

    return `<!DOCTYPE html>
<html><head><title>OPERATIONS CENTER ELECTRONIC LOGBOOK</title>
<meta charset="utf-8" />
<style>
  @page { size: landscape; margin: 0.4in; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #000; margin: 0; }
  .header-container { text-align: center; margin-bottom: 15px; line-height: 1.3; font-size: 10px; }
  .header-container p { margin: 2px 0; }
  .doc-title { font-size: 14px; font-weight: bold; margin-top: 5px; letter-spacing: .5px; }
  .shift-info { font-weight: bold; margin-bottom: 10px; font-size: 9px; }
  .shift-info table { margin-bottom: 0; width: auto; border: none; }
  .shift-info td { border: none; padding: 2px 10px 2px 0; font-size: 10px; vertical-align: top; }
  table.data { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  table.data th, table.data td { border: 1px solid #c0c0c0; padding: 5px 4px; text-align: left; vertical-align: top; }
  table.data th { background-color: #f2f2f2; font-size: 7px; font-weight: bold; color: #666; text-transform: uppercase; }
  .turnover-banner { background-color: #f0f4f8; font-weight: bold; padding: 8px; font-size: 9px; margin-bottom: 20px; border-top: 1px solid #c0c0c0; border-bottom: 1px solid #c0c0c0; }
  .signatures-container { display: flex; justify-content: space-between; margin-top: 10px; padding: 0 10px; gap: 24px; }
  .sig-block { width: 48%; }
  .sig-title { font-weight: bold; font-size: 10px; margin-bottom: 18px; text-transform: uppercase; letter-spacing: .5px; }
  .sig-grid { display: flex; flex-wrap: wrap; gap: 18px 24px; }
  .sig-person { width: 200px; }
  .sig-name { font-weight: bold; font-size: 9px; text-decoration: underline; text-underline-offset: 3px; margin-bottom: 4px; }
  .sig-role { font-size: 8px; color: #555; }
  .footer-code { text-align: right; font-size: 7px; margin-top: 30px; color: #666; }
</style></head><body>
<div class="header-container">
  <p>Republic of the Philippines</p>
  <p style="font-weight: bold; color: #0033cc;">CITY GOVERNMENT OF BUTUAN</p>
  <p>City Disaster Risk Reduction and Management Department</p>
  <p>City Hall Bldg., J.P. Rosales Ave., Doongan, Butuan City</p>
  <div class="doc-title">OPERATIONS CENTER ELECTRONIC LOGBOOK</div>
</div>
<div class="shift-info">
  <table>
    <tr><td>DATE:</td><td>${escapeHtml(dateVal.toUpperCase())} (${escapeHtml(shiftLabel)})</td></tr>
    <tr><td>TIME:</td><td>${escapeHtml(assumedText)}</td></tr>
  </table>
</div>
<table class="data">
  <thead>
    <tr>${PRINT_COLUMNS.map((c) => `<th>${escapeHtml(c.replace('NOTIFICATON', 'NOTIFICATION'))}</th>`).join('')}</tr>
  </thead>
  <tbody>${tableRowsHtml}</tbody>
</table>
<div class="turnover-banner">${escapeHtml(turnoverText)}</div>
<div class="signatures-container">
  ${sigBlock('INCOMING PERSONNEL', incoming)}
  ${sigBlock('OUTGOING PERSONNEL', outgoing)}
</div>
<div class="footer-code">CDRRMD.HMD.F.033.REV00</div>
</body></html>`;
  }

  function confirmPrint() {
    setShowPersonnelModal(false);
    const printHTML = buildPrintHtml();
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      alert('Your browser blocked the print window! Please allow pop-ups for this site to print.');
      return;
    }
    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  return (
    <div className="container">
      {/* Scoped Popup Modal Styles so the Print Dialog always renders as a clean centered overlay */}
      <style>{`
        .elog-modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 2000;
          animation: elogFadeIn 0.18s ease-out;
        }
        @keyframes elogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes elogSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .elog-modal-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          width: 100%;
          max-width: 920px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.22);
          overflow: hidden;
          animation: elogSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .elog-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 24px 16px 24px;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f8fafc;
        }
        .elog-modal-title-group h3 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .elog-modal-title-group p {
          margin: 6px 0 0 0;
          font-size: 0.85rem;
          color: #64748b;
        }
        .elog-modal-close {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background-color: #ffffff;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .elog-modal-close:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }
        .elog-modal-body {
          padding: 20px 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .elog-shift-grid {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 14px;
        }
        .elog-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .elog-field label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .elog-personnel-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 4px;
        }
        .elog-person-block {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .elog-person-block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .elog-person-block-header h4 {
          margin: 0;
          font-size: 0.92rem;
          font-weight: 700;
          color: #1e293b;
        }
        .elog-person-row {
          display: grid;
          grid-template-columns: 1.25fr 1fr 36px;
          gap: 8px;
          align-items: center;
        }
        .elog-person-row .form-control {
          height: 36px;
          font-size: 0.82rem;
          padding: 0 10px;
          background-color: #ffffff;
        }
        .elog-btn-trash {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background-color: #ffffff;
          color: #94a3b8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .elog-btn-trash:hover {
          background-color: #fef2f2;
          border-color: #fecaca;
          color: #ef4444;
        }
        .elog-btn-add {
          margin-top: 4px;
          align-self: flex-start;
          padding: 6px 12px;
          font-size: 0.8rem;
          border-radius: 8px;
          background-color: #ffffff;
          border: 1px dashed #cbd5e1;
          color: #2563eb;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .elog-btn-add:hover {
          background-color: #eff6ff;
          border-color: #93c5fd;
        }
        .elog-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          background-color: #f8fafc;
        }
        .elog-modal-footer-actions {
          display: flex;
          gap: 10px;
        }
        @media (max-width: 768px) {
          .elog-shift-grid,
          .elog-personnel-columns {
            grid-template-columns: 1fr;
          }
          .elog-person-row {
            grid-template-columns: 1fr 1fr 34px;
          }
        }
      `}</style>

      <PageHeader title="E-Log Reports" onToggleSidebar={onToggleSidebar} />
      <p style={{ color: '#64748b', margin: '0 0 25px 0', fontSize: '0.95rem' }}>
        Review, filter, and batch print incident logs.
      </p>

      {error && (
        <div className="panel" style={{ color: '#dc3545' }}>
          Failed to load E-Log data.
        </div>
      )}

      <div className="panel">
        <div className="filter-panel">
          <div className="filter-group">
            <label htmlFor="filter-date">Date Range</label>
            <input
              type="text"
              id="filter-date"
              className="form-control"
              placeholder="Select date range"
              ref={dateInputRef}
              style={{ backgroundColor: '#ffffff', cursor: 'pointer' }}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-time">Time</label>
            <input
              type="text"
              id="filter-time"
              className="form-control"
              placeholder="Search time..."
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-search">Keyword Search</label>
            <input
              type="text"
              id="filter-search"
              className="form-control"
              placeholder="Search incidents, locations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="filter-actions">
            <button
              id="btn-clear"
              className="btn btn-secondary"
              onClick={clearAll}
              style={{ height: 42 }}
            >
              Clear Filters
            </button>
            <button
              id="btn-print-batch"
              className="btn btn-primary"
              onClick={startPrint}
              disabled={!printEnabled}
              style={{
                height: 42,
                opacity: printEnabled ? 1 : 0.5,
                cursor: printEnabled ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fa-solid fa-print" /> Print Report
            </button>
          </div>
        </div>
      </div>

      <div className="panel panel-no-margin">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <h3>Incident Records</h3>
          <div
            id="record-count"
            style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}
          >
            {allRows.length === 0
              ? 'Loading...'
              : filtered.isFiltered
                ? `Showing ${filtered.rows.length} matching record(s)`
                : `Showing 10 latest of ${allRows.length} total record(s)`}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="report-table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '12px 15px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      borderBottom: '2px solid #cbd5e1',
                      textAlign: 'left',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length || 1}
                    style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}
                  >
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                filtered.rows.map((row, i) => (
                  <tr key={i} style={{ transition: 'background-color 0.2s' }}>
                    {headers.map((h) => (
                      <td
                        key={h}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '10px 15px',
                          borderBottom: '1px solid #e2e8f0',
                          color: '#334155',
                        }}
                      >
                        {row[h] || '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PersonnelModal
        open={showPersonnelModal}
        onCancel={() => setShowPersonnelModal(false)}
        onConfirm={confirmPrint}
        recordCount={filtered.rows.length}
        dateVal={dateVal}
        incoming={incoming}
        setIncoming={setIncoming}
        outgoing={outgoing}
        setOutgoing={setOutgoing}
        shiftLabel={shiftLabel}
        setShiftLabel={setShiftLabel}
        assumedText={assumedText}
        setAssumedText={setAssumedText}
        turnoverText={turnoverText}
        setTurnoverText={setTurnoverText}
      />
    </div>
  );
}

// Centered Popup Modal for confirming shift & personnel details before printing.
function PersonnelModal({
  open,
  onCancel,
  onConfirm,
  recordCount,
  dateVal,
  incoming,
  setIncoming,
  outgoing,
  setOutgoing,
  shiftLabel,
  setShiftLabel,
  assumedText,
  setAssumedText,
  turnoverText,
  setTurnoverText,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const updatePerson = (list, setList, idx, patch) => {
    setList(list.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const addPerson = (list, setList) => setList([...list, { name: '', role: '' }]);
  const removePerson = (list, setList, idx) =>
    setList(list.filter((_, i) => i !== idx));

  return (
    <div
      className="elog-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="elog-modal-card">
        <div className="elog-modal-header">
          <div className="elog-modal-title-group">
            <h3>
              <i className="fa-solid fa-print" style={{ color: '#2563eb' }} />
              Confirm Print Layout
            </h3>
            <p>
              Edit the personnel and shift information before printing. The report
              will be rendered in <b>landscape</b> orientation.
            </p>
          </div>
          <button
            className="elog-modal-close"
            type="button"
            onClick={onCancel}
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="elog-modal-body">
          <div className="elog-shift-grid">
            <div className="elog-field">
              <label>Shift Label</label>
              <input
                className="form-control"
                value={shiftLabel}
                onChange={(e) => setShiftLabel(e.target.value)}
                placeholder="e.g. PM SHIFT"
              />
            </div>
            <div className="elog-field">
              <label>Assumed Duties Text</label>
              <input
                className="form-control"
                value={assumedText}
                onChange={(e) => setAssumedText(e.target.value)}
              />
            </div>
          </div>

          <div className="elog-field">
            <label>Turn-over Banner Text</label>
            <input
              className="form-control"
              value={turnoverText}
              onChange={(e) => setTurnoverText(e.target.value)}
            />
          </div>

          <div className="elog-personnel-columns">
            <PersonBlock
              title="Incoming Personnel"
              people={incoming}
              onAdd={() => addPerson(incoming, setIncoming)}
              onRemove={(i) => removePerson(incoming, setIncoming, i)}
              onChange={(i, patch) => updatePerson(incoming, setIncoming, i, patch)}
            />
            <PersonBlock
              title="Outgoing Personnel"
              people={outgoing}
              onAdd={() => addPerson(outgoing, setOutgoing)}
              onRemove={(i) => removePerson(outgoing, setOutgoing, i)}
              onChange={(i, patch) => updatePerson(outgoing, setOutgoing, i, patch)}
            />
          </div>
        </div>

        <div className="elog-modal-footer">
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
            Ready to print <b>{recordCount}</b> record(s) for <b>{dateVal}</b>
          </span>
          <div className="elog-modal-footer-actions">
            <button className="btn btn-secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={onConfirm}>
              <i className="fa-solid fa-print" /> Print Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonBlock({ title, people, onAdd, onRemove, onChange }) {
  return (
    <div className="elog-person-block">
      <div className="elog-person-block-header">
        <h4>{title}</h4>
        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
          {people.length} listed
        </span>
      </div>

      {people.map((p, i) => (
        <div key={i} className="elog-person-row">
          <input
            className="form-control"
            placeholder="Full Name"
            value={p.name}
            onChange={(e) => onChange(i, { name: e.target.value })}
          />
          <input
            className="form-control"
            placeholder="Role / Designation"
            value={p.role}
            onChange={(e) => onChange(i, { role: e.target.value })}
          />
          <button
            type="button"
            className="elog-btn-trash"
            onClick={() => onRemove(i)}
            aria-label="Remove person"
            title="Remove person"
          >
            <i className="fa-solid fa-trash-can" />
          </button>
        </div>
      ))}

      <button type="button" className="elog-btn-add" onClick={onAdd}>
        <i className="fa-solid fa-plus" /> Add Personnel
      </button>
    </div>
  );
}