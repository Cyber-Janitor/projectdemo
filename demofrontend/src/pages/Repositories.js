import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:5000/api";

export default function Repositories() {
  const [repos, setRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("total_cost");
  const [sortOrder, setSortOrder] = useState("desc");
  const [summary, setSummary] = useState(null);
  const [groupByPlatform, setGroupByPlatform] = useState(false);

  const sortOptions = [
    { label: "Total Cost", key: "total_cost" },
    { label: "Total Jobs", key: "total_jobs" },
    { label: "Alphabetical", key: "repo_name" },
    { label: "Platform", key: "platform" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/repositories?range=last_30_days&sort_by=total_cost`
        );
        setRepos(response.data.repositories || []);
        setSummary(response.data.summary || {});
      } catch (error) {
        console.error("Error fetching repositories:", error);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const handleSortChange = (e) => {
    const key = e.target.value;
    setSortKey(key);
    setSortOrder(key === "repo_name" || key === "platform" ? "asc" : "desc");
  };

  const groupBy = (repoList) => {
    const groups = {};
    repoList.forEach((repo) => {
      const platform = repo.platform || "unknown";
      if (!groups[platform]) groups[platform] = [];
      groups[platform].push(repo);
    });
    return groups;
  };

  const sortedFilteredRepos = repos
    .filter((repo) => repo.repo_name.toLowerCase().includes(searchQuery))
    .sort((a, b) => {
      if (sortOrder === "asc") return a[sortKey] > b[sortKey] ? 1 : -1;
      return a[sortKey] < b[sortKey] ? 1 : -1;
    });

  const grouped = groupBy(sortedFilteredRepos);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">All Repositories</h1>

      {summary && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white shadow rounded-xl p-4">
            <h2 className="text-sm text-gray-500 mb-1">Most Expensive</h2>
            <p className="text-lg font-semibold text-red-600">{summary.most_expensive_repo}</p>
          </div>
          <div className="bg-white shadow rounded-xl p-4">
            <h2 className="text-sm text-gray-500 mb-1">Most Jobs</h2>
            <p className="text-lg font-semibold text-blue-600">{summary.most_jobs_repo}</p>
          </div>
          <div className="bg-white shadow rounded-xl p-4">
            <h2 className="text-sm text-gray-500 mb-1">Cheapest Repo</h2>
            <p className="text-lg font-semibold text-green-600">{summary.cheapest_repo}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by repository name..."
          className="px-4 py-2 border border-gray-300 rounded-xl w-full sm:w-1/3"
          value={searchQuery}
          onChange={handleSearch}
        />
        <div className="flex gap-4 items-center">
          <select
            value={sortKey}
            onChange={handleSortChange}
            className="px-4 py-2 border border-gray-300 rounded-xl"
          >
            {sortOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                Sort by {opt.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={groupByPlatform}
              onChange={(e) => setGroupByPlatform(e.target.checked)}
            />
            Group by Platform
          </label>
        </div>
      </div>

      {groupByPlatform ? (
        Object.entries(grouped).map(([platform, repos]) => (
          <div key={platform} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">{platform.toUpperCase()}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white shadow rounded-xl">
                <thead className="bg-gray-200 text-gray-800 uppercase text-xs">
                  <tr>
                    <th className="py-2 px-4">Repo Name</th>
                    <th className="py-2 px-4">Team</th>
                    <th className="py-2 px-4">Jobs</th>
                    <th className="py-2 px-4">Cost ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {repos.map((repo, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="py-2 px-4">{repo.repo_name}</td>
                      <td className="py-2 px-4">{repo.team_name}</td>
                      <td className="py-2 px-4">{repo.total_jobs}</td>
                      <td className="py-2 px-4">${repo.total_cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow rounded-xl">
            <thead className="bg-gray-200 text-gray-800 uppercase text-xs">
              <tr>
                <th className="py-2 px-4">Repo Name</th>
                <th className="py-2 px-4">Team</th>
                <th className="py-2 px-4">Platform</th>
                <th className="py-2 px-4">Jobs</th>
                <th className="py-2 px-4">Cost ($)</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredRepos.map((repo, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-2 px-4">{repo.repo_name}</td>
                  <td className="py-2 px-4">{repo.team_name}</td>
                  <td className="py-2 px-4">{repo.platform}</td>
                  <td className="py-2 px-4">{repo.total_jobs}</td>
                  <td className="py-2 px-4">${repo.total_cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
