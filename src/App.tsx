import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HubPage from './pages/HubPage';
import DemoPage from './pages/DemoPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { usePageAnalytics } from './analytics/usePageAnalytics';

const AdminPage = React.lazy(() => import('./pages/AdminPage'));

export default function App() {
  usePageAnalytics();

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HubPage />} />
        <Route path="/demo/:demoId" element={<DemoPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/a/:slug/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
