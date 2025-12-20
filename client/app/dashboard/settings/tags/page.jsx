'use client';

import { useState } from 'react';
import { FaTags, FaPlus, FaTrash } from 'react-icons/fa';

export default function TagsSettingsPage() {
  const [tags, setTags] = useState([
    { id: 1, name: 'VIP', color: '#F59E0B', count: 42 },
    { id: 2, name: 'Lead', color: '#10B981', count: 120 },
  ]);
  const [form, setForm] = useState({ name: '', color: '#10B981' });

  const createTag = (e) => {
    e.preventDefault();
    setTags(prev => [{ id: Date.now(), name: form.name, color: form.color, count: 0 }, ...prev]);
    setForm({ name: '', color: '#10B981' });
    // TODO: Wire to backend API
  };

  const deleteTag = (id) => {
    if (confirm('Delete this tag?')) {
      setTags(prev => prev.filter(t => t.id !== id));
      // TODO: Wire to backend API
    }
  };

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h2>
          <ul className="space-y-3">
            {tags.map(t => (
              <li key={t.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.color }} />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{t.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t.count} contacts</p>
                  </div>
                </div>
                <button onClick={()=>deleteTag(t.id)} className="text-red-500 hover:text-red-700"><FaTrash/></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
