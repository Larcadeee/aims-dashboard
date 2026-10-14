import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Sidebar from './components/Sidebar.jsx';
import ZapierChat from './components/ZapierChat.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Resource from './pages/Resource.jsx';
import Report from './pages/Report.jsx';
import Weather from './pages/Weather.jsx';
import News from './pages/News.jsx';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer automatically on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Trigger Plotly resize when sidebar expands/collapses
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 280);
    return () => clearTimeout(timer);
  }, [collapsed]);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  };

  return (
    <div
      className={`app-container ${collapsed ? 'sidebar-collapsed' : ''} ${
        mobileOpen ? 'sidebar-mobile-open' : ''
      }`}
    >
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={<Dashboard onToggleSidebar={handleToggleSidebar} />}
          />
          <Route
            path="/resource"
            element={<Resource onToggleSidebar={handleToggleSidebar} />}
          />
          <Route
            path="/report"
            element={<Report onToggleSidebar={handleToggleSidebar} />}
          />
          <Route
            path="/weather"
            element={<Weather onToggleSidebar={handleToggleSidebar} />}
          />
          <Route
            path="/news"
            element={<News onToggleSidebar={handleToggleSidebar} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <ZapierChat />
    </div>
  );
}