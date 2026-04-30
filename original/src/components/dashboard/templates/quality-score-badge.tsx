"use client";

import React from 'react';
import { AlertCircle, CheckCircle, ZapOff } from 'lucide-react';

interface QualityScoreBadgeProps {
  score?: string;
  confidence?: number;
  className?: string;
}

const getQualityLabel = (score: string) => {
  switch (score) {
    case 'GREEN': return 'High Quality';
    case 'YELLOW': return 'Medium Quality';
    case 'RED': return 'Low Quality';
    default: return 'Unknown';
  }
};

export default function QualityScoreBadge({ score, confidence = 0, className = '' }: QualityScoreBadgeProps) {
  if (!score) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
        Unknown
      </span>
    );
  }

  const scoreUpper = score.toUpperCase();
  let icon, bgColor, textColor, borderColor;

  switch (scoreUpper) {
    case 'GREEN':
      icon = <CheckCircle size={14} />;
      bgColor = 'bg-emerald-50 dark:bg-emerald-900/20';
      textColor = 'text-emerald-700 dark:text-emerald-400';
      borderColor = 'border-emerald-300 dark:border-emerald-800';
      break;
    case 'YELLOW':
      icon = <AlertCircle size={14} />;
      bgColor = 'bg-amber-50 dark:bg-amber-900/20';
      textColor = 'text-amber-700 dark:text-amber-400';
      borderColor = 'border-amber-300 dark:border-amber-800';
      break;
    case 'RED':
      icon = <ZapOff size={14} />;
      bgColor = 'bg-rose-50 dark:bg-rose-900/20';
      textColor = 'text-rose-700 dark:text-rose-400';
      borderColor = 'border-rose-300 dark:border-rose-800';
      break;
    default:
      bgColor = 'bg-slate-50 dark:bg-slate-800';
      textColor = 'text-slate-700 dark:text-slate-300';
      borderColor = 'border-slate-300 dark:border-slate-700';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bgColor} ${textColor} ${borderColor} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{getQualityLabel(scoreUpper)}</span>
      {confidence > 0 && (
        <span className="text-xs opacity-75">({Math.round(confidence * 100)}%)</span>
      )}
    </span>
  );
}
