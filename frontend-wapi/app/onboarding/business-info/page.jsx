"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, saveBusinessInfo } from "@/lib/api";
import { FaSpinner } from "react-icons/fa";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const businessInfoSchema = z.object({
  businessName: z.string().min(2, 'Business Name is required'),
  industry: z.string().min(1, 'Please select an industry'),
  companySize: z.string().optional(),
  annualRevenue: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  address: z.string().min(5, 'Main address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  country: z.string().min(2, 'Country is required'),
  zipCode: z.string().min(2, 'Zip code is required'),
  certificationType: z.string().min(1, 'Certification Type is required'),
  certificationNumber: z.string().min(2, 'Certification Number is required'),
  description: z.string().max(300, 'Description cannot exceed 300 characters').optional(),
});

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

import { useAuthStore } from "@/store/authStore";

export default function BusinessInfoPage() {
  const router = useRouter();
  const { user, workspace, loading: authLoading, fetchSession } = useAuthStore();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      businessName: "",
      industry: "",
      companySize: "",
      website: "",
      address: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
      annualRevenue: "",
      description: "",
      certificationType: "",
      certificationNumber: ""
    }
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
        router.push('/auth/login');
        return;
    }

    if (!user.emailVerified) {
      router.replace('/auth/verify-email?reason=onboarding');
      return;
    }

    // Check onboarding status from session
    if (workspace?.onboardingStatus === 'completed' || workspace?.onboarding?.businessInfoCompleted) {
      router.replace('/dashboard');
      return;
    }

    if (!user.phoneVerified && !useAuthStore.getState().phone?.verified) {
      router.replace('/onboarding/verify-mobile');
      return;
    }

    // Hydration from store (Unified Session)
    if (workspace) {
        reset({
            businessName: workspace.name || '',
            industry: workspace.industry || '',
            website: workspace.website || '',
            address: workspace.address || '',
            city: workspace.city || '',
            state: workspace.state || '',
            country: workspace.country || '',
            zipCode: workspace.zipCode || '',
            companySize: workspace.companySize || '',
            annualRevenue: workspace.annualRevenue || '',
            description: workspace.description || '',
            certificationType: workspace.businessDocuments?.documentType || '',
            certificationNumber: workspace.businessDocuments?.certificationNumber || '',
        });
    }
  }, [user, workspace, authLoading, router, reset]);

  const onSubmit = async (values) => {
    setError('');

    try {
      await saveBusinessInfo(values);
      await fetchSession(true); // Update store
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save business info.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
            <FaSpinner className="animate-spin text-4xl text-emerald-500" />
            <div className="text-sm text-slate-400">Loading business profile...</div>
        </div>
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

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1">
            <input {...register("businessName")} placeholder="Business Name *" className={`input-premium ${errors.businessName ? 'border-destructive' : ''}`} />
            {errors.businessName && <p className="text-xs text-destructive">{errors.businessName.message}</p>}
          </div>

          <div className="space-y-1">
            <select {...register("industry")} className={`input-premium ${errors.industry ? 'border-destructive' : ''}`}>
              <option value="">Select Industry *</option>
              {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
            </select>
            {errors.industry && <p className="text-xs text-destructive">{errors.industry.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <input {...register("companySize")} placeholder="Company Size" className="input-premium" />
            </div>
            <div className="space-y-1">
              <input {...register("annualRevenue")} placeholder="Annual Revenue" className="input-premium" />
            </div>
          </div>

          <div className="space-y-1">
            <input {...register("website")} placeholder="Website" className={`input-premium ${errors.website ? 'border-destructive' : ''}`} />
            {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
          </div>

          <div className="space-y-1">
            <input {...register("address")} placeholder="Business Address *" className={`input-premium ${errors.address ? 'border-destructive' : ''}`} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <input {...register("city")} placeholder="City *" className={`input-premium ${errors.city ? 'border-destructive' : ''}`} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-1">
              <input {...register("state")} placeholder="State *" className={`input-premium ${errors.state ? 'border-destructive' : ''}`} />
              {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <input {...register("country")} placeholder="Country *" className={`input-premium ${errors.country ? 'border-destructive' : ''}`} />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
            </div>
            <div className="space-y-1">
              <input {...register("zipCode")} placeholder="Zip Code *" className={`input-premium ${errors.zipCode ? 'border-destructive' : ''}`} />
              {errors.zipCode && <p className="text-xs text-destructive">{errors.zipCode.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <select {...register("certificationType")} className={`input-premium ${errors.certificationType ? 'border-destructive' : ''}`}>
                <option value="">Certification Type *</option>
                <option value="gst">GST</option>
                <option value="msme">MSME</option>
                <option value="pan">PAN</option>
                <option value="other">Other</option>
              </select>
              {errors.certificationType && <p className="text-xs text-destructive">{errors.certificationType.message}</p>}
            </div>
            <div className="space-y-1">
              <input
                {...register("certificationNumber")}
                placeholder="Certification Number *"
                className={`input-premium ${errors.certificationNumber ? 'border-destructive' : ''}`}
              />
              {errors.certificationNumber && <p className="text-xs text-destructive">{errors.certificationNumber.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <textarea
              {...register("description")}
              placeholder="Business Description"
              className={`input-premium min-h-[100px] ${errors.description ? 'border-destructive' : ''}`}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Saving...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
