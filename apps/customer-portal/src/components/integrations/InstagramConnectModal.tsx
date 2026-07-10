"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from '@/store/auth-store';
import {
  getInstagramAuthUrl,
  getInstagramStatus,
  refreshInstagramToken,
  type InstagramIntegrationStatus,
} from '@/lib/api/integrations';

interface InstagramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatPrice(pricePaise?: number, currency = 'INR') {
  if (!pricePaise) return 'Plan add-on';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}

function getWebhookLabel(status?: InstagramIntegrationStatus) {
  const subscription = status?.integration?.configMetadata?.webhookSubscription;
  if (subscription?.success) return 'Live';
  if (status?.status === 'pending') return 'Pending setup';
  return 'Not connected';
}

export function InstagramConnectModal({ isOpen, onClose, onSuccess }: InstagramConnectModalProps) {
  const router = useRouter();
  const userPlan = useAuthStore((state) => state.user?.plan);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<InstagramIntegrationStatus | null>(null);

  const metadata = status?.integration?.configMetadata || {};
  const billing = status?.billing || {};
  const isConnected = status?.status === 'connected' || status?.status === 'pending';
  const planFeatures = userPlan?.features || [];
  const hasBillingAccess =
    !billing.planSlug ||
    !billing.pricePaise ||
    userPlan?.slug === billing.planSlug ||
    planFeatures.includes('INSTAGRAM') ||
    planFeatures.includes('ALL');

  const tokenExpiry = useMemo(() => {
    if (!metadata.tokenExpiresAt) return null;
    return new Date(metadata.tokenExpiresAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [metadata.tokenExpiresAt]);

  useEffect(() => {
    if (!isOpen) return;
    checkStatus();
  }, [isOpen]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const resp = await getInstagramStatus();
      setStatus(resp);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  const handleAuthorize = async (force = false) => {
    if (!hasBillingAccess && !isConnected) {
      toast.error("Activate the Instagram add-on before connecting Meta.");
      router.push(`/billing?addon=${billing.planSlug || 'instagram'}`);
      return;
    }

    setLoading(true);
    try {
      const resp = await getInstagramAuthUrl(force);
      window.location.href = resp.url;
    } catch (error: any) {
      toast.error(error?.message || "Failed to start Instagram onboarding");
      setLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setLoading(true);
    try {
      await refreshInstagramToken();
      toast.success("Instagram token refreshed");
      await checkStatus();
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to refresh Instagram token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] border-border/60 bg-background shadow-2xl">
        <DialogHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600">
            <Camera className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">Connect Instagram Business</DialogTitle>
          <DialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">
            Let customers connect their Instagram professional account to ConnectSphere for DMs, comments, and automation. Billing stays under your workspace plan or Instagram add-on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Billing</p>
              <p className="mt-2 text-sm font-bold">{formatPrice(billing.pricePaise, billing.currency)}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {hasBillingAccess ? 'Active for workspace' : billing.planSlug || 'Plan upgrade required'}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">OAuth</p>
              <p className="mt-2 text-sm font-bold">{isConnected ? 'Authorized' : 'Not started'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metadata.username ? `@${metadata.username}` : 'Instagram Login'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Webhooks</p>
              <p className="mt-2 text-sm font-bold">{getWebhookLabel(status || undefined)}</p>
              <p className="mt-1 text-xs text-muted-foreground">messages, comments</p>
            </div>
          </div>

          {checking ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking Instagram connection...
            </div>
          ) : isConnected ? (
            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-bold">
                      {metadata.username ? `@${metadata.username}` : 'Instagram account'}
                    </h3>
                    <Badge className={status?.status === 'connected' ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10' : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/10'}>
                      {status?.status === 'connected' ? 'Ready' : 'Needs webhook setup'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {metadata.accountType || 'Professional account'} account
                    {tokenExpiry ? `, token valid until ${tokenExpiry}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRefreshToken}
                  disabled={loading}
                  className="shrink-0 rounded-xl"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Refresh token
                </Button>
              </div>

              {metadata.webhookSubscription?.error && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{metadata.webhookSubscription.error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="space-y-2">
                  <h3 className="text-sm font-bold">Customer onboarding checklist</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Customer pays for the Instagram add-on, connects a professional Instagram account, grants Meta permissions, and ConnectSphere stores the 60-day token encrypted for automation.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-2 text-sm text-muted-foreground">
            {[
              'Instagram account must be professional: Business or Creator.',
              'Meta app must be Live with Advanced Access for messaging and comments.',
              'Webhook callback and verify token must be configured in Meta App Dashboard.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} className="font-bold text-xs uppercase tracking-widest">
            Close
          </Button>
          {isConnected && (
            <Button
              variant="outline"
              onClick={() => handleAuthorize(true)}
              disabled={loading}
              className="rounded-xl font-bold"
            >
              Reconnect
            </Button>
          )}
          <Button
            onClick={() => handleAuthorize(false)}
            disabled={loading}
            className="rounded-xl bg-pink-600 px-6 font-bold text-white hover:bg-pink-700"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            {!hasBillingAccess && !isConnected ? 'Open billing' : isConnected ? 'Open Meta Login' : 'Start onboarding'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
