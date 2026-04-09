"use client";

import React, { useState, useEffect } from "react";
import { 
  Heart, 
  Smartphone, 
  ShieldAlert, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Activity,
  Zap,
  Loader2
} from "lucide-react";
import { getWABAHealth } from "@/lib/api";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const WABAHealth = () => {
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await getWABAHealth();
      setHealthData(res.data || []);
    } catch (err) {
      toast.error("Failed to load WABA health metrics");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-white">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System & WABA Health</h1>
          <p className="text-slate-400 mt-1">Real-time status of all active WhatsApp Business Accounts</p>
        </div>
        <button 
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          <RefreshCcw size={18} className={cn(loading && "animate-spin")} />
          Refresh Status
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="animate-spin inline-block h-8 w-8 mb-4 text-emerald-500" />
          <p>Scanning WhatsApp Connectivity...</p>
        </div>
      ) : healthData.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-20 text-center text-slate-500 italic">
          No active WABA connections detected across the platform.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {healthData.map((item) => (
            <div 
              key={item.workspaceId}
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 hover:shadow-2xl hover:shadow-emerald-900/10 transition-all border-l-4 border-l-emerald-500"
              style={{ borderLeftColor: item.accountStatus === 'ACTIVE' ? '#10b981' : item.accountStatus === 'DISABLED' ? '#ef4444' : '#f59e0b' }}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {item.workspaceName}
                    {item.accountStatus === 'ACTIVE' ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : item.accountStatus === 'DISABLED' ? (
                      <XCircle size={18} className="text-red-500" />
                    ) : (
                      <Activity size={18} className="text-amber-500" />
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                    <Smartphone size={14} />
                    <span>{item.phoneNumber || "No number linked"}</span>
                  </div>
                </div>
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase",
                  item.accountStatus === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {item.accountStatus}
                </div>
              </div>

              {item.blocked && (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl mb-6 flex items-start gap-3">
                  <ShieldAlert className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-red-400 text-xs font-bold uppercase tracking-tight">Policy Restriction</p>
                    <p className="text-slate-300 text-sm mt-1">{item.blockReason || "Meta has restricted messaging for this account"}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Capabilities</p>
                  <p className="text-xs text-slate-300 font-mono">
                    {item.capabilities || "SMS, VOICE, WHATSAPP"}
                  </p>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Last Checked</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Clock size={12} className="text-slate-500" />
                    {item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleDateString() : 'Real-time syncing'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WABAHealth;
