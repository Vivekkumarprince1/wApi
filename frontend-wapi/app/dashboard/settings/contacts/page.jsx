'use client';

import { useState, useEffect } from 'react';
import { 
  FaAddressBook, FaPlus, FaTrash, FaSave, FaSpinner, 
  FaTags, FaListUl, FaUserTag, FaRandom, FaTimes
} from 'react-icons/fa';
import { getContactSettings, updateContactSettings } from '@/lib/api';
import { toast } from '@/lib/toast';
import FeatureGate from '@/components/features/FeatureGate';

function ContactsSettingsContent() {
  const [settings, setSettings] = useState({
    customFieldDefinitions: [],
    leadStatuses: [
      { key: 'new', label: 'New', color: '#10B981' },
      { key: 'open', label: 'Open', color: '#3B82F6' },
      { key: 'qualified', label: 'Qualified', color: '#F59E0B' },
      { key: 'unqualified', label: 'Unqualified', color: '#EF4444' }
    ],
    tagsOptions: [],
    autoAssign: {
      enabled: false,
      method: 'load_equalizer', // 'round_robin', 'load_equalizer', 'rules'
      rules: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Temp local state for add inputs
  const [newField, setNewField] = useState({ name: '', type: 'string' });
  const [newStatus, setNewStatus] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await getContactSettings();
      if (res && res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error(err);
      toast?.error?.('Failed to load contact settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateContactSettings(settings);
      toast?.success?.('Contact settings saved successfully!');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    if (!newField.name.trim()) return;
    setSettings(prev => ({
      ...prev,
      customFieldDefinitions: [...(prev.customFieldDefinitions || []), { key: newField.name.trim().toLowerCase().replace(/\s+/g, '_'), label: newField.name.trim(), type: newField.type } ]
    }));
    setNewField({ name: '', type: 'text' });
  };

  const removeCustomField = (idx) => {
    setSettings(prev => ({
      ...prev,
      customFieldDefinitions: prev.customFieldDefinitions.filter((_, i) => i !== idx)
    }));
  };

  const addLeadStatus = () => {
    if (!newStatus.trim()) return;
    setSettings(prev => ({
      ...prev,
      leadStatuses: [...(prev.leadStatuses || []), { key: newStatus.trim().toLowerCase().replace(/\s+/g, '_'), label: newStatus.trim(), color: '#3B82F6' }]
    }));
    setNewStatus('');
  };

  const removeLeadStatus = (idx) => {
    setSettings(prev => ({
      ...prev,
      leadStatuses: prev.leadStatuses.filter((_, i) => i !== idx)
    }));
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    setSettings(prev => ({
      ...prev,
      tagsOptions: [...(prev.tagsOptions || []), { label: newTag.trim(), color: '#4B5563' }]
    }));
    setNewTag('');
  };

  const removeTag = (idx) => {
    setSettings(prev => ({
      ...prev,
      tagsOptions: prev.tagsOptions.filter((_, i) => i !== idx)
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-48">
        <FaSpinner className="animate-spin text-emerald-600 text-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <FaAddressBook className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contact Config Rules</h1>
            <p className="text-sm text-muted-foreground">Manage fields, statuses, tags, and auto-assignment</p>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-md disabled:opacity-50"
        >
          {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
          Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* TOP LEFT: Custom Fields */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FaListUl className="text-gray-400" /> Custom Fields
          </h3>
          <div className="space-y-3 mb-4">
            {(settings.customFieldDefinitions || []).map((field, idx) => (
              <div key={idx} className="flex items-center justify-between bg-accent/50 p-2.5 rounded-lg border border-border">
                <div>
                  <span className="font-medium text-sm text-foreground">{field.label || field.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 uppercase px-1.5 py-0.5 bg-background rounded border border-border">
                    {field.type}
                  </span>
                </div>
                <button onClick={() => removeCustomField(idx)} className="text-red-400 hover:text-red-500 transition-colors p-1">
                  <FaTrash className="text-sm" />
                </button>
              </div>
            ))}
            {(settings.customFieldDefinitions?.length === 0) && (
              <p className="text-sm text-muted-foreground italic">No custom fields defined</p>
            )}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" placeholder="Field Name" 
              value={newField.name} onChange={e => setNewField({ ...newField, name: e.target.value })}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select 
              value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value })}
              className="w-28 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="boolean">Boolean</option>
            </select>
            <button onClick={addCustomField} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 dark:text-emerald-400 px-3 py-2 rounded-lg transition-colors">
              <FaPlus />
            </button>
          </div>
        </div>

        {/* TOP RIGHT: Lead Statuses */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FaUserTag className="text-gray-400" /> Lead Statuses
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {(settings.leadStatuses || []).map((status, idx) => (
              <div key={idx} className="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-sm">
                <span>{status.label || status}</span>
                <button onClick={() => removeLeadStatus(idx)} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">
                  <FaTimes className="text-xs" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" placeholder="New Status" 
              value={newStatus} onChange={e => setNewStatus(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLeadStatus()}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button onClick={addLeadStatus} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 dark:text-emerald-400 px-3 py-2 rounded-lg transition-colors">
              <FaPlus />
            </button>
          </div>
        </div>

        {/* BOTTOM LEFT: Tags */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FaTags className="text-gray-400" /> Global Tags
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {(settings.tagsOptions || []).map((tag, idx) => (
              <div key={idx} className="bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-md text-sm flex items-center gap-2 shadow-sm">
                <span>{tag.label || tag}</span>
                <button onClick={() => removeTag(idx)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <FaTimes className="text-xs" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" placeholder="New Tag" 
              value={newTag} onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button onClick={addTag} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 dark:text-emerald-400 px-3 py-2 rounded-lg transition-colors">
              <FaPlus />
            </button>
          </div>
        </div>

        {/* BOTTOM RIGHT: Auto Assign */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FaRandom className="text-gray-400" /> Auto-Assign Method
          </h3>
          <label className="flex items-center gap-3 mb-4 p-3 border border-border rounded-lg bg-accent/30 cursor-pointer">
            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
              <input 
                type="checkbox" 
                checked={settings.autoAssign?.enabled || false}
                onChange={e => setSettings(prev => ({
                  ...prev, 
                  autoAssign: { ...prev.autoAssign, enabled: e.target.checked }
                }))}
                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer translate-x-0 checked:translate-x-5 checked:border-emerald-500 transition-transform" 
              />
              <div className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Enable Auto-Assignment</p>
              <p className="text-xs text-muted-foreground">Assign incoming contacts automatically</p>
            </div>
          </label>

          {settings.autoAssign?.enabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Assignment Method</label>
                <select 
                  value={settings.autoAssign?.method || 'load_equalizer'}
                  onChange={e => setSettings(prev => ({
                    ...prev, 
                    autoAssign: { ...prev.autoAssign, method: e.target.value }
                  }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="round_robin">Round Robin (Evenly Distribute)</option>
                  <option value="load_equalizer">Least Active Agent (Load Equalizer)</option>
                  <option value="rules">Rule-Based Routing</option>
                </select>
              </div>
              
              {settings.autoAssign?.method === 'rules' && (
                <div className="bg-orange-50 border border-orange-200 dark:bg-orange-900/10 dark:border-orange-800 p-3 rounded-lg">
                  <p className="text-xs text-orange-800 dark:text-orange-300">
                    Rule builder UI is coming soon. Contacts will fallback to Round Robin in the meantime.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function ContactsSettingsPage() {
  return <ContactsSettingsContent />;
}
