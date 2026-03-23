'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, TrendingDown } from 'lucide-react';

/**
 * QualityIssuesPanel
 * Displays quality issues and recommendations
 */
export default function QualityIssuesPanel({ issues = [], recommendations = [] }) {
  if (!issues || issues.length === 0) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-700">✓ No quality issues detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Issues Section */}
      {issues.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-600" />
            <h4 className="font-medium text-red-900">Quality Issues</h4>
          </div>
          <ul className="space-y-2">
            {issues.map((issue, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-red-700">
                <span className="mt-1">•</span>
                <div>
                  <p className="font-medium">{issue.type || 'Issue'}</p>
                  <p className="text-red-600">{issue.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations Section */}
      {recommendations && recommendations.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-blue-600" />
            <h4 className="font-medium text-blue-900">Recommendations</h4>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
