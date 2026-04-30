"use client";

import React, { useState } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Settings2, 
  Trash2, 
  ChevronRight,
  Info,
  Loader2,
  CheckCircle2,
  Lock,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getRoles, createRole, updateRole, deleteRole } from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import RolePermissionsPanel from './role-permissions-panel';

export default function RoleBuilderTab() {
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRightsOpen, setIsRightsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['workspace-roles'],
    queryFn: () => getRoles()
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-roles'] });
      toast.success('Role deleted successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete role')
  });

  if (isLoading) return <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;

  const roles = rolesData?.data || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {roles.map((role: any, i: number) => (
            <motion.div 
              key={role._id || role.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`group bg-card border border-border/50 rounded-[32px] p-8 space-y-6 hover:shadow-xl transition-all relative overflow-hidden ${
                role.isSystem ? 'bg-muted/5' : ''
              }`}
            >
               <div className="flex items-start justify-between">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                    role.color === 'purple' ? 'bg-purple-600' :
                    role.color === 'blue' ? 'bg-blue-600' :
                    role.color === 'emerald' ? 'bg-emerald-600' :
                    role.color === 'amber' ? 'bg-amber-600' : 'bg-slate-600'
                  }`}>
                     {role.isSystem ? <ShieldCheck className="h-7 w-7" /> : <Shield className="h-7 w-7" />}
                  </div>
                  {role.isSystem ? (
                    <Badge variant="outline" className="rounded-lg bg-muted text-muted-foreground border-none font-black text-[8px] uppercase tracking-widest px-2 py-0.5">
                       <Lock className="h-2 w-2 mr-1" /> System
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setEditingRole(role); setIsEditorOpen(true); }}
                        className="h-9 w-9 rounded-xl hover:bg-muted"
                       >
                          <Settings2 className="h-4 w-4" />
                       </Button>
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteMutation.mutate(role._id)}
                        className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                       >
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  )}
               </div>

               <div className="space-y-2">
                  <h4 className="text-xl font-black tracking-tight">{role.name}</h4>
                  <p className="text-xs font-medium text-muted-foreground line-clamp-2 h-8 leading-relaxed">
                     {role.description || "Custom workspace access profile."}
                  </p>
               </div>

               <div className="pt-6 border-t border-border/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <Zap className="h-3.5 w-3.5 text-primary opacity-40" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {Object.values(role.permissions || {}).filter(v => v === true).length} Privileges
                     </span>
                  </div>
                  {!role.isSystem && (
                    <Button 
                      variant="ghost" 
                      onClick={() => { setEditingRole(role); setIsRightsOpen(true); }}
                      className="h-8 px-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                    >
                       Edit Rights <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
               </div>

               {/* Background Hint for custom roles */}
               {!role.isSystem && (
                 <div className="absolute top-0 right-0 p-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                 </div>
               )}
            </motion.div>
          ))}

          {/* Create Button */}
          <motion.button 
            onClick={() => { setEditingRole(null); setIsEditorOpen(true); }}
            className="group bg-muted/20 border border-dashed border-border/50 rounded-[32px] p-8 flex flex-col items-center justify-center space-y-4 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer min-h-[260px]"
          >
             <div className="h-14 w-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all shadow-sm">
                <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
             </div>
             <p className="text-sm font-black text-foreground opacity-60 uppercase tracking-widest">Construct New Role</p>
          </motion.button>
       </div>

       {/* Rights Panel */}
       <RolePermissionsPanel 
          isOpen={isRightsOpen}
          onClose={() => setIsRightsOpen(false)}
          role={editingRole}
       />

       {/* Simple Role Creator / Editor Modal */}
       <AnimatePresence>
          {isEditorOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 sm:p-12 overflow-hidden">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditorOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" />
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card border border-border/50 w-full max-w-lg rounded-[48px] shadow-2xl relative z-10 overflow-hidden">
                  <RoleForm 
                    role={editingRole} 
                    onClose={() => setIsEditorOpen(false)} 
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['workspace-roles'] });
                        setIsEditorOpen(false);
                    }}
                  />
               </motion.div>
            </div>
          )}
       </AnimatePresence>
    </div>
  );
}

function RoleForm({ role, onClose, onSuccess }: { role?: any, onClose: () => void, onSuccess: () => void }) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor] = useState(role?.color || 'blue');

  const mutation = useMutation({
    mutationFn: (data: any) => role ? updateRole(role._id, data) : createRole(data),
    onSuccess: () => {
      toast.success(role ? 'Role updated' : 'Role created');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message || 'Operation failed')
  });

  return (
    <div className="p-10 space-y-10">
       <div className="flex items-start justify-between">
          <div className="h-14 w-14 rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/20 text-white flex items-center justify-center">
             <Shield className="h-7 w-7" />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10">
             <X className="h-5 w-5" />
          </Button>
       </div>

       <div className="space-y-2">
          <h2 className="text-2xl font-black">{role ? 'Refine Role' : 'Architect New Role'}</h2>
          <p className="text-sm font-medium text-muted-foreground">Define a new blueprint for workspace access control.</p>
       </div>

       <div className="space-y-6">
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Role Identifier</label>
             <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Strategic Manager" 
                className="h-14 rounded-2xl bg-muted/20 border-none font-bold"
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Scope Description</label>
             <Input 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="What is this role responsible for?" 
                className="h-14 rounded-2xl bg-muted/20 border-none font-medium"
             />
          </div>
          <div className="space-y-3">
             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Visual Signature</label>
             <div className="flex items-center gap-2">
                {['purple', 'blue', 'emerald', 'amber', 'slate'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full transition-all border-4 ${
                      color === c ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent opacity-60'
                    } ${
                      c === 'purple' ? 'bg-purple-600' :
                      c === 'blue' ? 'bg-blue-600' :
                      c === 'emerald' ? 'bg-emerald-600' :
                      c === 'amber' ? 'bg-amber-600' : 'bg-slate-600'
                    }`}
                  />
                ))}
             </div>
          </div>
       </div>

       <div className="space-y-4">
          <Button 
            disabled={mutation.isPending || !name}
            onClick={() => mutation.mutate({ name, description, color })}
            className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-900/20"
          >
             {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (role ? 'Solidify Refinement' : 'Finalize Specification')}
          </Button>
          <div className="flex items-center justify-center gap-2 py-2">
             <Info className="h-3 w-3 text-muted-foreground" />
             <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40 leading-none">After creation, you can customize granular rights.</p>
          </div>
       </div>
    </div>
  );
}

import { X } from 'lucide-react';
