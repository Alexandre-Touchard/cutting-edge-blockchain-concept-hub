import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HubPage from './pages/HubPage';
import DemoPage from './pages/DemoPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HubPage />} />
      <Route path="/demo/:demoId" element={<DemoPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
