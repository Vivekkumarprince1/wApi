'use client';

import { useState } from 'react';
import { FaUsersCog, FaPlus, FaTrash } from 'react-icons/fa';

export default function TeamsSettingsPage() {
  const [teams, setTeams] = useState([
    { id: 1, name: 'Support Team', members: 5 },
    { id: 2, name: 'Sales Team', members: 3 },
  ]);
  const [name, setName] = useState('');

  const createTeam = (e) => {
    e.preventDefault();
    setTeams(prev => [{ id: Date.now(), name, members: 0 }, ...prev]);
    setName('');
    // TODO: Wire to backend API
  };

  const deleteTeam = (id) => {
    if (confirm('Delete this team?')) {
      setTeams(prev => prev.filter(t => t.id !== id));
      // TODO: Wire to backend API
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
          <FaUsersCog className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Organize agents into teams</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        <form onSubmit={createTeam} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Team</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Team Name</label>
              <input value={name} onChange={(e)=>setName(e.target.value)} required className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <FaPlus/> Create Team
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Teams</h2>
          <ul className="space-y-3">
            {teams.map(t => (
              <li key={t.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{t.name}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t.members} members</p>
                </div>
                <button onClick={()=>deleteTeam(t.id)} className="text-red-500 hover:text-red-700"><FaTrash/></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
