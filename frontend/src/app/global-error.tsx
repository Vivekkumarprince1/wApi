"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Activates when an error is thrown in the
 * root layout itself (above the per-route error.tsx). Must render its
 * own <html> and <body> tags because the layout has crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App] Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#fff",
          color: "#111",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>
          The application failed to load
        </h1>
        <p style={{ maxWidth: 480, color: "#555", marginBottom: 16 }}>
          A fatal error occurred while loading the page shell. Try reloading.
          If the problem persists, contact support.
        </p>
        {error?.digest && (
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#888" }}>
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "#fafafa",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
