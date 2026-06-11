"use client";

import React, { useState } from 'react';
import { 
  Users, 
  Filter, 
  Plus, 
  Save, 
  Trash2, 
  Tag, 
  AlertCircle, 
  Loader2, 
  X,
  ChevronRight,
  Target,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getSegments, createSegment, deleteSegment, Segment } from '@/lib/api/contacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import FlashLoader from '@/components/ui/flash-loader';

export default function SegmentsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  
  // Builder State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [excludeTagInput, setExcludeTagInput] = useState('');

  const { data: segmentsResponse, isLoading } = useQuery({
    queryKey: ['segments'],
    queryFn: () => getSegments()
  });

  const segments = segmentsResponse?.data || [];

  const mutation = useMutation({
    mutationFn: (data: any) => createSegment(data),
    onSuccess: () => {
      toast.success('Segment created successfully');
      setIsCreating(false);
      resetBuilder();
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create segment')
  });

  const resetBuilder = () => {
    setName('');
    setDescription('');
    setIncludeTags([]);
    setExcludeTags([]);
  };

  const addIncludeTag = () => {
    if (tagInput.trim() && !includeTags.includes(tagInput.trim())) {
      setIncludeTags([...includeTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const addExcludeTag = () => {
    if (excludeTagInput.trim() && !excludeTags.includes(excludeTagInput.trim())) {
      setExcludeTags([...excludeTags, excludeTagInput.trim()]);
      setExcludeTagInput('');
    }
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Dynamic Segments
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/10">
              {segments?.length || 0} Saved
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Build automated audience groups based on behavior, tags, and custom filters.</p>
        </div>
        <Button 
          onClick={() => setIsCreating(!isCreating)} 
          variant={isCreating ? "outline" : "default"}
          className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20 transition-all"
        >
          {isCreating ? <Filter className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {isCreating ? 'View All Segments' : 'Create Segment'}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isCreating ? (
          <motion.div 
            key="builder"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Form Side */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border/50 rounded-[32px] p-8 shadow-sm space-y-8">
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Segment Name</label>
                       <Input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="e.g. High Value Customers" 
                        className="h-13 rounded-2xl bg-muted/20 border-none font-bold"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Description</label>
                       <Textarea 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        placeholder="What criteria defines this segment?" 
                        className="min-h-[100px] rounded-2xl bg-muted/20 border-none font-medium p-4"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Include Tags</label>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] uppercase">AND logic</Badge>
                       </div>
                       <div className="flex flex-wrap gap-2 p-4 bg-emerald-500/5 rounded-2xl min-h-[100px] border border-emerald-500/10">
                          {includeTags.map(t => (
                            <Badge key={t} className="bg-background text-foreground border-emerald-500/20 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase group">
                              {t} <button onClick={() => setIncludeTags(includeTags.filter(i => i !== t))} className="ml-2 hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                            </Badge>
                          ))}
                          {includeTags.length === 0 && <p className="text-[10px] text-emerald-600/40 font-bold italic w-full text-center py-6">No tags added</p>}
                       </div>
                       <div className="flex gap-2">
                          <Input 
                            value={tagInput} 
                            onChange={e => setTagInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && addIncludeTag()}
                            placeholder="Add tag..." 
                            className="h-11 rounded-xl bg-muted/20 border-none font-bold" 
                          />
                          <Button onClick={addIncludeTag} className="h-11 w-11 rounded-xl bg-emerald-500"><Plus className="h-4 w-4" /></Button>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-destructive">Exclude Tags</label>
                          <Badge className="bg-destructive/10 text-destructive border-none text-[8px] uppercase">NOT logic</Badge>
                       </div>
                       <div className="flex flex-wrap gap-2 p-4 bg-destructive/5 rounded-2xl min-h-[100px] border border-destructive/10">
                          {excludeTags.map(t => (
                            <Badge key={t} className="bg-background text-foreground border-destructive/20 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase group">
                              {t} <button onClick={() => setExcludeTags(excludeTags.filter(i => i !== t))} className="ml-2 hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                            </Badge>
                          ))}
                          {excludeTags.length === 0 && <p className="text-[10px] text-destructive/40 font-bold italic w-full text-center py-6">No exclusions</p>}
                       </div>
                       <div className="flex gap-2">
                          <Input 
                            value={excludeTagInput} 
                            onChange={e => setExcludeTagInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && addExcludeTag()}
                            placeholder="Exclude tag..." 
                            className="h-11 rounded-xl bg-muted/20 border-none font-bold" 
                          />
                          <Button onClick={addExcludeTag} className="h-11 w-11 rounded-xl bg-destructive"><Plus className="h-4 w-4" /></Button>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Preview Side */}
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-[32px] p-8 border border-white/5 text-white space-y-8 sticky top-8 shadow-2xl overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Target className="h-40 w-40" />
                 </div>
                 
                 <div className="space-y-1 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Live Projection</p>
                    <h3 className="text-xl font-black">{name || 'New Segment'}</h3>
                 </div>

                 <div className="space-y-4 relative z-10">
                    <div className="bg-white/5 rounded-2xl p-6 text-center space-y-2 group cursor-pointer hover:bg-white/10 transition-all border border-white/5">
                       <p className="text-4xl font-black tracking-tighter group-hover:scale-110 transition-transform">0</p>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Estimated Contacts</p>
                    </div>
                    
                    <div className="space-y-3">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Criteria Summary</p>
                       <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs p-3 bg-white/5 rounded-xl border border-white/5">
                             <span className="opacity-60">Tagged with</span>
                             <span className="font-bold">{includeTags.length} filter(s)</span>
                          </div>
                          <div className="flex items-center justify-between text-xs p-3 bg-white/5 rounded-xl border border-white/5">
                             <span className="opacity-60">Not tagged with</span>
                             <span className="font-bold">{excludeTags.length} filter(s)</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <Button 
                   onClick={() => mutation.mutate({ name, description, filters: { tags: includeTags, notTags: excludeTags } })}
                   disabled={mutation.isPending || !name}
                   className="w-full h-14 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 transition-all z-10 relative group"
                 >
                    {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />}
                    Save Segment
                 </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {segments?.length === 0 ? (
               <div className="col-span-full py-20 text-center bg-card border border-dashed border-border/50 rounded-[40px] space-y-6">
                 <div className="w-20 h-20 rounded-[30px] bg-primary/5 flex items-center justify-center mx-auto opacity-30 shadow-inner">
                    <Users className="h-10 w-10 text-primary" />
                 </div>
                 <h3 className="text-xl font-bold text-foreground">No segments yet</h3>
                 <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">Create your first segment to start targeted marketing campaigns based on customer behavior.</p>
                 <Button onClick={() => setIsCreating(true)} className="rounded-2xl h-12 px-8 font-black">
                    <Plus className="h-4 w-4 mr-2" /> Create Segment
                 </Button>
               </div>
            ) : (
              segments?.map((s: Segment) => (
                <div 
                  key={s._id} 
                  className="group bg-card border border-border/50 p-6 rounded-[32px] shadow-sm hover:shadow-premium transition-all flex flex-col h-full relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => deleteSegment(s._id)}>
                        <Trash2 className="h-4 w-4" />
                     </Button>
                  </div>

                  <div className="flex items-start justify-between mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Target className="h-6 w-6" />
                    </div>
                    <div className="text-right">
                       <p className="text-3xl font-black text-foreground tracking-tighter">{s.contactCount || 0}</p>
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Contacts</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <h3 className="font-black text-lg text-foreground group-hover:text-primary transition-colors">{s.name}</h3>
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2 leading-relaxed opacity-70">
                      {s.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                     <div className="flex flex-wrap gap-1.5">
                        {s.filters?.tags?.slice(0, 3).map((t: any) => (
                          <Badge key={t} variant="outline" className="text-[8px] font-black h-4 px-1.5 uppercase tracking-tighter opacity-60">
                            {t}
                          </Badge>
                        ))}
                     </div>
                     <Button variant="ghost" onClick={() => { router.push('/contacts'); }} className="h-8 pr-0 pl-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-transparent group/btn">
                        View List <ChevronRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                     </Button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
