"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminAuth } from "@/store/admin-auth-store";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const login = useAdminAuth((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (result.ok) {
      toast.success("Welcome back");
      const callback = searchParams.get("callbackUrl") || "/";
      window.location.assign(callback);
    } else {
      setError(result.message || "Invalid username or password");
      toast.error(result.message || "Login failed");
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const response = await fetch("/api/admin/auth/google/url", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!response.ok || !body?.url) throw new Error(body?.message ?? "Unable to start Google sign-in");
      window.location.assign(body.url);
    } catch (reason) {
      setGoogleSubmitting(false);
      setError(reason instanceof Error ? reason.message : "Unable to start Google sign-in");
    }
  }

  return (
    <div className="admin-surface relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,var(--accent),transparent)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/15">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Super Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">ConnectSphere</h1>
          <p className="mt-1 text-sm text-muted-foreground">Internal control plane for platform operations</p>
        </div>

        <Card className="border-border/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Restricted to authorized platform administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20 text-center font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@connectsphere.in"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="h-10 w-full shadow-sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
              <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Or
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Continue with Google"
                  title="Continue with Google"
                  disabled={googleSubmitting}
                  onClick={handleGoogleSignIn}
                >
                  {googleSubmitting ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Authorized access only / All activity is audited
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.06v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.12-1.32.31-1.92v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.52l3.35-2.6Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.8.5 3.84 1.5l2.88-2.88C16.96 2.95 14.7 2 12 2a10 10 0 0 0-8.94 5.48l3.35 2.6C7.2 7.72 9.4 5.97 12 5.97Z"/></svg>;
}
