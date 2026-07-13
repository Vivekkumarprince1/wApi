"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { Badge, Button, Field, Input, Surface } from "@/components/ui";
import { demoAccounts } from "@/lib/auth-client";
import { useAuth } from "@/components/auth-provider";

type AuthMode = "login" | "register" | "verify" | "reset";
type AuthValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  otp: string;
  newPassword: string;
};

export function AuthCard({
  mode,
  title,
  description,
  initialEmail = "",
  from,
  showDevCredentials = false,
}: {
  mode: AuthMode;
  title: string;
  description: string;
  initialEmail?: string;
  from?: string;
  showDevCredentials?: boolean;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({
    name: "",
    email: initialEmail,
    phone: "",
    password: "",
    otp: "123456",
    newPassword: "",
  });
  const [resetOtpSent, setResetOtpSent] = useState(false);

  const targetAfterLogin = useMemo(() => {
    if (!from || ["/login", "/register", "/forgot-password", "/verify-email"].includes(from)) return undefined;
    return from;
  }, [from]);

  const update = (key: keyof AuthValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const applyDemo = (email: string, password: string) => {
    setValues((current) => ({ ...current, email, password }));
    setErrors({});
    setNotice("Development credentials loaded. Press Sign in to continue.");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setNotice("");

    try {
      if (mode === "login") {
        const data = await auth.login({ email: values.email, password: values.password });
        router.push(targetAfterLogin || data.redirectTo);
      }

      if (mode === "register") {
        const data = await auth.register({
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
        });
        const redirectTo = targetAfterLogin
          ? `${data.redirectTo}&from=${encodeURIComponent(targetAfterLogin)}`
          : data.redirectTo;
        router.push(redirectTo);
      }

      if (mode === "verify") {
        const data = await auth.verifyEmail({ email: values.email, otp: values.otp });
        router.push(targetAfterLogin || data.redirectTo);
      }

      if (mode === "reset") {
        if (!resetOtpSent) {
          const response = await fetch("/api/v1/auth/password/forgot", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: values.email }),
          });
          if (!response.ok) throw new Error("Could not send reset OTP.");
          setResetOtpSent(true);
          setNotice("OTP sent. Demo OTP is 123456.");
        } else {
          const response = await fetch("/api/v1/auth/password/reset", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: values.email, otp: values.otp, newPassword: values.newPassword }),
          });
          if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload?.error?.message || "Could not reset password.");
          }
          setNotice("Password reset. You can sign in now.");
        }
      }
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  const canShowDevCredentials = mode === "login" && showDevCredentials;

  return (
    <Surface className={canShowDevCredentials ? "mx-auto max-w-5xl overflow-hidden" : "mx-auto max-w-xl overflow-hidden"}>
      <div className={canShowDevCredentials ? "grid lg:grid-cols-[minmax(0,1fr)_380px]" : undefined}>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {errors.form ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {errors.form}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mr-1 inline size-4" aria-hidden="true" />
              {notice}
            </div>
          ) : null}

          <form className="mt-5 grid gap-4" onSubmit={submit}>
            {mode === "register" ? (
              <Field id="name" label="Name">
                <Input id="name" value={values.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" required />
              </Field>
            ) : null}

            <Field id="email" label="Email">
              <Input id="email" type="email" value={values.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required />
            </Field>

            {mode === "register" ? (
              <Field id="phone" label="Mobile number" hint="Indian mobile number, e.g. +919876543210">
                <Input id="phone" value={values.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" />
              </Field>
            ) : null}

            {mode === "verify" || (mode === "reset" && resetOtpSent) ? (
              <Field id="otp" label="Six-digit OTP" hint="Demo OTP: 123456">
                <Input id="otp" inputMode="numeric" maxLength={6} value={values.otp} onChange={(event) => update("otp", event.target.value)} required />
              </Field>
            ) : null}

            {mode === "login" || mode === "register" ? (
              <Field id="password" label="Password" hint={mode === "register" ? "12+ chars with upper, lower, number, and symbol." : undefined}>
                <Input id="password" type="password" value={values.password} onChange={(event) => update("password", event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} required />
              </Field>
            ) : null}

            {mode === "reset" && resetOtpSent ? (
              <Field id="newPassword" label="New password" hint="12+ chars with upper, lower, number, and symbol.">
                <Input id="newPassword" type="password" value={values.newPassword} onChange={(event) => update("newPassword", event.target.value)} autoComplete="new-password" required />
              </Field>
            ) : null}

            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
              {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Verify email" : resetOtpSent ? "Reset password" : "Send reset OTP"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">Login</Link>
            <Link href="/register" className="hover:text-foreground">Register</Link>
          </div>
        </div>

        {canShowDevCredentials ? (
          <aside className="border-t bg-muted/35 p-5 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Development credentials</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a role to autofill login fields for RBAC testing.
                </p>
              </div>
              <Badge className="bg-background">Dev only</Badge>
            </div>

            <div className="mt-4 grid gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => applyDemo(account.email, account.password)}
                  className="rounded-md border bg-background p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{account.label}</span>
                    <span className="text-xs text-muted-foreground">{account.route}</span>
                  </span>
                  <span className="mt-1 block break-all text-xs text-muted-foreground">{account.email}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground">
              <p>
                Password: <span className="font-medium text-foreground">Password@123</span>
              </p>
              <p>
                OTP: <span className="font-medium text-foreground">123456</span>
              </p>
            </div>
          </aside>
        ) : null}
      </div>
    </Surface>
  );
}
