import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AutomationLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-[220px] rounded-xl" />
            <Skeleton className="h-6 w-[100px] rounded-full" />
          </div>
          <Skeleton className="h-4 w-[380px] rounded-lg" />
        </div>
        <Skeleton className="h-12 w-[160px] rounded-2xl" />
      </div>

      {/* Primary 4-Card Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-6 bg-card border border-border/30 rounded-[32px] space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <Skeleton className="h-5 w-[80px] rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-[140px] rounded-xl" />
                <Skeleton className="h-4 w-full rounded-lg" />
                <Skeleton className="h-4 w-[90%] rounded-lg" />
              </div>
            </div>
            <div className="pt-4 flex items-center justify-between">
              <Skeleton className="h-4 w-[80px] rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Chart & Activity Panel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border/30 p-8 rounded-[36px] space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-[180px] rounded-xl" />
              <Skeleton className="h-4 w-[120px] rounded-lg" />
            </div>
            <Skeleton className="h-8 w-[140px] rounded-xl" />
          </div>
          <Skeleton className="h-[250px] w-full rounded-2xl" />
        </div>
        <div className="bg-card border border-border/30 p-8 rounded-[36px] space-y-6">
          <Skeleton className="h-6 w-[150px] rounded-xl" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[80%] rounded-lg" />
                  <Skeleton className="h-3 w-[40px] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
