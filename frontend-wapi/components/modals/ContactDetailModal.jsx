'use client';

import React, { useState, useEffect } from 'react';
import { 
  FaTimes, 
  FaSpinner, 
  FaTrash, 
  FaPlus,
  FaCalendarAlt,
  FaTag,
  FaTasks
} from 'react-icons/fa';
import { 
  getDealsByContact, 
  moveDealStage, 
  addDealNote, 
  deleteDeal,
  getPipeline,
  getContactEvents,
  getContactSettings,
  updateContact,
  deleteContact
} from '@/lib/api';

export default function ContactDetailModal({ isOpen, onClose, contact, onAddToPipeline, onUpdate }) {
  const [deals, setDeals] = useState([]);
  const [activeDeal, setActiveDeal] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [settings, setSettings] = useState(null);
  const [editableContact, setEditableContact] = useState(null);
  const [savingContact, setSavingContact] = useState(false);

  // Load deal data & events when modal opens
  useEffect(() => {
    if (isOpen && contact) {
      loadDealData();
      loadEventsData();
      loadSettings();
      setEditableContact({ ...contact, customFields: contact.customFields || {} });
    }
  }, [isOpen, contact]);

  // Load pipeline when active deal changes
  useEffect(() => {
    if (activeDeal && activeDeal.pipeline) {
      const pipelineId = typeof activeDeal.pipeline === 'object' ? activeDeal.pipeline._id : activeDeal.pipeline;
      if (pipelineId) {
        loadPipeline(pipelineId);
      }
    }
  }, [activeDeal]);

  const loadSettings = async () => {
    try {
      const res = await getContactSettings();
      setSettings(res?.data || null);
    } catch(err) {}
  };

  const handleContactUpdate = async (field, value) => {
    try {
      setSavingContact(true);
      const newData = { ...editableContact, [field]: value };
      setEditableContact(newData);
      await updateContact,
  deleteContact(contact._id || contact.id, { [field]: value });
    } catch(err) {
      console.error(err);
    } finally {
      setSavingContact(false);
    }
  };

  const handleCustomFieldUpdate = async (key, value) => {
    try {
      setSavingContact(true);
      const newCustomFields = { ...editableContact.customFields, [key]: value };
      setEditableContact({ ...editableContact, customFields: newCustomFields });
      await updateContact,
  deleteContact(contact._id || contact.id, { customFields: newCustomFields });
    } catch(err) {
      console.error(err);
    } finally {
      setSavingContact(false);
    }
  };

  const loadDealData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getDealsByContact(contact._id || contact.id);
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

  const loadEventsData = async () => {
    try {
      setLoadingEvents(true);
      const response = await getContactEvents(contact._id || contact.id);
      setEvents(response.data || response || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
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



  const handleDeleteContact = async () => {
    if (!confirm('Are you sure you want to completely delete this contact? This action cannot be undone.')) return;
    try {
      setLoading(true);
      await deleteContact(contact.id || contact._id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete contact');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-card rounded-lg shadow-xl max-w-5xl w-full mx-4 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              {contact.firstName || contact.metadata?.firstName} {contact.lastName || contact.metadata?.lastName}
              {settings?.leadStatuses && settings.leadStatuses.length > 0 ? (
                <div className="flex items-center gap-1">
                  <select 
                    title="Change Lead Status"
                    value={editableContact?.leadStatus || 'new'}
                    onChange={e => handleContactUpdate('leadStatus', e.target.value)}
                    disabled={savingContact}
                    className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-none outline-none cursor-pointer appearance-none text-center min-w-[100px]"
                  >
                    {settings.leadStatuses.map(s => (
                      <option key={s.key || s} value={s.key || s}>
                        {s.label || s}
                      </option>
                    ))}
                  </select>
                  {savingContact && <FaSpinner className="animate-spin text-muted-foreground w-3 h-3" />}
                </div>
              ) : (
                contact.leadStatus && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {contact.leadStatus}
                  </span>
                )
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{contact.phone}</p>
          </div>
          <div className="flex items-start gap-3">
            <button
              onClick={handleDeleteContact}
              className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
              title="Delete Contact"
            >
              <FaTrash />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
          
          {/* LEFT COLUMN: Info */}
          <div className="flex-1 space-y-6">
            {/* Contact Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Email
                </label>
                <p className="text-foreground">{contact.email || contact.metadata?.email || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {contact.tags && contact.tags.length > 0 ? (
                    contact.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md flex items-center gap-1">
                        <FaTag className="text-[10px]" /> {tag}
                      </span>
                    ))
                  ) : '-'}
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            {(settings?.customFieldDefinitions?.length > 0 || (contact.customFields && Object.keys(contact.customFields).length > 0)) && (
              <div className="bg-gray-50 border border-gray-100 dark:bg-[#1a1c23] dark:border-gray-800 p-4 rounded-lg">
                <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider flex items-center justify-between">
                  Custom Fields
                  {savingContact && <FaSpinner className="animate-spin text-muted-foreground w-3 h-3" />}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Dynamic Fields from Settings */}
                  {settings?.customFieldDefinitions?.map(def => (
                    <div key={def.key}>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                        {def.label || def.key} {def.type === 'number' && '(123)'} {def.type === 'date' && '(Date)'}
                      </label>
                      {def.type === 'boolean' ? (
                        <select 
                           value={(editableContact?.customFields && editableContact.customFields[def.key]) ? 'true' : 'false'} 
                           onChange={e => handleCustomFieldUpdate(def.key, e.target.value === 'true')}
                           className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded text-sm w-full p-2 h-9 text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                           disabled={savingContact}
                        >
                          <option value="false">No</option>
                          <option value="true">Yes</option>
                        </select>
                      ) : (
                        <input 
                           type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
                           className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded text-sm w-full p-2 h-9 text-foreground placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                           value={(editableContact?.customFields && editableContact.customFields[def.key]) || ''}
                           onChange={e => handleCustomFieldUpdate(def.key, e.target.value)}
                           onBlur={e => handleCustomFieldUpdate(def.key, e.target.value)}
                           disabled={savingContact}
                           placeholder="-"
                        />
                      )}
                    </div>
                  ))}

                  {/* Legacy/Unknown Fields not in settings but on contact */}
                  {contact.customFields && Object.entries(contact.customFields).filter(([key]) => !settings?.customFieldDefinitions?.some(d => d.key === key)).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                        {key}
                      </label>
                      <input 
                        type="text" 
                        value={value || ''} 
                        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded text-sm w-full p-2 h-9 text-foreground opacity-70"
                        readOnly 
                        disabled
                        title="Legacy field - can only be viewed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Timeline */}
            <div className="pt-4 mt-4 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <FaCalendarAlt className="text-gray-400" /> Event Timeline
              </h3>
              
              {loadingEvents ? (
                <div className="flex justify-center py-4">
                  <FaSpinner className="animate-spin text-teal-600" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground italic pl-6">No events recorded.</p>
              ) : (
                <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-6">
                  {events.map((event, idx) => (
                    <div key={idx} className="relative pl-6">
                      {/* Timeline dot */}
                      <div className="absolute w-3 h-3 bg-teal-500 rounded-full -left-[7px] top-1.5 border-2 border-white dark:border-card" />
                      <div className="bg-white dark:bg-muted p-3 rounded-lg border border-gray-100 dark:border-border shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-semibold text-foreground capitalize">{event.type}</h4>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.createdAt || event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {event.description || (event.details && JSON.stringify(event.details)) || 'Event recorded'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Divider on MD */}
          <div className="hidden md:block w-px bg-border shrink-0" />

          {/* RIGHT COLUMN: CRM */}
          <div className="w-full md:w-[350px] shrink-0 space-y-6 flex flex-col">

            {/* Sales CRM Section */}
            <div className="bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-xl p-5 border border-teal-200 dark:border-teal-800/50 shadow-sm flex-1">
              <h3 className="text-lg font-bold text-teal-800 dark:text-teal-400 mb-4 flex items-center gap-2">
                <FaTasks /> Sales CRM
              </h3>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <FaSpinner className="animate-spin text-teal-600 text-2xl" />
              </div>
            ) : !activeDeal ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No active deal for this contact
                </p>
                <button
                  onClick={() => {
                    onClose();
                    if (onAddToPipeline) onAddToPipeline(contact);
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-primary/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                  <FaPlus /> Add to Pipeline
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pipeline & Stage Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Pipeline
                    </label>
                    <p className="text-foreground font-medium">
                      {pipeline?.name || 'Loading...'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Current Stage
                    </label>
                    {pipeline && pipeline.stages ? (
                      <select
                        value={activeDeal.stage}
                        onChange={(e) => handleMoveStage(e.target.value)}
                        disabled={updatingStage}
                        className="w-full px-3 py-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        {pipeline.stages.map(stage => (
                          <option key={stage.id} value={stage.id}>
                            {stage.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-foreground">{activeDeal.stage}</p>
                    )}
                  </div>
                </div>

                {/* Deal Value & Assigned Agent */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Deal Value
                    </label>
                    <p className="text-foreground font-medium">
                      {activeDeal.currency} {activeDeal.value?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Assigned Agent
                    </label>
                    <p className="text-foreground">
                      {activeDeal.assignedAgent?.name || '-'}
                    </p>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="border-t border-teal-200 dark:border-teal-800 pt-4">
                  <h4 className="font-semibold text-foreground mb-3">Notes</h4>
                  
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 px-3 py-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-muted text-foreground placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                      disabled={addingNote}
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-teal-600 hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                      disabled={addingNote || !newNote.trim()}
                    >
                      {addingNote ? <FaSpinner className="animate-spin" /> : 'Add'}
                    </button>
                  </form>

                  {/* Notes List */}
                  {activeDeal.notes && activeDeal.notes.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeDeal.notes.map((note, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-muted rounded-lg border border-gray-200 dark:border-border">
                          <p className="text-sm text-foreground">{note.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {note.author?.name && `by ${note.author.name}`}
                            {note.createdAt && ` • ${new Date(note.createdAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No notes yet</p>
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
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0 bg-gray-50 dark:bg-[#1a1c23] rounded-b-lg">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-border bg-white dark:bg-muted text-foreground font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
