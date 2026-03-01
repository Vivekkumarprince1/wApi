'use client';

import { useState, useEffect } from 'react';
import { FaKeyboard, FaPlus, FaTrash, FaSpinner } from 'react-icons/fa';
import { get, post, del } from '@/lib/api';
import { toast } from 'react-toastify';
import FeatureGate from '@/components/FeatureGate';

function QuickRepliesContent() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', shortcut: '', content: '', category: 'General' });

  useEffect(() => {
    loadReplies();
  }, []);

  const loadReplies = async () => {
    try {
      setLoading(true);
      const data = await get('/quick-replies');
      const replyList = Array.isArray(data) ? data : (data?.replies || []);
      setReplies(replyList);
    } catch (err) {
      console.error('Failed to load quick replies:', err);
      // API may not exist yet - show empty state
      setReplies([]);
    } finally {
      setLoading(false);
    }
  };

  const createReply = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    
    try {
      setCreating(true);
      const data = await post('/quick-replies', form);
      setReplies(prev => [data.reply || data, ...prev]);
      setForm({ title: '', shortcut: '', content: '', category: 'General' });
      toast?.success?.('Quick reply created');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to create quick reply');
    } finally {
      setCreating(false);
    }
  };

  const deleteReply = async (id) => {
    if (!confirm('Delete this quick reply?')) return;
    
    try {
      await del(`/quick-replies/${id}`);
      setReplies(prev => prev.filter(r => String(r._id || r.id) !== String(id)));
      toast?.success?.('Quick reply deleted');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to delete quick reply');
    }
  };

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-cyan-600" />
      </div>
    );
  }

  return (
    <div className=" p-6">
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center">
          <FaKeyboard className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quick Replies</h1>
          <p className="text-sm text-muted-foreground">Create reusable responses for faster replies</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        <form onSubmit={createReply} className="bg-card rounded-xl shadow-premium p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Create Reply</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-foreground mb-1">Title</label>
              <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required placeholder="e.g., Greeting" className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-foreground mb-1">Shortcut</label>
                <input value={form.shortcut} onChange={(e)=>setForm({...form,shortcut:e.target.value})} placeholder="/hi" className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Category</label>
                <select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground">
                  <option>General</option>
                  <option>Sales</option>
                  <option>Support</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Content</label>
              <textarea value={form.content} onChange={(e)=>setForm({...form,content:e.target.value})} rows={4} required placeholder="Type your message template..." className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <button type="submit" disabled={creating} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 disabled:opacity-50">
              {creating ? <FaSpinner className="animate-spin" /> : <FaPlus/>} 
              {creating ? 'Creating...' : 'Create Reply'}
            </button>
          </div>
        </form>

        <div className="bg-card rounded-xl shadow-premium p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Replies ({replies.length})</h2>
          {replies.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No quick replies yet. Create your first one!</p>
          ) : (
            <ul className="space-y-3 max-h-[500px] overflow-y-auto">
              {replies.map(r => (
                <li key={String(r._id || r.id)} className="border border-border rounded p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{r.title} <span className="text-xs text-muted-foreground">({r.category})</span></h3>
                      <p className="text-xs text-muted-foreground">Shortcut: {r.shortcut || '—'}</p>
                      <p className="mt-2 text-sm text-foreground line-clamp-2">{r.content}</p>
                    </div>
                    <button onClick={()=>deleteReply(r._id || r.id)} className="ml-2 text-destructive hover:text-destructive/80"><FaTrash/></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuickRepliesSettingsPage() {
  return (
    <FeatureGate feature="quick-replies" comingSoon>
      <QuickRepliesContent />
    </FeatureGate>
  );
}
