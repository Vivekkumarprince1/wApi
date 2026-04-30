"use client";

import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface TemplateAnalyticsChartProps {
  data: any[];
  type?: 'line' | 'bar' | 'pie';
  title?: string;
  dataKey?: string;
  xAxisKey?: string;
}

export default function TemplateAnalyticsChart({ 
  data = [], 
  type = 'line', 
  title = 'Analytics',
  dataKey = 'value',
  xAxisKey = 'name'
}: TemplateAnalyticsChartProps) {
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 0, bottom: 5 },
  };

  switch (type) {
    case 'line':
      return (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value: any) => value.toLocaleString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={dataKey} 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'bar':
      return (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value: any) => value.toLocaleString()}
                />
                <Legend />
                <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'pie':
      return (
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey={dataKey}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => value.toLocaleString()} 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    default:
      return null;
  }
}
