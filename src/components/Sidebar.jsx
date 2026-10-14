import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Main', icon: 'fa-solid fa-house' },
  { path: '/resource', label: 'Resource Tracker', icon: 'fa-solid fa-truck-medical' },
  { path: '/report', label: 'E-Log Reports', icon: 'fa-solid fa-file-lines' },
  { path: '/weather', label: 'Weather', icon: 'fa-solid fa-cloud-sun-rain' },
  { path: '/news', label: 'News & Updates', icon: 'fa-solid fa-newspaper' },
  { path: '/custom', label: 'Custom View', icon: 'fa-solid fa-wand-magic-sparkles' },
];

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}) {
  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${
        mobileOpen ? 'mobile-open' : ''
      }`}
    >
      {/* Exact Reference Floating Collapse Button */}
      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={() => {
          if (window.innerWidth <= 1024) {
            onCloseMobile();
          } else {
            onToggleCollapse();
          }
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <i
          className={`fa-solid ${
            collapsed ? 'fa-chevron-right' : 'fa-chevron-left'
          }`}
        />
      </button>

      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-box">
          <img
            src={`${import.meta.env.BASE_URL}assets/images/cdrrmd-logo.jpg`}
            alt="CDRRMD"
            className="sidebar-logo-img"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-info">
            <span className="sidebar-brand-title">AIMS</span>
            <span className="sidebar-brand-sub">CDRRMD Butuan</span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-item-icon">
              <i className={item.icon} />
            </span>
            {!collapsed && (
              <span className="sidebar-item-label">{item.label}</span>
            )}
            {/* Dark Floating Tooltip on Hover when Collapsed */}
            {collapsed && (
              <span className="sidebar-hover-tooltip">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}