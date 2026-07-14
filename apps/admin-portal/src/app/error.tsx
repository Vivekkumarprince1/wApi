"use client";

import { Button } from '@/components/ui/button';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center" role="alert">
      <h1 className="text-2xl font-semibold">Administrative view unavailable</h1>
      <p className="text-sm text-muted-foreground">The request failed. Retry, or inspect service monitoring if the problem continues.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
