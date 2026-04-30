"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Shield, 
  Settings2,
  Check,
  ChevronRight,
  Loader2,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { updateRole } from '@/lib/api/settings';
import { Button } from '@/components/ui/button';

interface RolePermissionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  role: any;
}

const CATEGORIES: any = {
  admin: 'Workspace Admin',
  messaging: 'Messaging & Campaigns',
  templates: 'Templates',
  billing: 'Billing & Plans',
  team: 'Team Management',
  analytics: 'Analytics & Reports',
  contacts: 'Contact Management',
  conversations: 'Inbox & Conversations',
  deals: 'Deals & Pipelines',
  integrations: 'Integrations & Webhooks',
  audit_logs: 'Audit Logs'
};

export default function RolePermissionsPanel({ isOpen, onClose, role }: RolePermissionsPanelProps) {
  const queryClient = useQueryClient();
  const [localPermissions, setLocalPermissions] = useState<any>({});
  
  useEffect(() => {
    if (role?.permissions) {
      setLocalPermissions(role.permissions);
    }
  }, [role, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateRole(role._id, { permissions: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-roles'] });
      toast.success('Role permissions updated and propagated');
      onClose();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update role permissions')
  });

  const togglePermission = (key: string) => {
    setLocalPermissions((prev: any) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const groupPermissions = () => {
    const grouped: Record<string, string[]> = {};
    Object.keys(localPermissions).forEach(key => {
      // Handle nested billing if necessary, but focusing on boolean flags for now
      if (typeof localPermissions[key] !== 'boolean') return;
      
      let cat = 'Other';
      if (key.includes('Conversation')) cat = 'conversations';
      if (key.includes('Contact')) cat = 'contacts';
      if (key.includes('Template')) cat = 'templates';
      if (key.includes('Campaign')) cat = 'messaging';
      if (key.includes('Deal')) cat = 'deals';
      if (key.includes('manageTeam')) cat = 'team';
      if (key.includes('billing')) cat = 'billing';
      if (key.includes('viewAnalytics') || key.includes('viewReports')) cat = 'analytics';
      if (key.includes('Integrations') || key.includes('Webhooks')) cat = 'integrations';
      if (key.includes('AuditLogs')) cat = 'audit_logs';

      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(key);
    });
    return grouped;
  };

  const grouped = groupPermissions();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-xl bg-card border-l border-border/50 shadow-2xl h-full flex flex-col"
          >
             {/* Header */}
             <div className="p-8 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white ${
                      role?.color === 'purple' ? 'bg-purple-600' :
                      role?.color === 'blue' ? 'bg-blue-600' :
                      role?.color === 'emerald' ? 'bg-emerald-600' :
                      role?.color === 'amber' ? 'bg-amber-600' : 'bg-slate-600'
                   }`}>
                      <Shield className="h-6 w-6" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black">{role?.name} Blueprint</h2>
                      <p className="text-xs font-medium text-muted-foreground">Architect global permissions for this role.</p>
                   </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10">
                   <X className="h-5 w-5" />
                </Button>
             </div>

             {/* Content */}
             <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3">
                   <Zap className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                   <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                      Changing these rights will instantly update all agents assigned to the <span className="underline">{role?.name}</span> role.
                   </p>
                </div>

                {Object.entries(grouped).map(([catId, keys]) => (
                    <div key={catId} className="space-y-4">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">
                          {CATEGORIES[catId] || catId}
                       </h3>
                       <div className="grid grid-cols-1 gap-2">
                          {keys.map(key => (
                            <div 
                              key={key}
                              onClick={() => togglePermission(key)}
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
                                localPermissions[key] ? 'bg-primary/5 border-primary/10' : 'bg-muted/10 border-border/10'
                              }`}
                            >
                               <span className="text-sm font-bold text-foreground/80 lowercase">
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^view |All /i, '')}
                               </span>
                               <button 
                                 className={`w-10 h-5 rounded-full transition-all relative ${localPermissions[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                               >
                                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${localPermissions[key] ? 'left-5.5' : 'left-0.5'}`} />
                               </button>
                            </div>
                          ))}
                       </div>
                    </div>
                ))}
             </div>

             {/* Footer */}
             <div className="p-8 border-t border-border/50 bg-muted/10 flex items-center gap-4">
                <Button variant="ghost" onClick={onClose} className="rounded-2xl h-14 flex-1 font-black">Cancel</Button>
                <Button 
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate(localPermissions)}
                  className="rounded-2xl h-14 flex-[2] font-black bg-slate-900 text-white shadow-xl shadow-slate-900/20"
                >
                   {updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Solidify Blueprint'}
                </Button>
             </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
