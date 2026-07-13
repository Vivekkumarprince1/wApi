"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import type { Application, Certificate, OfferLetter, OfferStatus, WorkMode } from "@/types/career";
import { Badge, Button, Field, Input, Select, StatusBadge, Surface, Textarea } from "@/components/ui";
import { cn, formatDate, statusLabel } from "@/lib/utils";

type CredentialTab = "issue-certificate" | "certificates" | "issue-offer" | "offers" | "verify";
type CertificatePrefill = {
  recipientName?: string;
  recipientEmail?: string;
  credential?: string;
  role?: string;
  fromDate?: string;
  toDate?: string;
};
type Notice = { type: "success" | "error" | "info"; message: string };
type EmailTarget =
  | { kind: "certificates"; id: string; label: string; email?: string }
  | { kind: "offers"; id: string; label: string; email?: string };

const workModes: WorkMode[] = ["Remote", "On-site", "Hybrid"];
const offerStatuses: OfferStatus[] = ["issued", "accepted", "rejected", "expired", "cancelled"];
const certificateStatuses: Certificate["status"][] = ["valid", "expired", "revoked"];

function dateInput(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsv(text: string) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/).filter(Boolean);
  if (!headerLine) return [];
  const headers = headerLine.split(",").map((header) => header.trim());
  return lines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])) as Record<string, string>;
  });
}

function downloadBlob(blob: Blob, fallbackName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function readApi<T>(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "Request failed.");
  return payload?.data as T;
}

