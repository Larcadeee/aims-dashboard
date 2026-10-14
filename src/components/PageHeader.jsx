import React from 'react';

export default function PageHeader({ title, onToggleSidebar, children }) {
  return (
    <header className="page-header">
      <div className="page-header-left">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <i className="fa-solid fa-bars" />
        </button>
        <h2 className="page-title">{title}</h2>
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  );
}