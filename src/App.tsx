import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HubPage from './pages/HubPage';
import DemoPage from './pages/DemoPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { usePageAnalytics } from './analytics/usePageAnalytics';

export default function App() {
  usePageAnalytics();

  return (
    <Routes>
      <Route path="/" element={<HubPage />} />
      <Route path="/demo/:demoId" element={<DemoPage />} />
      <Route path="/a/:slug/analytics" element={<AnalyticsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
