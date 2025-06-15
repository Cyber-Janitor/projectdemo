import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Card from '../components/Card';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

export default function PlatformRepositoriesPage() {
  const { platformName } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summary, setSummary] = useState(null);
  const [repos, setRepos] = useState([]);
  const [dateRange, setDateRange] = useState('30d');
  const [sortBy, setSortBy] = useState('total_cost');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    async function fetchSummaryAndRepos() {
      try {
        const [summaryRes, reposRes] = await Promise.all([
          fetch(`${API_BASE_URL}/platform-repositories-summary?platform=${platformName}&range=${dateRange}`),
          fetch(`${API_BASE_URL}/platform-repositories?platform=${platformName}&range=${dateRange}`)
        ]);

        const summaryData = await summaryRes.json();
        const reposData = await reposRes.json();

        setSummary(summaryData);
        setRepos(Array.isArray(reposData) ? reposData : []);
      } catch (error) {
        console.error('Failed to fetch repository data:', error);
        setRepos([]);
      }
    }

    fetchSummaryAndRepos();
  }, [platformName, dateRange]);

  const sortedRepos = [...repos].sort((a, b) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className={`flex-1 p-6 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 capitalize">
            {platformName} Repositories
          </h1>
          <div className="flex items-center space-x-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border rounded-md shadow-sm bg-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="6mo">Last 6 months</option>
              <option value="1yr">Last 1 year</option>
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
            <Card title="Total Cost" value={`$${summary.total_cost?.toFixed(2)}`} />
            <Card
              title="Most Expensive Repo"
              value={`${summary.most_costly_repo || '-'} ($${summary.most_costly_repo_cost?.toFixed(2)})`}
            />
            <Card
              title="Most Active Repo"
              value={`${summary.repo_with_most_jobs || '-'} (${summary.repo_with_most_jobs_count || 0})`}
            />
            <Card title="Total Repositories" value={summary.total_active_repositories || 0} />
          </div>
        )}

        {/* Sort Dropdown */}
        <div className="flex justify-end mb-2">
          <label className="mr-2 font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            className="px-3 py-1 border rounded-md shadow-sm bg-white text-sm"
          >
            <option value="total_cost">Cost</option>
            <option value="total_jobs">Jobs</option>
          </select>
        </div>

        {/* Repositories Table */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Repositories List</h2>
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-200 text-gray-800 uppercase text-xs">
              <tr>
                <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('repo_name')}>Repo Name</th>
                <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('team_name')}>Team</th>
                <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('total_jobs')}>Jobs</th>
                <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('total_cost')}>Cost ($)</th>
              </tr>
            </thead>
            <tbody>
              {sortedRepos.map((repo, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2 px-4">{repo.repo_name}</td>
                  <td className="py-2 px-4">{repo.team_name || '-'}</td>
                  <td className="py-2 px-4">{repo.total_jobs}</td>
                  <td className="py-2 px-4">${(repo.total_cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
