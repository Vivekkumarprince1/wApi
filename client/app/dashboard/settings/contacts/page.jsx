'use client';

import { useState } from 'react';
import { FaAddressBook, FaSave } from 'react-icons/fa';

export default function ContactsSettingsPage() {
  const [form, setForm] = useState({
    duplicateDetection: 'phone',
    requireOptIn: true,
    importDefaultTag: 'Lead',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Saved (placeholder)');
    // TODO: Wire to backend API
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
          <FaAddressBook className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Settings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Control how contacts are handled</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Duplicate Detection</label>
          <select value={form.duplicateDetection} onChange={(e)=>setForm({...form,duplicateDetection:e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="phone">Phone Only</option>
            <option value="phone-email">Phone or Email</option>
            <option value="none">None</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How to detect duplicates during import and creation.</p>
        </div>

        <div className="flex items-center gap-2">
          <input id="optin" type="checkbox" checked={form.requireOptIn} onChange={(e)=>setForm({...form,requireOptIn:e.target.checked})} />
          <label htmlFor="optin" className="text-sm text-gray-700 dark:text-gray-300">Require explicit opt-in for messaging</label>
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Default Tag on Import</label>
          <input value={form.importDefaultTag} onChange={(e)=>setForm({...form,importDefaultTag:e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>

        <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          <FaSave/> Save Settings
        </button>
      </form>
    </div>
  );
}
