'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, updateProfile } from '@/lib/api';
import { toast } from 'react-toastify';
import { FaUser, FaSave } from 'react-icons/fa';

export default function MemberProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        if (user) {
          setForm({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile(form);
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
          <FaUser className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Member Profile</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage your profile and credentials</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4">
        {loading ? (
          <div className="text-gray-600 dark:text-gray-300">Loading...</div>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
              <FaSave/> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
