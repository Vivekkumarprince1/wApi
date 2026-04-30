"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { getOnboardingStatus, verifyBusinessDocument } from '@/lib/api/onboarding';

export default function BusinessVerificationPage() {
  const router = useRouter();
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getOnboardingStatus()
      .then((status) => {
        setGstNumber(status?.business?.gstNumber || '');
        setPanNumber(status?.business?.panNumber || '');
        setMsmeNumber(status?.business?.msmeNumber || '');
        if (status?.currentStep === 'BUSINESS_CONFIRMATION') router.push('/dashboard');
        if (status?.currentStep === 'APP_ASSIGNMENT') router.push('/dashboard');
        if (status?.currentStep === 'COMPLETED') router.push('/dashboard');
      })
      .catch(() => {});
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await verifyBusinessDocument({ gstNumber, panNumber, msmeNumber });
      setLegalName(result?.verification?.legalName || '');
      router.push(result?.nextStep || '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card/80 backdrop-blur-md rounded-xl shadow-premium border border-border p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5 text-primary">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your business</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Enter a GSTIN or MSME Udyam number to verify your business identity.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}
        
        {legalName && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <p className="text-primary text-sm font-medium">Legal Name: {legalName}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              GST Number
            </label>
            <input 
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent uppercase outline-none transition-all placeholder:text-muted-foreground/30" 
              value={gstNumber} 
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())} 
              placeholder="27ABCDE1234F1Z5" 
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              PAN Number
            </label>
            <input 
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent uppercase outline-none transition-all placeholder:text-muted-foreground/30" 
              value={panNumber} 
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())} 
              placeholder="ABCDE1234F" 
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              MSME / Udyam Number
            </label>
            <input 
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent uppercase outline-none transition-all placeholder:text-muted-foreground/30" 
              value={msmeNumber} 
              onChange={(e) => setMsmeNumber(e.target.value.toUpperCase())} 
              placeholder="UDYAM-MH-12-1234567" 
            />
          </div>

          <button 
            className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20" 
            disabled={loading || (!gstNumber && !msmeNumber)}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
            Verify Business
          </button>
        </form>

        <div className="mt-8 flex items-start gap-3 rounded-lg bg-accent/50 p-4 border border-accent">
          <CheckCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            We use trusted sources for GST and MSME verification. This step helps ensure compliance with WhatsApp Business policies.
          </p>
        </div>
      </div>
    </div>
  );
}
