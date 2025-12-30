'use client';

import DealCard from './DealCard';
import { Plus } from 'lucide-react';

export default function PipelineColumn({
  stage,
  deals,
  onDragOver,
  onDrop,
  onAddDeal,
  onDeleteDeal,
  onOpenDetail,
  isLoading,
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.name)}
      className="flex flex-col flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-96"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{stage.name}</h3>
          <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-1 rounded-full">
            {deals.length}
          </span>
        </div>
        <button
          onClick={() => onAddDeal(stage.name)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title="Add deal to this stage"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Deals List (Scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : deals.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-sm">No deals in {stage.name}</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal._id}
              deal={deal}
              stage={stage.name}
              onDelete={onDeleteDeal}
              onOpenDetail={onOpenDetail}
            />
          ))
        )}
      </div>

      {/* Column Footer Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {deals.length > 0 && (
            <div>
              <span className="font-medium">
                ${deals.reduce((sum, deal) => sum + (deal.value || 0), 0).toLocaleString()}
              </span>
              <span> in deals</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
