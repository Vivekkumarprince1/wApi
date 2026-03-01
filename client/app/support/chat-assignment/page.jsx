'use client';

import { 
  UserPlus, 
  Users, 
  Bot, 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Shield, 
  Zap, 
  Activity,
  UserCheck,
  UserX,
  MoreVertical
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getInboxSettings, updateInboxSettings, fetchAvailableAgents } from '@/lib/api';
import { toast } from 'react-toastify';
import { useSocketEvent } from '@/lib/SocketContext';

export default function ChatAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [settings, setSettings] = useState({
    autoAssignmentEnabled: false,
    assignmentStrategy: 'MANUAL',
    slaEnabled: false,
    slaFirstResponseMinutes: 60,
    slaResolutionMinutes: 1440,
    agentRateLimitEnabled: true,
    agentMessagesPerMinute: 30,
    softLockEnabled: true,
    softLockTimeoutSeconds: 60
  });
  const [agents, setAgents] = useState([]);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'agents', 'rules'

  // Listen for real-time assignment updates
  useSocketEvent('inbox:assignment', (payload) => {
    toast.info(`Conversation assigned to ${payload.assignedTo?.name || 'someone'}`);
    // Refresh agents list to update workload
    fetchData();
  });

  useSocketEvent('inbox:new-conversation', (payload) => {
    toast.success('New chat request received!');
    fetchData();
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, agentsRes] = await Promise.all([
        getInboxSettings(),
        fetchAvailableAgents()
      ]);

      if (settingsRes.success) {
        setSettings(settingsRes.settings);
      }
      if (agentsRes.success) {
        setAgents(agentsRes.members || []);
      }
    } catch (error) {
      console.error('Error fetching chat assignment data:', error);
      toast.error('Failed to load assignment settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateSettings = async (updates) => {
    setUpdating(true);
    try {
      const newSettings = { ...settings, ...updates };
      const res = await updateInboxSettings(newSettings);
      if (res.success) {
        setSettings(res.settings);
        toast.success('Settings updated successfully');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setUpdating(false);
    }
  };

  const statCards = [
    { 
      label: 'Active Agents', 
      value: agents.filter(a => a.status === 'active').length, 
      icon: Users, 
      color: 'from-blue-500/10 to-blue-600/10 border-blue-500/20', 
      iconColor: 'text-blue-600 dark:text-blue-400' 
    },
    { 
      label: 'Strategy', 
      value: settings.assignmentStrategy === 'ROUND_ROBIN' ? 'Round Robin' : 
             settings.assignmentStrategy === 'LEAST_ASSIGNED' ? 'Least Assigned' : 
             settings.assignmentStrategy === 'LEAST_UNREAD' ? 'Least Unread' : 'Manual', 
      icon: Bot, 
      color: 'from-violet-500/10 to-violet-600/10 border-violet-500/20', 
      iconColor: 'text-violet-600 dark:text-violet-400' 
    },
    { 
      label: 'Auto-Assignment', 
      value: settings.autoAssignmentEnabled ? 'Enabled' : 'Disabled', 
      icon: Zap, 
      color: settings.autoAssignmentEnabled ? 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20' : 'from-gray-500/10 to-gray-600/10 border-gray-500/20', 
      iconColor: settings.autoAssignmentEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400' 
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading assignment configuration...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <UserPlus className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chat Assignment</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure real-time chat routing and agent availability</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            title="Refresh Data"
          >
            <RefreshCw className={`h-5 w-5 ${updating ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Create Rule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {statCards.map((stat, idx) => (
          <div key={idx} className={`bg-gradient-to-br ${stat.color} border rounded-xl p-5 shadow-sm hover:shadow-md transition-all`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg bg-background/50`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-muted/30 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          General Settings
        </button>
        <button 
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'agents' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Agent Availability
        </button>
        <button 
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rules' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Routing Rules
        </button>
      </div>

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Auto-Assignment Config */}
          <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Auto-Assignment</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.autoAssignmentEnabled}
                  onChange={(e) => handleUpdateSettings({ autoAssignmentEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Assignment Strategy</label>
                <select 
                  className="input-premium py-2 text-sm"
                  value={settings.assignmentStrategy}
                  onChange={(e) => handleUpdateSettings({ assignmentStrategy: e.target.value })}
                  disabled={!settings.autoAssignmentEnabled}
                >
                  <option value="MANUAL">Manual (No Auto-Routing)</option>
                  <option value="ROUND_ROBIN">Round Robin (Sequential Rotation)</option>
                  <option value="LEAST_ASSIGNED">Least Assigned (Balance Workload)</option>
                  <option value="LEAST_UNREAD">Least Unread (Responsiveness Focus)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  {settings.assignmentStrategy === 'ROUND_ROBIN' && 'Distributes new chats sequentially among available agents.'}
                  {settings.assignmentStrategy === 'LEAST_ASSIGNED' && 'Assigns chats to agents with the lowest number of open conversations.'}
                  {settings.assignmentStrategy === 'LEAST_UNREAD' && 'Prioritizes agents who have the fewest unread messages.'}
                  {settings.assignmentStrategy === 'MANUAL' && 'New chats remain in the unassigned queue for manual pick-up.'}
                </p>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Soft Lock</h4>
                    <p className="text-xs text-muted-foreground">Temporarily reserve chat for active agent</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.softLockEnabled}
                      onChange={(e) => handleUpdateSettings({ softLockEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {settings.softLockEnabled && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Timeout:</span>
                    <input 
                      type="number" 
                      className="input-premium py-1 px-3 text-xs w-24"
                      value={settings.softLockTimeoutSeconds}
                      onChange={(e) => handleUpdateSettings({ softLockTimeoutSeconds: parseInt(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">seconds</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SLA & Limits */}
          <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-violet-500" />
                <h3 className="text-lg font-bold text-foreground">SLA & Response Limits</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.slaEnabled}
                  onChange={(e) => handleUpdateSettings({ slaEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">First Response SLA</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="input-premium py-2 text-sm"
                      value={settings.slaFirstResponseMinutes}
                      onChange={(e) => handleUpdateSettings({ slaFirstResponseMinutes: parseInt(e.target.value) })}
                      disabled={!settings.slaEnabled}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Resolution SLA</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="input-premium py-2 text-sm"
                      value={settings.slaResolutionMinutes}
                      onChange={(e) => handleUpdateSettings({ slaResolutionMinutes: parseInt(e.target.value) })}
                      disabled={!settings.slaEnabled}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Agent Rate Limiting</h4>
                    <p className="text-xs text-muted-foreground">Prevent spam and accidental flood</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.agentRateLimitEnabled}
                      onChange={(e) => handleUpdateSettings({ agentRateLimitEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {settings.agentRateLimitEnabled && (
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      className="input-premium py-1 px-3 text-xs w-24"
                      value={settings.agentMessagesPerMinute}
                      onChange={(e) => handleUpdateSettings({ agentMessagesPerMinute: parseInt(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">messages per minute</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-400">
                    SLA breaches will be logged in the audit trail and can be configured to auto-escalate to managers in the routing rules tab.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="bg-card border border-border/50 rounded-xl shadow-premium overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Agent Status & Availability</h3>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium px-2 py-1 bg-emerald-500/10 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                {agents.filter(a => a.status === 'active').length} Online
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {['Agent Name', 'Email', 'Role', 'Status', 'Workload', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {agents.length > 0 ? (
                  agents.map((agent) => (
                    <tr key={agent._id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground">{agent.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{agent.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground uppercase text-[10px] font-bold tracking-wider">{agent.role}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: '30%' }}></div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">3 / 10</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button className="text-primary hover:text-primary/80 transition-colors"><Settings className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No team members found in this workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="bg-card border border-border/50 rounded-xl shadow-premium overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Advanced Routing Rules</h3>
            <button className="btn-primary flex items-center gap-2 text-xs py-2">
              <Plus className="h-3.5 w-3.5" /> Add New Rule
            </button>
          </div>
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h4 className="text-lg font-bold text-foreground mb-2">No custom routing rules yet</h4>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Create rules to route chats based on customer tags, business hours, or message keywords.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 border border-border rounded-xl text-left hover:border-primary/50 transition-colors cursor-pointer group">
                <Shield className="h-5 w-5 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                <h5 className="text-sm font-bold text-foreground mb-1">VIP Routing</h5>
                <p className="text-[11px] text-muted-foreground">Route high-value customers to senior agents automatically.</p>
              </div>
              <div className="p-4 border border-border rounded-xl text-left hover:border-primary/50 transition-colors cursor-pointer group">
                <Clock className="h-5 w-5 text-violet-500 mb-2 group-hover:scale-110 transition-transform" />
                <h5 className="text-sm font-bold text-foreground mb-1">After Hours</h5>
                <p className="text-[11px] text-muted-foreground">Set up auto-replies or route to night shift teams.</p>
              </div>
              <div className="p-4 border border-border rounded-xl text-left hover:border-primary/50 transition-colors cursor-pointer group">
                <Zap className="h-5 w-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                <h5 className="text-sm font-bold text-foreground mb-1">Skill-based</h5>
                <p className="text-[11px] text-muted-foreground">Route technical queries directly to the engineering support.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
