import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CommerceLoading() {
  return (
    <div className="space-y-10 animate-in fade-in duration-500 p-8 max-w-[1600px] mx-auto pb-32">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-[240px] rounded-xl" />
            <Skeleton className="h-6 w-[100px] rounded-full" />
          </div>
          <Skeleton className="h-4 w-[480px] rounded-lg" />
        </div>
        <Skeleton className="h-12 w-[160px] rounded-2xl" />
      </div>

      {/* Intelligence Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 bg-card border border-border/40 rounded-[32px] shadow-premium-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-[40px] rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-[120px] rounded-lg" />
              <Skeleton className="h-8 w-[160px] rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links Control Center Grid */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-1">
          <Skeleton className="h-4 w-[160px] rounded-lg" />
          <div className="h-[1px] flex-1 bg-border/40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-8 rounded-[40px] border border-border/30 bg-card shadow-premium-sm space-y-8">
              <div className="flex items-start justify-between">
                <Skeleton className="h-14 w-14 rounded-[24px]" />
                <Skeleton className="h-6 w-[70px] rounded-xl" />
              </div>
              <div className="space-y-3 px-1">
                <Skeleton className="h-6 w-[160px] rounded-xl" />
                <Skeleton className="h-4 w-full rounded-lg" />
                <Skeleton className="h-4 w-[90%] rounded-lg" />
              </div>
              <div className="mt-8 flex items-center justify-between px-1">
                <Skeleton className="h-4 w-[80px] rounded-lg" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Section Card */}
      <div className="bg-card border border-border/30 rounded-[48px] p-10 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-[280px] rounded-xl" />
            <Skeleton className="h-3 w-[150px] rounded-lg" />
          </div>
          <Skeleton className="h-14 w-14 rounded-[24px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-6">
              <Skeleton className="h-48 rounded-[36px] w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[120px] rounded-lg" />
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-[90%] rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
