// Page header with the bulletproof sidebar toggle that every original
// page had. The icon flip on collapse is preserved verbatim.
export default function PageHeader({ title, onToggleSidebar, subtitle, right }) {
  return (
    <div className="page-header-filters" style={{ marginBottom: subtitle ? 25 : 25 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
        <button
          id="sidebarToggle"
          className="sidebar-toggle"
          onClick={(e) => {
            e.preventDefault();
            onToggleSidebar();
            const icon = e.currentTarget.querySelector('i');
            if (icon) {
              // Match the .collapsed class on the sidebar by reading
              // its current state — Sidebar owns the `collapsed` prop.
              const sidebar = document.querySelector('.sidebar');
              if (sidebar?.classList.contains('collapsed')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
              } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
              }
            }
          }}
        >
          <i className="fa-solid fa-bars" />
        </button>
        <h1 className="header-title" style={{ margin: 0 }}>{title}</h1>
      </div>

      {right ? <div className="filter-group-inline">{right}</div> : null}
    </div>
  );
}
