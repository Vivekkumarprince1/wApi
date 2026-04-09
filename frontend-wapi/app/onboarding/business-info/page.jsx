"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, getOnboardingStatus, saveBusinessInfo } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const businessInfoSchema = z.object({
  businessName: z.string().min(2, 'Business Name is required'),
  industry: z.string().min(1, 'Please select an industry'),
  companySize: z.string().optional(),
  annualRevenue: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  companyLocation: z.string().optional(),
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

export default function BusinessInfoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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
      companyLocation: "",
      annualRevenue: "",
      description: "",
      certificationType: "",
      certificationNumber: ""
    }
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

        if (!onboarding?.status?.steps?.phoneVerified) {
          router.replace('/onboarding/verify-mobile');
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

        reset({
          businessName: workspace?.businessInfo?.name || '',
          industry: workspace?.businessInfo?.industry || '',
          website: workspace?.businessInfo?.website || '',
          companyLocation: [workspace?.businessInfo?.city, workspace?.businessInfo?.state, workspace?.businessInfo?.country].filter(Boolean).join(', '),
          certificationType: docType,
          certificationNumber: docNumber,
          companySize: "",
          annualRevenue: "",
          description: "",
        });
      } catch (_err) {
        setError('Unable to load business profile. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const onSubmit = async (values) => {
    setError('');

    try {
      const payload = {
        businessName: values.businessName,
        industry: values.industry,
        companySize: values.companySize,
        annualRevenue: values.annualRevenue,
        website: values.website,
        address: values.companyLocation,
        description: values.description,
        documentType: values.certificationType,
        gstNumber: values.certificationType === 'gst' ? values.certificationNumber : undefined,
        msmeNumber: values.certificationType === 'msme' ? values.certificationNumber : undefined,
        panNumber: values.certificationType === 'pan' ? values.certificationNumber : undefined,
        certificationNumber: values.certificationNumber
      };

      await saveBusinessInfo(payload);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save business info.');
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
            <input {...register("companyLocation")} placeholder="Company Location" className="input-premium" />
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
