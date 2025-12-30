'use client';

import React, { useState, useEffect } from 'react';
import { 
  FaTimes, 
  FaSpinner, 
  FaTrash, 
  FaPlus 
} from 'react-icons/fa';
import { 
  getDealsByContact, 
  moveDealStage, 
  addDealNote, 
  deleteDeal,
  getPipeline
} from '@/lib/api';

export default function ContactDetailModal({ isOpen, onClose, contact, onAddToPipeline }) {
  const [deals, setDeals] = useState([]);
  const [activeDeal, setActiveDeal] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);

  // Load deal data when modal opens
  useEffect(() => {
    if (isOpen && contact) {
      loadDealData();
    }
  }, [isOpen, contact]);

  // Load pipeline when active deal changes
  useEffect(() => {
    if (activeDeal && activeDeal.pipeline) {
      loadPipeline(activeDeal.pipeline);
    }
  }, [activeDeal]);

  const loadDealData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getDealsByContact(contact._id);
      const allDeals = response.deals || [];
      setDeals(allDeals);
      
      // Get active deal if exists
      const active = allDeals.find(d => d.status === 'active');
      setActiveDeal(active || null);
    } catch (err) {
      setError(err.message || 'Failed to load deal data');
    } finally {
      setLoading(false);
    }
  };

  const loadPipeline = async (pipelineId) => {
    try {
      const data = await getPipeline(pipelineId);
      setPipeline(data);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    }
  };

  const handleMoveStage = async (newStageId) => {
    if (!activeDeal) return;

    try {
      setUpdatingStage(true);
      setError('');
      const result = await moveDealStage(activeDeal._id, newStageId);
      setActiveDeal(result.deal);
      setDeals(prev => prev.map(d => d._id === result.deal._id ? result.deal : d));
    } catch (err) {
      setError(err.message || 'Failed to move deal');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !activeDeal) return;

    try {
      setAddingNote(true);
      setError('');
      const result = await addDealNote(activeDeal._id, newNote.trim());
      setActiveDeal(result.deal);
      setDeals(prev => prev.map(d => d._id === result.deal._id ? result.deal : d));
      setNewNote('');
    } catch (err) {
      setError(err.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteDeal = async () => {
    if (!activeDeal || !confirm('Delete this deal? This cannot be undone.')) return;

    try {
      setLoading(true);
      setError('');
      await deleteDeal(activeDeal._id);
      setActiveDeal(null);
      setDeals(prev => prev.filter(d => d._id !== activeDeal._id));
    } catch (err) {
      setError(err.message || 'Failed to delete deal');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {contact.firstName} {contact.lastName}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{contact.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Contact Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white">{contact.email || '-'}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                Tags
              </label>
              <p className="text-gray-900 dark:text-white">
                {contact.tags && contact.tags.length > 0 ? contact.tags.join(', ') : '-'}
              </p>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Sales CRM Section */}
          <div className="bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-teal-200 dark:border-teal-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sales CRM
            </h3>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <FaSpinner className="animate-spin text-teal-600 text-2xl" />
              </div>
            ) : !activeDeal ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  No active deal for this contact
                </p>
                <button
                  onClick={() => {
                    onClose();
                    if (onAddToPipeline) onAddToPipeline(contact);
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                  <FaPlus /> Add to Pipeline
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pipeline & Stage Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                      Pipeline
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {pipeline?.name || 'Loading...'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                      Current Stage
                    </label>
                    {pipeline && pipeline.stages ? (
                      <select
                        value={activeDeal.stage}
                        onChange={(e) => handleMoveStage(e.target.value)}
                        disabled={updatingStage}
                        className="w-full px-3 py-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                      >
                        {pipeline.stages.map(stage => (
                          <option key={stage.id} value={stage.id}>
                            {stage.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-gray-900 dark:text-white">{activeDeal.stage}</p>
                    )}
                  </div>
                </div>

                {/* Deal Value & Assigned Agent */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                      Deal Value
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {activeDeal.currency} {activeDeal.value?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                      Assigned Agent
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {activeDeal.assignedAgent?.name || '-'}
                    </p>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="border-t border-teal-200 dark:border-teal-800 pt-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Notes</h4>
                  
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 px-3 py-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      disabled={addingNote}
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                      disabled={addingNote || !newNote.trim()}
                    >
                      {addingNote ? <FaSpinner className="animate-spin" /> : 'Add'}
                    </button>
                  </form>

                  {/* Notes List */}
                  {activeDeal.notes && activeDeal.notes.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeDeal.notes.map((note, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-900 dark:text-white">{note.text}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {note.author?.name && `by ${note.author.name}`}
                            {note.createdAt && ` • ${new Date(note.createdAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No notes yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Delete Deal Button */}
            {activeDeal && (
              <div className="mt-6 pt-6 border-t border-teal-200 dark:border-teal-800">
                <button
                  onClick={handleDeleteDeal}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm transition-colors"
                >
                  <FaTrash /> Delete Deal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
