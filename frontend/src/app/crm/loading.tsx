import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CRMLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-[200px] rounded-xl" />
            <Skeleton className="h-6 w-[80px] rounded-full" />
          </div>
          <Skeleton className="h-4 w-[340px] rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-[120px] rounded-xl" />
          <Skeleton className="h-11 w-[140px] rounded-xl" />
        </div>
      </div>

      {/* Board Controls (Pipeline selector & filters) */}
      <div className="bg-card/40 border border-border/40 p-2 rounded-2xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-[140px] rounded-lg" />
          <Skeleton className="h-8 w-[100px] rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-[80px] rounded-lg" />
          <Skeleton className="h-8 w-[80px] rounded-lg" />
        </div>
      </div>

      {/* Kanban Board Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
        {[...Array(4)].map((_, colIdx) => (
          <div key={colIdx} className="bg-card/30 border border-border/30 rounded-[32px] p-5 space-y-4 shrink-0 min-w-[280px]">
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className={`h-2.5 w-2.5 rounded-full ${colIdx === 0 ? 'bg-blue-500' : colIdx === 1 ? 'bg-amber-500' : colIdx === 2 ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                <Skeleton className="h-5 w-[100px] rounded-md" />
              </div>
              <Skeleton className="h-5 w-6 rounded-md" />
            </div>

            {/* Column Deal Cards Stack */}
            <div className="space-y-3">
              {[...Array(colIdx === 0 ? 3 : colIdx === 1 ? 2 : colIdx === 2 ? 4 : 1)].map((_, cardIdx) => (
                <div key={cardIdx} className="bg-card border border-border/40 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-[50px] rounded-md" />
                      <Skeleton className="h-4 w-4 rounded-md" />
                    </div>
                    <Skeleton className="h-5 w-[160px] rounded-lg" />
                  </div>
                  <div className="h-[1px] bg-border/20" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-3 w-[80px] rounded-md" />
                    </div>
                    <Skeleton className="h-4.5 w-[60px] rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
