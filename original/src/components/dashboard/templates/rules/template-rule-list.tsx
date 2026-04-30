'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TemplateRuleCard from './template-rule-card';
import { Loader2 } from 'lucide-react';
import { TemplateRule, TemplateRuleSummaryStats } from '@/lib/api/templates';
const FlashLoader = () => <div className="p-12 flex justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;

/**
 * TemplateRuleList
 * Display paginated list of template rules
 */
interface TemplateRuleListProps {
  rules?: TemplateRule[];
  loading?: boolean;
  pagination?: { page: number; pageSize: number; total: number };
  onEdit?: (rule: TemplateRule) => void;
  onDelete?: (ruleId: string) => void;
  onToggle?: (ruleId: string, enabled: boolean) => void;
  onTest?: (ruleId: string) => void | Promise<void>;
  onStats?: (ruleId: string) => Promise<TemplateRuleSummaryStats | null>;
  onPageChange?: (page: number) => void;
}

export default function TemplateRuleList({
  rules = [],
  loading = false,
  pagination = { page: 1, pageSize: 10, total: 0 },
  onEdit,
  onDelete,
  onToggle,
  onTest,
  onStats,
  onPageChange
}: TemplateRuleListProps) {
  if (loading) return <FlashLoader />;

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No template rules yet</p>
        <p className="text-gray-400 text-sm mt-2">Create your first rule to auto-trigger templates</p>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const currentPage = pagination.page || 1;

  return (
    <div className="space-y-4">
      {/* Rules Grid */}
      <div className="grid gap-4">
        {rules.map((rule) => (
          <TemplateRuleCard
            key={rule._id}
            rule={rule}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
            onTest={onTest}
            onStats={onStats}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <button
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
