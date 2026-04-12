'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertCircle, 
  Wallet, 
  ExternalLink, 
  X, 
  ArrowRight,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { FaWhatsapp } from 'react-icons/fa';

const GlobalAlertBanner = () => {
    const router = useRouter();
    const { 
        workspace, 
        stage1Complete, 
        phoneStatus, 
        wallet, 
        user,
        isOnTrial,
        trialDaysLeft
    } = useAuthStore();

    const ACTIVE_PHONE_STATUSES = ['CONNECTED', 'RESTRICTED', 'LIVE', 'ACTIVE', 'VERIFIED'];
    const isWhatsAppConnected = stage1Complete || ACTIVE_PHONE_STATUSES.includes(String(phoneStatus || '').toUpperCase());
    
    // Banner Priority Logic
    const banner = useMemo(() => {
        if (!workspace) return null;

        // 1. WhatsApp Connection (Critical - Red)
        if (!isWhatsAppConnected) {
            return {
                id: 'whatsapp_disconnected',
                type: 'error',
                icon: FaWhatsapp,
                title: 'WhatsApp Disconnected',
                message: 'Connect your WhatsApp number to start sending messages and campaigns.',
                actionLabel: 'Connect Now',
                action: () => router.push('/dashboard?connectWhatsApp=1'),
                bg: 'bg-red-500',
                textColor: 'text-white'
            };
        }

        // 2. Low Balance (Warning - Amber)
        const balance = wallet?.balance || 0;
        const threshold = wallet?.thresholdAmount || 500;
        if (balance < threshold) {
            return {
                id: 'low_balance',
                type: 'warning',
                icon: Wallet,
                title: 'Insufficient Credits',
                message: `Your balance is low (₹${(balance / 100).toFixed(2)}). Recharge now to prevent campaign failures.`,
                actionLabel: 'Recharge',
                action: () => router.push('/dashboard/billing'),
                bg: 'bg-amber-500',
                textColor: 'text-white'
            };
        }

        // 3. Trial Expiry (Info - Blue)
        if (isOnTrial && trialDaysLeft !== null && trialDaysLeft <= 3) {
            return {
                id: 'trial_expiry',
                type: 'info',
                icon: Clock,
                title: 'Trial Ending Soon',
                message: `Your free trial expires in ${trialDaysLeft} days. Upgrade to a premium plan to continue.`,
                actionLabel: 'Upgrade Plan',
                action: () => router.push('/dashboard/billing'),
                bg: 'bg-blue-600',
                textColor: 'text-white'
            };
        }

        return null;
    }, [workspace, isWhatsAppConnected, wallet, isOnTrial, trialDaysLeft, router]);

    if (!banner) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={cn(
                    "relative w-full overflow-hidden border-b border-white/10",
                    banner.bg
                )}
            >
                <div className="max-w-[1600px] mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <banner.icon className={cn("h-4 w-4", banner.textColor)} />
                            </div>
                            <div className={cn("flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2", banner.textColor)}>
                                <span className="font-bold text-sm uppercase tracking-wider">{banner.title}:</span>
                                <span className="text-sm font-medium opacity-90">{banner.message}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={banner.action}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-all shadow-lg active:scale-95"
                            >
                                {banner.actionLabel}
                                <ArrowRight className="h-3 w-3" />
                            </button>
                            
                            {/* Optional: Close Button if we want it dismissible */}
                            {/* <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="h-4 w-4" />
                            </button> */}
                        </div>
                    </div>
                </div>

                {/* Decorative background pattern */}
                <div className="absolute inset-0 pointer-events-none opacity-10">
                    <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="url(#pattern)" />
                        <defs>
                            <pattern id="pattern" width="10" height="10" patternUnits="userSpaceOnUse">
                                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                    </svg>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GlobalAlertBanner;
