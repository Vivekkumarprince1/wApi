'use client';

import { useState } from 'react';
import { FaShieldAlt, FaPlus, FaTrash } from 'react-icons/fa';

const DEFAULT_PERMS = ['read:conversations','write:messages','manage:templates','manage:campaigns'];

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState([
    { id: 1, name: 'Admin', permissions: DEFAULT_PERMS },
    { id: 2, name: 'Agent', permissions: ['read:conversations','write:messages'] },
  ]);
  const [name, setName] = useState('');
  const [perms, setPerms] = useState(new Set(['read:conversations']));

  const togglePerm = (p) => {
    const s = new Set(perms);
    s.has(p) ? s.delete(p) : s.add(p);
    setPerms(s);
  };

  const createRole = (e) => {
    e.preventDefault();
    setRoles(prev => [{ id: Date.now(), name, permissions: Array.from(perms) }, ...prev]);
    setName('');
    setPerms(new Set(['read:conversations']));
    // TODO: Wire to backend API
  };

  const removeRole = (id) => {
    if (confirm('Delete this role?')) {
      setRoles(prev => prev.filter(r => r.id !== id));
      // TODO: Wire to backend API
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
          <FaShieldAlt className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Define what your team can access</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        <form onSubmit={createRole} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Role</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
              <input value={name} onChange={(e)=>setName(e.target.value)} required className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEFAULT_PERMS.map(p => (
                  <label key={p} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={perms.has(p)} onChange={()=>togglePerm(p)} /> {p}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <FaPlus/> Create Role
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Existing Roles</h2>
          <ul className="space-y-3">
            {roles.map(r => (
              <li key={r.id} className="border border-gray-200 dark:border-gray-700 rounded p-4 flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{r.name}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{r.permissions.join(', ')}</p>
                </div>
                <button onClick={()=>removeRole(r.id)} className="text-red-500 hover:text-red-700"><FaTrash/></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
