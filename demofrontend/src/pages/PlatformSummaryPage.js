import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Card from '../components/Card';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

export default function PlatformSummaryPage() {
  const { platformName } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState('30d');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchSummary() {
      const res = await fetch(`${API_BASE_URL}/platform-summary?platform=${platformName}&range=${dateRange}`);
      const data = await res.json();
      setSummary(data);
    }
    fetchSummary();
  }, [platformName, dateRange]);

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans relative overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className={`flex-1 p-6 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        
        {/* Navbar-like row */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/')} className="text-3xl font-bold text-blue-600 hover:text-blue-800">
              ⛩️
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {platformName.charAt(0).toUpperCase() + platformName.slice(1)} Summary
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300 bg-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="6mo">Last 6 months</option>
              <option value="1y">Last 1 year</option>
              <option value="all">All time</option>
            </select>
            <button
              className="bg-white shadow px-3 py-1 rounded-md border text-gray-800 hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ≡
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card title="Total Cost" value={`$${summary.total_cost.toFixed(2)}`} />
            <Card title="Total Jobs" value={summary.total_jobs} />
            <Card title="Failed Jobs" value={summary.failed_jobs} />
            <Card
              title="Top Repo"
              value={`${summary.most_costly_repo} ($${summary.most_costly_repo_cost.toFixed(2)})`}
            />
          </div>
        )}

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <Card
            title="Teams"
            value="View"
            onClick={() => navigate(`/platform/${platformName}/teams`)}
          />
          <Card
            title="Repositories"
            value="View"
            onClick={() => navigate(`/platform/${platformName}/repositories`)}
          />
        </div>
      </main>
    </div>
  );
}
