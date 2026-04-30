"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { SocketHub } from "./socket-hub";
import { SystemBanners } from "./system-banners";
import { FeatureGate } from "@/components/shared/feature-gate";
import { usePathname } from "next/navigation";
import { getFeatureMetadata } from "@/config/feature-config";
import FlashLoader from "@/components/ui/flash-loader";
import { AccessRestrictedState } from "@/components/shared/access-restricted-state";


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isImpersonating, stopImpersonating, user, workspace, loading, accessRestriction } = useAuthStore();
  const [isExiting, setIsExiting] = React.useState(false);
  const pathname = usePathname();

  // Route to Feature Mapping
  const getRouteFeature = (path: string) => {
    if (path.includes('/dashboard/crm')) return 'crm';
    if (path.includes('/dashboard/automation')) return 'automation';
    if (path.includes('/dashboard/commerce')) return 'commerce';
    if (path.includes('/dashboard/integrations')) return 'integrations';
    if (path.includes('/dashboard/campaign')) return 'campaigns';
    if (path.includes('/dashboard/templates')) return 'templates';
    if (path.includes('/dashboard/inbox')) return 'inbox';
    if (path.includes('/dashboard/analytics')) return 'analytics';
    if (path.includes('/dashboard/settings/teams')) return 'team';
    return null;
  };

  const featureRequired = getRouteFeature(pathname);
  const featureMeta = featureRequired ? getFeatureMetadata(featureRequired) : null;
  const isBillingPage = pathname.startsWith('/dashboard/billing');

  if (loading && !user) {
    return <FlashLoader />;
  }

  if (accessRestriction && !(accessRestriction.kind === 'billing' && isBillingPage)) {
    return (
      <AccessRestrictedState
        title={accessRestriction.title}
        description={accessRestriction.description}
        actionLabel={accessRestriction.actionLabel}
        targetPath={accessRestriction.targetPath}
        secondaryLabel={accessRestriction.kind === 'onboarding' ? 'Open billing' : 'Go to dashboard'}
        secondaryPath={accessRestriction.kind === 'onboarding' ? '/dashboard/billing' : '/dashboard'}
        statusLabel={accessRestriction.kind === 'billing' ? workspace?.billingStatus || null : null}
      />
    );
  }

  const handleExit = async () => {
    setIsExiting(true);
    const toastId = toast.loading("Restoring administrative session...");
    try {
      await stopImpersonating();
    } catch (error) {
      toast.error("Failed to restore session. Please log in manually.", { id: toastId });
      setIsExiting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background transition-colors duration-300">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0 bg-background/50">
          
          {/* Master Impersonation Overlay */}
          {isImpersonating && (
            <div className="bg-primary px-4 py-2 flex items-center justify-between shadow-2xl z-50 animate-in slide-in-from-top duration-500">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                  <ShieldAlert className="h-5 w-5 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 leading-none mb-1">Master Bypass Active</p>
                  <p className="text-xs font-bold text-white leading-none">
                    Operating as <span className="underline decoration-white/30">{user?.name}</span> @ <span className="uppercase">{workspace?.name}</span>
                  </p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="h-8 px-4 rounded-lg font-black uppercase tracking-widest text-[9px] bg-white text-primary hover:bg-white/90 shadow-xl transition-all active:scale-95"
                onClick={handleExit}
                disabled={isExiting}
              >
                {isExiting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <LogOut className="h-3 w-3 mr-2" />}
                Terminate Session
              </Button>
            </div>
          )}

          <DashboardHeader />
          <SystemBanners />
          <SocketHub />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
              {featureRequired ? (
                <FeatureGate 
                  feature={featureRequired} 
                  featureName={featureMeta?.name}
                  description={featureMeta?.description}
                  icon={featureMeta?.icon}
                >
                  {children}
                </FeatureGate>
              ) : (
                children
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
