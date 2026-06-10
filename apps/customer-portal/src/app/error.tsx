"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

/**
 * Per-route error boundary. Next.js wraps every route segment in this
 * component when an error is thrown during rendering, data fetching, or
 * inside a child Server/Client Component.
 *
 * The previous version of this app had no boundary at all, so any
 * unhandled error showed a blank white screen.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App] Route error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-red-50 p-3 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        We hit an unexpected error rendering this page. Try again, or go back
        to the dashboard. The error has been logged.
      </p>
      {error?.digest && (
        <p className="mt-2 font-mono text-xs text-gray-400">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => reset()} variant="default">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/dashboard";
            }
          }}
        >
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
