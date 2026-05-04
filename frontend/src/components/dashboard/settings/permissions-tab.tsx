"use client";

import React from 'react';
import { 
  Shield, 
  CheckCircle2, 
  XCircle,
  Lock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getPermissionsMatrix } from '@/lib/api/settings';
import { Badge } from '@/components/ui/badge';
import FlashLoader from '@/components/ui/flash-loader';

const CATEGORIES = {
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

const ROLE_ORDER = ['owner', 'admin', 'manager', 'agent', 'viewer'];

export default function PermissionsTab() {
  const { data: matrix, isLoading } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () => getPermissionsMatrix()
  });

  if (isLoading) return <div className="py-20 text-center"><FlashLoader /></div>;

  if (!matrix) return (
    <div className="bg-card border border-border/50 rounded-[40px] p-20 text-center space-y-4">
       <div className="h-16 w-16 rounded-[24px] bg-muted flex items-center justify-center mx-auto opacity-40">
          <Shield className="h-8 w-8" />
       </div>
       <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Unable to load permissions</p>
    </div>
  );

  // Group permissions by category
  // Since new system uses boolean map, we iterate over the owner role for all keys
  const ownerPerms = matrix.owner?.permissions || {};
  const allKeys = Object.keys(ownerPerms).filter(k => typeof ownerPerms[k] === 'boolean');
  
  const groupedPerms: Record<string, string[]> = {};
  allKeys.forEach(key => {
    // Basic heuristics for categorization if not predefined
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
    
    if (!groupedPerms[cat]) groupedPerms[cat] = [];
    groupedPerms[cat].push(key);
  });

  return (
    <div className="bg-card border border-border/50 rounded-[40px] overflow-hidden shadow-sm">
       <div className="px-8 py-6 border-b border-border/50 bg-muted/20">
          <h3 className="text-lg font-black text-foreground">Roles & Permissions Matrix</h3>
          <p className="text-sm font-medium text-muted-foreground opacity-60">Complete breakdown of workspace access by role.</p>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                   <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 min-w-[250px] sticky left-0 bg-card/10 backdrop-blur-md">Action / Permission</th>
                   {ROLE_ORDER.map(role => (
                     <th key={role} className="px-6 py-5 text-center">
                        <Badge variant="outline" className={`rounded-lg px-3 py-1 font-bold text-[10px] uppercase tracking-widest border-none ${
                           role === 'owner' ? 'bg-purple-500/10 text-purple-600' :
                           role === 'admin' ? 'bg-blue-500/10 text-blue-600' :
                           'bg-slate-500/10 text-slate-600'
                        }`}>
                           {role}
                        </Badge>
                     </th>
                   ))}
                </tr>
             </thead>
             <tbody className="divide-y divide-border/10">
                {Object.entries(groupedPerms).map(([catId, keys]) => (
                  <React.Fragment key={catId}>
                     <tr className="bg-primary/5">
                        <td colSpan={ROLE_ORDER.length + 1} className="px-8 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                           {(CATEGORIES as any)[catId] || catId}
                        </td>
                     </tr>
                     {keys.map(key => (
                       <tr key={key} className="hover:bg-muted/10 transition-colors group">
                          <td className="px-8 py-4 sticky left-0 bg-card group-hover:bg-muted/10 transition-colors font-medium text-sm text-foreground/80 lowercase">
                             {key.replace(/([A-Z])/g, ' $1').replace(/^view |All /i, '')}
                          </td>
                          {ROLE_ORDER.map(role => {
                            const hasPerm = matrix[role]?.permissions?.[key];
                            return (
                              <td key={role} className="px-6 py-4 text-center">
                                 {hasPerm ? (
                                   <div className="flex items-center justify-center">
                                      <div className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                         <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      </div>
                                   </div>
                                 ) : (
                                   <div className="flex items-center justify-center">
                                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center opacity-30">
                                         <XCircle className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                   </div>
                                 )}
                              </td>
                            );
                          })}
                       </tr>
                     ))}
                  </React.Fragment>
                ))}
             </tbody>
          </table>
       </div>
       <div className="p-8 border-t border-border/50 bg-muted/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
             <Lock className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
             Roles and permissions are predefined for security. If you need custom roles, please contact support for an enterprise upgrade.
          </p>
       </div>
    </div>
  );
}
