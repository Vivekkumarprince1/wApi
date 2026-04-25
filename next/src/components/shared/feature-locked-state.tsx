"use client";

import React from "react";
import { Lock, Sparkles, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface FeatureLockedStateProps {
  featureName: string;
  description?: string;
  requiredPlan?: string;
  benefits?: string[];
  icon?: React.ElementType;
  className?: string;
}

export function FeatureLockedState({
  featureName,
  description = "This feature is not available on your current plan.",
  requiredPlan = "Pro",
  benefits = [
    "Advanced Automation & Workflows",
    "Enhanced Campaign Analytics",
    "Priority Customer Support",
    "Unlimited Contacts & Segments"
  ],
  icon: Icon = Lock,
  className
}: FeatureLockedStateProps) {
  const router = useRouter();

  return (
    <div className={cn(
      "relative flex flex-col items-center justify-center min-h-[500px] w-full p-8 overflow-hidden rounded-3xl border border-border/50 bg-background/50 backdrop-blur-xl",
      className
    )}>
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-rose-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center max-w-2xl text-center"
      >
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-2xl shadow-primary/40 rotate-12">
            <Icon className="h-10 w-10 -rotate-12" />
          </div>
          <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg border-2 border-background">
            <Lock className="h-4 w-4" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-6">
          <Sparkles className="h-3 w-3" />
          Premium Feature
        </div>

        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground mb-4">
          Unlock {featureName}
        </h2>
        
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          {description} Upgrade to the <span className="font-bold text-primary underline underline-offset-4 decoration-primary/30">{requiredPlan} Plan</span> to access this and other advanced tools.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-10">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50 text-left"
            >
              <div className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground/80">{benefit}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button 
            size="lg" 
            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 transition-all active:scale-95 text-white"
            onClick={() => router.push("/dashboard/billing")}
          >
            Upgrade to {requiredPlan}
            <ArrowRight className="ml-3 h-5 w-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="lg" 
            className="h-14 px-8 rounded-2xl font-bold text-muted-foreground hover:bg-muted/50"
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </div>
      </motion.div>

      {/* Trust Badge */}
      <div className="mt-16 flex items-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Secure</span>
        </div>
        <div className="h-4 w-px bg-border sm:block hidden" />
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Instant Activation</span>
        </div>
      </div>
    </div>
  );
}
