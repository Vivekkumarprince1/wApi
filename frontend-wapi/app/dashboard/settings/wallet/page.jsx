'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wallet, RefreshCcw, History, ArrowRight, 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  AlertCircle, Loader2, Info, Plus
} from 'lucide-react';
import FlashLoader from '@/components/ui/FlashLoader';
import { get } from '@/lib/api';

export default function WalletSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balance: 0, parkedBalance: 0, currency: 'INR' });
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const [walletRes, transRes] = await Promise.all([
        get('/settings/wallet'),
        get('/settings/wallet/transactions')
      ]);
      
      if (walletRes.success) setWallet(walletRes.data);
      if (transRes.success) setTransactions(transRes.data);
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'RECHARGE': return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
      case 'PARK': return <ShieldCheck className="h-4 w-4 text-amber-500" />;
      case 'SPEND': return <ArrowDownLeft className="h-4 w-4 text-primary" />;
      default: return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) return <FlashLoader />;

  return (
    <div className="max-w-5xl mx-auto p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Wallet & Credits</h1>
        <p className="text-sm text-muted-foreground">Manage pre-paid credits for delivery optimization features.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Balance Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Available Balance */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20">
                 <Wallet className="h-16 w-16" />
               </div>
               <div className="relative z-10">
                 <p className="text-sm font-medium text-white/80 flex items-center gap-1.5 mb-2">
                   Available Balance
                   <Info className="h-3.5 w-3.5" />
                 </p>
                 <div className="flex items-baseline gap-2">
                   <h2 className="text-4xl font-bold">{wallet.currency} {wallet.balance.toLocaleString()}</h2>
                   <span className="text-xs font-medium text-white/70">Credits</span>
                 </div>
                 <button className="mt-6 w-full py-2.5 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2">
                   <Plus className="h-5 w-5" /> Recharge Wallet
                 </button>
               </div>
            </div>

            {/* Parked Balance */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-premium relative">
               <div className="flex items-center gap-2 mb-2">
                 <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Parked Balance</p>
                 <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
               </div>
               <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold text-foreground">{wallet.currency} {wallet.parkedBalance.toLocaleString()}</h2>
                  <span className="text-xs text-muted-foreground">Reserved</span>
               </div>
               <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                 Credits currently reserved for active campaigns and pending automated retries.
               </p>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-card border border-border rounded-2xl shadow-premium overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Transaction History
              </h3>
              <button onClick={loadWalletData} className="p-2 hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-primary">
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs">Transaction</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs">Reference</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs">Amount</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-muted-foreground italic">
                        No transactions found yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              {getTransactionIcon(tx.type)}
                            </div>
                            <div>
                               <p className="font-bold text-foreground">{tx.type}</p>
                               <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-medium text-foreground">{tx.referenceType} #{tx.referenceId.slice(-6).toUpperCase()}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{tx.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-bold ${tx.type === 'RECHARGE' ? 'text-emerald-600' : tx.type === 'SPEND' ? 'text-primary' : 'text-foreground'}`}>
                            {tx.type === 'RECHARGE' ? '+' : '-'}{tx.amount}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                             tx.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                           }`}>
                             {tx.status}
                           </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {transactions.length > 0 && (
              <div className="p-4 bg-muted/20 text-center border-t border-border">
                <button className="text-xs font-bold text-primary hover:underline">View All Transactions</button>
              </div>
            )}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
           <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
              <h4 className="font-bold text-blue-700 flex items-center gap-2 mb-3">
                <Info className="h-4 w-4" /> Understanding Credits
              </h4>
              <ul className="space-y-4">
                <li className="text-xs text-foreground/80 leading-relaxed">
                  <strong className="text-blue-700 block mb-1">Pre-paid Model:</strong> 
                  Delivery optimization features (RCS & Retries) require upfront credits. 1 credit = 1 message attempt.
                </li>
                <li className="text-xs text-foreground/80 leading-relaxed">
                  <strong className="text-blue-700 block mb-1">Parking:</strong> 
                  When you launch a campaign, credits for all recipients are "parked" to ensure delivery.
                </li>
                <li className="text-xs text-foreground/80 leading-relaxed">
                  <strong className="text-blue-700 block mb-1">Reconciliation:</strong> 
                  Successful delivery converts parked balance to spent. Failures without fallback are refunded to Available Balance.
                </li>
              </ul>
           </div>

           <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
              <h4 className="font-bold text-amber-700 flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4" /> Usage Limits
              </h4>
              <p className="text-xs text-foreground/80 leading-relaxed">
                 You are currently on the **Advanced Plan**. Your daily limit for delivery optimization is **10,000 credits**.
              </p>
              <button className="mt-4 w-full py-2 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-bold hover:bg-amber-500/20 transition-all">
                Increase Limit
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
