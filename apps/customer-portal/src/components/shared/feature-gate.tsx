"use client";

import React from "react";
import { useFeatureGate } from "@/store/auth-store";
import { FeatureLockedState } from "./feature-locked-state";
import { LucideIcon } from "lucide-react";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedState?: boolean;
  featureName?: string;
  description?: string;
  icon?: LucideIcon;
}

/**
 * A wrapper component that gates access to features based on the user's plan.
 * If the feature is locked, it can either show a custom fallback or a premium Locked State UI.
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showLockedState = true,
  featureName,
  description,
  icon
}: FeatureGateProps) {
  const { gate } = useFeatureGate(feature);

  if (gate.allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showLockedState) {
    return (
      <FeatureLockedState 
        featureName={featureName || feature.charAt(0).toUpperCase() + feature.slice(1)}
        description={description || gate.reason}
        icon={icon}
      />
    );
  }

  return null;
}
