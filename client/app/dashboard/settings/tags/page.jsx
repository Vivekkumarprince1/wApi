'use client';

import { useState, useEffect } from 'react';
import { FaTags, FaPlus, FaTrash, FaSpinner } from 'react-icons/fa';
import { get, post, del } from '@/lib/api';
import { toast } from 'react-toastify';

export default function TagsSettingsPage() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#10B981' });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const data = await get('/tags');
      setTags(data.tags || data || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const createTag = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    
    try {
      setCreating(true);
      const data = await post('/tags', { name: form.name, color: form.color });
      setTags(prev => [data.tag || data, ...prev]);
      setForm({ name: '', color: '#10B981' });
      toast.success('Tag created');
    } catch (err) {
      toast.error(err.message || 'Failed to create tag');
    } finally {
      setCreating(false);
    }
  };

  const deleteTag = async (id) => {
    if (!confirm('Delete this tag? It will be removed from all contacts.')) return;
    
    try {
      await del(`/tags/${id}`);
      setTags(prev => prev.filter(t => String(t._id || t.id) !== String(id)));
      toast.success('Tag deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete tag');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
          <FaTags className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Categorize contacts with tags</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        <form onSubmit={createTag} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Tag</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="w-16 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded" />
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
              <FaPlus/> Create Tag
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags ({tags.length})</h2>
          {tags.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No tags created yet</p>
          ) : (
          <ul className="space-y-3">
            {tags.map(t => (
              <li key={t._id || t.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.color }} />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{t.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t.contactCount || t.count || 0} contacts</p>
                  </div>
                </div>
                <button onClick={()=>deleteTag(t._id || t.id)} className="text-red-500 hover:text-red-700"><FaTrash/></button>
              </li>
            ))}
          </ul>
          )}
        </div>
      </div>
    </div>
  );
}
