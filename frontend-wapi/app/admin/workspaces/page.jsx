"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Search, 
  Filter, 
  ShieldCheck, 
  ShieldAlert, 
  Pause, 
  Play, 
  Edit3, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  CreditCard,
  History,
  Loader2
} from "lucide-react";
import { getAllWorkspaces, suspendWorkspace, resumeWorkspace, updateWorkspacePlan } from "@/lib/api";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const WorkspaceManagement = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [plans, setPlans] = useState([]); // This would normally be fetched too
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWS, setSelectedWS] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
    fetchPlans();
  }, []);

  const fetchWorkspaces = async (searchVal = searchTerm) => {
    setLoading(true);
    try {
      const res = await getAllWorkspaces({ limit: 50, search: searchVal });
      setWorkspaces(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch workspaces");
    }
    setLoading(false);
  };

  const fetchPlans = async () => {
    try {
      const { getPlans } = await import("@/lib/api");
      const res = await getPlans();
      setPlans(res.data?.filter(p => p.isActive) || []);
    } catch (err) {
      console.error("Failed to fetch plans", err);
    }
  };

  const handleManualPlanUpdate = async (planId) => {
    try {
      toast.loading("Updating plan...", { id: "update-plan" });
      await updateWorkspacePlan(selectedWS.id, planId);
      toast.success("Workspace plan updated successfully", { id: "update-plan" });
      setShowPlanModal(false);
      fetchWorkspaces();
    } catch (err) {
      toast.error("Failed to update plan", { id: "update-plan" });
    }
  };

  const handleToggleSuspension = async (ws) => {
    try {
      if (ws.suspended) {
        await resumeWorkspace(ws.id);
        toast.success("Workspace resumed");
      } else {
        await suspendWorkspace(ws.id, "Admin suspension");
        toast.success("Workspace suspended");
      }
      fetchWorkspaces();
    } catch (err) {
      toast.error("Suspension update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Workspaces</h1>
          <p className="text-slate-400 mt-1">Audit and control all tenant accounts</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/20">
            <TrendingUp size={16} />
            <span className="text-sm font-bold">12% Growth this month</span>
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-[2rem] flex items-center gap-4 shadow-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Search by workspace name, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchWorkspaces()}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
          />
        </div>
        <button 
          onClick={() => fetchWorkspaces()}
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-bold transition-all"
        >
          Search
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-500">
            <Loader2 className="animate-spin inline-block h-8 w-8 mb-4 text-blue-500" />
            <p className="font-medium">Managing tenants...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-600 italic">No workspaces found</div>
        ) : (
          workspaces.map((ws) => (
            <div 
              key={ws.id}
              className={cn(
                "group relative bg-slate-900 border rounded-[2.5rem] p-6 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-900/10",
                ws.suspended ? "border-red-900/50 grayscale-[0.8]" : "border-slate-800 hover:border-slate-700"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                    {ws.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">ID: {ws.id}</p>
                </div>
                {ws.suspended ? (
                  <div className="p-2 bg-red-500/10 text-red-500 rounded-full" title="Suspended">
                    <ShieldAlert size={18} />
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-full" title="Active">
                    <ShieldCheck size={18} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none">Subscription</p>
                  <p className="text-sm text-blue-400 font-bold">{ws.plan?.name || (typeof ws.plan === 'string' ? ws.plan : 'Starter')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none">Members</p>
                  <p className="text-sm text-white font-bold">{ws.memberCount} Teams</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-2xl mb-6 border border-slate-800/50">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                  {ws.owner?.name?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="text-slate-300 font-semibold truncate">{ws.owner?.name || "No Owner"}</p>
                  <p className="text-slate-500 truncate">{ws.owner?.email || "Unknown Email"}</p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-2 pt-4 border-t border-slate-800/50">
                <button 
                  onClick={() => { setSelectedWS(ws); setShowPlanModal(true); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 py-3 rounded-xl transition-all border border-slate-700"
                >
                  <CreditCard size={14} /> <span className="text-xs font-bold uppercase">Plan</span>
                </button>
                <button 
                  onClick={() => handleToggleSuspension(ws)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all border",
                    ws.suspended 
                      ? "bg-emerald-600/10 text-emerald-500 border-emerald-600/30 hover:bg-emerald-600/20" 
                      : "bg-red-600/10 text-red-500 border-red-600/30 hover:bg-red-600/20"
                  )}
                >
                  {ws.suspended ? <Play size={14} /> : <Pause size={14} />}
                  <span className="text-xs font-bold uppercase">{ws.suspended ? 'Resume' : 'Suspend'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Plan Modal - Simplistic demo */}
      {showPlanModal && selectedWS && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Upgrade/Downgrade Plan</h2>
            <p className="text-slate-400 mb-6 font-medium text-sm">Force override the plan for <span className="text-white">{selectedWS.name}</span></p>
            
            <div className="space-y-3 mb-8 max-h-[40vh] overflow-y-auto pr-2">
              {plans.map(plan => (
                <button 
                  key={plan._id}
                  className={cn(
                    "w-full flex items-center justify-between p-4 bg-slate-950 border rounded-2xl transition-all group",
                    selectedWS.plan?.id === plan._id ? "border-blue-500 bg-blue-500/5" : "border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  )}
                  onClick={() => handleManualPlanUpdate(plan._id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-200 block">{plan.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">₹{plan.monthlyBaseFeeCents / 100}/mo</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-600 group-hover:text-blue-400" />
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowPlanModal(false)}
              className="w-full py-4 text-slate-500 hover:text-white font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceManagement;
