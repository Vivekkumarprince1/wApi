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
import { 
  getInboxSettings, 
  updateInboxSettings, 
  fetchAvailableAgents,
  automationApi,
  teamApi 
} from '@/lib/api';
import { useSocketEvent } from '@/store/socketStore';
import { toast } from '@/lib/toast';
import PageHeader from '@/components/shared/PageHeader';
import FlashLoader from '@/components/ui/FlashLoader';
// import Modal from '@/components/shared/Modal'; // Using inline modals for consistency

export default function ChatAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [inboxSettings, setInboxSettings] = useState({
    autoAssignmentEnabled: false,
    assignmentStrategy: 'MANUAL',
    maxConcurrentChats: 10,
    slaEnabled: false,
    slaFirstResponseMinutes: 60,
    slaResolutionMinutes: 1440,
    agentRateLimitEnabled: true,
    agentMessagesPerMinute: 30,
    softLockEnabled: true,
    softLockTimeoutSeconds: 60
  });
  const [agents, setAgents] = useState([]);
  const [rules, setRules] = useState([]);
  const [activeTab, setActiveTab] = useState('settings'); 
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  // Listen for real-time assignment updates
  useSocketEvent('inbox:assignment', (payload) => {
    toast.info(`Conversation assigned to ${payload.assignedTo?.name || 'someone'}`);
    fetchData();
  });

  useSocketEvent('inbox:new-conversation', (payload) => {
    toast.success('New chat request received!');
    fetchData();
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, agentsRes, rulesRes] = await Promise.all([
        getInboxSettings(),
        fetchAvailableAgents(),
        automationApi.getRules()
      ]);

      if (settingsRes.success) {
        setInboxSettings(settingsRes.settings || {
          autoAssignmentEnabled: false,
          assignmentStrategy: 'MANUAL',
          maxConcurrentChats: 10,
          slaEnabled: false,
          slaFirstResponseMinutes: 60,
          slaResolutionMinutes: 1440,
          agentRateLimitEnabled: true,
          agentMessagesPerMinute: 30,
          softLockEnabled: true,
          softLockTimeoutSeconds: 60
        });
      }
      if (agentsRes.success) {
        setAgents(agentsRes.members || []);
      }
      if (rulesRes?.success) {
        setRules(rulesRes.data.rules || []);
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
      const newSettings = { ...inboxSettings, ...updates };
      const res = await updateInboxSettings(newSettings);
      if (res.success) {
        setInboxSettings(res.settings);
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
      value: agents.filter(a => a.isOnline).length, 
      total: agents.length,
      icon: UserCheck, 
      color: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20', 
      iconColor: 'text-emerald-600 dark:text-emerald-400' 
    },
    { 
      label: 'Strategy', 
      value: inboxSettings.assignmentStrategy === 'ROUND_ROBIN' ? 'Round Robin' : 
             inboxSettings.assignmentStrategy === 'LEAST_ASSIGNED' ? 'Least Assigned' : 
             inboxSettings.assignmentStrategy === 'LEAST_UNREAD' ? 'Least Unread' : 'Manual', 
      icon: Bot, 
      color: 'from-violet-500/10 to-violet-600/10 border-violet-500/20', 
      iconColor: 'text-violet-600 dark:text-violet-400' 
    },
    { 
      label: 'Auto-Assignment', 
      value: inboxSettings.autoAssignmentEnabled ? 'Enabled' : 'Disabled', 
      icon: Zap, 
      color: inboxSettings.autoAssignmentEnabled ? 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20' : 'from-gray-500/10 to-gray-600/10 border-gray-500/20', 
      iconColor: inboxSettings.autoAssignmentEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400' 
    },
  ];

  if (loading) return <FlashLoader />;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={UserPlus}
        title="Chat Assignment"
        subtitle="Configure real-time chat routing and agent availability"
        extra={
          <button 
            onClick={fetchData}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            title="Refresh Data"
          >
            <RefreshCw className={`h-5 w-5 ${updating ? 'animate-spin' : ''}`} />
          </button>
        }
        actions={
          <button 
            onClick={() => setShowRuleModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Create Rule
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {statCards.map((stat, idx) => (
          <div key={idx} className={`bg-gradient-to-br ${stat.color} border rounded-xl p-5 shadow-sm hover:shadow-md transition-all`}>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.color} border shadow-sm`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-lg font-bold">{stat.value}</h3>
                      {stat.total !== undefined && (
                        <span className="text-[10px] text-muted-foreground">/ {stat.total}</span>
                      )}
                    </div>
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
                  checked={inboxSettings.autoAssignmentEnabled}
                  onChange={(e) => handleUpdateSettings({ autoAssignmentEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Assignment Strategy
                </label>
                <select 
                  value={inboxSettings.assignmentStrategy} 
                  onChange={(e) => handleUpdateSettings({ assignmentStrategy: e.target.value })}
                  className="input-premium w-full text-sm py-2"
                  disabled={!inboxSettings.autoAssignmentEnabled}
                >
                  <option value="MANUAL">Manual (No Auto-assignment)</option>
                  <option value="ROUND_ROBIN">Round Robin (Sequential)</option>
                  <option value="LEAST_ASSIGNED">Load Balanced (Least Assigned)</option>
                  <option value="LEAST_UNREAD">Inbox Focused (Least Unread)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  {inboxSettings.assignmentStrategy === 'ROUND_ROBIN' && 'Distributes new chats sequentially among available agents.'}
                  {inboxSettings.assignmentStrategy === 'LEAST_ASSIGNED' && 'Assigns chats to agents with the lowest number of open conversations.'}
                  {inboxSettings.assignmentStrategy === 'LEAST_UNREAD' && 'Prioritizes agents who have the fewest unread messages.'}
                  {inboxSettings.assignmentStrategy === 'MANUAL' && 'New chats remain in the unassigned queue for manual pick-up.'}
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
                      checked={inboxSettings.softLockEnabled}
                      onChange={(e) => handleUpdateSettings({ softLockEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {inboxSettings.softLockEnabled && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Timeout:</span>
                    <input 
                      type="number" 
                      className="input-premium py-1 px-3 text-xs w-24"
                      value={inboxSettings.softLockTimeoutSeconds}
                      onChange={(e) => handleUpdateSettings({ softLockTimeoutSeconds: parseInt(e.target.value) || 0 })}
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
                  checked={inboxSettings.slaEnabled}
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
                      className="input-premium py-2 text-sm w-full"
                      value={inboxSettings.slaFirstResponseMinutes}
                      onChange={(e) => handleUpdateSettings({ slaFirstResponseMinutes: parseInt(e.target.value) || 0 })}
                      disabled={!inboxSettings.slaEnabled}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Resolution SLA</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="input-premium py-2 text-sm w-full"
                      value={inboxSettings.slaResolutionMinutes}
                      onChange={(e) => handleUpdateSettings({ slaResolutionMinutes: parseInt(e.target.value) || 0 })}
                      disabled={!inboxSettings.slaEnabled}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Concurrency Limit</h4>
                    <p className="text-xs text-muted-foreground">Default max chats per agent</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="input-premium py-1 px-3 text-xs w-20 text-center"
                      value={inboxSettings.maxConcurrentChats}
                      onChange={(e) => handleUpdateSettings({ maxConcurrentChats: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Agent Rate Limiting</h4>
                    <p className="text-xs text-muted-foreground">Prevent spam and accidental flood</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={inboxSettings.agentRateLimitEnabled}
                      onChange={(e) => handleUpdateSettings({ agentRateLimitEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {inboxSettings.agentRateLimitEnabled && (
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      className="input-premium py-1 px-3 text-xs w-24 text-center"
                      value={inboxSettings.agentMessagesPerMinute}
                      onChange={(e) => handleUpdateSettings({ agentMessagesPerMinute: parseInt(e.target.value) || 1 })}
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
                {agents.filter(a => a.isOnline).length} Online
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
                          agent.isOnline ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                        }`}>
                          {agent.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-1.5">
                            <div 
                                className="bg-primary h-1.5 rounded-full" 
                                style={{ width: `${Math.min((agent.openConversations / (agent.maxConcurrentChats || inboxSettings.maxConcurrentChats)) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{agent.openConversations || 0} / {agent.maxConcurrentChats || inboxSettings.maxConcurrentChats}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowAgentModal(true);
                          }}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
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

      {/* Routing Rules Content */}
      {activeTab === 'rules' && (
        <div className="bg-card border border-border/50 rounded-xl shadow-premium overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Advanced Routing Rules</h3>
            <button 
              onClick={() => setShowRuleModal(true)}
              className="btn-primary flex items-center gap-2 text-xs py-2"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Rule
            </button>
          </div>
          
          {rules.length > 0 ? (
            <div className="divide-y divide-border/50">
              {rules.map((rule) => (
                <div key={rule._id} className="p-6 hover:bg-accent/30 transition-all flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-1">{rule.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 bg-muted rounded">Trigger: {rule.trigger?.event}</span>
                        <span>•</span>
                        <span>{rule.actions?.length || 0} Actions</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="relative inline-flex items-center cursor-pointer scale-90">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={rule.enabled}
                        onChange={async (e) => {
                          try {
                            const res = await automationApi.toggleRule(rule._id, e.target.checked);
                            if (res.success) {
                              setRules(rules.map(r => r._id === rule._id ? { ...r, enabled: e.target.checked } : r));
                              toast.success(`Rule ${e.target.checked ? 'enabled' : 'disabled'}`);
                            }
                          } catch (err) {
                            toast.error('Failed to update rule status');
                          }
                        }}
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <button 
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this rule?')) {
                          try {
                            const res = await automationApi.deleteRule(rule._id);
                            if (res.success) {
                              setRules(rules.filter(r => r._id !== rule._id));
                              toast.success('Rule deleted');
                            }
                          } catch (err) {
                            toast.error('Failed to delete rule');
                          }
                        }
                      }}
                      className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h4 className="text-lg font-bold text-foreground mb-2">No custom routing rules yet</h4>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                Create rules to route chats based on customer tags, business hours, or message keywords.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div onClick={() => setShowRuleModal(true)} className="p-4 border border-border rounded-xl text-left hover:border-primary/50 transition-colors cursor-pointer group">
                  <Shield className="h-5 w-5 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                  <h5 className="text-sm font-bold text-foreground mb-1">VIP Routing</h5>
                  <p className="text-[11px] text-muted-foreground">Route high-value customers to senior agents automatically.</p>
                </div>
                <div onClick={() => setShowRuleModal(true)} className="p-4 border border-border rounded-xl text-left hover:border-primary/50 transition-colors cursor-pointer group">
                  <Clock className="h-5 w-5 text-violet-500 mb-2 group-hover:scale-110 transition-transform" />
                  <h5 className="text-sm font-bold text-foreground mb-1">After Hours</h5>
                  <p className="text-[11px] text-muted-foreground">Set up auto-replies or route to night shift teams.</p>
                </div>
                <div onClick={() => setShowRuleModal(true)} className="p-4 border border-border rounded-xl text-left hover:border-primary/50 transition-colors cursor-pointer group">
                  <Zap className="h-5 w-5 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                  <h5 className="text-sm font-bold text-foreground mb-1">Skill-based</h5>
                  <p className="text-[11px] text-muted-foreground">Route technical queries directly to the engineering support.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Settings Modal Placeholder */}
      {showAgentModal && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-premium max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">Agent Configuration</h3>
              <button onClick={() => setShowAgentModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {selectedAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{selectedAgent.name}</h4>
                  <p className="text-xs text-muted-foreground">{selectedAgent.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-foreground">Auto-Assignment Availability</h5>
                    <p className="text-xs text-muted-foreground text-[11px]">Can receive new conversations</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={selectedAgent.isAvailable}
                      onChange={(e) => setSelectedAgent({ ...selectedAgent, isAvailable: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="space-y-2">
                  <h5 className="text-sm font-bold text-foreground">Concurrency Limit</h5>
                  <p className="text-xs text-muted-foreground text-[11px] mb-2">Maximum open chats for this agent</p>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="1" 
                      max="50" 
                      value={selectedAgent.maxConcurrentChats || inboxSettings.maxConcurrentChats}
                      onChange={(e) => setSelectedAgent({ ...selectedAgent, maxConcurrentChats: parseInt(e.target.value) })}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-bold text-primary w-8">{selectedAgent.maxConcurrentChats || inboxSettings.maxConcurrentChats}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAgentModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button 
                   onClick={async () => {
                     try {
                        const res = await teamApi.updateSettings(selectedAgent._id, {
                          isAvailable: selectedAgent.isAvailable,
                          maxConcurrentChats: selectedAgent.maxConcurrentChats
                        });
                        if (res.success) {
                          setAgents(agents.map(a => a._id === selectedAgent._id ? { ...a, ...selectedAgent } : a));
                          toast.success('Agent settings updated');
                          setShowAgentModal(false);
                        }
                     } catch (err) {
                        toast.error('Failed to update agent settings');
                     }
                   }}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Create Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-premium max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">Create Routing Rule</h3>
              <button onClick={() => setShowRuleModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>
            
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const data = {
                name: formData.get('name'),
                trigger: { event: formData.get('trigger') },
                actions: [{
                  type: 'assign_conversation',
                  config: {
                    assignTo: {
                      type: formData.get('assignType'),
                      agentId: formData.get('agentId') || undefined
                    }
                  }
                }],
                enabled: true
              };
              
              try {
                const res = await automationApi.createRule(data);
                if (res.success) {
                  setRules([res.data, ...rules]);
                  toast.success('Rule created successfully');
                  setShowRuleModal(false);
                }
              } catch (err) {
                toast.error('Failed to create rule');
              }
            }}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rule Name</label>
                  <input name="name" required placeholder="e.g. VIP Customer Routing" className="input-premium w-full text-sm" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">When this happens</label>
                  <select name="trigger" className="input-premium w-full text-sm">
                    <option value="conversation.created">New Conversation Started</option>
                    <option value="customer.message.received">Customer Sends Message</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assign to</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select name="assignType" className="input-premium w-full text-sm">
                      <option value="round_robin">Round Robin (Team)</option>
                      <option value="least_busy">Least Busy Agent</option>
                      <option value="agent">Specific Agent</option>
                    </select>
                    <select name="agentId" className="input-premium w-full text-sm">
                      <option value="">Select Agent...</option>
                      {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowRuleModal(false)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-md">
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
