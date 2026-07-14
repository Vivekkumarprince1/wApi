"use client";

import type { ApplicationStatus } from "@prisma/client";
import {
  Download,
  LoaderCircle,
  Mail,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApplicationOfferModal } from "@/modules/documents/components/application-offer-modal";
import type { OfferInput } from "@/modules/documents/schema";
import {
  applicationCsv,
  safeDownloadName,
  type ApplicationCsvData,
} from "@/modules/recruitment/applications/detail-utils";

type Props = {
  identifier: string;
  currentStatus: ApplicationStatus;
  allowedTransitions: readonly ApplicationStatus[];
  csv: ApplicationCsvData;
  offer?: { applicationId: string; initialValues: Partial<OfferInput> };
  offerStatus?: string | null;
  hasContract?: boolean;
};

export function ApplicationActions({
  identifier,
  currentStatus,
  allowedTransitions,
  csv,
  offer,
  offerStatus = null,
  hasContract = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function request(
    path: string,
    method: "PATCH" | "POST",
    body: object,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch(
      `/api/recruitment/applications/${encodeURIComponent(identifier)}/${path}`,
      {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : null;
    setBusy(false);
    if (!response.ok) {
      setError(detail ?? "Action failed");
      return false;
    }
    setMessage(detail ?? "Completed");
    router.refresh();
    return true;
  }

  async function updateStatus(status: ApplicationStatus) {
    if (status === "REJECTED") {
      setRejecting(true);
      return;
    }
    await request("status", "PATCH", { status });
  }

  async function reject() {
    const rejectionReason = reason.trim();
    if (!rejectionReason) {
      setError("A rejection reason is required");
      return;
    }
    if (!(await request("status", "PATCH", { status: "REJECTED" }))) return;
    if (
      !(await request("email", "POST", {
        action: "rejection",
        message: rejectionReason,
      }))
    )
      return;
    setReason("");
    setRejecting(false);
  }

  async function hireAndWelcome() {
    if (!hasContract || offerStatus !== "ACCEPTED") {
      setError(
        "Candidate must accept the offer and submit onboarding before hiring",
      );
      return;
    }
    if (
      currentStatus !== "HIRED" &&
      !(await request("status", "PATCH", { status: "HIRED" }))
    )
      return;
    await request("email", "POST", { action: "welcome" });
  }

  function exportCsv() {
    const blob = new Blob([applicationCsv(csv)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeDownloadName(`${csv.fullName}-${csv.jobTitle}`)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-busy={busy}
    >
      <div>
        <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
          Workflow
        </p>
        <p className="mt-1 text-lg font-extrabold">
          {currentStatus.replaceAll("_", " ")}
        </p>
      </div>
      <ol className="space-y-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
        <li>
          <strong>1.</strong> Review referral and application
        </li>
        <li>
          <strong>2.</strong> Move to reviewing, then shortlist
        </li>
        <li>
          <strong>3.</strong> Generate and send offer
        </li>
        <li>
          <strong>4.</strong> Candidate accepts and submits onboarding
        </li>
        <li>
          <strong>5.</strong> Hire and send welcome
        </li>
      </ol>
      <div className="grid gap-2">
        {offer ? (
          <ApplicationOfferModal
            applicationId={offer.applicationId}
            initialValues={offer.initialValues}
          />
        ) : null}
        {allowedTransitions
          .filter((status) => status !== "HIRED")
          .map((status) => (
            <Button
              key={status}
              type="button"
              variant={status === "REJECTED" ? "destructive" : "secondary"}
              disabled={busy}
              onClick={() => void updateStatus(status)}
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {status === "REJECTED"
                ? "Reject application"
                : `Mark ${status.toLowerCase()}`}
            </Button>
          ))}
        {currentStatus === "OFFERED" ? (
          <Button
            type="button"
            disabled={busy || !hasContract || offerStatus !== "ACCEPTED"}
            onClick={() => void hireAndWelcome()}
          >
            <UserCheck className="size-4" />
            Hire & send welcome
          </Button>
        ) : null}
        {currentStatus === "OFFERED" &&
        (!hasContract || offerStatus !== "ACCEPTED") ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            Waiting for accepted offer and completed onboarding.
          </p>
        ) : null}
        {currentStatus === "HIRED" ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void hireAndWelcome()}
          >
            <UserCheck className="size-4" />
            Send welcome email
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={exportCsv}>
          <Download className="size-4" />
          Export safe CSV
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.refresh()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>
      {message ? (
        <p className="text-sm font-semibold text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {rejecting ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="reject-title" className="text-2xl font-extrabold">
                Reject application
              </h2>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close rejection dialog"
                onClick={() => setRejecting(false)}
              >
                <X />
              </Button>
            </div>
            <label
              className="mt-5 block text-sm font-bold"
              htmlFor="rejection-reason"
            >
              Reason sent to applicant
            </label>
            <textarea
              id="rejection-reason"
              className="mt-2 min-h-36 w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-4 focus:ring-rose-100"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
              required
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy || !reason.trim()}
                onClick={() => void reject()}
              >
                <Mail className="size-4" />
                Reject & send
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
