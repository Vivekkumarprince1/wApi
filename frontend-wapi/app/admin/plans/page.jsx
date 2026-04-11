'use client';

import React, { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { 
  CreditCard, 
  Plus, 
  Shield, 
  Zap, 
  BarChart3, 
  Bot, 
  Check, 
  Trash2, 
  Edit2, 
  X,
  Package,
  Layers,
  Users,
  Code2,
  Puzzle,
  MessageSquare,
  FileText,
  Inbox,
  Contact2,
  Megaphone,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const FEATURE_OPTIONS = [
  { id: 'CRM', name: 'Sales CRM & Pipelines', icon: Shield },
  { id: 'ANSWERBOT', name: 'AI AnswerBot', icon: Bot },
  { id: 'ANALYTICS', name: 'Advanced Analytics', icon: BarChart3 },
  { id: 'AUTOMATION', name: 'Automation Engine', icon: Zap },
  { id: 'BULK_CAMPAIGN', name: 'Bulk Campaigns', icon: Layers },
  { id: 'COMMERCE', name: 'WhatsApp Commerce Catalog', icon: ShoppingCart },
  { id: 'WHATSAPP_FORMS', name: 'WhatsApp Interactive Forms', icon: FileText },
  { id: 'TEAM', name: 'Team Management', icon: Users },
  { id: 'DEVELOPER_API', name: 'Developer API & Webhooks', icon: Code2 },
  { id: 'INTEGRATIONS', name: 'External Integrations', icon: Puzzle },
  { id: 'WIDGET', name: 'Custom Chat Widget', icon: MessageSquare },
  { id: 'TEMPLATES', name: 'Advanced Templates', icon: FileText },
  { id: 'INBOX', name: 'Shared Team Inbox', icon: Inbox },
  { id: 'CONTACTS', name: 'Contact Management', icon: Contact2 },
  { id: 'ADS', name: 'Click-to-WhatsApp Ads', icon: Megaphone }
];

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    monthlyBaseFeeCents: 0,
    currency: 'INR',
    features: [],
    limits: {
      maxContacts: 1000,
      maxMessagesPerMonth: 10000,
      maxAutomations: 5,
      maxTemplates: 20
    },
    fixedPricePaise: {
      marketing: 80,
      utility: 40,
      authentication: 30,
      service: 0
    },
    razorpayPlanId: ''
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await axios.get('/billing/plans');
      setPlans(data);
    } catch (err) {
      toast.error('Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeature = (featureId) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(f => f !== featureId)
        : [...prev.features, featureId]
    }));
  };

  const handleDelete = async (planId) => {
    if (!window.confirm("Are you sure you want to PERMANENTLY delete this plan? This action cannot be undone and will remove it from the database.")) return;

    try {
      // Always use force=true for the Trash button now as per user preference
      const url = `/billing/plans/${planId}?force=true`;
      const { data } = await axios.delete(url);
      toast.success(data.message || 'Plan deleted successfully');
      fetchPlans();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Deletion failed';
      toast.error(errorMsg);
      
      // If backend says plan is in use, we can offer to just deactivate it instead
      if (err.response?.data?.code === 'PLAN_IN_USE' && window.confirm("This plan is currently in use and cannot be deleted. Would you like to deactivate it instead (hide it from new users)?")) {
        try {
          await axios.delete(`/billing/plans/${planId}`);
          toast.success("Plan deactivated successfully");
          fetchPlans();
        } catch (softErr) {
          toast.error("Deactivation also failed");
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await axios.patch(`/billing/plans/${editingPlan._id}`, formData);
        toast.success('Plan updated successfully');
      } else {
        await axios.post('/billing/plans', formData);
        toast.success('Plan created successfully');
      }
      setIsModalOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      monthlyBaseFeeCents: plan.monthlyBaseFeeCents,
      currency: plan.currency || 'INR',
      features: plan.features || [],
      limits: plan.limits || {
        maxContacts: 1000,
        maxMessagesPerMonth: 10000,
        maxAutomations: 5,
        maxTemplates: 20
      },
      fixedPricePaise: plan.fixedPricePaise || {
        marketing: 80,
        utility: 40,
        authentication: 30,
        service: 0
      },
      razorpayPlanId: plan.razorpayPlanId || ''
    });
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8 text-white">Loading plans...</div>;

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Subscription Plans
            </h1>
            <p className="text-slate-400 mt-2">Manage your platform pricing tiers and feature access</p>
          </div>
          <button 
            onClick={() => {
              setEditingPlan(null);
              setFormData({
                name: '',
                slug: '',
                monthlyBaseFeeCents: 0,
                currency: 'INR',
                features: [],
                limits: { maxContacts: 1000, maxMessagesPerMonth: 10000, maxAutomations: 5, maxTemplates: 20 },
                fixedPricePaise: { marketing: 80, utility: 40, authentication: 30, service: 0 },
                razorpayPlanId: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            Create New Plan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan._id} 
              className={`relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 transition-all hover:scale-[1.02] hover:border-slate-700 ${!plan.isActive ? 'opacity-50 grayscale' : ''}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-xs font-mono text-blue-400 mb-4 inline-block">
                    {plan.slug.toUpperCase()}
                  </span>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(plan)} 
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="Edit Plan"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(plan._id)} 
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete Permanently"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold">{(plan.monthlyBaseFeeCents / 100).toLocaleString('en-IN', { style: 'currency', currency: plan.currency })}</span>
                <span className="text-slate-400 text-sm"> / month</span>
              </div>

              <div className="space-y-3 mb-8">
                {FEATURE_OPTIONS.map((f) => {
                  const hasFeature = plan.features?.includes(f.id);
                  const Icon = f.icon;
                  return (
                    <div key={f.id} className={`flex items-center gap-3 text-sm ${hasFeature ? 'text-emerald-400' : 'text-slate-500 line-through'}`}>
                      <Icon size={16} />
                      {f.name}
                    </div>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-slate-800/50 text-xs text-slate-500">
                <div className="flex justify-between mb-1">
                  <span>Contacts Limit:</span>
                  <span className="text-slate-300">{plan.limits?.maxContacts.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modern Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Plan Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Slug (ID-like, unique)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Base Price (in Paise/Cents)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.monthlyBaseFeeCents}
                    onChange={(e) => setFormData({...formData, monthlyBaseFeeCents: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

              {/* Per Message Pricing */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-400 border-b border-slate-800 pb-2">Per Message Pricing (Paise)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Marketing</label>
                    <input 
                      type="number" 
                      value={formData.fixedPricePaise?.marketing || 0}
                      onChange={(e) => setFormData({...formData, fixedPricePaise: {...formData.fixedPricePaise, marketing: parseInt(e.target.value) || 0}})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Utility</label>
                    <input 
                      type="number" 
                      value={formData.fixedPricePaise?.utility || 0}
                      onChange={(e) => setFormData({...formData, fixedPricePaise: {...formData.fixedPricePaise, utility: parseInt(e.target.value) || 0}})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Authentication</label>
                    <input 
                      type="number" 
                      value={formData.fixedPricePaise?.authentication || 0}
                      onChange={(e) => setFormData({...formData, fixedPricePaise: {...formData.fixedPricePaise, authentication: parseInt(e.target.value) || 0}})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Service (Session)</label>
                    <input 
                      type="number" 
                      value={formData.fixedPricePaise?.service || 0}
                      onChange={(e) => setFormData({...formData, fixedPricePaise: {...formData.fixedPricePaise, service: parseInt(e.target.value) || 0}})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm text-slate-400">Enabled Features</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FEATURE_OPTIONS.map((f) => {
                    const isSelected = formData.features.includes(f.id);
                    return (
                      <button 
                        key={f.id}
                        type="button"
                        onClick={() => handleToggleFeature(f.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${isSelected ? 'bg-blue-600/10 border-blue-600 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                      >
                        <f.icon size={18} />
                        <span className="text-sm font-medium">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800">
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-900/20 transition-all active:scale-[0.98]"
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
