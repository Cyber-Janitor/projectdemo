import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import PlatformSummaryPage from './pages/PlatformSummaryPage';
import PlatformTeamsPage from './pages/PlatformTeamsPage';
import PlatformRepositoriesPage from './pages/PlatformRepositoriesPage';
import TeamsPage from './pages/TeamsPage';  // ✅ New
import Repositories from './pages/Repositories';  // ✅ New



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/platform/:platformName" element={<PlatformSummaryPage />} />
        <Route path="/platform/:platformName/teams" element={<PlatformTeamsPage />} />
        <Route path="/platform/:platformName/repositories" element={<PlatformRepositoriesPage />} /> {/* ✅ New */}
        <Route path="/teams" element={<TeamsPage />} /> 
        <Route path="/repositories" element={<Repositories />} /> 
      </Routes>
    </Router>
  );
}

export default App;
