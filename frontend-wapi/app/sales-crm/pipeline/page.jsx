"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, MoreVertical, Filter, Search, ArrowRight, User as UserIcon, DollarSign, Calendar, CheckSquare, Settings } from "lucide-react";
import { getPipelines, getDefaultPipeline, listDeals, getDealsByStage, moveDealStage, createDeal, createPipeline } from "@/lib/api/sales";
import { fetchContacts } from "@/lib/api/contacts";
import { toast } from "react-hot-toast";
import FlashLoader from "@/components/ui/FlashLoader";

export default function SalesPipelinePage() {
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState([]);
  const [activePipeline, setActivePipeline] = useState(null);
  const [deals, setDeals] = useState({});
  const [activeStage, setActiveStage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [newDeal, setNewDeal] = useState({ title: "", value: 0, contactId: "" });
  const [newPipeline, setNewPipeline] = useState({ name: "", description: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const pipelinesData = await getPipelines();
      const pipelinesList = pipelinesData?.pipelines || [];
      setPipelines(pipelinesList);
      
      if (pipelinesList.length > 0) {
        const defaultPipeline = pipelinesList.find(p => p.isDefault) || pipelinesList[0];
        setActivePipeline(defaultPipeline);
        setActiveStage(defaultPipeline.stages[0]?.id);
        await fetchDeals(defaultPipeline._id);
      } else {
        // No pipelines found, try to get or create default
        const defaultP = await getDefaultPipeline();
        if (defaultP) {
          setPipelines([defaultP]);
          setActivePipeline(defaultP);
          setActiveStage(defaultP.stages[0]?.id);
          await fetchDeals(defaultP._id);
        }
      }
      
      const contactsRes = await fetchContacts(1, 100);
      setContacts(contactsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch pipelines:", error);
      toast.error("Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeals = async (pipelineId) => {
    try {
      setLoading(true); // Using a local loading state for deals or reusing components
      const response = await getDealsByStage(pipelineId);
      // getDealsByStage returns { pipeline, deals: { stageId: [deals] } }
      setDeals(response.deals || {});
      if (response.pipeline) {
        setActivePipeline(response.pipeline);
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error);
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveStage = async (dealId, targetStageId) => {
    try {
      await moveDealStage(dealId, targetStageId);
      toast.success("Deal moved successfully");
      if (activePipeline) {
        fetchDeals(activePipeline._id);
      }
    } catch (error) {
      console.error("Failed to move deal:", error);
      toast.error("Failed to move deal");
    }
  };

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    try {
      if (!activePipeline) {
        toast.error("No active pipeline selected");
        return;
      }
      await createDeal({
        ...newDeal,
        pipelineId: activePipeline?._id,
        stage: activeStage
      });
      toast.success("Deal created successfully");
      setIsDealModalOpen(false);
      setNewDeal({ title: "", value: 0, contactId: "", pipelineId: "", stage: "" });
      fetchDeals(activePipeline._id);
    } catch (error) {
      console.error("Failed to create deal:", error);
      toast.error(error.message || "Failed to create deal");
    }
  };

  const handleCreatePipeline = async (e) => {
    e.preventDefault();
    try {
      const stages = [
        { id: 'leads', title: 'Leads', position: 0, color: '#6B7280' },
        { id: 'qualified', title: 'Qualified', position: 1, color: '#3B82F6' },
        { id: 'won', title: 'Won', position: 2, isFinal: true, color: '#10B981' }
      ];
      const res = await createPipeline({ ...newPipeline, stages });
      toast.success("Pipeline created successfully");
      setIsPipelineModalOpen(false);
      setNewPipeline({ name: "", description: "" });
      fetchInitialData();
    } catch (error) {
      console.error("Failed to create pipeline:", error);
      toast.error(error.message || "Failed to create pipeline");
    }
  };

  const filteredDeals = () => {
    let list = deals[activeStage] || [];
    
    if (searchQuery) {
      list = list.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortBy === "value-high") {
      list = [...list].sort((a, b) => b.value - a.value);
    } else if (sortBy === "value-low") {
      list = [...list].sort((a, b) => a.value - b.value);
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  };

  if (loading) return <FlashLoader />;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Pipeline</h1>
            <div className="flex items-center gap-2 mt-1">
               <div className="flex items-center space-x-2 bg-muted/30 p-1.5 rounded-2xl border border-border/50">
                 <select 
                   className="bg-transparent text-sm font-bold text-foreground focus:outline-none px-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
                   value={activePipeline?._id}
                   onChange={e => {
                     const p = pipelines.find(p => p._id === e.target.value);
                     if (p) {
                       setActivePipeline(p);
                       localStorage.setItem('last_pipeline_id', p._id);
                       fetchDeals(p._id);
                     }
                   }}
                 >
                   {pipelines.map(p => (
                     <option key={p._id} value={p._id} className="bg-card">{p.name}</option>
                   ))}
                 </select>
               </div>
              <button 
                onClick={() => setIsPipelineModalOpen(true)}
                className="p-2 hover:bg-muted rounded-xl text-primary transition-colors"
                title="New Pipeline"
              >
                <Plus className="w-4 h-4" />
              </button>
              {activePipeline && (
                <button 
                  onClick={() => toast.success("Pipeline Rules & Settings coming soon!")}
                  className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-primary transition-colors"
                  title="Pipeline Rules & Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
              />
            </div>
            <button 
              onClick={() => setIsDealModalOpen(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Deal
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6 scrollbar-hide">
        {!activePipeline ? (
           <div className="flex flex-col items-center justify-center py-40 animate-in fade-in duration-1000">
             <div className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-[3rem] border border-primary/10 mb-8 relative">
               <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary/20 rounded-full blur-xl animate-pulse" />
               <ChevronDown className="w-16 h-16 text-primary animate-bounce opacity-50" />
             </div>
             <h3 className="text-4xl font-black text-foreground font-outfit tracking-tighter">Your Pipeline Awaits</h3>
             <p className="text-muted-foreground max-w-sm text-center mt-4 font-inter text-lg leading-relaxed">
               Ready to scale? Create your high-velocity sales journey to start tracking deals.
             </p>
             <button 
               onClick={() => setIsPipelineModalOpen(true)}
               className="mt-10 px-10 py-5 bg-primary text-white rounded-[2rem] font-black shadow-premium hover:shadow-2xl transition-all hover:-translate-y-2 active:scale-95 text-xl tracking-tight"
             >
               Blueprint Your Journey
             </button>
           </div>
        ) : (
          <div className="board-container flex space-x-6 pb-8 h-full min-h-[600px]">
            {activePipeline.stages.map((stage) => {
              const stageDeals = deals[stage.id] || [];
              const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
              
              return (
                <div key={stage.id} className="board-column w-80 flex-shrink-0 bg-muted/10 rounded-[2rem] p-5 flex flex-col h-full border border-border/30 backdrop-blur-sm group/column hover:bg-muted/20 transition-all">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-6 px-1">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]" 
                        style={{ backgroundColor: stage.color || '#6B7280' }}
                      />
                      <div>
                        <h3 className="text-sm font-black text-foreground tracking-tight flex items-center gap-2 uppercase opacity-80 group-hover/column:opacity-100 transition-opacity">
                          {stage.title}
                          <span className="bg-muted px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-muted-foreground">{stageDeals.length}</span>
                        </h3>
                        <p className="text-[10px] font-bold text-muted-foreground mt-0.5 tracking-wider">₹{totalValue.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveStage(stage.id);
                        setIsDealModalOpen(true);
                      }}
                      className="p-2 text-muted-foreground hover:bg-white dark:hover:bg-muted rounded-xl transition-all opacity-0 group-hover/column:opacity-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Column Body */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                    {stageDeals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border/30 rounded-3xl opacity-40 group-hover/column:opacity-60 transition-all">
                        <div className="p-4 bg-muted/50 rounded-2xl mb-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empty Stage</p>
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <div 
                          key={deal._id} 
                          className="deal-card bg-card border border-border/80 rounded-[1.5rem] p-5 shadow-sm hover:shadow-2xl transition-all group/card border-b-4 hover:-translate-y-1 active:scale-[0.98]"
                          style={{ borderBottomColor: stage.color }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-foreground truncate group-hover/card:text-primary transition-colors">{deal.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[120px]">{deal.contact?.name || 'Unknown'}</span>
                                <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                                <span className="text-[10px] text-muted-foreground">{new Date(deal.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg opacity-0 group-hover/card:opacity-100 transition-all">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5">
                                <UserIcon className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                                  {deal.assignedAgent?.name?.split(' ')[0] || 'Team'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" title="View Tasks">
                                <CheckSquare className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">
                                  {deal.tasks?.length || 0} Tasks
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex flex-col justify-between items-end">
                              <p className="text-sm font-black text-foreground">₹{deal.value?.toLocaleString() || '0'}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                             {activePipeline.stages
                              .filter(s => s.id !== stage.id)
                              .slice(0, 2)
                              .map(nextStage => (
                                <button
                                  key={nextStage.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveStage(deal._id, nextStage.id);
                                  }}
                                  className="text-[9px] font-black px-2 py-1 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-all flex items-center gap-1 flex-1 justify-center whitespace-nowrap"
                                >
                                  TO {nextStage.title.split(' ')[0].toUpperCase()}
                                  <ArrowRight className="w-2 h-2" />
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Deal Modal */}
      {isDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-xl font-bold text-foreground">Create New Deal</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Adding to {activePipeline?.name} - {activePipeline?.stages?.find(s => s.id === activeStage)?.title}
              </p>
            </div>
            
            <form onSubmit={handleCreateDeal} className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deal Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Enterprise License Upgrade"
                  className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={newDeal.title}
                  onChange={e => setNewDeal({...newDeal, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Value (₹)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={isNaN(newDeal.value) ? "" : newDeal.value}
                    onChange={e => setNewDeal({...newDeal, value: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newDeal.contactId}
                    onChange={e => setNewDeal({...newDeal, contactId: e.target.value})}
                  >
                    <option value="">Select Contact</option>
                    {contacts.map((c, idx) => (
                      <option 
                        key={c.id || idx} 
                        value={c.id}
                        disabled={!!c.activeDealId}
                      >
                        {c.name} ({c.phone}) {c.activeDealId ? "— (In Pipeline)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsDealModalOpen(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Pipeline Modal */}
      {isPipelineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-xl font-bold text-foreground">Create New Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-1">Define your sales journey</p>
            </div>
            
            <form onSubmit={handleCreatePipeline} className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Enterprise Sales, Direct Leads"
                  className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={newPipeline.name}
                  onChange={e => setNewPipeline({...newPipeline, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (Optional)</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Briefly describe the purpose of this pipeline..."
                  rows="3"
                  value={newPipeline.description}
                  onChange={e => setNewPipeline({...newPipeline, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsPipelineModalOpen(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Create Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
