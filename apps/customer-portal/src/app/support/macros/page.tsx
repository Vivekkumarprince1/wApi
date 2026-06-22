'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getMacros, 
  createMacro, 
  updateMacro as updateMacroApi,
  deleteMacro, 
  updateTicket 
} from '@/lib/api/support';
import { 
  FaBolt, 
  FaPlus, 
  FaSearch, 
  FaEdit, 
  FaTrash, 
  FaCode, 
  FaPaperclip,
  FaInfoCircle,
  FaSpinner
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Reusable UI components (mocked for this context, but should use the project's shadcn components)
const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: string }) => {
  const styles: Record<string, string> = {
    default: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    outline: 'border-border text-muted-foreground'
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[variant]}`}>{children}</span>;
};

export default function MacrosPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    shortcut: '',
    content: '',
    mediaUrl: '',
    mediaType: 'image'
  });

  // Fetch Macros
  const { data: macros, isLoading } = useQuery({
    queryKey: ['macros'],
    queryFn: getMacros
  });

  // Create/Update Mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMacro) {
        return updateMacroApi(editingMacro._id, data); 
      }
      return createMacro(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macros'] });
      toast.success(editingMacro ? 'Macro updated' : 'Macro created');
      setIsEditorOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save macro');
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMacro,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macros'] });
      toast.success('Macro deleted');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', shortcut: '', content: '', mediaUrl: '', mediaType: 'image' });
    setEditingMacro(null);
  };

  const handleEdit = (macro: any) => {
    setEditingMacro(macro);
    setFormData({
      name: macro.name,
      shortcut: macro.shortcut?.startsWith('/') ? macro.shortcut.slice(1) : (macro.shortcut || ''),
      content: macro.content,
      mediaUrl: macro.mediaUrl || '',
      mediaType: macro.mediaType || 'image'
    });
    setIsEditorOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const filteredMacros = macros?.filter((m: any) => 
    (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.shortcut?.toLowerCase().includes(searchQuery.toLowerCase())) ?? false
  );

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            Quick Replies <FaBolt className="text-primary" size={20} />
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your canned responses and keyboard shortcuts for faster support.
          </p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsEditorOpen(true); }}
          className="bg-primary text-white h-11 px-6 rounded-xl font-bold flex items-center gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <FaPlus size={14} /> New Macro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Search & Stats Card */}
        <div className="md:col-span-4 bg-muted/30 border border-border/50 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={14} />
            <input 
              type="text" 
              placeholder="Search macros by name, shortcut or content..."
              className="w-full bg-background border-border/40 pl-11 h-12 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-6 px-4 py-2 bg-background/50 rounded-xl border border-border/40">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total</p>
              <p className="text-sm font-black">{macros?.length || 0}</p>
            </div>
            <div className="h-6 w-px bg-border/40" />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active</p>
              <p className="text-sm font-black text-emerald-500">{macros?.filter((m: any) => m.isActive !== false).length || 0}</p>
            </div>
          </div>
        </div>

        {/* Macros List */}
        <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-40 bg-muted/20 animate-pulse rounded-2xl border border-border/20" />
            ))
          ) : filteredMacros?.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-muted/10 rounded-3xl border-2 border-dashed border-border/40">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/40 mb-4">
                <FaBolt size={32} />
              </div>
              <h3 className="text-lg font-bold">No macros found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                Create shortcuts for your most frequent responses to save time.
              </p>
            </div>
          ) : (
            filteredMacros?.map((macro: any) => (
              <motion.div 
                key={macro._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative bg-background border border-border/60 rounded-2xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                      <FaCode size={16} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm">{macro.name}</h4>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">/{macro.shortcut?.replace('/', '') || 'no-shortcut'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(macro)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                      aria-label={`Edit macro ${macro.name}`}
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(macro._id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                      aria-label={`Delete macro ${macro.name}`}
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
                
                <p className="text-[12px] text-muted-foreground font-medium line-clamp-3 leading-relaxed mb-4 min-h-[54px]">
                  {macro.content}
                </p>

                <div className="flex items-center gap-2 pt-4 border-t border-border/40">
                  {macro.mediaUrl && <Badge variant="success"><FaPaperclip className="mr-1 inline-block" /> Media</Badge>}
                  {macro.content.includes('{{') && <Badge variant="warning">Dynamic</Badge>}
                  {!macro.mediaUrl && !macro.content.includes('{{') && <Badge variant="outline">Text Only</Badge>}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal/Sidebar */}
      <AnimatePresence>
        {isEditorOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditorOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-2xl z-[101] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black">{editingMacro ? 'Edit Macro' : 'Create New Macro'}</h3>
                  <button
                    onClick={() => setIsEditorOpen(false)}
                    className="h-10 w-10 flex items-center justify-center hover:bg-muted rounded-xl transition-colors"
                    aria-label="Close macro editor"
                  >
                    <FaPlus className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Macro Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Welcome Message"
                      className="w-full bg-muted/30 border-border/40 rounded-xl h-11 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Keyboard Shortcut</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">/</span>
                      <input 
                        type="text" 
                        required
                        placeholder="welcome"
                        className="w-full bg-muted/30 border-border/40 rounded-xl h-11 pl-8 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        value={formData.shortcut}
                        onChange={(e) => setFormData({...formData, shortcut: e.target.value})}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic font-medium">Type / followed by this shortcut in the chat to use it.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Response Content</label>
                    <div className="flex gap-1.5">
                      {['contact_name', 'agent_name'].map(v => (
                        <button 
                          key={v}
                          type="button"
                          onClick={() => setFormData({...formData, content: formData.content + `{{${v}}}`})}
                          className="px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10 text-[10px] font-black hover:bg-primary/10"
                        >
                          +{v}
                        </button>
                      ))}
                    </div>
                    </div>
                    <textarea 
                      required
                      placeholder="Hello {{contact_name}}, how can we help you today?"
                      className="w-full bg-muted/30 border-border/40 rounded-xl min-h-[160px] p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 leading-relaxed"
                      value={formData.content}
                      onChange={(e) => setFormData({...formData, content: e.target.value})}
                    />
                  </div>

                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-4">
                    <FaInfoCircle className="text-primary mt-1" size={14} />
                    <div className="space-y-1">
                      <p className="text-xs font-black">Pro Tip: Variables</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                        Use <code className="text-primary font-bold">{"{{variable_name}}"}</code> to insert dynamic data. We'll automatically replace them when you send the message.
                      </p>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full bg-primary text-white h-14 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-4"
                  >
                    {mutation.isPending ? <FaSpinner className="animate-spin" /> : (editingMacro ? 'Save Changes' : 'Create Macro')}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
