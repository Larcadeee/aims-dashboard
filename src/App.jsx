import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Sidebar from './components/Sidebar.jsx';
import ZapierChat from './components/ZapierChat.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Resource from './pages/Resource.jsx';
import Report from './pages/Report.jsx';
import Weather from './pages/Weather.jsx';
import News from './pages/News.jsx';
import CustomPage from './pages/CustomPage.jsx';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const toggle = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  };

  // Alias so either `toggle` or `handleToggleSidebar` works
  const handleToggleSidebar = toggle;

  // Close mobile sidebar when navigating between pages
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Reflect sidebar state on the app container and resize Plotly charts
  useEffect(() => {
    const el = document.querySelector('.app-container');
    if (el) {
      el.classList.toggle('sidebar-open', !collapsed);
    }
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 280);
    return () => clearTimeout(timer);
  }, [collapsed]);

  return (
    <div
      className={`app-container ${collapsed ? 'sidebar-collapsed' : ''} ${
        mobileOpen ? 'sidebar-mobile-open' : ''
      }`}
    >
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
        onClose={() => setCollapsed(true)}
      />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard onToggleSidebar={toggle} />} />
          <Route
            path="/resource"
            element={<Resource onToggleSidebar={toggle} />}
          />
          <Route
            path="/report"
            element={<Report onToggleSidebar={toggle} />}
          />
          <Route
            path="/weather"
            element={<Weather onToggleSidebar={toggle} />}
          />
          <Route path="/news" element={<News onToggleSidebar={toggle} />} />
          <Route
            path="/custom"
            element={<CustomPage onToggleSidebar={toggle} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <ZapierChat />
    </div>
  );
}