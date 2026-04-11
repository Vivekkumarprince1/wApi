'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { useAuthStore, refetch } from '@/store/authStore';
import { 
  Check, 
  CreditCard, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  Loader2,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ChevronRight,
  CheckCircle2,
  XCircle,
  History,
  Clock,
  Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import LockedPage from '@/components/shared/LockedPage';

const FEATURE_NAMES = {
  'CRM': 'Sales CRM & Pipelines',
  'ANSWERBOT': 'AI AnswerBot',
  'ANALYTICS': 'Advanced Analytics',
  'AUTOMATION': 'Automation Engine',
  'BULK_CAMPAIGN': 'Bulk Campaigns',
  'WHATSAPP_FORMS': 'WhatsApp Forms'
};

export default function BillingPage() {
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingSub, setProcessingSub] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(500);
  const [processingRecharge, setProcessingRecharge] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedReason, setLockedReason] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Check for auto-recharge trigger from 402 redirection
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('action') === 'recharge') {
      setShowRechargeModal(true);
      // Clean up URL without reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, currentRes, walletRes, transRes] = await Promise.all([
        api.getPlans(),
        api.getSubscriptionStatus(),
        api.getWalletStatus(),
        api.getWalletTransactions({ limit: 10 })
      ]);
      setPlans(plansRes.data.filter(p => p.isActive));
      setCurrentPlan(currentRes.data);
      setWallet(walletRes.data);
      setTransactions(transRes.data?.transactions || transRes.data || []);
    } catch (err) {
      console.error('Failed to fetch billing status', err);
      if (err.status === 403) {
        setIsLocked(true);
        setLockedReason("You don't have permission to view or manage billing settings.");
      }
    } finally {
      setLoading(false);
      setLoadingTransactions(false);
    }
  };

  const handleSubscribe = async (planId) => {
    try {
      setProcessingSub(planId);
      const resp = await api.createSubscription(planId, 'monthly');
      const orderData = resp.data || resp;

      if (orderData?.isMock) {
        window.location.href = orderData.shortUrl;
        return;
      }

      if (orderData?.subscriptionId || orderData?.orderId) {
        const options = {
          key: orderData.keyId,
          subscription_id: orderData.subscriptionId,
          order_id: orderData.orderId,
          name: 'WhatsApp SaaS',
          description: `Subscription: ${plans.find(p => p._id === planId)?.name}`,
          handler: async (response) => {
            try {
              toast.loading('Verifying upgrade...', { id: 'verify-sub' });
              await api.verifySubscription({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              });
              toast.success('Plan activated!', { id: 'verify-sub' });
              await refetch();
              fetchData();
            } catch (err) {
              toast.error('Payment succeeded but activation failed. Contact support.', { id: 'verify-sub' });
            }
          },
          theme: { color: '#3b82f6' }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate subscription');
    } finally {
      setProcessingSub(null);
    }
  };

  const handleRecharge = async () => {
    try {
      setProcessingRecharge(true);
      const amountPaise = rechargeAmount * 100;
      const resp = await api.initiateRecharge(amountPaise);
      
      // Axios interceptor returns response.data directly
      const orderData = resp.data || resp;

      if (orderData?.isMock) {
        toast.loading('Simulating payment...', { id: 'mock-recharge' });
        await api.verifyRecharge({
          razorpay_payment_id: 'pay_mock_' + Date.now(),
          razorpay_order_id: orderData.orderId,
          razorpay_signature: 'mock_sig',
          isMock: true
        });
        toast.success(`Wallet topped up by ₹${rechargeAmount}!`, { id: 'mock-recharge' });
        setShowRechargeModal(false);
        fetchData();
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount || amountPaise,
        currency: orderData.currency || 'INR',
        name: 'WhatsApp SaaS',
        description: `Wallet Recharge: ₹${rechargeAmount}`,
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            toast.loading('Verifying payment...', { id: 'verify-recharge' });
            await api.verifyRecharge(response);
            toast.success('Recharge successful!', { id: 'verify-recharge' });
            setShowRechargeModal(false);
            fetchData();
            await refetch();
          } catch (err) {
            toast.error('Verification failed. Contact support.', { id: 'verify-recharge' });
          }
        },
        theme: { color: '#3b82f6' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate recharge');
    } finally {
      setProcessingRecharge(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  const activePlanId = currentPlan?.plan?._id || currentPlan?.plan;

  if (isLocked) {
    return (
      <LockedPage 
        title="Billing & Plan Locked"
        description={lockedReason}
        requiredRole="Admin"
        isUpgradeRequired={false}
      />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Plan & Billing
          </h1>
          <p className="text-slate-400 mt-2">Scale your business messaging with flexible subscription tiers</p>
        </div>
        
        {currentPlan ? (
          <div className="px-6 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
              <ShieldCheck size={28} />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Current Plan</p>
              <p className="text-lg font-bold text-emerald-400">{currentPlan.plan?.name || 'Active Plan'}</p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500">
              <Loader2 className="animate-spin text-amber-500" size={28} />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</p>
              <p className="text-lg font-bold text-amber-400">Loading Plan...</p>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 backdrop-blur-xl border border-indigo-500/20 rounded-[2.5rem] p-8 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                  <Wallet size={24} />
                </div>
                <h3 className="text-xl font-bold">Wallet Balance</h3>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Available Credit</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">₹{(wallet?.balance / 100 || 0).toLocaleString()}</span>
                  <span className="text-slate-500 font-medium">INR</span>
                </div>
              </div>

              {wallet?.isLow && (
                <div className="mt-4 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-500 text-sm">
                  <AlertTriangle size={16} />
                  <span>Low balance! Top up to avoid service interruption</span>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowRechargeModal(true)}
              className="mt-8 w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              Recharge Now <ArrowUpRight size={20} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Why top up?</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
              <h4 className="font-bold text-blue-400 mb-1">Scale Campaigns</h4>
              <p className="text-sm text-slate-400">Pre-paid balance is required for business-initiated template messages across all plans.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
              <h4 className="font-bold text-emerald-400 mb-1">Pay Per Category</h4>
              <p className="text-sm text-slate-400">Marketing, Utility, and Auth templates are billed per conversation window directly from the wallet.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
              <h4 className="font-bold text-purple-400 mb-1">Automation Safety</h4>
              <p className="text-sm text-slate-400">Ensure your automated workflows never pause due to usage limits.</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
              <h4 className="font-bold text-amber-400 mb-1">Full Transparency</h4>
              <p className="text-sm text-slate-400">View exact costs per template and conversation in your billing ledger.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mock Simulation Alert */}
      {typeof window !== 'undefined' && window.location.search.includes('mock_checkout=true') && (
        <div className="bg-blue-600/20 border border-blue-500/50 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shrink-0">
              <Zap size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Mock Checkout Active</h3>
              <p className="text-blue-200 text-sm">Since Razorpay is not configured, we&apos;ve entered simulation mode.</p>
            </div>
          </div>
          <button 
            onClick={async () => {
              const urlParams = new URLSearchParams(window.location.search);
              const subId = urlParams.get('sub_id');
              try {
                await api.simulateMockSuccess(subId);
                toast.success('Subscription activated successfully (Simulation)');
                window.location.href = '/dashboard/billing';
              } catch (e) {
                toast.error('Simulation failed');
              }
            }}
            className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black hover:scale-105 transition-transform active:scale-95 shadow-xl"
          >
            CONFIRM MOCK PAYMENT
          </button>
        </div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const isActive = activePlanId === plan._id;
          return (
            <div 
              key={plan._id}
              className={`relative bg-slate-900/40 backdrop-blur-xl border-2 rounded-[2.5rem] p-8 transition-all hover:scale-[1.03] flex flex-col ${isActive ? 'border-blue-500 shadow-2xl shadow-blue-500/10' : 'border-slate-800/50 hover:border-slate-700'}`}
            >
              {isActive && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                  CURRENT PLAN
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">{(plan.monthlyBaseFeeCents / 100).toLocaleString('en-IN', { style: 'currency', currency: plan.currency })}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-10 text-sm">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Capabilities</div>
                {plan.features?.map((feat) => (
                  <div key={feat} className="flex items-center gap-3 text-slate-300">
                    <div className="w-5 h-5 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                      <Check size={14} />
                    </div>
                    {FEATURE_NAMES[feat] || feat}
                  </div>
                ))}
                
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2">Usage Limits</div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Contacts</span>
                  <span className="font-mono text-white">{plan.limits?.maxContacts?.toLocaleString() || '1,000'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Messages / mo</span>
                  <span className="font-mono text-white">{plan.limits?.maxMessagesPerMonth?.toLocaleString() || '10,000'}</span>
                </div>
              </div>

              <button
                disabled={isActive || processingSub === plan._id}
                onClick={() => handleSubscribe(plan._id)}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${isActive ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-900/20 active:scale-95'}`}
              >
                {processingSub === plan._id ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : isActive ? (
                  'Active'
                ) : (
                  <>Upgrade Now <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800/50">
          <div className="flex items-center gap-3 mb-4">
            <History className="text-blue-400" />
            <h3 className="text-xl font-bold">Billing History</h3>
          </div>
          <p className="text-slate-400 text-sm mb-6">View and download your recent invoices</p>
          
          <div className="space-y-3">
            {loadingTransactions ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin text-blue-500 mx-auto" size={24} />
              </div>
            ) : transactions.length > 0 ? (
              transactions.map((tx) => {
                const isCredit = tx.type === 'RECHARGE' || tx.type === 'BONUS' || tx.type === 'REFUND' || tx.type === 'UNPARK';
                const isSubscription = tx.type === 'SUBSCRIPTION_PURCHASE';
                
                return (
                  <div key={tx._id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isCredit ? 'bg-emerald-500/10 text-emerald-500' : 
                        isSubscription ? 'bg-purple-500/10 text-purple-400' : 
                        'bg-rose-500/10 text-rose-500'
                      }`}>
                        {isCredit ? <Plus size={18} /> : 
                         isSubscription ? <Zap size={18} /> : 
                         <ArrowUpRight size={18} className="rotate-180" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{tx.description || tx.type}</p>
                        <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black ${isCredit ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {isCredit ? '+' : '-'} ₹{(tx.amount / 100).toLocaleString()}
                      </p>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${tx.status === 'COMPLETED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-2xl">
                <p className="text-slate-500 italic">No recent transactions found</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800/50">
          <div className="flex items-center gap-3 mb-4 text-amber-500">
            <AlertTriangle />
            <h3 className="text-xl font-bold">Billing Support</h3>
          </div>
          <p className="text-slate-400 text-sm mb-6">Need help with your subscription or payments?</p>
          <a 
            href="#" 
            className="block w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-center font-semibold transition-colors"
          >
            Contact Support Team
          </a>
        </div>
      </div>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Recharge Wallet</h3>
            <p className="text-slate-400 mb-8 text-sm">Add funds to send template messages and start conversations.</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setRechargeAmount(amt)}
                  className={`p-4 rounded-2xl border-2 font-bold transition-all ${rechargeAmount === amt ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 hover:border-slate-700 text-slate-400'}`}
                >
                  ₹{amt.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <button
                disabled={processingRecharge}
                onClick={handleRecharge}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {processingRecharge ? <Loader2 className="animate-spin" /> : <>Pay ₹{rechargeAmount.toLocaleString()}</>}
              </button>
              <button
                disabled={processingRecharge}
                onClick={() => setShowRechargeModal(false)}
                className="w-full py-4 text-slate-400 hover:text-white font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
