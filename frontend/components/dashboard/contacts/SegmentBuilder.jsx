import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Filter, Plus, Save, Trash2, Users, Tag, AlertCircle, Loader2 } from 'lucide-react';
import * as api from '@/lib/api';
import { toast } from '@/lib/toast';

export default function SegmentBuilder() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Builder State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [notTags, setNotTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [notTagInput, setNotTagInput] = useState('');

  useEffect(() => {
    loadSegments();
  }, []);

  async function loadSegments() {
    try {
      setLoading(true);
      const resp = await api.get('/segments');
      setSegments(resp.segments || []);
    } catch (err) {
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name) return toast.error('Segment name is required');
    
    try {
      setLoading(true);
      await api.post('/segments', {
        name,
        description,
        filters: { tags, notTags }
      });
      toast.success('Segment created successfully');
      setIsCreating(false);
      resetBuilder();
      loadSegments();
    } catch (err) {
      toast.error(err.message || 'Failed to create segment');
    } finally {
      setLoading(false);
    }
  }

  function resetBuilder() {
    setName('');
    setDescription('');
    setTags([]);
    setNotTags([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dynamic Segments</h2>
          <p className="text-sm text-muted-foreground">Build audiences based on behavior and tags</p>
        </div>
        <button onClick={() => setIsCreating(!isCreating)} className="btn-primary flex items-center gap-2">
          {isCreating ? <Filter className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isCreating ? 'View All Segments' : 'Create Segment'}
        </button>
      </div>

      {isCreating ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-premium"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Segment Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP Customers" className="input-premium w-full text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this segment..." className="input-premium w-full text-sm min-h-[80px]" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Include Contacts with Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(t => (
                    <span key={t} className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg flex items-center gap-1 border border-primary/20">
                      {t} <button onClick={() => setTags(tags.filter(i => i !== t))}><Trash2 className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag..." className="input-premium flex-1 text-sm py-1.5" />
                  <button onClick={() => { if(tagInput) setTags([...new Set([...tags, tagInput])]); setTagInput(''); }} className="p-2 bg-muted hover:bg-muted/80 rounded-xl transition-colors"><Plus className="h-4 w-4" /></button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Exclude Contacts with Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {notTags.map(t => (
                    <span key={t} className="px-2 py-1 bg-destructive/10 text-destructive text-[10px] font-bold rounded-lg flex items-center gap-1 border border-destructive/20">
                      {t} <button onClick={() => setNotTags(notTags.filter(i => i !== t))}><Trash2 className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={notTagInput} onChange={e => setNotTagInput(e.target.value)} placeholder="Exclude tag..." className="input-premium flex-1 text-sm py-1.5" />
                  <button onClick={() => { if(notTagInput) setNotTags([...new Set([...notTags, notTagInput])]); setNotTagInput(''); }} className="p-2 bg-muted hover:bg-muted/80 rounded-xl transition-colors"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-6">
            <button onClick={handleSave} disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Dynamic Segment
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {segments.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-muted/20 border border-dashed border-border rounded-2xl">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-muted-foreground">No dynamic segments created yet.</p>
            </div>
          ) : segments.map(s => (
            <div key={s._id} className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-foreground">{s.contactCount || 0}</span>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contacts</p>
                </div>
              </div>
              <h4 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{s.name}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-4">{s.description || 'No description provided.'}</p>
              <div className="flex flex-wrap gap-1.5">
                {s.filters?.tags?.map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
