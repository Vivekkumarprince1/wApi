"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Mock deals per stage
const initialDeals = {
  "new-lead": [
    { id: 1, name: "Acme Corp Intro", value: 5000, owner: "Vivek", updated: "Today" },
    { id: 2, name: "Globex Cold Outreach", value: 2500, owner: "Aditi", updated: "1d ago" },
  ],
  qualification: [
    { id: 3, name: "Initech Discovery", value: 12000, owner: "Rahul", updated: "2d ago" },
  ],
  "needs-analysis": [
    { id: 4, name: "Umbrella Requirements", value: 8500, owner: "Vivek", updated: "3d ago" },
  ],
  proposal: [
    { id: 5, name: "Umbrella Proposal", value: 18000, owner: "Vivek", updated: "4d ago" },
    { id: 6, name: "Soylent Pricing", value: 9000, owner: "Aditi", updated: "3d ago" },
  ],
  negotiation: [
    { id: 7, name: "Initech Final Terms", value: 15000, owner: "Rahul", updated: "1d ago" },
  ],
  "closed-won": [
    { id: 8, name: "Hooli Subscription", value: 30000, owner: "Vivek", updated: "7d ago" },
  ],
  "closed-lost": [
    { id: 9, name: "Stark Industries", value: 15000, owner: "Rahul", updated: "5d ago" },
  ],
};

const stages = [
  { key: "new-lead", label: "New Lead", color: "#EF4444" },
  { key: "qualification", label: "Qualification", color: "#F59E0B" },
  { key: "needs-analysis", label: "Needs Analysis", color: "#3B82F6" },
  { key: "proposal", label: "Proposal", color: "#8B5CF6" },
  { key: "negotiation", label: "Negotiation", color: "#EC4899" },
  { key: "closed-won", label: "Closed Won", color: "#10B981" },
  { key: "closed-lost", label: "Closed Lost", color: "#EF4444" },
];

export default function SalesPipelinePage() {
  const [deals, setDeals] = useState(initialDeals);
  const [activeStage, setActiveStage] = useState("new-lead");
  const [sortBy, setSortBy] = useState("descending");
  const [filterContact, setFilterContact] = useState("All");

  const contacts = ["All", ...Array.from(new Set(Object.values(initialDeals).flat().map(d => d.owner)))];

  const filteredDeals = () => {
    let filtered = deals[activeStage] || [];
    
    if (filterContact !== "All") {
      filtered = filtered.filter(d => d.owner === filterContact);
    }

    if (sortBy === "ascending") {
      filtered = [...filtered].sort((a, b) => a.value - b.value);
    } else {
      filtered = [...filtered].sort((a, b) => b.value - a.value);
    }

    return filtered;
  };

  const currentStageData = stages.find(s => s.key === activeStage);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Pipelines</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              You can track and manage your Contacts (Leads) at all stages of your sales cycle here
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <select
            value={filterContact}
            onChange={(e) => setFilterContact(e.target.value)}
            className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            {contacts.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "Cont..." : c}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="descending">Descending</option>
            <option value="ascending">Ascending</option>
          </select>

          <button className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
            Filters <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pipeline Stages Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="flex px-6 gap-0">
          {stages.map((stage) => (
            <button
              key={stage.key}
              onClick={() => setActiveStage(stage.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeStage === stage.key
                  ? `border-b-2 text-gray-900 dark:text-white`
                  : `border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300`
              }`}
              style={
                activeStage === stage.key
                  ? { borderBottomColor: stage.color }
                  : {}
              }
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: stage.color }}
              />
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {filteredDeals().length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No deals in this stage</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredDeals().map((deal) => (
              <div
                key={deal.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">{deal.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Owner: {deal.owner}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">
                      ₹{deal.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{deal.updated}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
