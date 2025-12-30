'use client';

import { useState, useEffect } from 'react';
import PipelineColumn from './PipelineColumn';
import ContactDetailModal from './ContactDetailModal';
import LoadingSpinner from './LoadingSpinner';
import { AlertCircle } from 'lucide-react';

export default function KanbanBoard({
  pipelineId,
  pipeline,
  deals,
  isLoading,
  onMoveDeal,
  onDeleteDeal,
  onAddDeal,
}) {
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Clear error after 5 seconds
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, toStage) => {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { dealId, fromStage } = data;

      // Don't move if dropping in same stage
      if (fromStage === toStage) return;

      // Optimistic UI update
      setDraggedDeal(null);

      // Call backend to move deal
      await onMoveDeal(dealId, toStage);
    } catch (err) {
      console.error('Drop error:', err);
      setError('Failed to move deal. Please try again.');
      setDraggedDeal(null);
    }
  };

  const handleOpenDetail = (deal) => {
    setSelectedDeal(deal);
    setDetailModalOpen(true);
  };

  const handleDetailClose = () => {
    setDetailModalOpen(false);
    setSelectedDeal(null);
  };

  if (isLoading && !pipeline) {
    return <LoadingSpinner />;
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
        <p>Select a pipeline to view deals</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Pipeline Info */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {pipeline.name}
        </h2>
        {pipeline.description && (
          <p className="text-gray-600 dark:text-gray-400">{pipeline.description}</p>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 pb-4">
          {pipeline.stages && pipeline.stages.length > 0 ? (
            pipeline.stages.map((stage) => {
              const stageDeals = deals.filter((deal) => deal.stage === stage.name);
              return (
                <PipelineColumn
                  key={stage._id}
                  stage={stage}
                  deals={stageDeals}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onAddDeal={onAddDeal}
                  onDeleteDeal={onDeleteDeal}
                  onOpenDetail={handleOpenDetail}
                  isLoading={isLoading}
                />
              );
            })
          ) : (
            <div className="flex items-center justify-center w-full h-96 text-gray-500 dark:text-gray-400">
              <p>No stages configured for this pipeline</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailModalOpen && selectedDeal && (
        <ContactDetailModal
          contactId={selectedDeal.contactId}
          onClose={handleDetailClose}
        />
      )}
    </div>
  );
}
