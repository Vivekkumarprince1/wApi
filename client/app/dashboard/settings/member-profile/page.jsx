'use client';

import { useEffect, useState } from 'react';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { toast } from 'react-toastify';
import { FaUser, FaSave } from 'react-icons/fa';

export default function MemberProfileSettingsPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!authLoading && authUser) {
      setForm({ name: authUser.name || '', email: authUser.email || '', phone: '' });
    }
  }, [authUser, authLoading]);

  const loading = authLoading;

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
    <div className=" p-6">
      <div className="max-w-xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
          <FaUser className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Member Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and credentials</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-card rounded-xl shadow-premium p-6 space-y-4">
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div>
              <label className="block text-sm text-foreground mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-muted text-white rounded-xl hover:bg-gray-800 disabled:opacity-50">
              <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
