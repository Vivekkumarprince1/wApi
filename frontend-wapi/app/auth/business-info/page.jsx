"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bspComplete, bspStart, bspSync, saveBusinessInfo } from "@/lib/api";
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
  const popupRef = useRef(null);
  const processedCallbackRef = useRef(null);

  const cleanupPopup = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
  };

  const openPopup = () => {
    if (typeof window === "undefined") return null;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "about:blank",
      "gupshup_onboarding",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
    );

    if (!popup || popup.closed) {
      return null;
    }

    popup.document.write(`
      <html>
        <head><title>Connecting WhatsApp...</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f0fdf4;">
          <div style="text-align:center">
            <div style="width:48px;height:48px;border:4px solid #14b8a6;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
            <p style="color:#374151;font-size:16px;font-weight:500">Preparing your WhatsApp connection...</p>
            <p style="color:#6b7280;font-size:14px">Please wait, this may take a few seconds.</p>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </body>
      </html>
    `);

    popupRef.current = popup;
    return popup;
  };

  const handleOnboardingComplete = async () => {
    cleanupPopup();

    try {
      await bspSync();
    } catch (_error) {
    }

    await fetchSession(true);
    router.push('/dashboard');
  };

  const handleCallbackCompletion = async (payload = {}) => {
    const payloadKey = JSON.stringify(payload || {});
    if (processedCallbackRef.current === payloadKey) {
      return;
    }

    processedCallbackRef.current = payloadKey;

    const code = payload?.code;
    const state = payload?.state;
    const providerError = payload?.error;
    const providerMessage = payload?.message;

    if (providerError) {
      cleanupPopup();
      setError(providerMessage || 'WhatsApp signup was cancelled or failed.');
      return;
    }

    if (!code || !state) {
      return;
    }

    try {
      setError('');
      await bspComplete({ code, state });
      await handleOnboardingComplete();
    } catch (err) {
      cleanupPopup();
      setError(err.message || 'Failed to complete WhatsApp onboarding');
    }
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GUPSHUP_ONBOARDING_COMPLETE') {
        handleOnboardingComplete();
      }
      if (event.data?.type === 'GUPSHUP_ONBOARDING_CALLBACK') {
        handleCallbackCompletion(event.data?.payload || {});
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

    // Hydration from store (Unified Session)
    if (workspace && !Object.keys(errors).length) {
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
    const popup = openPopup();

    try {
      await saveBusinessInfo(values);
      const session = await fetchSession(true); // Update store

      const workspaceComplete = !!session?.workspace?.stage1?.complete || !!session?.workspace?.whatsappConnected;

      if (workspaceComplete) {
        cleanupPopup();
        router.push('/dashboard');
        return;
      }

      const onboarding = await bspStart({
        connectionType: 'business_app',
        businessName: values.businessName,
        phone: session?.phone?.number || user?.phone || '',
        contactEmail: user?.email || ''
      });

      const signupUrl = onboarding?.url;
      if (!signupUrl) {
        throw new Error('Failed to generate onboarding link');
      }

      if (popup) {
        popup.location.href = signupUrl;
        popup.focus();
      } else {
        router.push('/dashboard?connectWhatsApp=1');
        return;
      }
    } catch (err) {
      cleanupPopup();
      setError(err.message || 'Failed to save business info.');
      router.push('/dashboard?connectWhatsApp=1');
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