export function CredentialsManagement({
  initialTab,
  initialCertificates,
  initialOffers,
  applications,
  certificatePrefill,
  filterEmail = "",
  autoOpenExtendEmail = "",
  currentUser,
}: {
  initialTab: CredentialTab;
  initialCertificates: Certificate[];
  initialOffers: OfferLetter[];
  applications: Application[];
  certificatePrefill?: CertificatePrefill;
  filterEmail?: string;
  autoOpenExtendEmail?: string;
  currentUser: { name: string; email: string };
}) {
  const [activeTab, setActiveTab] = useState<CredentialTab>(initialTab);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [offers, setOffers] = useState(initialOffers);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [certificateStatusFilter, setCertificateStatusFilter] = useState<Certificate["status"] | "all">("all");
  const [offerStatusFilter, setOfferStatusFilter] = useState<OfferStatus | "all">("all");
  const [emailFilter, setEmailFilter] = useState(filterEmail);
  const [expandedCertificate, setExpandedCertificate] = useState("");
  const [expandedOffer, setExpandedOffer] = useState("");
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [verifyCertificate, setVerifyCertificate] = useState<Certificate | null>(null);
  const [extendTarget, setExtendTarget] = useState<OfferLetter | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [certificateForm, setCertificateForm] = useState({
    recipientName: certificatePrefill?.recipientName || "",
    recipientEmail: certificatePrefill?.recipientEmail || "",
    credential: certificatePrefill?.credential || "Internship Completion",
    role: certificatePrefill?.role || "",
    fromDate: certificatePrefill?.fromDate || "",
    toDate: certificatePrefill?.toDate || "",
  });
  const [offerForm, setOfferForm] = useState({
    applicationId: applications[0]?.id || "",
    candidateName: applications[0]?.candidate.name || "",
    candidateEmail: applications[0]?.candidate.email || "",
    position: applications[0]?.jobTitle || "",
    department: "People Operations",
    salary: "",
    startDate: addDays(30),
    validUntil: addDays(14),
    workType: "On-site" as WorkMode,
  });

  const applicationById = useMemo(() => new Map(applications.map((application) => [application.id, application])), [applications]);
  const selectedApplication = applicationById.get(offerForm.applicationId);

  const certificateStats = useMemo(
    () => ({
      total: certificates.length,
      valid: certificates.filter((certificate) => certificate.status === "valid").length,
      expired: certificates.filter((certificate) => certificate.status === "expired").length,
      revoked: certificates.filter((certificate) => certificate.status === "revoked").length,
    }),
    [certificates],
  );

  const offerStats = useMemo(
    () => ({
      total: offers.length,
      issued: offers.filter((offer) => offer.status === "issued").length,
      accepted: offers.filter((offer) => offer.status === "accepted").length,
      rejected: offers.filter((offer) => offer.status === "rejected").length,
    }),
    [offers],
  );

  const filteredCertificates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return certificates
      .filter((certificate) => certificateStatusFilter === "all" || certificate.status === certificateStatusFilter)
      .filter((certificate) => {
        if (!normalized) return true;
        return [certificate.publicId, certificate.recipientName, certificate.credential, certificate.role, certificate.issuer]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      });
  }, [certificates, certificateStatusFilter, query]);

  const filteredOffers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const normalizedEmail = emailFilter.trim().toLowerCase();
    return offers
      .filter((offer) => offerStatusFilter === "all" || offer.status === offerStatusFilter)
      .filter((offer) => {
        if (!normalizedEmail) return true;
        const application = applicationById.get(offer.applicationId);
        return application?.candidate.email.toLowerCase() === normalizedEmail;
      })
      .filter((offer) => {
        if (!normalized) return true;
        const application = applicationById.get(offer.applicationId);
        return [offer.publicId, offer.candidateName, application?.candidate.email, offer.position, offer.department, offer.salary, offer.issuer]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      });
  }, [applicationById, emailFilter, offerStatusFilter, offers, query]);

  useEffect(() => {
    if (!autoOpenExtendEmail || !offers.length) return;
    const match = offers.find((offer) => {
      const application = applicationById.get(offer.applicationId);
      return application?.candidate.email.toLowerCase() === autoOpenExtendEmail.toLowerCase();
    });
    if (!match) return;
    setActiveTab("offers");
    setEmailFilter(autoOpenExtendEmail);
    setExpandedOffer(match.id);
    setExtendTarget(match);
  }, [applicationById, autoOpenExtendEmail, offers]);

  const resetMessages = () => setNotice(null);
  const setSuccess = (message: string) => setNotice({ type: "success", message });
  const setError = (message: string) => setNotice({ type: "error", message });

  const refreshAdminCollections = async () => {
    setBusy("Refreshing");
    resetMessages();
    try {
      const [certificatesResponse, offersResponse] = await Promise.all([
        fetch("/api/v1/admin/certificates", { cache: "no-store" }),
        fetch("/api/v1/admin/offers", { cache: "no-store" }),
      ]);
      setCertificates(await readApi<Certificate[]>(certificatesResponse));
      setOffers(await readApi<OfferLetter[]>(offersResponse));
      setSuccess("Credential lists refreshed.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not refresh credentials.");
    } finally {
      setBusy("");
    }
  };

  const issueCertificate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("Issuing certificate");
    resetMessages();
    try {
      const response = await fetch("/api/v1/admin/certificates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(certificateForm),
      });
      const certificate = await readApi<Certificate>(response);
      setCertificates((current) => [certificate, ...current]);
      setSuccess("Certificate issued successfully.");
      if (certificate.recipientName && certificateForm.recipientEmail) {
        await sendCredentialEmail({ kind: "certificates", id: certificate.id, label: certificate.recipientName, email: certificateForm.recipientEmail }, false);
      }
      setActiveTab("certificates");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not issue certificate.");
    } finally {
      setBusy("");
    }
  };

  const issueOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("Issuing offer letter");
    resetMessages();
    try {
      const body = {
        ...offerForm,
        candidateName: offerForm.candidateName || selectedApplication?.candidate.name,
        candidateEmail: offerForm.candidateEmail || selectedApplication?.candidate.email,
        position: offerForm.position || selectedApplication?.jobTitle,
      };
      const response = await fetch("/api/v1/admin/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const offer = await readApi<OfferLetter>(response);
      setOffers((current) => [offer, ...current]);
      setSuccess("Offer letter issued successfully.");
      if (offerForm.candidateEmail) {
        await sendCredentialEmail({ kind: "offers", id: offer.id, label: offer.candidateName, email: offerForm.candidateEmail }, false);
      }
      setActiveTab("offers");
      setExpandedOffer(offer.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not issue offer.");
    } finally {
      setBusy("");
    }
  };

  const patchCertificateStatus = async (id: string, status: Certificate["status"]) => {
    setBusy(`Updating ${id}`);
    resetMessages();
    try {
      const response = await fetch(`/api/v1/admin/certificates/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const certificate = await readApi<Certificate>(response);
      setCertificates((current) => current.map((item) => (item.id === id ? certificate : item)));
      setSuccess("Certificate status updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update certificate.");
    } finally {
      setBusy("");
    }
  };

  const patchOfferStatus = async (id: string, status: OfferStatus) => {
    setBusy(`Updating ${id}`);
    resetMessages();
    try {
      const response = await fetch(`/api/v1/admin/offers/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const offer = await readApi<OfferLetter>(response);
      setOffers((current) => current.map((item) => (item.id === id ? offer : item)));
      setSuccess("Offer status updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update offer.");
    } finally {
      setBusy("");
    }
  };

  const extendOffer = async (id: string, validUntil: string) => {
    setBusy("Extending offer");
    resetMessages();
    try {
      const response = await fetch(`/api/v1/admin/offers/${id}/extend`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ validUntil }),
      });
      const offer = await readApi<OfferLetter>(response);
      setOffers((current) => current.map((item) => (item.id === id ? offer : item)));
      setExtendTarget(null);
      setSuccess("Offer acceptance deadline extended.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not extend offer.");
    } finally {
      setBusy("");
    }
  };

  const regenerateToken = async (id: string) => {
    setBusy("Regenerating token");
    resetMessages();
    try {
      const response = await fetch(`/api/v1/admin/offers/${id}/regenerate-token`, { method: "POST" });
      const offer = await readApi<OfferLetter>(response);
      setOffers((current) => current.map((item) => (item.id === id ? offer : item)));
      setSuccess("Acceptance token regenerated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not regenerate token.");
    } finally {
      setBusy("");
    }
  };

  const sendCredentialEmail = async (target: EmailTarget, showNotice = true) => {
    setBusy("Queueing email");
    if (showNotice) resetMessages();
    try {
      const response = await fetch(`/api/v1/admin/${target.kind}/${target.id}/email`, { method: "POST" });
      await readApi<{ queued: boolean }>(response);
      if (showNotice) {
        setEmailTarget(null);
        setSuccess(`Email queued for ${target.email || target.label}.`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not queue email.");
    } finally {
      setBusy("");
    }
  };

  const downloadArtifact = async (kind: "certificates" | "offers", id: string) => {
    setBusy("Downloading artifact");
    resetMessages();
    try {
      const response = await fetch(`/api/v1/admin/${kind}/${id}/download`);
      if (!response.ok) throw new Error("Could not download artifact.");
      await downloadBlob(await response.blob(), `${kind}-${id}.txt`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not download artifact.");
    } finally {
      setBusy("");
    }
  };

  const downloadSample = async () => {
    setBusy("Downloading sample");
    resetMessages();
    try {
      const response = await fetch("/api/v1/admin/offers/bulk-sample-csv");
      if (!response.ok) throw new Error("Could not download sample CSV.");
      await downloadBlob(await response.blob(), "bulk_offer_sample.csv");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not download sample CSV.");
    } finally {
      setBusy("");
    }
  };

  const exportOffersCsv = () => {
    const rows = [
      ["Public ID", "Candidate", "Email", "Position", "Department", "Salary", "Start Date", "Valid Until", "Work Type", "Status"],
      ...filteredOffers.map((offer) => {
        const application = applicationById.get(offer.applicationId);
        return [
          offer.publicId,
          offer.candidateName,
          application?.candidate.email || "",
          offer.position,
          offer.department,
          offer.salary,
          formatDate(offer.startDate),
          formatDate(offer.validUntil),
          offer.workType,
          offer.status,
        ];
      }),
    ];
    downloadBlob(new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }), "offer_letters.csv");
  };

  const tabs: { key: CredentialTab; label: string; count?: number }[] = [
    { key: "issue-certificate", label: "Issue Certificate" },
    { key: "issue-offer", label: "Issue Offer Letter" },
    { key: "certificates", label: "All Certificates", count: certificates.length },
    { key: "offers", label: "All Offer Letters", count: offers.length },
    { key: "verify", label: "Verify Certificate" },
  ];

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Certification Management</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Certificates and offer letters</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Issue, verify, email, download, extend, and revoke ConnectSphere candidate credentials.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={downloadSample} disabled={Boolean(busy)}>
              <Download className="size-4" aria-hidden="true" />
              Offer CSV sample
            </Button>
            <Button type="button" variant="outline" onClick={refreshAdminCollections} disabled={Boolean(busy)}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Stat label="Certificates" value={certificateStats.total} detail={`${certificateStats.valid} valid`} />
          <Stat label="Expired / Revoked" value={certificateStats.expired + certificateStats.revoked} detail="Certificate exceptions" />
          <Stat label="Offer letters" value={offerStats.total} detail={`${offerStats.issued} awaiting decision`} />
          <Stat label="Accepted offers" value={offerStats.accepted} detail={`${offerStats.rejected} rejected`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.key ? "border-primary bg-emerald-50 text-primary" : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {typeof tab.count === "number" ? <Badge className="bg-background">{tab.count}</Badge> : null}
            </button>
          ))}
        </div>
        {notice ? <Notice type={notice.type}>{notice.message}</Notice> : null}
      </Surface>

      {activeTab === "issue-certificate" ? (
        <Surface className="p-4">
          <h2 className="text-base font-semibold">Issue Certificate</h2>
          <form className="mt-4 grid gap-4" onSubmit={issueCertificate}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field id="cert-name" label="Recipient name">
                <Input id="cert-name" value={certificateForm.recipientName} onChange={(event) => setCertificateForm((current) => ({ ...current, recipientName: event.target.value }))} required />
              </Field>
              <Field id="cert-email" label="Recipient email">
                <Input id="cert-email" type="email" value={certificateForm.recipientEmail} onChange={(event) => setCertificateForm((current) => ({ ...current, recipientEmail: event.target.value }))} />
              </Field>
              <Field id="cert-role" label="Job Role">
                <Input id="cert-role" value={certificateForm.role} onChange={(event) => setCertificateForm((current) => ({ ...current, role: event.target.value }))} />
              </Field>
              <Field id="cert-credential" label="Domain / Credential">
                <Input id="cert-credential" value={certificateForm.credential} onChange={(event) => setCertificateForm((current) => ({ ...current, credential: event.target.value }))} />
              </Field>
              <Field id="cert-from" label="From Date">
                <Input id="cert-from" type="date" value={certificateForm.fromDate} onChange={(event) => setCertificateForm((current) => ({ ...current, fromDate: event.target.value }))} />
              </Field>
              <Field id="cert-to" label="To Date">
                <Input id="cert-to" type="date" value={certificateForm.toDate} onChange={(event) => setCertificateForm((current) => ({ ...current, toDate: event.target.value }))} />
              </Field>
            </div>
            <Button className="w-full sm:w-fit" type="submit" disabled={Boolean(busy)}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              {busy === "Issuing certificate" ? "Issuing" : "Issue Certificate"}
            </Button>
          </form>
        </Surface>
      ) : null}

      {activeTab === "issue-offer" ? (
        <Surface className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Issue Offer Letter</h2>
              <p className="mt-1 text-sm text-muted-foreground">Create a single offer, or bulk issue from a CSV file.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowBulkModal(true)}>
              <UploadCloud className="size-4" aria-hidden="true" />
              Bulk Issue Offer
            </Button>
          </div>

          <form className="mt-4 grid gap-4" onSubmit={issueOffer}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field id="offer-application" label="Application">
                <Select
                  id="offer-application"
                  value={offerForm.applicationId}
                  onChange={(event) => {
                    const application = applications.find((item) => item.id === event.target.value);
                    setOfferForm((current) => ({
                      ...current,
                      applicationId: event.target.value,
                      candidateName: application?.candidate.name || current.candidateName,
                      candidateEmail: application?.candidate.email || current.candidateEmail,
                      position: application?.jobTitle || current.position,
                    }));
                  }}
                >
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>{application.candidate.name} - {application.jobTitle}</option>
                  ))}
                </Select>
              </Field>
              <Field id="offer-name" label="Candidate Name">
                <Input id="offer-name" value={offerForm.candidateName} onChange={(event) => setOfferForm((current) => ({ ...current, candidateName: event.target.value }))} />
              </Field>
              <Field id="offer-email" label="Candidate Email">
                <Input id="offer-email" type="email" value={offerForm.candidateEmail} onChange={(event) => setOfferForm((current) => ({ ...current, candidateEmail: event.target.value }))} />
              </Field>
              <Field id="offer-position" label="Position">
                <Input id="offer-position" value={offerForm.position} onChange={(event) => setOfferForm((current) => ({ ...current, position: event.target.value }))} required />
              </Field>
              <Field id="offer-department" label="Department">
                <Input id="offer-department" value={offerForm.department} onChange={(event) => setOfferForm((current) => ({ ...current, department: event.target.value }))} required />
              </Field>
              <Field id="offer-salary" label="Salary">
                <Input id="offer-salary" value={offerForm.salary} onChange={(event) => setOfferForm((current) => ({ ...current, salary: event.target.value }))} required />
              </Field>
              <Field id="offer-start" label="Start Date">
                <Input id="offer-start" type="date" value={offerForm.startDate} onChange={(event) => setOfferForm((current) => ({ ...current, startDate: event.target.value }))} required />
              </Field>
              <Field id="offer-valid" label="Valid Until">
                <Input id="offer-valid" type="date" value={offerForm.validUntil} onChange={(event) => setOfferForm((current) => ({ ...current, validUntil: event.target.value }))} required />
              </Field>
              <Field id="offer-work" label="Work Type">
                <Select id="offer-work" value={offerForm.workType} onChange={(event) => setOfferForm((current) => ({ ...current, workType: event.target.value as WorkMode }))}>
                  {workModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </Select>
              </Field>
            </div>
            <Button className="w-full sm:w-fit" type="submit" disabled={Boolean(busy)}>
              <FileCheck2 className="size-4" aria-hidden="true" />
              {busy === "Issuing offer letter" ? "Issuing" : "Issue Offer"}
            </Button>
          </form>
        </Surface>
      ) : null}

      {activeTab === "certificates" ? (
        <CredentialListShell
          title={`All Certificates (${filteredCertificates.length})`}
          query={query}
          setQuery={setQuery}
          statusFilter={certificateStatusFilter}
          setStatusFilter={(value) => setCertificateStatusFilter(value as Certificate["status"] | "all")}
          statuses={certificateStatuses}
        >
          {filteredCertificates.length ? (
            <CertificateList
              certificates={filteredCertificates}
              expandedCertificate={expandedCertificate}
              setExpandedCertificate={setExpandedCertificate}
              onStatus={patchCertificateStatus}
              onDownload={(certificate) => downloadArtifact("certificates", certificate.id)}
              onEmail={(certificate) => setEmailTarget({ kind: "certificates", id: certificate.id, label: certificate.recipientName, email: certificatePrefill?.recipientEmail })}
              onVerify={setVerifyCertificate}
              busy={busy}
            />
          ) : (
            <Empty message="No certificates found." />
          )}
        </CredentialListShell>
      ) : null}

      {activeTab === "offers" ? (
        <CredentialListShell
          title={emailFilter ? `Offer History (${filteredOffers.length})` : `All Offer Letters (${filteredOffers.length})`}
          query={query}
          setQuery={setQuery}
          statusFilter={offerStatusFilter}
          setStatusFilter={(value) => setOfferStatusFilter(value as OfferStatus | "all")}
          statuses={offerStatuses}
          extraFilter={
            <Field id="offer-email-filter" label="Filter by user email">
              <Input
                id="offer-email-filter"
                name="offer-history-filter"
                type="email"
                autoComplete="off"
                value={emailFilter}
                onChange={(event) => setEmailFilter(event.target.value)}
                placeholder="candidate@example.com"
              />
            </Field>
          }
          action={
            <Button type="button" variant="outline" onClick={exportOffersCsv}>
              <Download className="size-4" aria-hidden="true" />
              Export
            </Button>
          }
        >
          {filteredOffers.length ? (
            <OfferList
              offers={filteredOffers}
              applications={applicationById}
              expandedOffer={expandedOffer}
              setExpandedOffer={setExpandedOffer}
              onStatus={patchOfferStatus}
              onDownload={(offer) => downloadArtifact("offers", offer.id)}
              onEmail={(offer) => {
                const application = applicationById.get(offer.applicationId);
                setEmailTarget({ kind: "offers", id: offer.id, label: offer.candidateName, email: application?.candidate.email });
              }}
              onExtend={setExtendTarget}
              onRegenerate={regenerateToken}
              busy={busy}
            />
          ) : (
            <Empty message={emailFilter ? "No offer letters found for selected user." : "No offer letters found."} />
          )}
        </CredentialListShell>
      ) : null}

      {activeTab === "verify" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Surface className="p-4">
            <h2 className="text-base font-semibold">Certificate verification entry</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open the public certificate verification tool.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/verify">Verify certificate</Link>
            </Button>
          </Surface>
          <Surface className="p-4">
            <h2 className="text-base font-semibold">Offer verification entry</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open the public offer letter verification tool.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/verify-offer">Verify offer</Link>
            </Button>
          </Surface>
        </div>
      ) : null}

      {emailTarget ? (
        <EmailModal
          target={emailTarget}
          loading={Boolean(busy)}
          onClose={() => setEmailTarget(null)}
          onSend={(target) => sendCredentialEmail(target)}
        />
      ) : null}
      {verifyCertificate ? <VerifyCertificateModal certificate={verifyCertificate} onClose={() => setVerifyCertificate(null)} /> : null}
      {extendTarget ? (
        <ExtendOfferModal
          offer={extendTarget}
          loading={Boolean(busy)}
          onClose={() => setExtendTarget(null)}
          onExtend={(validUntil) => extendOffer(extendTarget.id, validUntil)}
        />
      ) : null}
      {showBulkModal ? (
        <BulkOfferModal
          currentUser={currentUser}
          loading={Boolean(busy)}
          onClose={() => setShowBulkModal(false)}
          onDownloadSample={downloadSample}
          onSubmit={async (rows) => {
            setBusy("Bulk issuing offers");
            resetMessages();
            try {
              const response = await fetch("/api/v1/admin/offers/bulk-issue", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ offers: rows }),
              });
              const result = await readApi<{ created: OfferLetter[]; failed: unknown[]; total: number }>(response);
              setOffers((current) => [...result.created, ...current]);
              setShowBulkModal(false);
              setActiveTab("offers");
              setSuccess(`Bulk issue complete: ${result.created.length} created, ${result.failed.length} failed.`);
            } catch (error) {
              setError(error instanceof Error ? error.message : "Could not process bulk offers.");
            } finally {
              setBusy("");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Notice({ type, children }: { type: Notice["type"]; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-sm",
        type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        type === "error" && "border-rose-200 bg-rose-50 text-rose-800",
        type === "info" && "border-sky-200 bg-sky-50 text-sky-800",
      )}
    >
      {children}
    </div>
  );
}

