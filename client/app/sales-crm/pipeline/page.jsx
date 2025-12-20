"use client";

import { useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaFilter,
  FaEllipsisV,
  FaUserTie,
  FaDollarSign,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
} from "react-icons/fa";

// Mock deals per stage
const initialDeals = {
  leads: [
    { id: 1, name: "Acme Corp Intro", value: 5000, owner: "Vivek", status: "New", updated: "Today" },
    { id: 2, name: "Globex Cold Outreach", value: 2500, owner: "Aditi", status: "Contacted", updated: "1d ago" },
  ],
  qualified: [
    { id: 3, name: "Initech Discovery", value: 12000, owner: "Rahul", status: "Discovery", updated: "2d ago" },
  ],
  proposal: [
    { id: 4, name: "Umbrella Proposal", value: 18000, owner: "Vivek", status: "Proposal Sent", updated: "4d ago" },
    { id: 5, name: "Soylent Pricing", value: 9000, owner: "Aditi", status: "Negotiation", updated: "3d ago" },
  ],
  won: [
    { id: 6, name: "Hooli Subscription", value: 30000, owner: "Vivek", status: "Won", updated: "7d ago" },
  ],
  lost: [
    { id: 7, name: "Stark Industries", value: 15000, owner: "Rahul", status: "Lost - Pricing", updated: "5d ago" },
  ],
};

const stageMeta = [
  { key: "leads", title: "Leads", color: "bg-gray-100 dark:bg-gray-800", accent: "border-gray-300 dark:border-gray-700" },
  { key: "qualified", title: "Qualified", color: "bg-blue-50 dark:bg-blue-900/30", accent: "border-blue-300 dark:border-blue-700" },
  { key: "proposal", title: "Proposal", color: "bg-purple-50 dark:bg-purple-900/30", accent: "border-purple-300 dark:border-purple-700" },
  { key: "won", title: "Won", color: "bg-green-50 dark:bg-green-900/30", accent: "border-green-300 dark:border-green-700" },
  { key: "lost", title: "Lost", color: "bg-red-50 dark:bg-red-900/30", accent: "border-red-300 dark:border-red-700" },
];

export default function SalesPipelinePage() {
  const [deals, setDeals] = useState(initialDeals);
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("All");

  const owners = ["All", ...Array.from(new Set(Object.values(initialDeals).flat().map(d => d.owner)))];

  const filteredDeals = (stageKey) => {
    return deals[stageKey].filter((d) => {
      const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
      const matchesOwner = filterOwner === "All" || d.owner === filterOwner;
      return matchesSearch && matchesOwner;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Banner */}
      <div className="bg-teal-600 text-white px-6 py-3 text-sm flex items-center justify-between">
        <span>
          Want to learn how leading D2C brands drive 40X engagement on WhatsApp?
        </span>
        <button className="bg-white text-teal-700 px-4 py-1 rounded font-medium text-sm hover:bg-gray-100 transition-colors">
          Read Now
        </button>
      </div>

      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FaUserTie className="text-teal-600 dark:text-teal-400" /> Sales Pipeline
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track opportunities across stages and focus on deals that move.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search deals"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48"
              />
            </div>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {owners.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaFilter />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              <FaPlus /> New Deal
            </button>
          </div>
        </div>

        {/* Pipeline Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1100px]">
            {stageMeta.map((stage) => (
              <div
                key={stage.key}
                className={`flex-1 min-w-[220px] border rounded-lg ${stage.accent} ${stage.color} flex flex-col max-h-[70vh]`}
              >
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    {stage.title}
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                      {filteredDeals(stage.key).length}
                    </span>
                  </h2>
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaEllipsisV />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {filteredDeals(stage.key).length === 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">No deals</div>
                  )}
                  {filteredDeals(stage.key).map((deal) => (
                    <div
                      key={deal.id}
                      className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 p-3 space-y-1 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
                          {deal.name}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{deal.updated}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 text-xs font-semibold">
                          <FaDollarSign /> {deal.value.toLocaleString()}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">
                          {deal.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Owner: {deal.owner}</span>
                        <StageStatusIcon status={deal.status} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700">
                  <button className="w-full text-xs flex items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 dark:border-gray-600 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <FaPlus className="text-xs" /> Add Deal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageStatusIcon({ status }) {
  if (status?.toLowerCase().includes("won")) {
    return <FaCheckCircle className="text-green-500" title="Won" />;
  }
  if (status?.toLowerCase().includes("lost")) {
    return <FaTimesCircle className="text-red-500" title="Lost" />;
  }
  if (status?.toLowerCase().includes("negoti")) {
    return <FaClock className="text-yellow-500" title="Negotiation" />;
  }
  return <FaClock className="text-gray-400" title="In Progress" />;
}
