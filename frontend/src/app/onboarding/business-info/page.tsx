"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Globe, MapPin, Briefcase, CheckCircle, Loader2, CreditCard } from 'lucide-react';
import { saveBusinessInfo } from '@/lib/api/business';
import { useAuthStore } from '@/store/auth-store';

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
      setFormData(prev => ({ ...prev, businessName: user.workspace?.name || '' }));
    }
  }, [user, authLoading, router, formData.businessName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await saveBusinessInfo(formData);
      await fetchSession(true);
      router.push(result?.nextStep || '/onboarding/business-verification');
    } catch (err: any) {
      setError(err.message || 'Failed to save business information');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-4xl text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full bg-card/80 backdrop-blur-md rounded-xl shadow-premium border border-border p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 3 of 3</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Business Information</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Configure your business</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">Provide your business details to complete the setup and start using WhatsApp Business API.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="text-primary w-4 h-4" /> Business Name *
              </label>
              <input
                required
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="ACME Corp"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="text-primary w-4 h-4" /> Website URL
              </label>
              <input
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                 Industry *
              </label>
              <select
                required
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Company Size</label>
              <select
                name="companySize"
                value={formData.companySize}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
              >
                <option value="">Select Size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="200+">200+ employees</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <label className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
              <MapPin className="w-4 h-4" /> Address Details
            </label>
            
            <div className="grid grid-cols-1 gap-4">
              <input
                required
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Business Address *"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input
                required
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City *"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
              <input
                required
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State *"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
              <input
                required
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="Zip *"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
               <input
                required
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Country *"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <label className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
              <CreditCard className="w-4 h-4" /> Identification (Optional)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="GST Number"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
              <input
                name="panNumber"
                value={formData.panNumber}
                onChange={handleChange}
                placeholder="PAN Number"
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Saving Business Info...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Complete Setup
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
