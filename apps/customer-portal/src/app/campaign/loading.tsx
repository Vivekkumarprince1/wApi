import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignsLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-[180px] rounded-xl" />
            <Skeleton className="h-6 w-[80px] rounded-full" />
          </div>
          <Skeleton className="h-4 w-[280px] rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-[120px] rounded-2xl" />
          <Skeleton className="h-12 w-[150px] rounded-2xl" />
        </div>
      </div>

      {/* Tabs & Filters Shimmer */}
      <div className="bg-card/30 border border-border/40 rounded-3xl p-1.5 flex flex-col sm:flex-row items-center gap-2 shadow-sm">
        <div className="flex p-1 rounded-2xl w-full sm:w-auto gap-1">
          <Skeleton className="h-8 w-[90px] rounded-xl" />
          <Skeleton className="h-8 w-[90px] rounded-xl" />
          <Skeleton className="h-8 w-[70px] rounded-xl" />
        </div>
        <div className="flex-1 w-full px-4">
          <Skeleton className="h-5 w-[200px] rounded-lg" />
        </div>
        <div className="hidden sm:flex items-center gap-2 border-l border-border/40 px-4 ml-1">
          <Skeleton className="h-6 w-[100px] rounded-xl" />
          <Skeleton className="h-6 w-[80px] rounded-xl" />
        </div>
      </div>

      {/* Table Shell */}
      <div className="bg-card border border-border/40 rounded-3xl shadow-premium-sm overflow-hidden">
        <div className="border-b border-border/40 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <Skeleton className="h-4 w-[150px] rounded-lg" />
          <Skeleton className="h-4 w-[80px] rounded-lg" />
        </div>
        <div className="divide-y divide-border/20 px-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="py-6 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-[220px] rounded-xl" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-[60px] rounded-lg" />
                  <Skeleton className="h-4 w-[120px] rounded-lg" />
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-4 w-[40px] rounded-lg" />
                  <Skeleton className="h-3 w-[50px] rounded-lg" />
                </div>
                <div className="h-6 w-[1px] bg-border/20" />
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-4 w-[40px] rounded-lg" />
                  <Skeleton className="h-3 w-[50px] rounded-lg" />
                </div>
              </div>
              <div className="hidden md:block">
                <Skeleton className="h-5 w-[80px] rounded-full" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card/50 border border-border/30 p-6 rounded-3xl flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-[100px] rounded-lg" />
              <Skeleton className="h-8 w-[60px] rounded-xl" />
            </div>
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
