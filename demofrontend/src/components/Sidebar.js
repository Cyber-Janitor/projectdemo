import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 z-20 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Close button (only when sidebar is open) */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-gray-600 hover:text-red-500 text-xl font-bold"
          aria-label="Close Sidebar"
        >
          ✕
        </button>
      )}

      <div className="p-6 mt-10">
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          <div>
            <h2 className="text-gray-500 uppercase font-semibold text-xs mb-1">Platforms</h2>
            <ul className="ml-2 space-y-1">
              {['github', 'gitlab', 'bitbucket'].map((platform) => (
                <li
                  key={platform}
                  className="cursor-pointer hover:text-blue-600"
                  onClick={() => navigate(`/platform/${platform}`)}
                >
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-gray-500 uppercase font-semibold text-xs mb-1">Teams</h2>
            <ul className="ml-2 space-y-1">
              <li className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/teams')}>
                Team Summary
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-gray-500 uppercase font-semibold text-xs mb-1">Repos</h2>
            <ul className="ml-2 space-y-1">
              <li className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/repositories')}>
                Repository Stats
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
