export function SkeletonCard({ variant = 'panel' }) {
  return (
    <div className={`soft-skeleton-card soft-skeleton-${variant}`} aria-hidden="true">
      <span className="soft-skeleton-line short" />
      <span className="soft-skeleton-line" />
      <span className="soft-skeleton-line medium" />
      {variant !== 'metric' && <span className="soft-skeleton-plot" />}
    </div>
  );
}

export function SkeletonTable({ rows = 7, columns = 5, label = 'Loading records' }) {
  return (
    <div className="soft-skeleton-table" role="status" aria-label={label} aria-busy="true">
      <div className="soft-skeleton-table-row header" style={{ '--columns': columns }}>
        {Array.from({ length: columns }, (_, index) => (
          <span key={index} className="soft-skeleton-line" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div className="soft-skeleton-table-row" key={row} style={{ '--columns': columns }}>
          {Array.from({ length: columns }, (_, column) => (
            <span key={column} className="soft-skeleton-line" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonNotice({ children = 'Refreshing data' }) {
  return (
    <div className="soft-loading-notice" role="status" aria-live="polite">
      <span className="soft-loading-dot" />
      {children}
    </div>
  );
}
