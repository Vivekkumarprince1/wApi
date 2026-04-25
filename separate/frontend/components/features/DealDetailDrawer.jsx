'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, DollarSign, Calendar, User, Tag, 
  History, MessageSquare, Trash2, 
  ShieldCheck, TrendingUp, Clock, Info
} from 'lucide-react';
import { getDeal, addDealNote, deleteDeal, updateDeal } from '@/lib/api/sales';
import { toast } from 'react-hot-toast';

const DealDetailDrawer = ({ dealId, isOpen, onClose, onUpdate }) => {
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (isOpen && dealId) {
      fetchDealDetails();
    }
  }, [isOpen, dealId]);

  const fetchDealDetails = async () => {
    try {
      setLoading(true);
      const data = await getDeal(dealId);
      setDeal(data);
    } catch (error) {
      toast.error('Failed to load deal details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setSubmittingNote(true);
      await addDealNote(dealId, newNote);
      setNewNote('');
      await fetchDealDetails();
      toast.success('Note added');
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Drawer Content */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                <ShieldCheck size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Deal Intelligence</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead ID: {dealId}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 opacity-50">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Analyzing Deal Pipeline...</p>
              </div>
            ) : deal && (
              <>
                {/* Basic Info */}
                <section>
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Core Metadata</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard icon={<DollarSign size={14}/>} label="Market Value" value={`₹${deal.value?.toLocaleString()}`} />
                    <InfoCard icon={<TrendingUp size={14}/>} label="Win Prob." value={`${deal.probability || 10}%`} />
                    <InfoCard icon={<User size={14}/>} label="Assigned To" value={deal.assignedAgent?.name || 'Unassigned'} />
                    <InfoCard icon={<Calendar size={14}/>} label="Expected Close" value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'N/A'} />
                  </div>
                </section>

                {/* Attribution Section */}
                <section className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Tag size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lead Attribution</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Source Channel</p>
                      <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400 capitalize">{deal.source || 'Manual CRM entry'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Identified At</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(deal.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </section>

                {/* Activity Feed */}
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <History size={16} className="text-slate-400" />
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Activity Timeline</h3>
                  </div>
                  <div className="space-y-6 relative ml-2">
                    <div className="absolute left-0 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800" />
                    {deal.activityLog && deal.activityLog.length > 0 ? (
                      deal.activityLog.slice().reverse().map((log, idx) => (
                        <div key={idx} className="relative pl-6">
                          <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{log.text}</p>
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            <Clock size={10} />
                            {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
                    )}
                  </div>
                </section>

                {/* Notes Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare size={16} className="text-slate-400" />
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Context & Notes</h3>
                  </div>
                  
                  <div className="space-y-4 mb-4">
                    {deal.notes?.map((note, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{note.text}</p>
                        <div className="flex items-center justify-between mt-3 text-[10px] font-black text-slate-400 uppercase">
                          <span>{note.author?.name || 'System'}</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddNote} className="relative">
                    <textarea 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a dynamic note for the team..."
                      className="w-full p-4 bg-slate-100 dark:bg-slate-800/60 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all resize-none min-h-[100px]"
                    />
                    <button 
                      type="submit"
                      disabled={submittingNote || !newNote.trim()}
                      className="absolute bottom-3 right-3 px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                      {submittingNote ? 'Saving...' : 'Post Note'}
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const InfoCard = ({ icon, label, value }) => (
  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
    <div className="flex items-center gap-2 text-slate-400 mb-2">
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{value}</p>
  </div>
);

export default DealDetailDrawer;
