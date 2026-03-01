'use client';

import { useState, useEffect } from 'react';
import { FaUsersCog, FaPlus, FaTrash, FaSpinner } from 'react-icons/fa';
import { get, post, del } from '@/lib/api';
import { toast } from 'react-toastify';
import FeatureGate from '@/components/FeatureGate';

function TeamsContent() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const data = await get('/teams');
      setTeams(data.teams || data || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    try {
      setCreating(true);
      const data = await post('/teams', { name });
      setTeams(prev => [data.team || data, ...prev]);
      setName('');
      toast.success('Team created successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const deleteTeam = async (id) => {
    if (!confirm('Delete this team? Members will be unassigned.')) return;
    
    try {
      await del(`/teams/${id}`);
      setTeams(prev => prev.filter(t => String(t._id || t.id) !== String(id)));
      toast.success('Team deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete team');
    }
  };

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-purple-600" />
      </div>
    );
  }

  return (
    <div className=" p-6">
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
          <FaUsersCog className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">Organize agents into teams</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        <form onSubmit={createTeam} className="bg-card rounded-xl shadow-premium p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Create Team</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-foreground mb-1">Team Name</label>
              <input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="e.g., Support Team"
                className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" 
              />
            </div>
            <button 
              type="submit" 
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
            >
              {creating ? <FaSpinner className="animate-spin" /> : <FaPlus />}
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>

        <div className="bg-card rounded-xl shadow-premium p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Teams ({teams.length})</h2>
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No teams created yet</p>
          ) : (
            <ul className="space-y-3">
              {teams.map(t => (
                <li key={t._id || t.id} className="border border-border rounded p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.memberCount || t.members?.length || 0} members</p>
                  </div>
                  <button 
                    onClick={() => deleteTeam(t._id || t.id)} 
                    className="text-destructive hover:text-destructive/80"
                  >
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamsSettingsPage() {
  return (
    <FeatureGate feature="team">
      <TeamsContent />
    </FeatureGate>
  );
}
