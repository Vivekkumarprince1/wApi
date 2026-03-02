"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, getOnboardingStatus, saveBusinessInfo } from "@/lib/api";

const INDUSTRIES = [
  "Retail",
  "E-commerce",
  "Healthcare",
  "Education",
  "Travel",
  "Hospitality",
  "Real Estate",
  "Finance",
  "Other"
];

export default function BusinessInfoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    businessName: "",
    industry: "",
    companySize: "",
    website: "",
    companyLocation: "",
    annualRevenue: "",
    description: "",
    certificationType: "",
    certificationNumber: ""
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [me, onboarding] = await Promise.all([
          get('/auth/me'),
          getOnboardingStatus()
        ]);

        if (onboarding?.status?.steps?.businessInfo) {
          router.replace('/dashboard');
          return;
        }

        const workspace = me?.workspace || {};
        const docs = workspace?.documents || {};
        const docType = docs?.gstNumber
          ? 'gst'
          : docs?.msmeNumber
            ? 'msme'
            : docs?.panNumber
              ? 'pan'
              : '';
        const docNumber = docs?.gstNumber || docs?.msmeNumber || docs?.panNumber || '';

        setFormData((prev) => ({
          ...prev,
          businessName: workspace?.businessInfo?.name || '',
          industry: workspace?.businessInfo?.industry || '',
          website: workspace?.businessInfo?.website || '',
          companyLocation: [workspace?.businessInfo?.city, workspace?.businessInfo?.state, workspace?.businessInfo?.country].filter(Boolean).join(', '),
          certificationType: docType,
          certificationNumber: docNumber
        }));
      } catch (_err) {
        setError('Unable to load business profile. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.businessName || !formData.industry || !formData.certificationType || !formData.certificationNumber) {
      setError('Please fill required fields: business name, industry, certification type and number.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        businessName: formData.businessName,
        industry: formData.industry,
        companySize: formData.companySize,
        annualRevenue: formData.annualRevenue,
        website: formData.website,
        address: formData.companyLocation,
        description: formData.description,
        documentType: formData.certificationType,
        gstNumber: formData.certificationType === 'gst' ? formData.certificationNumber : undefined,
        msmeNumber: formData.certificationType === 'msme' ? formData.certificationNumber : undefined,
        panNumber: formData.certificationType === 'pan' ? formData.certificationNumber : undefined,
        certificationNumber: formData.certificationNumber
      };

      await saveBusinessInfo(payload);

      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save business info.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading business info form...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto bg-card border border-border/60 rounded-2xl p-6 md:p-8 shadow-premium">
        <h1 className="text-2xl font-bold text-foreground">Complete Business Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">This is required once. We use it for your business profile.</p>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input name="businessName" value={formData.businessName} onChange={handleChange} placeholder="Business Name *" className="input-premium" required />

          <select name="industry" value={formData.industry} onChange={handleChange} className="input-premium" required>
            <option value="">Select Industry *</option>
            {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="companySize" value={formData.companySize} onChange={handleChange} placeholder="Company Size" className="input-premium" />
            <input name="annualRevenue" value={formData.annualRevenue} onChange={handleChange} placeholder="Annual Revenue" className="input-premium" />
          </div>

          <input name="website" value={formData.website} onChange={handleChange} placeholder="Website" className="input-premium" />
          <input name="companyLocation" value={formData.companyLocation} onChange={handleChange} placeholder="Company Location" className="input-premium" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select name="certificationType" value={formData.certificationType} onChange={handleChange} className="input-premium" required>
              <option value="">Certification Type *</option>
              <option value="gst">GST</option>
              <option value="msme">MSME</option>
              <option value="pan">PAN</option>
              <option value="other">Other</option>
            </select>
            <input
              name="certificationNumber"
              value={formData.certificationNumber}
              onChange={handleChange}
              placeholder="Certification Number *"
              className="input-premium"
              required
            />
          </div>

          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Business Description"
            className="input-premium min-h-[100px]"
            maxLength={300}
          />

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
