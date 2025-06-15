import React, { useEffect, useState, useRef } from "react";
import vegaEmbed from "vega-embed";
import Card from "../components/Card";
import Sidebar from "../components/Sidebar";
import { useClickAway } from "react-use";

const API_BASE_URL = "http://127.0.0.1:5000/api";

export default function DashboardPage() {
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [platformCosts, setPlatformCosts] = useState([]);
  const [selectedRange, setSelectedRange] = useState("1y");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["github", "gitlab", "bitbucket"]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const platformDropdownRef = useRef(null);
  const pieChartContainerRef = useRef(null);

  const dateRanges = [
    { label: "Last 7 Days", value: "7d" },
    { label: "Last 30 Days", value: "30d" },
    { label: "Last 6 Months", value: "6m" },
    { label: "Last Year", value: "1y" },
  ];

  const platforms = ["github", "gitlab", "bitbucket"];

  useClickAway(platformDropdownRef, () => {
    setDropdownOpen(false);
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard-summary?range=${selectedRange}`)
      .then((res) => res.json())
      .then((data) => setDashboardSummary(data));

    fetch(`${API_BASE_URL}/platform-costs?range=${selectedRange}`)
      .then((res) => res.json())
      .then((data) => {
        setPlatformCosts(data);

        const filtered = data.filter((d) =>
          selectedPlatforms.includes(d.platform.toLowerCase())
        );

        if (!pieChartContainerRef.current || filtered.length === 0) return;

        const onlyOnePlatform = selectedPlatforms.length === 1;

        const spec = onlyOnePlatform
          ? (() => {
              const platformData = filtered[0];
              const totalJobs = platformData.total_jobs || 0;
              const failedJobs = platformData.failed_jobs || 0;
              const successfulJobs = totalJobs - failedJobs;

              return {
                $schema: "https://vega.github.io/schema/vega-lite/v5.json",
                description: "Job Breakdown",
                width: 500,
                height: 400,
                data: {
                  values: [
                    { type: "Successful Jobs", count: successfulJobs },
                    { type: "Failed Jobs", count: failedJobs },
                  ],
                },
                mark: "bar",
                encoding: {
                  x: {
                    field: "type",
                    type: "nominal",
                    axis: { title: "Job Type", labelAngle: 0 },
                  },
                  y: {
                    field: "count",
                    type: "quantitative",
                    axis: { title: "Count" },
                  },
                  color: { field: "type", type: "nominal" },
                  tooltip: [
                    { field: "type", title: "Job Type" },
                    { field: "count", title: "Count" },
                  ],
                },
              };
            })()
          : {
              $schema: "https://vega.github.io/schema/vega-lite/v5.json",
              description: "Platform Cost Breakdown",
              width: 500,
              height: 400,
              data: {
                values: filtered.map((p) => ({
                  platform:
                    p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
                  cost: p.total_cost_by_platform || 0,
                })),
              },
              transform: [
                { window: [{ op: "sum", field: "cost", as: "TotalCost" }] },
                {
                  calculate: "datum.cost / datum.TotalCost * 100",
                  as: "Percent",
                },
                {
                  calculate: "format(datum.Percent, '.1f') + '%'",
                  as: "PercentLabel",
                },
              ],
              mark: "arc",
              encoding: {
                theta: { field: "cost", type: "quantitative" },
                color: { field: "platform", type: "nominal" },
                tooltip: [
                  { field: "platform", title: "Platform" },
                  {
                    field: "cost",
                    title: "Total Cost ($)",
                    type: "quantitative",
                    format: ".2f",
                  },
                  { field: "PercentLabel", title: "Share" },
                ],
              },
              view: { stroke: null },
            };

        vegaEmbed(pieChartContainerRef.current, spec, { actions: false }).catch(console.error);
      });
  }, [selectedRange, selectedPlatforms]);

  if (!dashboardSummary) {
    return <div className="p-4 text-lg">Loading summary...</div>;
  }

  const togglePlatform = (platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const isAllSelected = selectedPlatforms.length === platforms.length;

  const summary = isAllSelected
    ? {
        totalCost: dashboardSummary.total_enterprise_ci_cd_cost,
        totalRuns: dashboardSummary.total_runs_enterprise,
        failedJobs: dashboardSummary.failed_runs_enterprise,
        successfulJobs: dashboardSummary.successful_runs_enterprise,
      }
    : platformCosts
        .filter((p) => selectedPlatforms.includes(p.platform.toLowerCase()))
        .reduce(
          (acc, curr) => ({
            totalCost: acc.totalCost + (curr.total_cost_by_platform || 0),
            totalRuns: acc.totalRuns + (curr.total_jobs || 0),
            failedJobs: acc.failedJobs + (curr.failed_jobs || 0),
            successfulJobs:
              acc.successfulJobs +
              ((curr.total_jobs || 0) - (curr.failed_jobs || 0)),
          }),
          { totalCost: 0, totalRuns: 0, failedJobs: 0, successfulJobs: 0 }
        );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-0"}`}>
        {/* Top Bar */}
        <div className="bg-orange-700 p-4 flex justify-between items-center text-white">
          <div className="flex items-center space-x-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-white bg-orange-600 hover:bg-orange-500 px-3 py-2 rounded-lg"
              >
                ☰
              </button>
            )}
            <h1
              className="text-2xl font-bold cursor-pointer hover:underline"
              onClick={() => window.location.href = "/"}
            >
              Enterprise CI/CD Summary
            </h1>
          </div>

          <div className="flex space-x-4">
            {/* Platform Multi-select */}
            <div className="relative" ref={platformDropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg border border-white"
              >
                {isAllSelected ? "All Platforms" : selectedPlatforms.join(", ")}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 bg-white text-black rounded shadow z-10 w-40">
                  {platforms.map((platform) => (
                    <label
                      key={platform}
                      className="flex items-center px-4 py-2 hover:bg-orange-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform)}
                        onChange={() => togglePlatform(platform)}
                        className="mr-2"
                      />
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range Dropdown */}
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg border border-white"
            >
              {dateRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card title="Total Cost" value={`$${summary.totalCost.toFixed(2)}`} />
            <Card title="Total Runs" value={summary.totalRuns} />
            <Card title="Failed Jobs" value={summary.failedJobs} />
            <Card title="Successful Jobs" value={summary.successfulJobs} />
          </div>

          {/* Chart */}
          <div>
            <h2 className="text-xl font-semibold mb-2 mt-6">
              {selectedPlatforms.length === 1
                ? `Job Breakdown for ${selectedPlatforms[0].toUpperCase()}`
                : "Cost Breakdown by Platform"}
            </h2>
            <div className="bg-white rounded-xl p-4 shadow w-full">
              <div ref={pieChartContainerRef} className="w-full h-[400px] ml-96" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
