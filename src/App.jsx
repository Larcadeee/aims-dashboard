import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar.jsx';
import ZapierChat from './components/ZapierChat.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Resource from './pages/Resource.jsx';
import Report from './pages/Report.jsx';
import Weather from './pages/Weather.jsx';
import News from './pages/News.jsx';

// App shell: holds the sidebar's collapsed state in one place so any
// page header can toggle it. Routes are mounted inside <main> as if they
// were the original `index.html`, `report.html`, etc.
export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => setCollapsed((c) => !c);

  // Reflect sidebar state on the app container so the mobile burger
  // can render its backdrop via CSS.
  useEffect(() => {
    const el = document.querySelector('.app-container');
    if (!el) return;
    el.classList.toggle('sidebar-open', !collapsed);
  }, [collapsed]);

  return (
    <div className="app-container">
      <Sidebar collapsed={collapsed} onClose={() => setCollapsed(true)} />

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Same chatbot embed that the original site used on every page */}
      <ZapierChat />
    </div>
  );
}
