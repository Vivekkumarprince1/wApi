'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INTERNAL NOTES PANEL
 * Agent-only internal notes for conversations - Interakt-style
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { 
  getConversationNotes, 
  createConversationNote, 
  updateConversationNote, 
  deleteConversationNote 
} from '@/lib/api';
import { FaStickyNote, FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaSpinner } from 'react-icons/fa';

interface Note {
  _id: string;
  content: string;
  createdBy: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface InternalNotesPanelProps {
  conversationId: string;
  contactName: string;
}

export default function InternalNotesPanel({ conversationId, contactName }: InternalNotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (conversationId) {
      loadNotes();
    }
  }, [conversationId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await getConversationNotes(conversationId);
      setNotes(data.notes || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setCreating(true);
      const data = await createConversationNote(conversationId, newNote);
      setNotes(prev => [data.note, ...prev]);
      setNewNote('');
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;

    try {
      setSaving(true);
      const data = await updateConversationNote(conversationId, noteId, editContent);
      setNotes(prev => prev.map(n => n._id === noteId ? data.note : n));
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      await deleteConversationNote(conversationId, noteId);
      setNotes(prev => prev.filter(n => n._id !== noteId));
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  const startEditing = (note: Note) => {
    setEditingId(note._id);
    setEditContent(note.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-yellow-100 dark:bg-yellow-800/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FaStickyNote className="text-yellow-600 dark:text-yellow-400" />
          <span className="font-semibold text-yellow-800 dark:text-yellow-200">
            Internal Notes
          </span>
          {notes.length > 0 && (
            <span className="text-xs bg-yellow-200 dark:bg-yellow-700 text-yellow-700 dark:text-yellow-200 px-2 py-0.5 rounded-full">
              {notes.length}
            </span>
          )}
        </div>
        <span className={`text-yellow-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="p-4">
          {/* Add Note Form */}
          <form onSubmit={handleCreateNote} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={`Add note about ${contactName}...`}
                className="flex-1 px-3 py-2 text-sm border border-yellow-300 dark:border-yellow-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={creating || !newNote.trim()}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {creating ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                Add
              </button>
            </div>
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
              ⚠️ Internal notes are only visible to your team, not the customer
            </p>
          </form>

          {/* Notes List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <FaSpinner className="animate-spin text-yellow-500 text-2xl" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
              <FaStickyNote className="text-4xl mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notes yet</p>
              <p className="text-xs mt-1">Add notes to help your team track this conversation</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note._id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700 shadow-sm"
                >
                  {editingId === note._id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-400"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                        >
                          <FaTimes /> Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateNote(note._id)}
                          disabled={saving}
                          className="px-3 py-1 text-sm bg-yellow-500 text-white rounded flex items-center gap-1 hover:bg-yellow-600 disabled:opacity-50"
                        >
                          {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {note.createdBy?.name || 'Unknown'} • {formatDate(note.createdAt)}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(note)}
                            className="text-yellow-600 hover:text-yellow-800 transition-colors"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note._id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
