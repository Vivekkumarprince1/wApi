"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page py-12">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold">Something did not load</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {error.message || "The careers workspace hit a temporary issue. Try again."}
            </p>
            <Button className="mt-4" onClick={reset}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
