'use client';

import React, { useState } from 'react';
import { Zap, Trash2, Edit, Play, Eye, ToggleRight, ToggleLeft } from 'lucide-react';
import { TRIGGER_TYPES, TemplateRule, TemplateRuleSummaryStats } from '@/lib/api/templates';

/**
 * TemplateRuleCard
 * Display individual template rule with actions
 */
interface TemplateRuleCardProps {
  rule: TemplateRule;
  onEdit?: (rule: TemplateRule) => void;
  onDelete?: (ruleId: string) => void;
  onToggle?: (ruleId: string, enabled: boolean) => void;
  onTest?: (ruleId: string) => void | Promise<void>;
  onStats?: (ruleId: string) => Promise<TemplateRuleSummaryStats | null>;
}

export default function TemplateRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  onStats
}: TemplateRuleCardProps) {
  const [stats, setStats] = useState<TemplateRuleSummaryStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const triggerLabel = TRIGGER_TYPES.find(t => t.value === rule.triggerType)?.label || rule.triggerType;
  const templateName = typeof rule.template === 'string' ? undefined : rule.template?.name;

  const handleShowStats = async () => {
    if (onStats) {
      const statsData = await onStats(rule._id);
      setStats(statsData);
      setShowStats(Boolean(statsData));
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-blue-600" />
            <h3 className="font-medium text-gray-900">{rule.name}</h3>
            {rule.enabled ? (
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
            ) : (
              <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle && onToggle(rule._id, !rule.enabled)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? (
              <ToggleRight size={20} className="text-green-600" />
            ) : (
              <ToggleLeft size={20} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={() => onEdit && onEdit(rule)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            title="Edit rule"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete && onDelete(rule._id)}
            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-600"
            title="Delete rule"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
            {triggerLabel}
          </span>
          {templateName && (
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              📨 {templateName}
            </span>
          )}
          {rule.rateLimit?.enabled && (
            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">
              Rate limit: {rule.rateLimit.maxTriggers}/{rule.rateLimit.window}h
            </span>
          )}
        </div>

        {/* Keywords if applicable */}
        {rule.keywords && rule.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rule.keywords.map((keyword: any, idx: number) => (
              <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats Preview */}
      {stats && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.successful || 0}</p>
              <p className="text-xs text-gray-600">Successful</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.failed || 0}</p>
              <p className="text-xs text-gray-600">Failed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.skipped || 0}</p>
              <p className="text-xs text-gray-600">Skipped</p>
            </div>
          </div>
          {stats.lastErrors && stats.lastErrors.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-medium text-red-700">Recent Errors:</p>
              <ul className="text-xs text-gray-600 mt-1 space-y-1">
                {stats.lastErrors.slice(0, 2).map((err: any, idx: any) => (
                  <li key={idx} className="text-red-600">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleShowStats}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          title="View rule statistics"
        >
          <Eye size={16} />
          {showStats ? 'Hide Stats' : 'View Stats'}
        </button>
        <button
          onClick={() => onTest && onTest(rule._id)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
          title="Test rule without sending"
        >
          <Play size={16} />
          Test Rule
        </button>
      </div>
    </div>
  );
}
