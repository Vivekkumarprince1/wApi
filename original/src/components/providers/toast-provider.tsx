"use client";

import { Toaster } from 'sonner';

export default function ToastProvider() {
  return (
    <Toaster 
      position="top-right"
      theme="system"
      richColors
      closeButton
      expand={true}
      toastOptions={{
        className: 'rounded-2xl border-border/50 bg-card/80 backdrop-blur-xl shadow-premium font-sans',
      }}
    />
  );
}
