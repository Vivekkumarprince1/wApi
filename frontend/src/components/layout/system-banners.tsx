"use client";

import React from "react";
import { useAuthStore } from "@/store/auth-store";
import { 
  AlertCircle, 
  Wallet, 
  PhoneCall, 
  ArrowRight, 
  X,
  CreditCard,
  ShieldAlert,
  Zap,
  Info,
  Lock,
  Megaphone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BannerProps {
  id: string;
  type: "warning" | "error" | "info" | "success";
  icon: React.ElementType;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  onClose?: () => void;
  className?: string;
}

const Banner = ({ 
  type, 
  icon: Icon, 
  title, 
  description, 
  actionText, 
  onAction, 
  onClose,
  className 
}: BannerProps) => {
  const themes = {
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 shadow-amber-500/5",
    error: "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 shadow-rose-500/5",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400 shadow-blue-500/5",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-emerald-500/5",
  };

  const iconColors = {
    warning: "bg-amber-500 shadow-amber-500/20",
    error: "bg-rose-500 shadow-rose-500/20",
    info: "bg-blue-500 shadow-blue-500/20",
    success: "bg-emerald-500 shadow-emerald-500/20",
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0, y: -20 }}
      animate={{ height: "auto", opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="overflow-hidden"
    >
      <div className={cn(
        "relative flex items-center gap-4 px-6 py-3 border-b backdrop-blur-md shadow-lg transition-all",
        themes[type],
        className
      )}>
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg",
          iconColors[type]
        )}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col">
            <h4 className="text-sm font-black uppercase tracking-widest leading-none mb-1 opacity-90">{title}</h4>
            <p className="text-xs font-medium opacity-80">{description}</p>
          </div>

          <div className="flex items-center gap-2">
            {actionText && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onAction}
                className={cn(
                  "h-8 px-4 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-white/10 shadow-sm transition-all active:scale-95",
                  type === 'warning' && "text-amber-700 dark:text-amber-400 border-amber-500/20",
                  type === 'error' && "text-rose-700 dark:text-rose-400 border-rose-500/20",
                  type === 'info' && "text-blue-700 dark:text-blue-400 border-blue-500/20"
                )}
              >
                {actionText}
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            )}
            
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export function SystemBanners() {
  const { stage1Complete, wallet, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([]);
  const handleDismiss = (id: string) => setDismissedIds(prev => [...prev, id]);

  const banners: any[] = [];
  const addBanner = (banner: any) => {
    if (!dismissedIds.includes(banner.id)) {
      banners.push({ ...banner, onClose: () => handleDismiss(banner.id) });
    }
  };

  const renderBanners = () => (
    <div className="w-full flex flex-col">
      <AnimatePresence initial={false}>
        {banners.map((banner) => <Banner key={banner.id} {...banner} />)}
      </AnimatePresence>
    </div>
  );

  // 1. Onboarding Priority
  if (!stage1Complete) {
    addBanner({
      id: "onboarding",
      type: "info",
      icon: PhoneCall,
      title: "Action Required: Onboarding",
      description: "You haven't connected your WhatsApp number yet. Connect now to start sending campaigns.",
      actionText: "Connect Number",
      onAction: () => router.push("/?connectWhatsApp=1"),
    });
    return renderBanners();
  }

  // 2. Wallet Priority
  const CRITICAL_THRESHOLD = 500;
  const LOW_THRESHOLD = 1000;
  if (wallet) {
    if (wallet.balance <= 0) {
      addBanner({
        id: "zero-balance",
        type: "error",
        icon: CreditCard,
        title: "Service Suspended",
        description: "Your wallet balance is zero or negative. Active campaigns and automation are paused.",
        actionText: "Recharge Now",
        onAction: () => router.push("/billing"),
      });
      return renderBanners();
    } else if (wallet.balance < CRITICAL_THRESHOLD) {
      addBanner({
        id: "critical-balance",
        type: "error",
        icon: AlertCircle,
        title: "Critical Balance Warning",
        description: `Your balance is critically low (${wallet.currency} ${wallet.balance.toFixed(2)}). Service may be interrupted soon.`,
        actionText: "Recharge Now",
        onAction: () => router.push("/billing"),
      });
      return renderBanners();
    } else if (wallet.balance < LOW_THRESHOLD) {
      addBanner({
        id: "low-balance",
        type: "warning",
        icon: Wallet,
        title: "Low Balance Warning",
        description: `Your balance (${wallet.currency} ${wallet.balance.toFixed(2)}) is approaching the threshold. Consider recharging soon.`,
        actionText: "Recharge Wallet",
        onAction: () => router.push("/billing"),
      });
      return renderBanners();
    }
  }

  // 3. Restricted Access Priority
  const getRouteFeature = (path: string) => {
    if (path.includes('/crm')) return 'crm';
    if (path.includes('/automation')) return 'automation';
    if (path.includes('/campaign')) return 'campaigns';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/settings/teams')) return 'team';
    return null;
  };

  const currentFeature = getRouteFeature(pathname);
  const userFeatures = user?.plan?.features || [];

  if (currentFeature) {
    const isLocked = !userFeatures.includes(currentFeature.toUpperCase()) && !userFeatures.includes('ALL');
    if (isLocked && user?.role !== 'super_admin') {
      addBanner({
        id: `restricted-${currentFeature}`,
        type: "error",
        icon: Lock,
        title: "Restricted Feature",
        description: `Your current plan does not include access to ${currentFeature.toUpperCase()}. View data only mode active.`,
        actionText: "Upgrade Plan",
        onAction: () => router.push("/billing"),
      });
      return renderBanners();
    }
  }

  // 4. System Notice
  const { systemStatus } = useAuthStore();
  if (systemStatus?.systemNotice?.active) {
    addBanner({
      id: "system-notice",
      type: systemStatus.systemNotice.level || "info",
      icon: Megaphone,
      title: "System Announcement",
      description: systemStatus.systemNotice.message,
    });
  }

  return renderBanners();
}
