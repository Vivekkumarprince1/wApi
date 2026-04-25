'use client';

import React from 'react';
import { AlertCircle, CheckCircle, ZapOff } from 'lucide-react';
import { getQualityLabel } from '@/lib/api';

/**
 * QualityScoreBadge
 * Displays template quality score with visual indicator
 */
export default function QualityScoreBadge({ score, confidence = 0, className = '' }) {
  if (!score) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-300 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
        Unknown
      </span>
    );
  }

  const scoreUpper = score.toUpperCase();
  let icon, bgColor, textColor, borderColor;

  switch (scoreUpper) {
    case 'GREEN':
      icon = <CheckCircle size={14} />;
      bgColor = 'bg-green-50';
      textColor = 'text-green-700';
      borderColor = 'border-green-300';
      break;
    case 'YELLOW':
      icon = <AlertCircle size={14} />;
      bgColor = 'bg-yellow-50';
      textColor = 'text-yellow-700';
      borderColor = 'border-yellow-300';
      break;
    case 'RED':
      icon = <ZapOff size={14} />;
      bgColor = 'bg-red-50';
      textColor = 'text-red-700';
      borderColor = 'border-red-300';
      break;
    default:
      bgColor = 'bg-gray-50';
      textColor = 'text-gray-700';
      borderColor = 'border-gray-300';
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
