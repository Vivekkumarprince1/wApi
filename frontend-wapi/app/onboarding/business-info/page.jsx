"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaBuilding, FaGlobe, FaMapMarkerAlt, FaBriefcase, FaCheckCircle, FaSpinner, FaIdCard } from 'react-icons/fa';
import { saveBusinessInfo } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function BusinessInfoPage() {
  const router = useRouter();
  const { user, fetchSession, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    companySize: '',
    website: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    zipCode: '',
    gstNumber: '',
    panNumber: ''
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    // Pre-fill business name from workspace if available
    if (user.workspace?.name && !formData.businessName) {
      setFormData(prev => ({ ...prev, businessName: user.workspace.name }));
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await saveBusinessInfo(formData);
      await fetchSession(true); // Refresh session to update onboarding status
      router.push('/dashboard'); // After business info, go to dashboard (where WhatsApp setup starts)
    } catch (err) {
      setError(err.message || 'Failed to save business information');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full bg-white/95 backdrop-blur rounded-3xl shadow-2xl border border-white/20 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 3 of 3</span>
            <span className="text-sm font-medium text-primary">Business Information</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <FaBuilding className="text-3xl text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Configure your business</h1>
          <p className="text-muted-foreground text-sm">Provide your business details to complete the setup and start using WhatsApp Business API.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <FaBriefcase className="text-emerald-600" /> Business Name *
              </label>
              <input
                required
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="ACME Corp"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <FaGlobe className="text-emerald-600" /> Website URL
              </label>
              <input
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                 Industry *
              </label>
              <select
                required
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
              >
                <option value="">Select Industry</option>
                <option value="Technology">Technology</option>
                <option value="Retail">Retail</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education">Education</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Finance">Finance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Company Size */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Company Size</label>
              <select
                name="companySize"
                value={formData.companySize}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
              >
                <option value="">Select Size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="200+">200+ employees</option>
              </select>
            </div>
          </div>

          {/* Address Fields */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <label className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-slate-500">
              <FaMapMarkerAlt /> Address Details
            </label>
            
            <div className="grid grid-cols-1 gap-4">
              <input
                required
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Business Address *"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input
                required
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City *"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <input
                required
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State *"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <input
                required
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="Zip *"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
               <input
                required
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Country *"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Tax ID Details (Optional) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <label className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-slate-500">
              <FaIdCard /> Identification (Optional)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="GST Number"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <input
                name="panNumber"
                value={formData.panNumber}
                onChange={handleChange}
                placeholder="PAN Number"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8 shadow-emerald-200"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                Saving Business Info...
              </>
            ) : (
              <>
                <FaCheckCircle />
                Complete Setup
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
