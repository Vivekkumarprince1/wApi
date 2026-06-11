"use client";

import React, { useState, useEffect } from "react";
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
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  Inbox as InboxIcon,
  Tag,
  Lock,
  Target
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getInboxSettings, updateInboxSettings, getTeamMembers } from "@/lib/api/settings";
import { fetchRules, toggleRule } from "@/lib/api/automation";

export default function ChatAssignmentPage() {
  const router = useRouter();
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
  const [agents, setAgents] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('settings');

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('[ChatAssignment] Loading data...');
      const [settingsRes, agentsRes, rulesRes] = await Promise.all([
        getInboxSettings().catch((err: any) => { console.error('Settings fetch failed:', err); throw err; }),
        getTeamMembers().catch((err: any) => { console.error('Agents fetch failed:', err); throw err; }),
        fetchRules('system').catch((err: any) => { console.error('Rules fetch failed:', err); throw err; })
      ]);

      console.log('[ChatAssignment] Data loaded:', { settingsRes, agentsRes, rulesRes });

      if (settingsRes) setInboxSettings(settingsRes);
      if (agentsRes) {
        const agentArray = agentsRes.members || (Array.isArray(agentsRes) ? agentsRes : []);
        setAgents(agentArray);
      }
      if (rulesRes) setRules(Array.isArray(rulesRes) ? rulesRes : (rulesRes.rules || []));
      
    } catch (error: any) {
      console.error('Error fetching chat assignment data:', error);
      const isJsonError = error?.message?.includes('JSON') || error?.message?.includes('token');
      toast.error(isJsonError ? 'Backend API returned invalid response (HTML instead of JSON)' : 'Failed to load assignment settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateSettings = async (updates: any) => {
    setUpdating(true);
    try {
      const newSettings = { ...inboxSettings, ...updates };
      const res = await updateInboxSettings(newSettings);

      if (res) {
        setInboxSettings(res);
        toast.success('Settings updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col gap-6 animate-pulse">
       <div className="h-20 bg-muted rounded-2xl w-full" />
       <div className="grid grid-cols-3 gap-6">
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-32 bg-muted rounded-2xl" />
       </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
             <UserPlus className="size-8 text-primary" />
             Chat Assignment
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Configure real-time chat routing and agent availability</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} className="rounded-xl border-border/50 shadow-sm">
            <RefreshCw className={cn("size-4", updating && "animate-spin")} />
          </Button>
          <Button onClick={() => setActiveTab('rules')} className="rounded-xl bg-primary shadow-lg shadow-primary/20 gap-2 font-black uppercase tracking-widest text-[10px]">
            <Plus className="size-4" /> Create Routing Rule
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { 
            label: 'Online Members', 
            value: agents.filter(a => a.isOnline).length, 
            total: agents.length,
            icon: UserCheck, 
            color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          },
          { 
            label: 'Routing Strategy', 
            value: inboxSettings.assignmentStrategy.replace('_', ' '), 
            icon: Bot, 
            color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
          },
          { 
            label: 'Automation', 
            value: inboxSettings.autoAssignmentEnabled ? 'Enabled' : 'Disabled', 
            icon: Zap, 
            color: inboxSettings.autoAssignmentEnabled ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted/50 text-muted-foreground border-border/50'
          },
        ].map((stat, i) => (
          <Card key={i} className={cn("border-none shadow-premium-sm", stat.color)}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-background/50 flex items-center justify-center shadow-sm">
                  <stat.icon className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">{stat.label}</p>
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-2xl font-black leading-none">{stat.value}</h3>
                    {stat.total !== undefined && <span className="text-xs font-bold opacity-50">/ {stat.total}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="bg-muted/40 p-1 rounded-2xl border border-border/50 h-auto gap-1 mb-8">
          <TabsTrigger value="settings" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-premium-sm text-xs font-black uppercase tracking-widest uppercase">
            General Settings
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-premium-sm text-xs font-black uppercase tracking-widest uppercase">
            Member Availability
          </TabsTrigger>
          <TabsTrigger value="rules" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-premium-sm text-xs font-black uppercase tracking-widest uppercase">
            Routing Rules
          </TabsTrigger>
        </TabsList>

        {/* 1. General Settings */}
        <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="rounded-3xl border border-border/40 shadow-premium overflow-hidden">
               <CardHeader className="bg-muted/30 border-b border-border/30 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <Bot className="size-6" />
                       </div>
                       <div>
                          <CardTitle className="text-xl font-black">Auto-Assignment</CardTitle>
                          <CardDescription className="font-medium">Distribute incoming chats automatically</CardDescription>
                       </div>
                    </div>
                    <Switch 
                      checked={inboxSettings.autoAssignmentEnabled} 
                      onCheckedChange={(val) => handleUpdateSettings({ autoAssignmentEnabled: val })}
                      className="scale-125 data-[state=checked]:bg-primary"
                    />
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                     <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assignment Strategy</Label>
                     <Select 
                        value={inboxSettings.assignmentStrategy} 
                        onValueChange={(val) => handleUpdateSettings({ assignmentStrategy: val })}
                        disabled={!inboxSettings.autoAssignmentEnabled}
                     >
                        <SelectTrigger className="rounded-xl h-12 border-border/60 hover:bg-muted/20">
                           <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/40 shadow-premium-lg">
                           <SelectItem value="MANUAL" className="font-bold py-2.5">Manual (Queue System)</SelectItem>
                           <SelectItem value="ROUND_ROBIN" className="font-bold py-2.5">Round Robin (Sequential)</SelectItem>
                           <SelectItem value="LEAST_ASSIGNED" className="font-bold py-2.5">Load Balanced (Least Busy)</SelectItem>
                           <SelectItem value="LEAST_UNREAD" className="font-bold py-2.5">Response Focused (Least Unread)</SelectItem>
                        </SelectContent>
                     </Select>
                     <p className="text-xs font-medium text-muted-foreground flex gap-2 pt-1">
                        <AlertCircle className="size-3.5 text-primary shrink-0" />
                        {inboxSettings.assignmentStrategy === 'ROUND_ROBIN' && "Ensures even distribution by going through agents in a circle."}
                        {inboxSettings.assignmentStrategy === 'LEAST_ASSIGNED' && "Optimizes speed by picking agents with the fewest open tickets."}
                        {inboxSettings.assignmentStrategy === 'MANUAL' && "New tickets stay in the 'Unassigned' queue until picked up."}
                        {inboxSettings.assignmentStrategy === 'LEAST_UNREAD' && "Prioritizes agents who are currently up-to-date with their messages."}
                     </p>
                  </div>

                  <Separator className="bg-border/40" />

                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div>
                           <p className="text-sm font-black tracking-tight">Soft Lock Reservation</p>
                           <p className="text-xs font-medium text-muted-foreground">Temporarily reserve chat for the active agent</p>
                        </div>
                        <Switch 
                          checked={inboxSettings.softLockEnabled} 
                          onCheckedChange={(val) => handleUpdateSettings({ softLockEnabled: val })}
                        />
                     </div>
                     {inboxSettings.softLockEnabled && (
                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/30">
                           <Lock className="size-4 text-primary" />
                           <div className="flex-1 space-y-1">
                               <Label className="text-[10px] font-black uppercase tracking-widest">Timeout (Seconds)</Label>
                               <div className="flex items-center gap-3">
                                  <Input 
                                    type="number" 
                                    value={inboxSettings.softLockTimeoutSeconds}
                                    onChange={(e) => handleUpdateSettings({ softLockTimeoutSeconds: parseInt(e.target.value) })}
                                    className="h-9 w-24 rounded-lg bg-background border-border/50 text-xs font-bold"
                                  />
                                  <span className="text-xs font-bold text-muted-foreground">s</span>
                               </div>
                           </div>
                        </div>
                     )}
                  </div>
               </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/40 shadow-premium overflow-hidden">
               <CardHeader className="bg-muted/30 border-b border-border/30 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                          <Clock className="size-6" />
                       </div>
                       <div>
                          <CardTitle className="text-xl font-black">SLA & Response Limits</CardTitle>
                          <CardDescription className="font-medium">Define service standards for your team</CardDescription>
                       </div>
                    </div>
                    <Switch 
                      checked={inboxSettings.slaEnabled} 
                      onCheckedChange={(val) => handleUpdateSettings({ slaEnabled: val })}
                      className="scale-125 data-[state=checked]:bg-primary"
                    />
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">First Response SLA</Label>
                        <div className="flex items-center gap-2">
                           <Input 
                              type="number" 
                              value={inboxSettings.slaFirstResponseMinutes}
                              onChange={(e) => handleUpdateSettings({ slaFirstResponseMinutes: parseInt(e.target.value) })}
                              disabled={!inboxSettings.slaEnabled}
                              className="h-10 rounded-xl bg-muted/20 border-border/40 text-sm font-bold"
                           />
                           <span className="text-xs font-black opacity-40">Min</span>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resolution SLA</Label>
                        <div className="flex items-center gap-2">
                           <Input 
                              type="number" 
                              value={inboxSettings.slaResolutionMinutes}
                              onChange={(e) => handleUpdateSettings({ slaResolutionMinutes: parseInt(e.target.value) })}
                              disabled={!inboxSettings.slaEnabled}
                              className="h-10 rounded-xl bg-muted/20 border-border/40 text-sm font-bold"
                           />
                           <span className="text-xs font-black opacity-40">Min</span>
                        </div>
                     </div>
                  </div>

                  <Separator className="bg-border/40" />

                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div>
                           <p className="text-sm font-black tracking-tight">Agent Rate Limiting</p>
                           <p className="text-xs font-medium text-muted-foreground">Prevent conversation floods</p>
                        </div>
                        <Switch 
                          checked={inboxSettings.agentRateLimitEnabled} 
                          onCheckedChange={(val) => handleUpdateSettings({ agentRateLimitEnabled: val })}
                        />
                     </div>
                     {inboxSettings.agentRateLimitEnabled && (
                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/30">
                           <Activity className="size-4 text-primary" />
                           <div className="flex-1 space-y-1">
                               <Label className="text-[10px] font-black uppercase tracking-widest">Rate (Messages/Min)</Label>
                               <Input 
                                 type="number" 
                                 value={inboxSettings.agentMessagesPerMinute}
                                 onChange={(e) => handleUpdateSettings({ agentMessagesPerMinute: parseInt(e.target.value) })}
                                 className="h-9 w-24 rounded-lg bg-background border-border/50 text-xs font-bold mt-1"
                               />
                           </div>
                        </div>
                     )}
                  </div>
               </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Member Availability */}
        <TabsContent value="members" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <Card className="rounded-3xl border border-border/40 shadow-premium overflow-hidden">
              <ScrollArea className="h-[600px] w-full">
                 <table className="w-full text-left">
                    <thead className="sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/30">
                       <tr className="bg-muted/30">
                          {['Member', 'Availability', 'Current Workload', 'Response Rate', 'Actions'].map((h, i) => (
                             <th key={i} className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                          ))}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                       {agents.map((agent) => (
                          <tr key={agent._id} className="hover:bg-muted/10 transition-colors group">
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                   <div className="relative">
                                      <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs shadow-sm ring-1 ring-primary/20">
                                         {agent.name.charAt(0)}
                                      </div>
                                      <div className={cn(
                                        "absolute -bottom-0.5 -right-0.5 size-3.5 border-2 border-background rounded-full",
                                        agent.isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"
                                      )} />
                                   </div>
                                   <div>
                                      <p className="text-sm font-black tracking-tight">{agent.name}</p>
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 tracking-wider leading-none mt-0.5">{agent.role}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <Badge variant="outline" className={cn(
                                  "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-none ring-1 ring-inset",
                                  agent.isAvailable ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" : "bg-muted/50 text-muted-foreground ring-border/50"
                                )}>
                                   {agent.isAvailable ? "Accepting Chats" : "On Break"}
                                </Badge>
                             </td>
                             <td className="px-8 py-6 max-w-[200px]">
                                <div className="space-y-2">
                                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                                      <span>{agent.openConversations || 0} Open</span>
                                      <span>{inboxSettings.maxConcurrentChats} Max</span>
                                   </div>
                                   <Progress 
                                      value={((agent.openConversations || 0) / inboxSettings.maxConcurrentChats) * 100} 
                                      className="h-1.5 bg-muted/40" 
                                   />
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-2">
                                   <Zap className="size-3.5 text-amber-500" />
                                   <span className="text-sm font-black tracking-tighter">92%</span>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-2">
                                   <Button variant="outline" size="sm" onClick={() => { router.push('/settings'); }} className="rounded-lg h-8 px-3 border-border/50 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all">Manage</Button>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </ScrollArea>
           </Card>
        </TabsContent>

        {/* 3. Routing Rules */}
        <TabsContent value="rules" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                 <Card className="rounded-3xl border border-border/40 bg-primary/5 border-primary/20 p-8 shadow-premium-sm relative overflow-hidden group">
                    <Target className="absolute -bottom-4 -right-4 size-32 text-primary/5 group-hover:scale-110 transition-transform duration-700" />
                    <h3 className="text-lg font-black tracking-tight mb-2">Smart Routing Rules</h3>
                    <p className="text-xs font-medium text-muted-foreground mb-6">Create complex logic to ensure Every conversation reaches the right person instantly. Use customer tags, keywords, or time-based triggers.</p>
                    <Button onClick={() => { router.push('/automation/workflows'); }} className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/20">
                       <Plus className="size-4" /> Add New Rule
                    </Button>
                 </Card>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-2">Quick Templates</p>
                    {[
                      { icon: ShieldCheck, title: "VIP Ticket Routing", desc: "Tag: High-Value" },
                      { icon: Clock, title: "After Hours Queue", desc: "Mon-Fri after 8PM" },
                      { icon: Target, title: "Sales Recovery", desc: "Keyword: 'Price'" },
                    ].map((tpl, i) => (
                      <div key={i} className="p-5 rounded-2xl border border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all shadow-sm">
                         <div className="flex items-center gap-4">
                            <div className="size-10 rounded-xl bg-background border border-border/50 flex items-center justify-center text-primary shadow-sm">
                               <tpl.icon className="size-5" />
                            </div>
                            <div>
                               <p className="text-xs font-black tracking-tight">{tpl.title}</p>
                               <p className="text-[10px] font-medium text-muted-foreground opacity-70 italic">{tpl.desc}</p>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="lg:col-span-8">
                 <div className="space-y-4">
                    {rules.length > 0 ? rules.map((rule) => (
                      <Card key={rule._id} className="rounded-3xl border border-border/30 shadow-premium-sm hover:shadow-premium transition-all">
                         <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "size-10 rounded-xl flex items-center justify-center shadow-sm",
                                    rule.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                  )}>
                                     <Zap className="size-5" />
                                  </div>
                                  <div>
                                     <h4 className="text-[13px] font-black tracking-tight uppercase tracking-wider">{rule.name}</h4>
                                     <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mt-0.5">
                                        <Badge variant="outline" className="rounded-md px-1.5 py-0 border-border/50 text-[9px] uppercase font-bold">{rule.trigger.event}</Badge>
                                        <span>&rarr;</span>
                                        <span className="italic">{rule.actions.length} Actions</span>
                                     </div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-3">
                                  <Switch 
                                    checked={rule.enabled} 
                                    onCheckedChange={async (val) => {
                                      try {
                                        const res = await toggleRule(rule._id, val);
                                        if (res) {
                                          setRules(rules.map(r => r._id === rule._id ? { ...r, enabled: val } : r));
                                          toast.success(`Rule ${val ? 'Enabled' : 'Disabled'}`);
                                        }
                                      } catch (err) {
                                        toast.error("Failed to toggle rule");
                                      }
                                    }}
                                  />
                                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                                     <Trash2 className="size-4" />
                                  </Button>
                               </div>
                            </div>
                         </CardContent>
                      </Card>
                    )) : (
                      <Card className="rounded-3xl border border-dashed border-border/60 p-12 text-center bg-muted/10">
                         <InboxIcon className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                         <h4 className="text-sm font-black text-muted-foreground uppercase tracking-widest">No Custom Rules Defined</h4>
                         <p className="text-xs font-medium text-muted-foreground mt-2 max-w-xs mx-auto">Create rules to handle off-hours, route specific customer tags, or trigger automated bot responses.</p>
                      </Card>
                    )}
                 </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
