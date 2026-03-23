'use client';

import React from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FLASH LOADER
 * A high-performance, premium global loader component.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default function FlashLoader({ isLoading }) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[9999]">
      <div 
        className="h-full bg-gradient-to-r from-primary via-blue-500 to-primary shadow-[0_0_10px_rgba(19,193,141,0.5)]" 
        style={{
          width: '200%',
          animation: 'progress-fast 1s infinite linear'
        }}
      />
      
      <div className="fixed inset-0 bg-background/5 backdrop-blur-[1px] pointer-events-none flex items-start justify-center pt-2">
        <div className="bg-card/80 backdrop-blur-md border border-border/50 px-4 py-1.5 rounded-full shadow-premium animate-pulse flex items-center gap-2">
           <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Syncing...</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress-fast {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
