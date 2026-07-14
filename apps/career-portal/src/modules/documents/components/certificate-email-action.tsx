"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CertificateEmailAction({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(
      `/api/recruitment/certificates/${encodeURIComponent(id)}/email`,
      { method: "POST" },
    );
    const payload = (await response.json()) as { message?: string };
    setBusy(false);
    setMessage(
      payload.message ??
        (response.ok ? "Certificate emailed" : "Unable to email certificate"),
    );
  }
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={!enabled || busy}
        onClick={send}
      >
        Email PDF
      </Button>
      {message ? (
        <p role="status" className="mt-1 text-xs text-slate-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