function CredentialListShell({
  title,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  statuses,
  extraFilter,
  action,
  children,
}: {
  title: string;
  query: string;
  setQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  statuses: string[];
  extraFilter?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Surface className="overflow-hidden">
      <div className="border-b p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search, expand, email, verify, download, and update statuses.</p>
          </div>
          {action}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field id="credential-search" label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="credential-search" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, role, email" />
            </div>
          </Field>
          <Field id="credential-status" label="Status">
            <Select id="credential-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status as never)}</option>
              ))}
            </Select>
          </Field>
          {extraFilter}
        </div>
      </div>
      {children}
    </Surface>
  );
}

function CertificateList({
  certificates,
  expandedCertificate,
  setExpandedCertificate,
  onStatus,
  onDownload,
  onEmail,
  onVerify,
  busy,
}: {
  certificates: Certificate[];
  expandedCertificate: string;
  setExpandedCertificate: (id: string) => void;
  onStatus: (id: string, status: Certificate["status"]) => void;
  onDownload: (certificate: Certificate) => void;
  onEmail: (certificate: Certificate) => void;
  onVerify: (certificate: Certificate) => void;
  busy: string;
}) {
  return (
    <>
      <div className="grid gap-3 p-3 md:hidden">
        {certificates.map((certificate) => (
          <CredentialCard key={certificate.id}>
            <CertificateSummary certificate={certificate} expanded={expandedCertificate === certificate.id} onToggle={() => setExpandedCertificate(expandedCertificate === certificate.id ? "" : certificate.id)} />
            {expandedCertificate === certificate.id ? (
              <CertificateDetails certificate={certificate} onStatus={onStatus} onDownload={onDownload} onEmail={onEmail} onVerify={onVerify} busy={busy} />
            ) : null}
          </CredentialCard>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="grid gap-3 p-3">
          {certificates.map((certificate) => (
            <CredentialCard key={certificate.id}>
              <CertificateSummary certificate={certificate} expanded={expandedCertificate === certificate.id} onToggle={() => setExpandedCertificate(expandedCertificate === certificate.id ? "" : certificate.id)} />
              {expandedCertificate === certificate.id ? (
                <CertificateDetails certificate={certificate} onStatus={onStatus} onDownload={onDownload} onEmail={onEmail} onVerify={onVerify} busy={busy} />
              ) : null}
            </CredentialCard>
          ))}
        </div>
      </div>
    </>
  );
}

function CertificateSummary({ certificate, expanded, onToggle }: { certificate: Certificate; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40" onClick={onToggle}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="safe-text font-medium">{certificate.credential}</h3>
          <StatusBadge status={certificate.status} />
        </div>
        <p className="safe-text mt-1 text-sm text-muted-foreground">{certificate.recipientName} - {certificate.role}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">{certificate.publicId}</span>
        {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
      </div>
    </button>
  );
}

function CertificateDetails({
  certificate,
  onStatus,
  onDownload,
  onEmail,
  onVerify,
  busy,
}: {
  certificate: Certificate;
  onStatus: (id: string, status: Certificate["status"]) => void;
  onDownload: (certificate: Certificate) => void;
  onEmail: (certificate: Certificate) => void;
  onVerify: (certificate: Certificate) => void;
  busy: string;
}) {
  return (
    <div className="border-t bg-muted/20 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Info label="Certificate ID" value={certificate.publicId} />
        <Info label="Issued By" value={certificate.issuer} />
        <Info label="Issued On" value={formatDate(certificate.issuedAt)} />
        <Info label="Duration" value={`${formatDate(certificate.fromDate)} - ${formatDate(certificate.toDate)}`} />
      </div>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Field id={`cert-status-${certificate.id}`} label="Certificate status">
          <Select id={`cert-status-${certificate.id}`} value={certificate.status} onChange={(event) => onStatus(certificate.id, event.target.value as Certificate["status"])}>
            {certificateStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" type="button" onClick={() => onDownload(certificate)} disabled={Boolean(busy)}>
            <Download className="size-4" aria-hidden="true" />
            Download
          </Button>
          <Button size="sm" variant="outline" type="button" onClick={() => onEmail(certificate)} disabled={Boolean(busy)}>
            <Mail className="size-4" aria-hidden="true" />
            Email
          </Button>
          <Button size="sm" variant="outline" type="button" onClick={() => onVerify(certificate)}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            Verify
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/verify/${certificate.publicId}`} target="_blank">
              <ExternalLink className="size-4" aria-hidden="true" />
              Public
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function OfferList({
  offers,
  applications,
  expandedOffer,
  setExpandedOffer,
  onStatus,
  onDownload,
  onEmail,
  onExtend,
  onRegenerate,
  busy,
}: {
  offers: OfferLetter[];
  applications: Map<string, Application>;
  expandedOffer: string;
  setExpandedOffer: (id: string) => void;
  onStatus: (id: string, status: OfferStatus) => void;
  onDownload: (offer: OfferLetter) => void;
  onEmail: (offer: OfferLetter) => void;
  onExtend: (offer: OfferLetter) => void;
  onRegenerate: (id: string) => void;
  busy: string;
}) {
  return (
    <div className="grid gap-3 p-3">
      {offers.map((offer) => {
        const application = applications.get(offer.applicationId);
        return (
          <CredentialCard key={offer.id}>
            <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40" onClick={() => setExpandedOffer(expandedOffer === offer.id ? "" : offer.id)}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="safe-text font-medium">{offer.candidateName}</h3>
                  <StatusBadge status={offer.status} />
                  <Badge className="border-border bg-muted">{application ? "Application" : "Manual"}</Badge>
                </div>
                <p className="safe-text mt-1 text-sm text-muted-foreground">{offer.position} - {offer.department}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">{offer.publicId}</span>
                {expandedOffer === offer.id ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
              </div>
            </button>
            {expandedOffer === offer.id ? (
              <div className="border-t bg-muted/20 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Info label="Email" value={application?.candidate.email || "Manual offer"} />
                  <Info label="Salary" value={offer.salary} />
                  <Info label="Start Date" value={formatDate(offer.startDate)} />
                  <Info label="Work Type" value={offer.workType} />
                  <Info label="Valid Until" value={formatDate(offer.validUntil)} />
                  <Info label="Issued On" value={formatDate(offer.issuedAt)} />
                </div>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <Field id={`offer-status-${offer.id}`} label="Offer status">
                    <Select id={`offer-status-${offer.id}`} value={offer.status} onChange={(event) => onStatus(offer.id, event.target.value as OfferStatus)}>
                      {offerStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                    </Select>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" type="button" onClick={() => onDownload(offer)} disabled={Boolean(busy)}>
                      <Download className="size-4" aria-hidden="true" />
                      Download PDF
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => onEmail(offer)} disabled={Boolean(busy)}>
                      <Mail className="size-4" aria-hidden="true" />
                      Send Email
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => onRegenerate(offer.id)} disabled={Boolean(busy)}>
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Token
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => onExtend(offer)} disabled={Boolean(busy)}>
                      <FileText className="size-4" aria-hidden="true" />
                      Extend Offer
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/offer/accept/${application?.jobSlug || "offer"}/${offer.publicId}`} target="_blank">Accept page</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/verify-offer/${offer.publicId}`} target="_blank">Verify</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </CredentialCard>
        );
      })}
    </div>
  );
}

function BulkOfferModal({
  currentUser,
  loading,
  onClose,
  onDownloadSample,
  onSubmit,
}: {
  currentUser: { name: string; email: string };
  loading: boolean;
  onClose: () => void;
  onDownloadSample: () => void;
  onSubmit: (rows: Record<string, string>[]) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [commonDetails, setCommonDetails] = useState({
    validUntil: addDays(14),
    workType: "On-site" as WorkMode,
    sendEmail: false,
    hrContactName: currentUser.name,
    hrContactEmail: currentUser.email,
    hrContactPhone: "",
  });
  const rows = useMemo(() => {
    return parseCsv(csvText).map((row) => ({
      ...row,
      candidateEmail: row.candidateEmail || row.email || "",
      validUntil: row.validUntil || commonDetails.validUntil,
      workType: row.workType || commonDetails.workType,
    }));
  }, [commonDetails.validUntil, commonDetails.workType, csvText]);

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  };

  return (
    <Modal title="Bulk Issue Offer Letters" onClose={onClose} size="xl">
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">Upload Candidate Data</h3>
            <Button type="button" variant="outline" size="sm" onClick={onDownloadSample}>
              <Download className="size-4" aria-hidden="true" />
              Download Sample CSV
            </Button>
          </div>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/35 p-4 text-center hover:bg-muted">
            <UploadCloud className="size-7 text-muted-foreground" aria-hidden="true" />
            <span className="mt-2 text-sm font-medium">{fileName || "Click to upload CSV file"}</span>
            <span className="text-xs text-muted-foreground">Required columns: candidateName, email, position, department, salary, startDate</span>
            <input type="file" accept=".csv" className="sr-only" onChange={readFile} />
          </label>
          <Field id="bulk-csv" label="CSV Preview / Paste CSV">
            <Textarea id="bulk-csv" className="min-h-36 font-mono text-xs" value={csvText} onChange={(event) => setCsvText(event.target.value)} />
          </Field>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Field id="bulk-valid" label="Offer Acceptance Deadline">
            <Input id="bulk-valid" type="date" value={commonDetails.validUntil} onChange={(event) => setCommonDetails((current) => ({ ...current, validUntil: event.target.value }))} />
          </Field>
          <Field id="bulk-work" label="Work Type">
            <Select id="bulk-work" value={commonDetails.workType} onChange={(event) => setCommonDetails((current) => ({ ...current, workType: event.target.value as WorkMode }))}>
              {workModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </Select>
          </Field>
          <Field id="bulk-hr-name" label="HR Name">
            <Input id="bulk-hr-name" value={commonDetails.hrContactName} onChange={(event) => setCommonDetails((current) => ({ ...current, hrContactName: event.target.value }))} />
          </Field>
          <Field id="bulk-hr-email" label="HR Email">
            <Input id="bulk-hr-email" type="email" value={commonDetails.hrContactEmail} onChange={(event) => setCommonDetails((current) => ({ ...current, hrContactEmail: event.target.value }))} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={commonDetails.sendEmail}
              onChange={(event) => setCommonDetails((current) => ({ ...current, sendEmail: event.target.checked }))}
            />
            Send offer letter notification emails automatically
          </label>
        </section>

        <div className="rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
          {rows.length} parsed rows ready for bulk issue.
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onSubmit(rows)} disabled={loading || rows.length === 0}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {loading ? "Processing" : "Generate Offer Letters"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ExtendOfferModal({
  offer,
  loading,
  onClose,
  onExtend,
}: {
  offer: OfferLetter;
  loading: boolean;
  onClose: () => void;
  onExtend: (validUntil: string) => void;
}) {
  const [validUntil, setValidUntil] = useState(dateInput(offer.validUntil));
  const [newStartDate, setNewStartDate] = useState(dateInput(offer.startDate));
  const [notes, setNotes] = useState("");

  return (
    <Modal title="Extend Offer Letter" onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/35 p-3">
          <p className="font-medium">{offer.candidateName}</p>
          <p className="text-sm text-muted-foreground">{offer.position} - {offer.department}</p>
          <p className="mt-2 text-xs text-muted-foreground">Current deadline: {formatDate(offer.validUntil)}</p>
        </div>
        <Field id="extend-valid" label="New Valid Until">
          <Input id="extend-valid" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
        </Field>
        <Field id="extend-start" label="New Start Date">
          <Input id="extend-start" type="date" value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} />
        </Field>
        <Field id="extend-notes" label="Additional Notes">
          <Textarea id="extend-notes" className="min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onExtend(validUntil)} disabled={loading || !validUntil}>
            <FileText className="size-4" aria-hidden="true" />
            {loading ? "Extending" : "Extend Offer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EmailModal({
  target,
  loading,
  onClose,
  onSend,
}: {
  target: EmailTarget;
  loading: boolean;
  onClose: () => void;
  onSend: (target: EmailTarget) => void;
}) {
  const [email, setEmail] = useState(target.email || "");
  const nextTarget = { ...target, email };
  return (
    <Modal title={`Send ${target.kind === "offers" ? "Offer Letter" : "Certificate"} via Email`} onClose={onClose} size="sm">
      <div className="space-y-4">
        <Field id="email-recipient" label="Recipient Email">
          <Input id="email-recipient" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="candidate@example.com" />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onSend(nextTarget)} disabled={loading || !email}>
            <Mail className="size-4" aria-hidden="true" />
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function VerifyCertificateModal({ certificate, onClose }: { certificate: Certificate; onClose: () => void }) {
  return (
    <Modal title="Certificate Verification" onClose={onClose}>
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5" aria-hidden="true" />
          Certificate verified successfully
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info label="Name" value={certificate.recipientName} />
        <Info label="Credential" value={certificate.credential} />
        <Info label="Role" value={certificate.role} />
        <Info label="Public ID" value={certificate.publicId} />
        <Info label="Issuer" value={certificate.issuer} />
        <Info label="Validity" value={`${formatDate(certificate.fromDate)} - ${formatDate(certificate.toDate)}`} />
      </div>
    </Modal>
  );
}

function CredentialCard({ children }: { children: ReactNode }) {
  return <article className="overflow-hidden rounded-md border bg-background">{children}</article>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="safe-text mt-1 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  size = "lg",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "lg" | "xl";
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-lg border bg-card p-5 shadow-2xl",
          size === "sm" && "max-w-lg",
          size === "lg" && "max-w-3xl",
          size === "xl" && "max-w-5xl",
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
