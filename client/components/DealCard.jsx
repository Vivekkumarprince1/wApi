'use client';

import { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';

export default function DealCard({ deal, stage, onDelete, onOpenDetail }) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ dealId: deal._id, fromStage: stage }));
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onOpenDetail(deal)}
      className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-2 cursor-move hover:shadow-md dark:hover:shadow-lg transition-shadow group"
    >
      {/* Header: Contact Name */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white flex-1 line-clamp-1">
          {deal.contactName}
        </h4>
        {isHovering && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(deal._id);
            }}
            className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete deal"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Deal Value - if exists */}
      {deal.value && (
        <div className="mb-2 text-sm font-medium text-green-600 dark:text-green-400">
          ${deal.value.toLocaleString()}
        </div>
      )}

      {/* Assigned Agent */}
      {deal.assignedAgent && (
        <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Agent:</span> {deal.assignedAgent}
        </div>
      )}

      {/* Notes Indicator */}
      {deal.notes && deal.notes.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
          <FileText size={12} />
          <span>{deal.notes.length} note{deal.notes.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Created Date */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {new Date(deal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}
