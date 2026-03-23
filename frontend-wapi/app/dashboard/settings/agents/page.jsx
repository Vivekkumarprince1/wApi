'use client';

import { useState } from 'react';
import { FaUsers, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';

export default function AgentsSettingsPage() {
  const [agents, setAgents] = useState([
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Support', status: 'active', lastActive: '2h ago' },
    { id: 2, name: 'Bob Singh', email: 'bob@example.com', role: 'Sales', status: 'inactive', lastActive: '3d ago' },
  ]);
  const [form, setForm] = useState({ name: '', email: '', role: 'Support' });

  const handleCreate = (e) => {
    e.preventDefault();
    const newAgent = { id: Date.now(), status: 'active', lastActive: 'just now', ...form };
    setAgents(prev => [newAgent, ...prev]);
    setForm({ name: '', email: '', role: 'Support' });
    // TODO: Wire to backend API
  };

  const handleDelete = (id) => {
    if (confirm('Delete this agent?')) {
      setAgents(prev => prev.filter(a => a.id !== id));
      // TODO: Wire to backend API
    }
  };

  return (
    <div className=" p-6">
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <FaUsers className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agents</h1>
            <p className="text-sm text-muted-foreground">Manage team members who handle conversations</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Create Agent */}
        <form onSubmit={handleCreate} className="bg-card rounded-xl shadow-premium p-6 md:col-span-1">
          <h2 className="text-lg font-semibold text-foreground mb-4">Add Agent</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-foreground mb-1">Name</label>
              <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Role</label>
              <select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} className="w-full px-3 py-2 rounded border border-border bg-white dark:bg-muted text-foreground">
                <option>Support</option>
                <option>Sales</option>
                <option>Admin</option>
              </select>
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">
              <FaPlus/> Create Agent
            </button>
          </div>
        </form>

        {/* Agents List */}
        <div className="bg-card rounded-xl shadow-premium p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Agents List</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Last Active</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agents.map(a => (
                  <tr key={a.id} className="text-foreground">
                    <td className="py-3">{a.name}</td>
                    <td className="py-3">{a.email}</td>
                    <td className="py-3">{a.role}</td>
                    <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${a.status==='active'?'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':'bg-muted text-muted-foreground'}`}>{a.status}</span></td>
                    <td className="py-3">{a.lastActive}</td>
                    <td className="py-3 flex items-center gap-3">
                      <button className="text-primary hover:text-primary/80"><FaEdit/></button>
                      <button onClick={()=>handleDelete(a.id)} className="text-destructive hover:text-destructive/80"><FaTrash/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
