import { NavLink } from 'react-router-dom';

// Mirrors the static <aside class="sidebar"> from Draft - 2 exactly.
// NavLink's `isActive` replaces the manual `class="nav-item active"`
// that the original HTML files hard-coded.
const NAV_ITEMS = [
  { to: '/', icon: 'fa-solid fa-chart-line', label: 'Main' },
  { to: '/resource', icon: 'fa-solid fa-truck-medical', label: 'Resource' },
  { to: '/report', icon: 'fa-solid fa-file-lines', label: 'Report' },
  { to: '/weather', icon: 'fa-solid fa-cloud-sun', label: 'Weather' },
  { to: '/news', icon: 'fa-solid fa-newspaper', label: 'News' },
];

export default function Sidebar({ collapsed, onClose }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2>
          <img
            src="/assets/images/cdrrmd-logo.jpg"
            alt="CDRRMD Logo"
            className="sidebar-logo"
          />
          <span>CDRRMD</span>
        </h2>
        <p>
          <span>Operation Center</span>
        </p>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <i className={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
