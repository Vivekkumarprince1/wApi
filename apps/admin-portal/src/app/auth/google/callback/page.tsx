"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function GoogleCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing secure sign-in…");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || searchParams.get("error")) {
      router.replace("/login?error=google");
      return;
    }

    void (async () => {
      const response = await fetch("/api/admin/auth/google/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        router.replace(`/login?error=${encodeURIComponent(body?.message ?? "google")}`);
        return;
      }
      setMessage("Signed in. Redirecting…");
      router.replace("/");
      router.refresh();
    })();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <div>
          <h1 className="font-semibold">Google sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return <Suspense fallback={null}><GoogleCallback /></Suspense>;
}
