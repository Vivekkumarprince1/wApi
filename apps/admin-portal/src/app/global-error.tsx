"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The admin portal hit an unexpected error while rendering.
            </p>
            {error?.digest ? (
              <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
            ) : null}
            <button
              onClick={() => reset()}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
