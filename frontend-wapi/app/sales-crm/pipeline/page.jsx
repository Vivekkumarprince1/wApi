"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, MoreVertical, Filter, Search, ArrowRight, User as UserIcon, DollarSign, Calendar, CheckSquare, Settings } from "lucide-react";
import { getPipelines, getDefaultPipeline, listDeals, getDealsByStage, moveDealStage, createDeal, createPipeline } from "@/lib/api/sales";
import { fetchContacts } from "@/lib/api/contacts";
import { useSocketEvent } from "@/store/socketStore";
import { toast } from "react-hot-toast";
import FlashLoader from "@/components/ui/FlashLoader";
import DealDetailDrawer from "@/components/features/DealDetailDrawer";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";

export default function SalesPipelinePage() {
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState([]);
  const [activePipeline, setActivePipeline] = useState(null);
  const [deals, setDeals] = useState({}); // { stageId: [deals] }
  const [activeStage, setActiveStage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [newDeal, setNewDeal] = useState({ 
    title: "", 
    value: 0, 
    contactId: "",
    probability: 10,
    priority: "medium",
    expectedCloseDate: ""
  });
  const [newPipeline, setNewPipeline] = useState({ name: "", description: "" });
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Socket Listener: Real-time Deal Creation
  useSocketEvent("deal:created", (data) => {
    const { deal } = data;
    if (deal.pipeline === activePipeline?._id || deal.pipeline?._id === activePipeline?._id) {
      setDeals(prev => ({
        ...prev,
        [deal.stage]: [deal, ...(prev[deal.stage] || [])]
      }));
      toast.info(`New Deal: ${deal.title}`);
    }
  });

  // Socket Listener: Real-time Deal Movement
  useSocketEvent("deal:moved", (data) => {
    const { dealId, oldStageId, newStageId, deal } = data;
    if (deal.pipeline === activePipeline?._id || deal.pipeline?._id === activePipeline?._id) {
      setDeals(prev => {
        const sourceList = (prev[oldStageId] || []).filter(d => d._id !== dealId);
        const destList = [deal, ...(prev[newStageId] || []).filter(d => d._id !== dealId)];
        return {
          ...prev,
          [oldStageId]: sourceList,
          [newStageId]: destList
        };
      });
    }
  });

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
      const response = await getDealsByStage(pipelineId);
      setDeals(response.deals || {});
      if (response.pipeline) {
        setActivePipeline(response.pipeline);
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error);
      toast.error("Failed to load deals");
    }
  };

  const handleOnDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceStageId = source.droppableId;
    const destStageId = destination.droppableId;
    
    // 1. Optimistic Update
    const sourceDeals = [...(deals[sourceStageId] || [])];
    const destDeals = sourceStageId === destStageId ? sourceDeals : [...(deals[destStageId] || [])];
    
    const [movedDeal] = sourceDeals.splice(source.index, 1);
    destDeals.splice(destination.index, 0, movedDeal);

    setDeals(prev => ({
      ...prev,
      [sourceStageId]: sourceDeals,
      [destStageId]: destDeals
    }));

    // 2. API Call
    try {
      if (sourceStageId !== destStageId) {
        await moveDealStage(draggableId, destStageId);
        toast.success("Deal moved");
      }
    } catch (error) {
      console.error("Failed to move deal:", error);
      toast.error("Failed to move deal. Rolling back.");
      // 3. Rollback on failure
      fetchDeals(activePipeline._id);
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
      setNewDeal({ 
        title: "", 
        value: 0, 
        contactId: "", 
        probability: 10, 
        priority: "medium", 
        expectedCloseDate: "" 
      });
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

  const filteredDealsPerStage = (stageId) => {
    let list = deals[stageId] || [];
    if (searchQuery) {
      list = list.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  };

  if (loading) return <FlashLoader />;

  return (
    <div className="flex flex-col h-full bg-background font-sans">
      <div className="bg-card border-b border-border sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-foreground tracking-tight">Sales Pipeline</h1>
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                <TrendingUp size={12} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">
                  Active Velocity: {activePipeline?.stages?.length > 0 ? "High" : "N/A"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
               <div className="flex items-center space-x-2 bg-muted/40 p-1 rounded-xl border border-border/50">
                 <select 
                   className="bg-transparent text-xs font-bold text-foreground focus:outline-none px-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors border-none"
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
                     <option key={p._id} value={p._id}>{p.name}</option>
                   ))}
                 </select>
               </div>
              <button 
                onClick={() => setIsPipelineModalOpen(true)}
                className="p-2 hover:bg-muted rounded-xl text-primary transition-colors active:scale-95"
                title="New Pipeline"
              >
                <Plus className="w-4 h-4" />
              </button>
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
                className="pl-9 pr-4 py-2 bg-muted/40 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsDealModalOpen(true)}
              className="bg-primary hover:brightness-110 text-white px-5 py-2 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
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
              <div className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-[3rem] border border-primary/10 mb-8">
                <ChevronDown className="w-16 h-16 text-primary animate-bounce opacity-50" />
              </div>
              <h3 className="text-4xl font-black text-foreground font-outfit tracking-tighter">Your Pipeline Awaits</h3>
              <p className="text-muted-foreground max-w-sm text-center mt-4 font-inter text-lg leading-relaxed font-medium">
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
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <div className="board-container flex space-x-6 pb-8 h-full min-h-[600px]">
              {activePipeline.stages.map((stage) => {
                const stageDeals = filteredDealsPerStage(stage.id);
                const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                
                return (
                  <div key={stage.id} className="board-column w-80 flex-shrink-0 bg-muted/20 rounded-[2.5rem] p-5 flex flex-col h-full border border-border/40 backdrop-blur-sm group/column hover:bg-muted/30 transition-all shadow-sm">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-6 px-1">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full shadow-inner" 
                          style={{ backgroundColor: stage.color || '#6B7280' }}
                        />
                        <div>
                          <h3 className="text-[11px] font-black text-foreground tracking-widest flex items-center gap-2 uppercase opacity-80 group-hover/column:opacity-100 transition-opacity">
                            {stage.title}
                            <span className="bg-card px-2 py-0.5 rounded-lg text-[9px] font-black text-muted-foreground shadow-sm">{stageDeals.length}</span>
                          </h3>
                          <p className="text-[10px] font-black text-primary mt-0.5 tracking-wider uppercase">₹{totalValue.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveStage(stage.id);
                          setIsDealModalOpen(true);
                        }}
                        className="p-2 text-muted-foreground hover:bg-card rounded-xl transition-all opacity-0 group-hover/column:opacity-100 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Column Body - Droppable */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar transition-all duration-300 rounded-2xl p-1 ${snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20 ring-inset shadow-inner' : ''}`}
                        >
                          {stageDeals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border/30 rounded-[2rem] opacity-30 group-hover/column:opacity-50 transition-all">
                              <DollarSign className="w-5 h-5 text-muted-foreground mb-3" />
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Empty Stage</p>
                            </div>
                          ) : (
                            stageDeals.map((deal, index) => (
                              <Draggable key={deal._id} draggableId={deal._id} index={index}>
                                {(provided, snapshot) => (
                                  <div 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => {
                                      setSelectedDealId(deal._id);
                                      setIsDrawerOpen(true);
                                    }}
                                    className={`deal-card bg-card border border-border/60 rounded-[1.8rem] p-5 shadow-sm transition-all group/card cursor-pointer ${snapshot.isDragging ? 'shadow-2xl opacity-100 scale-[1.02] z-50 ring-2 ring-primary border-transparent' : 'hover:shadow-xl hover:-translate-y-1'}`}
                                    style={{ 
                                      borderLeft: `4px solid ${stage.color}`,
                                      ...provided.draggableProps.style 
                                    }}
                                  >
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-[13px] text-foreground tracking-tight line-clamp-2 group-hover/card:text-primary transition-colors leading-tight">{deal.title}</h4>
                                        <div className="flex items-center gap-2 mt-2">
                                          <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <UserIcon className="w-3 h-3 text-primary/70" />
                                          </div>
                                          <span className="text-[10px] font-black text-muted-foreground truncate max-w-[120px] uppercase tracking-tighter">{deal.contact?.name || 'Unknown'}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                      {deal.probability && (
                                        <div className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                          {deal.probability}% Prob
                                        </div>
                                      )}
                                      {deal.priority === 'high' || deal.priority === 'urgent' ? (
                                        <div className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">
                                          {deal.priority}
                                        </div>
                                      ) : null}
                                      {deal.expectedCloseDate && (
                                        <div className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1">
                                          <Calendar className="w-2.5 h-2.5" />
                                          {new Date(deal.expectedCloseDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                                      <div className="flex flex-col gap-1">
                                         <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest leading-none">
                                           {new Date(deal.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                         </p>
                                      </div>
                                      <p className="text-[13px] font-black text-foreground bg-muted/40 px-3 py-1 rounded-xl">₹{deal.value?.toLocaleString() || '0'}</p>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Create Deal Modal */}
      {isDealModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl transition-all animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-[2.5rem] shadow-premium border border-border overflow-hidden">
            <div className="p-8 border-b border-border/50 bg-muted/20">
              <h2 className="text-2xl font-black text-foreground tracking-tight">Fuel Your Growth</h2>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-60">
                Adding to {activePipeline?.name} • {activePipeline?.stages?.find(s => s.id === activeStage)?.title}
              </p>
            </div>
            
            <form onSubmit={handleCreateDeal} className="p-8 space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">The Opportunity</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Enterprise Expansion"
                  className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                  value={newDeal.title}
                  onChange={e => setNewDeal({...newDeal, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Win Probability (%)</label>
                   <input 
                    type="number" 
                    min="0"
                    max="100"
                    className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={newDeal.probability}
                    onChange={e => setNewDeal({...newDeal, probability: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Priority</label>
                   <select 
                    className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    value={newDeal.priority}
                    onChange={e => setNewDeal({...newDeal, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Value (₹)</label>
                   <input 
                    type="number" 
                    required
                    placeholder="0"
                    className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={isNaN(newDeal.value) ? "" : newDeal.value}
                    onChange={e => setNewDeal({...newDeal, value: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Expected Close</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={newDeal.expectedCloseDate}
                    onChange={e => setNewDeal({...newDeal, expectedCloseDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Partner</label>
                <select 
                  required
                  className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  value={newDeal.contactId}
                  onChange={e => setNewDeal({...newDeal, contactId: e.target.value})}
                >
                  <option value="">Select Partner</option>
                  {contacts.map((c, idx) => (
                    <option 
                      key={c._id || idx} 
                      value={c._id}
                      disabled={!!c.activeDealId}
                    >
                      {c.name} {c.activeDealId ? "• Active" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsDealModalOpen(false)}
                  className="flex-1 py-4 border border-border/60 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-muted/50 transition-all active:scale-95"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl transition-all animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-[2.5rem] shadow-premium border border-border overflow-hidden">
            <div className="p-8 border-b border-border/50 bg-muted/20">
              <h2 className="text-2xl font-black text-foreground tracking-tight">Design Your Funnel</h2>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Architect your sales journey</p>
            </div>
            
            <form onSubmit={handleCreatePipeline} className="p-8 space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Pipeline Identity</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Enterprise Velocity"
                  className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={newPipeline.name}
                  onChange={e => setNewPipeline({...newPipeline, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Strategy (Optional)</label>
                <textarea 
                  className="w-full px-5 py-4 bg-muted/40 border-none rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  placeholder="Describe your winning approach..."
                  rows="3"
                  value={newPipeline.description}
                  onChange={e => setNewPipeline({...newPipeline, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsPipelineModalOpen(false)}
                  className="flex-1 py-4 border border-border/60 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-muted/50 transition-all active:scale-95"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                >
                  Blueprint Funnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Deal Detail Drawer */}
      <DealDetailDrawer 
        dealId={selectedDealId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdate={() => fetchDeals(activePipeline?._id)}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
