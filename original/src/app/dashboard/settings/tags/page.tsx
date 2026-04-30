"use client";

import React, { useMemo, useState } from "react";
import { Layers3, Plus, Search, Sparkles, Tag as TagIcon, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import FlashLoader from "@/components/ui/flash-loader";
import { getTags, createTag, deleteTag } from "@/lib/api/settings";

type TagItem = {
  _id: string;
  name: string;
  usageCount: {
    contacts: number;
    conversations: number;
    total: number;
  };
  color?: string;
};

export default function TagsSettingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");

  const { data: tags = [], isLoading } = useQuery<TagItem[]>({
    queryKey: ["tags"],
    queryFn: () => getTags()
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createTag({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTag("");
      toast.success("Tag created successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create tag")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete tag")
  });

  const filteredTags = useMemo(() => {
    const value = search.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(value));
  }, [search, tags]);

  const addTag = () => {
    const normalized = newTag.trim();
    if (!normalized) return;
    createMutation.mutate(normalized);
  };

  const getTone = (tag: TagItem) => tag.color ? `bg-[${tag.color}]/10 text-[${tag.color}]` : "bg-violet-500/10 text-violet-600";

  if (isLoading) return <div className="py-20"><FlashLoader /></div>;

  return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Tag Library</h1>
            <p className="text-sm font-medium text-muted-foreground">Organize contacts and conversations with reusable labels.</p>
          </div>
          <Badge className="w-fit rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-violet-500/10 text-violet-600 border-none">API Connected</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Tags", value: tags.length, icon: TagIcon, tone: "text-violet-600" },
            { label: "Contacts Covered", value: tags.reduce((sum, tag) => sum + (tag.usageCount?.contacts || 0), 0), icon: Layers3, tone: "text-sky-600" },
            { label: "System Tags", value: 0, icon: Sparkles, tone: "text-emerald-600" },
          ].map((item) => (
            <Card key={item.label} className="border-none ring-1 ring-border/50 bg-background/60 shadow-sm backdrop-blur-xl">
              <CardContent className="p-6 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                  <h3 className="text-2xl font-black">{item.value}</h3>
                </div>
                <div className={`h-12 w-12 rounded-2xl bg-accent/40 flex items-center justify-center ${item.tone}`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4 space-y-6">
            <Card className="border-none ring-1 ring-border/50 bg-background/60 shadow-sm backdrop-blur-xl rounded-[2rem]">
              <CardContent className="p-8 space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Create Tag</p>
                  <h2 className="text-xl font-black">Label Builder</h2>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tag Name</label>
                  <Input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="high-value" className="h-12 rounded-2xl bg-accent/20 border-none" onKeyDown={(e) => e.key === 'Enter' && addTag()}/>
                </div>
                <Button disabled={createMutation.isPending || !newTag.trim()} onClick={addTag} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4 mr-2" /> Add Tag
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 bg-slate-950 text-white shadow-2xl rounded-[2rem] overflow-hidden">
              <CardContent className="p-8 space-y-4">
                <h3 className="text-xl font-black">Rule hints</h3>
                <p className="text-sm text-white/60 font-medium leading-relaxed">Use short, lower-case labels. Tags are most effective when they map to lifecycle stages, SLA tiers, or automation triggers.</p>
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-8 space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tags..." className="pl-11 h-12 rounded-2xl bg-background/60 border-border/50 shadow-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTags.length === 0 ? (
                <div className="col-span-full py-10 text-center text-muted-foreground text-sm">No tags found.</div>
              ) : filteredTags.map((tag) => (
                <Card key={tag._id} className="border-none ring-1 ring-border/50 bg-background/60 shadow-sm hover:shadow-xl transition-all rounded-[2rem]">
                  <CardContent className="p-6 flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <Badge className={`rounded-full px-3 py-1 font-black text-[10px] uppercase tracking-widest border-none ${getTone(tag)}`}>{tag.name}</Badge>
                      <p className="text-xs font-medium text-muted-foreground">Used by {tag.usageCount?.contacts || 0} contacts</p>
                    </div>
                    <Button disabled={deleteMutation.isPending} variant="ghost" size="icon" onClick={() => deleteMutation.mutate(tag._id)} className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}
