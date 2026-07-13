"use client";

import { FormEvent, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import type { VerificationResult } from "@/types/career";
import { Button, Field, Input, StatusBadge, Surface } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function VerificationLookup({
  kind,
  initialId = "",
}: {
  kind: "certificate" | "offer";
  initialId?: string;
}) {
  const [publicId, setPublicId] = useState(initialId);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const endpoint = kind === "certificate" ? "certificates" : "offers";

  const lookup = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!publicId.trim()) {
      setError("Enter a public verification ID.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/v1/verify/${endpoint}/${encodeURIComponent(publicId.trim())}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Verification failed.");
      }
      setResult(payload.data);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Surface className="p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 size-5 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {kind === "certificate" ? "Certificate verification" : "Offer verification"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Public verification returns only minimal credential data. Salary, phone, address, banking, onboarding, and internal notes are never exposed.
            </p>
          </div>
        </div>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={lookup}>
          <Field id="publicId" label="Public ID" error={error}>
            <Input id="publicId" value={publicId} onChange={(event) => setPublicId(event.target.value)} placeholder={kind === "certificate" ? "CRT-CS-2026-044" : "OFR-CSM-2026-018"} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              <Search className="size-4" aria-hidden="true" />
              {loading ? "Checking" : "Verify"}
            </Button>
          </div>
        </form>
      </Surface>

      <Surface className="p-5">
        <h2 className="text-base font-semibold">Verification result</h2>
        {!result ? (
          <p className="mt-2 text-sm text-muted-foreground">Enter an ID to see public verification details.</p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd><StatusBadge status={result.status} /></dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Public ID</dt>
              <dd className="font-medium">{result.publicId}</dd>
            </div>
            {result.recipientName ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="font-medium">{result.recipientName}</dd>
              </div>
            ) : null}
            {result.position ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Position</dt>
                <dd className="font-medium">{result.position}</dd>
              </div>
            ) : null}
            {result.issuer ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Issuer</dt>
                <dd className="font-medium">{result.issuer}</dd>
              </div>
            ) : null}
            {result.issuedAt ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Issued</dt>
                <dd className="font-medium">{formatDate(result.issuedAt)}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </Surface>
    </div>
  );
}
