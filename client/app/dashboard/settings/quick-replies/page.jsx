'use client';

import { useState } from 'react';
import { FaKeyboard, FaPlus, FaTrash } from 'react-icons/fa';

export default function QuickRepliesSettingsPage() {
  const [replies, setReplies] = useState([
    { id: 1, title: 'Greeting', shortcut: '/hi', content: 'Hi! How can I help you today?', category: 'General' },
    { id: 2, title: 'Closing', shortcut: '/ty', content: 'Thanks for reaching out. Have a great day!', category: 'General' },
  ]);
  const [form, setForm] = useState({ title: '', shortcut: '', content: '', category: 'General' });

  const createReply = (e) => {
    e.preventDefault();
    setReplies(prev => [{ id: Date.now(), ...form }, ...prev]);
    setForm({ title: '', shortcut: '', content: '', category: 'General' });
    // TODO: Wire to backend API
  };

  const deleteReply = (id) => {
    if (confirm('Delete this quick reply?')) {
      setReplies(prev => prev.filter(r => r.id !== id));
      // TODO: Wire to backend API
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center">
          <FaKeyboard className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Replies</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Create reusable responses for faster replies</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        <form onSubmit={createReply} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Reply</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Shortcut</label>
                <input value={form.shortcut} onChange={(e)=>setForm({...form,shortcut:e.target.value})} placeholder="/hi" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option>General</option>
                  <option>Sales</option>
                  <option>Support</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Content</label>
              <textarea value={form.content} onChange={(e)=>setForm({...form,content:e.target.value})} rows={4} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
              <FaPlus/> Create Reply
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Replies</h2>
          <ul className="space-y-3">
            {replies.map(r => (
              <li key={r.id} className="border border-gray-200 dark:border-gray-700 rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{r.title} <span className="text-xs text-gray-500">({r.category})</span></h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Shortcut: {r.shortcut || '—'}</p>
                    <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">{r.content}</p>
                  </div>
                  <button onClick={()=>deleteReply(r.id)} className="text-red-500 hover:text-red-700"><FaTrash/></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
