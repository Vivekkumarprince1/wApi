'use client';

import React, { useState, useEffect } from 'react';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import { 
  getDefaultPipeline, 
  createDeal 
} from '@/lib/api';

export default function AddToPipelineModal({ isOpen, onClose, contact, onSuccess }) {
  const [pipeline, setPipeline] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load default pipeline
  useEffect(() => {
    if (isOpen && contact) {
      loadPipeline();
    }
  }, [isOpen, contact]);

  const loadPipeline = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getDefaultPipeline();
      setPipeline(data);
      // Set first stage as default
      if (data.stages && data.stages.length > 0) {
        const firstStage = data.stages.sort((a, b) => a.position - b.position)[0];
        setSelectedStage(firstStage.id);
      }
      // Pre-fill title with contact name
      setTitle(`${contact.firstName || contact.name || contact.phone}`);
    } catch (err) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Deal title is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      
      const dealData = {
        contactId: contact._id,
        pipelineId: pipeline._id,
        title: title.trim(),
        value: value ? parseInt(value) : 0
      };

      const result = await createDeal(dealData);
      
      setSuccess(`Deal created successfully! Contact added to pipeline.`);
      
      // Close modal after 1 second
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess(result.deal);
        // Reset form
        setTitle('');
        setValue('');
        setSuccess('');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to create deal');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Add to Sales Pipeline
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <FaSpinner className="animate-spin text-teal-600 text-2xl" />
            </div>
          ) : (
            <form onSubmit={handleCreateDeal} className="space-y-4">
              {/* Contact Info */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Contact</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {contact.firstName} {contact.lastName} ({contact.phone})
                </p>
              </div>

              {/* Pipeline Name */}
              {pipeline && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pipeline
                  </label>
                  <p className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium">
                    {pipeline.name}
                  </p>
                </div>
              )}

              {/* Starting Stage */}
              {pipeline && pipeline.stages && pipeline.stages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Starting Stage
                  </label>
                  <p className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium">
                    {pipeline.stages.find(s => s.id === selectedStage)?.title || 'Select stage'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Deal will start in the first stage of the pipeline
                  </p>
                </div>
              )}

              {/* Deal Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 Project"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  disabled={creating}
                />
              </div>

              {/* Deal Value (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deal Value (Optional)
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g., 50000"
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  disabled={creating}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={creating || !title.trim()}
                >
                  {creating ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Add to Pipeline'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
