import React from "react";

export default function Card({ title, value, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-md p-6 text-center cursor-pointer hover:shadow-lg transition-transform transform hover:-translate-y-1"
    >
      <div className="text-2xl font-semibold text-gray-800">{title}</div>
      <div className="text-3xl mt-3 font-bold text-blue-600">{value}</div>
    </div>
  );
}
