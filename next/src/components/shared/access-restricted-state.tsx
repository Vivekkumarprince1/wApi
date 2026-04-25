"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccessRestrictedStateProps {
  title: string;
  description: string;
  actionLabel: string;
  targetPath: string;
  secondaryLabel?: string;
  secondaryPath?: string;
  statusLabel?: string | null;
  autoRedirectMs?: number;
  autoRedirectPath?: string;
  className?: string;
}

export function AccessRestrictedState({
  title,
  description,
  actionLabel,
  targetPath,
  secondaryLabel = 'Go back',
  secondaryPath = '/dashboard',
  statusLabel,
  autoRedirectMs,
  autoRedirectPath,
  className
}: AccessRestrictedStateProps) {
  const router = useRouter();

  useEffect(() => {
    if (!autoRedirectMs || autoRedirectMs <= 0) return;
    const destination = autoRedirectPath || secondaryPath;
    const timeout = window.setTimeout(() => {
      router.replace(destination);
    }, autoRedirectMs);

    return () => window.clearTimeout(timeout);
  }, [autoRedirectMs, autoRedirectPath, secondaryPath, router]);

  return (
    <div className={cn('min-h-[70vh] flex items-center justify-center p-4', className)}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[40px] border border-border/60 bg-card/80 p-8 md:p-12 shadow-[0_24px_100px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%)]" />
        <div className="absolute right-6 top-6 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-8 bottom-8 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Access restricted
          </div>

          <div className="max-w-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">{title}</h1>
                <p className="max-w-xl text-base md:text-lg text-muted-foreground leading-7">{description}</p>
                {statusLabel ? (
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Status: {statusLabel}</p>
                ) : null}
                {autoRedirectMs ? (
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Returning to your last page in {Math.ceil(autoRedirectMs / 1000)}s</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="rounded-2xl px-6 h-12 font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20">
              <Link href={targetPath}>
                {actionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl px-6 h-12 font-black uppercase tracking-[0.2em] bg-background/80">
              <Link href={secondaryPath}>{secondaryLabel}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}