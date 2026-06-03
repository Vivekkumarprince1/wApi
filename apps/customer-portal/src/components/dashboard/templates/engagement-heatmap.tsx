"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface EngagementHeatmapProps {
  matrix?: number[][];
  maxEngagement?: number;
  isLoading?: boolean;
}

const EngagementHeatmap = ({ matrix = [], maxEngagement = 0, isLoading = false }: EngagementHeatmapProps) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getColorIntensity = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/50';
    const ratio = count / (maxEngagement || 1);
    if (ratio > 0.8) return 'bg-indigo-600 dark:bg-indigo-500';
    if (ratio > 0.6) return 'bg-indigo-500 dark:bg-indigo-600';
    if (ratio > 0.4) return 'bg-indigo-400 dark:bg-indigo-700';
    if (ratio > 0.2) return 'bg-indigo-300 dark:bg-indigo-800';
    return 'bg-indigo-200 dark:bg-indigo-900';
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 bg-slate-50 dark:bg-slate-900/20 animate-pulse rounded-xl flex items-center justify-center">
        <p className="text-slate-400">Loading Behavioral Map...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-border/50 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Engagement Heatmap</h3>
          <p className="text-sm text-slate-500">Intensity of message reads across the week</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-indigo-200 rounded-sm"></div>
            <div className="w-3 h-3 bg-indigo-400 rounded-sm"></div>
            <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header (Hours) */}
          <div className="flex ml-10 mb-2">
            {hours.map((hour) => (
              <div key={hour} className="flex-1 text-[10px] text-slate-400 text-center">
                {hour % 3 === 0 ? `${hour}:00` : ''}
              </div>
            ))}
          </div>

          {/* Rows (Days) */}
          {days.map((day, dayIdx) => (
            <div key={day} className="flex items-center mb-1 group">
              <div className="w-10 text-xs font-medium text-slate-500">{day}</div>
              <div className="flex-1 flex gap-1">
                {matrix[dayIdx]?.map((count, hourIdx) => (
                  <motion.div
                    key={hourIdx}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: (dayIdx * 24 + hourIdx) * 0.001 }}
                    className={`flex-1 h-8 rounded-sm transition-all duration-200 cursor-help ${getColorIntensity(count)} relative group/cell hover:ring-2 hover:ring-indigo-400 hover:z-10`}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover/cell:opacity-100 pointer-events-none whitespace-nowrap z-20">
                      {count} messages read at {hourIdx}:00 on {day}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EngagementHeatmap;
