"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import type { Application, ApplicationStatus, ContractStatus, EmploymentContract, Job, OfferLetter, WorkMode } from "@/types/career";
import { Badge, Button, Field, Input, Select, StatusBadge, Surface, Textarea } from "@/components/ui";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type NoticeType = "success" | "error" | "info";
type ResumeAccess = {
  fileName: string;
  url: string;
  expiresAt: string;
};

const workflowStatuses: ApplicationStatus[] = ["pending", "reviewing", "shortlisted", "offered", "hired"];
const actionStatuses: ApplicationStatus[] = ["reviewing", "shortlisted", "offered", "hired", "rejected"];
const contractStatuses: ContractStatus[] = ["submitted", "under_review", "approved", "requires_changes", "rejected"];
const workModes: WorkMode[] = ["Remote", "On-site", "Hybrid"];

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function hasContent(value?: string | string[]) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value?.trim());
}

function formatAnswer(value: string | string[] | number | boolean) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function labelFor(value: string) {
  return value
    .split("_")
    .join(" ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function canMoveToStatus(current: ApplicationStatus, target: ApplicationStatus) {
  if (current === target) return false;
  if (target === "rejected") return current !== "rejected";
  if (current === "rejected") return false;

  const currentIndex = workflowStatuses.indexOf(current);
  const targetIndex = workflowStatuses.indexOf(target);
  if (currentIndex >= 3) return targetIndex > currentIndex;
  return targetIndex >= 0;
}

function contractStatusClass(status: ContractStatus) {
  const classes: Record<ContractStatus, string> = {
    submitted: "border-sky-200 bg-sky-50 text-sky-800",
    under_review: "border-amber-200 bg-amber-50 text-amber-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    requires_changes: "border-orange-200 bg-orange-50 text-orange-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return classes[status];
}

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function readApi<T>(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Request failed.");
  }
  return payload?.data as T;
}

function downloadTextFile(content: string, fileName: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ApplicationDetail({
  initialApplication,
  job,
  offer,
  contract,
  canManage,
  canGenerateOffer,
}: {
  initialApplication: Application;
  job?: Job;
  offer?: OfferLetter;
  contract?: EmploymentContract;
  canManage: boolean;
  canGenerateOffer: boolean;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [offerLetter, setOfferLetter] = useState<OfferLetter | undefined>(offer);
  const [contractData, setContractData] = useState<EmploymentContract | undefined>(contract);
  const [jobDetailsExpanded, setJobDetailsExpanded] = useState(true);
  const [candidateMessage, setCandidateMessage] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const [offerForm, setOfferForm] = useState({
    position: job?.title || initialApplication.jobTitle,
    department: job?.department || "People Operations",
    salary: job?.salary || "As discussed",
    startDate: addDays(30),
    validUntil: addDays(14),
    workType: (job?.workMode || "Hybrid") as WorkMode,
  });
  const [contractReview, setContractReview] = useState({
    status: contract?.status || "under_review",
    reviewNote: contract?.reviewNote || "",
  });

  const backHref = canManage && job ? `/jobs/edit/${job.slug || job.id}?tab=applications` : canManage ? "/admin/applications" : "/my-applications";
  const canShowContract = Boolean(contractData || offerLetter || application.status === "offered" || application.status === "hired");
  const loading = Boolean(busy);
  const applicationAge = useMemo(() => timeAgo(application.createdAt), [application.createdAt]);

  const setSuccess = (message: string) => setNotice({ type: "success", message });
  const setErrorNotice = (message: string) => setNotice({ type: "error", message });
  const setInfo = (message: string) => setNotice({ type: "info", message });

  const reloadApplication = async () => {
    const response = await fetch(`/api/v1/applications/${application.id}`, { cache: "no-store" });
    const updated = await readApi<Application>(response);
    setApplication(updated);
    return updated;
  };

  const refreshOfferAndContract = async () => {
    setBusy("Refreshing offer data");
    setNotice(null);
    try {
      try {
        const offerResponse = await fetch(`/api/v1/applications/${application.id}/offer-letter`, { cache: "no-store" });
        setOfferLetter(await readApi<OfferLetter>(offerResponse));
      } catch {
        setOfferLetter(undefined);
      }

      try {
        const contractResponse = await fetch(`/api/v1/contracts/application/${application.id}`, { cache: "no-store" });
        const latestContract = await readApi<EmploymentContract>(contractResponse);
        setContractData(latestContract);
        setContractReview({ status: latestContract.status, reviewNote: latestContract.reviewNote || "" });
      } catch {
        setContractData(undefined);
      }

      setSuccess("Offer and contract details refreshed.");
    } catch (refreshError) {
      setErrorNotice(refreshError instanceof Error ? refreshError.message : "Could not refresh offer data.");
    } finally {
      setBusy("");
    }
  };

  const updateStatus = async (status: ApplicationStatus) => {
    if (status === "rejected") {
      setShowRejectForm(true);
      return;
    }

    setBusy(`Marking as ${labelFor(status)}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/applications/${application.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, candidateMessage: candidateMessage.trim() || undefined }),
      });
      setApplication(await readApi<Application>(response));
      setCandidateMessage("");
      setSuccess(`Application status updated to ${labelFor(status)}.`);
    } catch (statusError) {
      setErrorNotice(statusError instanceof Error ? statusError.message : "Could not update status.");
    } finally {
      setBusy("");
    }
  };

  const rejectApplication = async () => {
    if (!rejectionReason.trim()) {
      setErrorNotice("Add a rejection reason before confirming.");
      return;
    }

    setBusy("Rejecting application");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/applications/${application.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim(), candidateMessage: rejectionReason.trim() }),
      });
      setApplication(await readApi<Application>(response));
      setRejectionReason("");
      setShowRejectForm(false);
      setSuccess("Application rejected and candidate-safe reason saved.");
    } catch (rejectError) {
      setErrorNotice(rejectError instanceof Error ? rejectError.message : "Could not reject application.");
    } finally {
      setBusy("");
    }
  };

  const generateOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("Generating offer letter");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/applications/${application.id}/offer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(offerForm),
      });
      const issuedOffer = await readApi<OfferLetter>(response);
      setOfferLetter(issuedOffer);
      await reloadApplication();
      setShowOfferForm(false);
      setSuccess("Offer letter generated and application moved to Offered.");
    } catch (offerError) {
      setErrorNotice(offerError instanceof Error ? offerError.message : "Could not generate offer letter.");
    } finally {
      setBusy("");
    }
  };

  const downloadOfferLetter = async () => {
    if (!offerLetter) return;
    setBusy("Downloading offer letter");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/admin/offers/${offerLetter.id}/download`);
      if (!response.ok) throw new Error("Could not download offer letter.");
      downloadTextFile(await response.text(), `offer-${offerLetter.publicId}.txt`);
      setSuccess("Offer letter downloaded.");
    } catch (downloadError) {
      setErrorNotice(downloadError instanceof Error ? downloadError.message : "Could not download offer letter.");
    } finally {
      setBusy("");
    }
  };

  const emailOfferLetter = async () => {
    if (!offerLetter) return;
    setBusy("Queueing offer email");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/admin/offers/${offerLetter.id}/email`, { method: "POST" });
      await readApi<{ queued: boolean }>(response);
      setSuccess(`Offer email queued for ${application.candidate.email}.`);
    } catch (emailError) {
      setErrorNotice(emailError instanceof Error ? emailError.message : "Could not queue offer email.");
    } finally {
      setBusy("");
    }
  };

  const prepareResumeAccess = async () => {
    setBusy("Preparing resume access");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/applications/${application.id}/resume-access`);
      const access = await readApi<ResumeAccess>(response);
      window.open(access.url, "_blank", "noopener,noreferrer");
      setInfo(`Secure resume access prepared for ${access.fileName}. Expires ${formatDate(access.expiresAt, "dd MMM yyyy, HH:mm")}.`);
    } catch (resumeError) {
      setErrorNotice(resumeError instanceof Error ? resumeError.message : "Could not prepare resume access.");
    } finally {
      setBusy("");
    }
  };

  const updateContractStatus = async (status: ContractStatus) => {
    if (!contractData) return;
    setBusy("Updating contract");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/contracts/${contractData.id}/status`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reviewNote: contractReview.reviewNote.trim() || undefined }),
      });
      const updatedContract = await readApi<EmploymentContract>(response);
      setContractData(updatedContract);
      setContractReview({ status: updatedContract.status, reviewNote: updatedContract.reviewNote || "" });
      if (status === "approved") await reloadApplication();
      setSuccess(`Contract marked as ${labelFor(status)}.`);
    } catch (contractError) {
      setErrorNotice(contractError instanceof Error ? contractError.message : "Could not update contract.");
    } finally {
      setBusy("");
    }
  };

  const downloadContract = async () => {
    if (!contractData) return;
    setBusy("Downloading contract");
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/contracts/${contractData.id}/pdf`);
      if (!response.ok) throw new Error("Could not download contract.");
      downloadTextFile(await response.text(), `${contractData.id}-contract.txt`);
      setSuccess("Contract downloaded.");
    } catch (downloadError) {
      setErrorNotice(downloadError instanceof Error ? downloadError.message : "Could not download contract.");
    } finally {
      setBusy("");
    }
  };

  const exportToCsv = () => {
    const rows = [
      ["Name", "Email", "Phone", "Job", "Reference", "Status", "Applied Date", "Skills", "Experience", "Education", "Cover Letter"],
      [
        application.candidate.name,
        application.candidate.email,
        application.candidate.phone,
        application.jobTitle,
        application.reference,
        application.status,
        formatDate(application.createdAt, "dd MMM yyyy, HH:mm"),
        application.skills,
        application.experience,
        application.education,
        application.coverLetter,
      ],
    ];
    const content = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadTextFile(content, `${application.reference}-${application.candidate.name.replace(/\s+/g, "_")}.csv`, "text/csv;charset=utf-8");
    setSuccess("Application data exported to CSV.");
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Surface className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={application.status} />
                  <span className="safe-text rounded-md border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {application.reference}
                  </span>
                </div>
                <h1 className="safe-text mt-3 text-2xl font-semibold tracking-tight">{application.candidate.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {application.jobTitle} application submitted {applicationAge}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full md:w-auto">
                <Link href={backHref}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  {canManage && job ? "Back to job applications" : "Back to applications"}
                </Link>
              </Button>
            </div>
            <div className="mt-5">
              <WorkflowTimeline current={application.status} />
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Applicant Information</h2>
                <p className="mt-1 text-sm text-muted-foreground">Profile, contact details, resume access, and application metadata.</p>
              </div>
              <Badge className="border-border bg-muted text-muted-foreground">Applied {formatDate(application.createdAt)}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Full Name" value={application.candidate.name} />
              <Info label="Email" value={application.candidate.email} />
              <Info label="Phone" value={application.candidate.phone || "Not provided"} />
              <Info label="Location" value={application.candidate.location || "Not provided"} />
              <Info label="Application Date" value={formatDate(application.createdAt, "dd MMM yyyy, HH:mm")} />
              <Info label="Resume" value={application.resumeFileName || "No resume uploaded"} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={prepareResumeAccess} disabled={loading || !application.resumeFileName}>
                {busy === "Preparing resume access" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                View Resume
              </Button>
              <Button asChild variant="outline">
                <a href={`mailto:${application.candidate.email}?subject=${encodeURIComponent(`Update on ${application.jobTitle}`)}`}>
                  <Mail className="size-4" aria-hidden="true" />
                  Email Candidate
                </a>
              </Button>
            </div>
          </Surface>

          {application.isReferred ? (
            <Surface className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Referral Details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Employee referral attached to this application.</p>
                </div>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Referred</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Referrer" value={application.referrerName || "Not provided"} />
                <Info label="Employee ID" value={application.referrerEmployeeId || "Not provided"} />
                <Info label="Referrer Email" value={application.referrerEmail || "Not provided"} />
              </div>
              {application.referralMessage ? <TextBlock label="Referral Message" value={application.referralMessage} /> : null}
            </Surface>
          ) : null}

          {job ? (
            <Surface className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b bg-muted/40 px-5 py-4 text-left"
                onClick={() => setJobDetailsExpanded((current) => !current)}
                aria-expanded={jobDetailsExpanded}
              >
                <div className="min-w-0">
                  <h2 className="safe-text text-base font-semibold">Job Information</h2>
                  <p className="safe-text mt-1 text-sm text-muted-foreground">{job.company} - {job.department}</p>
                </div>
                {jobDetailsExpanded ? <ChevronUp className="size-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="size-4 shrink-0" aria-hidden="true" />}
              </button>
              {jobDetailsExpanded ? (
                <div className="space-y-5 p-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Info label="Title" value={job.title} />
                    <Info label="Department" value={job.department} />
                    <Info label="Location" value={job.location} />
                    <Info label="Type" value={`${job.type} / ${job.workMode}`} />
                    <Info label="Salary" value={job.salary || "Not disclosed"} />
                    <Info label="Reporting Manager" value={job.reportingManager || "Not assigned"} />
                  </div>
                  <TextBlock label="Description" value={job.description} />
                  {hasContent(job.requirements) ? <ListBlock label="Requirements" items={job.requirements} /> : null}
                  {hasContent(job.responsibilities) ? <ListBlock label="Responsibilities" items={job.responsibilities} /> : null}
                  {job.questions.length ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Job Questions</p>
                      <div className="mt-2 grid gap-2">
                        {job.questions.map((question, index) => (
                          <div key={question.id} className="rounded-md border bg-background p-3">
                            <p className="safe-text text-sm font-medium">{index + 1}. {question.questionText}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {question.questionType}
                              {question.required ? " - required" : ""}
                              {question.allowFileUpload ? " - file enabled" : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Surface>
          ) : null}

          {hasContent(application.experience) ? (
            <Surface className="p-5">
              <TextBlock label="Experience" value={application.experience} />
            </Surface>
          ) : null}

          {hasContent(application.skills) ? (
            <Surface className="p-5">
              <h2 className="text-base font-semibold">Skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {application.skills.map((skill) => (
                  <Badge key={skill} className="border-border bg-muted">{skill}</Badge>
                ))}
              </div>
            </Surface>
          ) : null}

          {hasContent(application.education) ? (
            <Surface className="p-5">
              <TextBlock label="Education" value={application.education} />
            </Surface>
          ) : null}

          {hasContent(application.coverLetter) ? (
            <Surface className="p-5">
              <TextBlock label="Cover Letter" value={application.coverLetter} />
            </Surface>
          ) : null}

          <Surface className="p-5">
            <h2 className="text-base font-semibold">Application Questions</h2>
            <div className="mt-4 grid gap-3">
              {application.questionAnswers.length ? (
                application.questionAnswers.map((answer, index) => (
                  <div key={`${answer.questionId}-${index}`} className="rounded-md border bg-background p-3">
                    <p className="safe-text text-sm font-medium">{answer.questionText}</p>
                    <p className="safe-text mt-1 whitespace-pre-line text-sm text-muted-foreground">{formatAnswer(answer.answer)}</p>
                    {answer.fileUrl ? (
                      <a
                        href={answer.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                        Open uploaded file
                      </a>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">{answer.questionType}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No custom answers submitted for this role.</p>
              )}
            </div>
          </Surface>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {notice ? <Notice type={notice.type}>{notice.message}</Notice> : null}

          {canManage ? (
            <Surface className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Actions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Update status, generate offers, reject, or export this application.</p>
                </div>
                {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold">Update Application Status</h3>
                <div className="mt-3 grid gap-2">
                  {actionStatuses.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={status === "rejected" ? "destructive" : application.status === status ? "secondary" : "outline"}
                      className="justify-start"
                      disabled={loading || !canMoveToStatus(application.status, status)}
                      title={!canMoveToStatus(application.status, status) && application.status !== status ? "Cannot move backward from offered or hired status" : undefined}
                      onClick={() => updateStatus(status)}
                    >
                      {status === "rejected" ? <XCircle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                      {status === "rejected" ? "Reject Application" : `Mark as ${labelFor(status)}`}
                    </Button>
                  ))}
                </div>
                <Field id="candidate-message" label="Candidate message" hint="Optional candidate-safe note saved in the status timeline.">
                  <Textarea
                    id="candidate-message"
                    className="mt-3 min-h-20"
                    value={candidateMessage}
                    onChange={(event) => setCandidateMessage(event.target.value)}
                    placeholder="Optional update for the candidate timeline"
                  />
                </Field>
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold">Offer Letter Management</h3>
                {offerLetter ? (
                  <OfferLetterPanel
                    offer={offerLetter}
                    application={application}
                    loading={loading}
                    onDownload={downloadOfferLetter}
                    onEmail={emailOfferLetter}
                    onRefresh={refreshOfferAndContract}
                  />
                ) : canGenerateOffer ? (
                  <Button type="button" className="mt-3 w-full justify-start" variant="outline" onClick={() => setShowOfferForm(true)} disabled={loading}>
                    <FileText className="size-4" aria-hidden="true" />
                    Generate Offer Letter
                  </Button>
                ) : (
                  <p className="mt-3 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                    You can view applicants, but offer letter generation is not enabled for this role.
                  </p>
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold">Reject Application</h3>
                <Button type="button" className="mt-3 w-full justify-start" variant="outline" onClick={() => setShowRejectForm(true)} disabled={loading || application.status === "rejected"}>
                  <XCircle className="size-4" aria-hidden="true" />
                  Reject Application
                </Button>
              </div>

              {canShowContract ? (
                <div className="mt-6 border-t pt-5">
                  <h3 className="text-sm font-semibold">Offer Acceptance & Contract Details</h3>
                  {contractData ? (
                    <ContractPanel
                      contract={contractData}
                      application={application}
                      reviewStatus={contractReview.status as ContractStatus}
                      reviewNote={contractReview.reviewNote}
                      loading={loading}
                      onStatusChange={(status) => setContractReview((current) => ({ ...current, status }))}
                      onNoteChange={(reviewNote) => setContractReview((current) => ({ ...current, reviewNote }))}
                      onSubmitStatus={() => updateContractStatus(contractReview.status as ContractStatus)}
                      onApprove={() => updateContractStatus("approved")}
                      onDownload={downloadContract}
                    />
                  ) : (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">Waiting for offer acceptance</p>
                      <p className="mt-1">The candidate has an offer flow available, but onboarding details have not been submitted yet.</p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold">Export Application Data</h3>
                <Button type="button" className="mt-3 w-full justify-start" variant="outline" onClick={exportToCsv} disabled={loading}>
                  <FileDown className="size-4" aria-hidden="true" />
                  Export to CSV
                </Button>
              </div>
            </Surface>
          ) : null}

          {!canManage ? (
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Offer Letter</h2>
              {offerLetter ? (
                <div className="mt-3 rounded-md border bg-background p-3">
                  <StatusBadge status={offerLetter.status} />
                  <p className="safe-text mt-2 text-sm font-medium">{offerLetter.publicId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Valid until {formatDate(offerLetter.validUntil)}</p>
                  <Button asChild className="mt-3 w-full" variant="outline">
                    <Link href={`/offer/accept/${application.jobSlug}/${offerLetter.publicId}`}>
                      <FileText className="size-4" aria-hidden="true" />
                      Open acceptance
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No offer letter has been issued for this application.</p>
              )}
            </Surface>
          ) : null}

          <Surface className="p-4">
            <h2 className="text-base font-semibold">Status History</h2>
            <div className="mt-3 grid gap-3">
              {application.statusHistory.map((event) => (
                <div key={`${event.from}-${event.to}-${event.at}`} className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">{labelFor(event.from)} to {labelFor(event.to)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.actor} - {formatDate(event.at, "dd MMM yyyy, HH:mm")}</p>
                  {event.candidateMessage ? <p className="safe-text mt-2 text-xs text-muted-foreground">{event.candidateMessage}</p> : null}
                </div>
              ))}
            </div>
          </Surface>
        </aside>
      </div>

      {showOfferForm ? (
        <Modal title="Generate Offer Letter" onClose={() => setShowOfferForm(false)}>
          <form onSubmit={generateOffer} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="offer-position" label="Position">
                <Input id="offer-position" value={offerForm.position} onChange={(event) => setOfferForm((current) => ({ ...current, position: event.target.value }))} />
              </Field>
              <Field id="offer-department" label="Department">
                <Input id="offer-department" value={offerForm.department} onChange={(event) => setOfferForm((current) => ({ ...current, department: event.target.value }))} />
              </Field>
              <Field id="offer-salary" label="Salary">
                <Input id="offer-salary" value={offerForm.salary} onChange={(event) => setOfferForm((current) => ({ ...current, salary: event.target.value }))} />
              </Field>
              <Field id="offer-work-type" label="Work Type">
                <Select id="offer-work-type" value={offerForm.workType} onChange={(event) => setOfferForm((current) => ({ ...current, workType: event.target.value as WorkMode }))}>
                  {workModes.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </Select>
              </Field>
              <Field id="offer-start-date" label="Start Date">
                <Input id="offer-start-date" type="date" value={offerForm.startDate} onChange={(event) => setOfferForm((current) => ({ ...current, startDate: event.target.value }))} />
              </Field>
              <Field id="offer-valid-until" label="Valid Until">
                <Input id="offer-valid-until" type="date" value={offerForm.validUntil} onChange={(event) => setOfferForm((current) => ({ ...current, validUntil: event.target.value }))} />
              </Field>
            </div>
            {job ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                HR contact: {job.hrContact.name} ({job.hrContact.email || "no email"}) - joining location defaults to {job.location}.
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowOfferForm(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {busy === "Generating offer letter" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                Generate Offer Letter
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showRejectForm ? (
        <Modal title="Reject Application" onClose={() => setShowRejectForm(false)} size="sm">
          <div className="space-y-4">
            <Field id="rejection-reason" label="Rejection Reason" hint="This message is saved to the candidate-safe status timeline.">
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Enter rejection reason..."
              />
            </Field>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowRejectForm(false)} disabled={loading}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={rejectApplication} disabled={loading || !rejectionReason.trim()}>
                {busy === "Rejecting application" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function WorkflowTimeline({ current }: { current: ApplicationStatus }) {
  if (current === "rejected") {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        This application is closed. Candidate-safe feedback is available in the status history.
      </div>
    );
  }

  const currentIndex = workflowStatuses.indexOf(current);
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Application progress">
      {workflowStatuses.map((status, index) => {
        const isDone = index <= currentIndex;
        return (
          <li key={status} className={cn("rounded-md border px-3 py-2 text-xs font-medium", isDone ? "border-primary/30 bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <span className="block truncate">{labelFor(status)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Notice({ type, children }: { type: NoticeType; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        type === "error" && "border-rose-200 bg-rose-50 text-rose-900",
        type === "info" && "border-sky-200 bg-sky-50 text-sky-900",
      )}
    >
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="safe-text mt-1 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{label}</h2>
      <p className="safe-text mt-3 whitespace-pre-line rounded-md border bg-background p-3 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li key={item} className="safe-text rounded-md border bg-background p-3 text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function OfferLetterPanel({
  offer,
  application,
  loading,
  onDownload,
  onEmail,
  onRefresh,
}: {
  offer: OfferLetter;
  application: Application;
  loading: boolean;
  onDownload: () => void;
  onEmail: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <StatusBadge status={offer.status} />
          <p className="safe-text mt-2 text-sm font-medium">{offer.publicId}</p>
        </div>
        <Button type="button" size="icon" variant="outline" aria-label="Refresh offer data" onClick={onRefresh} disabled={loading}>
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <OfferInfo label="Position" value={offer.position} />
        <OfferInfo label="Department" value={offer.department} />
        <OfferInfo label="Salary" value={offer.salary} />
        <OfferInfo label="Start Date" value={formatDate(offer.startDate)} />
        <OfferInfo label="Valid Until" value={formatDate(offer.validUntil)} />
        <OfferInfo label="Work Type" value={offer.workType} />
      </div>

      <div className="mt-3 grid gap-2">
        <Button type="button" variant="outline" className="justify-start" onClick={onDownload} disabled={loading}>
          <Download className="size-4" aria-hidden="true" />
          Download PDF
        </Button>
        <Button type="button" variant="outline" className="justify-start" onClick={onEmail} disabled={loading}>
          <Mail className="size-4" aria-hidden="true" />
          Send Email
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/certificates?tab=alloffers" target="_blank">
            <ExternalLink className="size-4" aria-hidden="true" />
            View in Certificates
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href={`/offer/accept/${application.jobSlug}/${offer.publicId}`} target="_blank">
            <FileText className="size-4" aria-hidden="true" />
            Open Acceptance
          </Link>
        </Button>
      </div>
    </div>
  );
}

function OfferInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="safe-text text-right text-xs font-medium">{value}</span>
    </div>
  );
}

function ContractPanel({
  contract,
  application,
  reviewStatus,
  reviewNote,
  loading,
  onStatusChange,
  onNoteChange,
  onSubmitStatus,
  onApprove,
  onDownload,
}: {
  contract: EmploymentContract;
  application: Application;
  reviewStatus: ContractStatus;
  reviewNote: string;
  loading: boolean;
  onStatusChange: (status: ContractStatus) => void;
  onNoteChange: (note: string) => void;
  onSubmitStatus: () => void;
  onApprove: () => void;
  onDownload: () => void;
}) {
  const addressSummary = contract.onboarding.address || formatContractAddress(contract.onboarding);
  const emergencySummary = contract.onboarding.emergencyContact || formatContractEmergencyContact(contract.onboarding);
  const bankSummary = formatContractBank(contract.onboarding);
  const agreementSummary = contract.onboarding.agreementTerms
    ? [
        contract.onboarding.agreementTerms.termsAccepted ? "Terms accepted" : "Terms pending",
        contract.onboarding.agreementTerms.privacyPolicyAccepted ? "Privacy accepted" : "Privacy pending",
      ].join(" - ")
    : contract.onboarding.consentAccepted
      ? "Accepted"
      : "Not provided";

  return (
    <div className="mt-3 space-y-4 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className={contractStatusClass(contract.status)}>{labelFor(contract.status)}</Badge>
        <span className="text-xs text-muted-foreground">Submitted {formatDate(contract.submittedAt)}</span>
      </div>

      <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Sensitive information protected
        </div>
        <p className="mt-1">Government ID and banking values show last-four only in this HR view.</p>
      </div>

      <div className="grid gap-2 text-sm">
        <OfferInfo label="Candidate" value={contract.candidateName} />
        <OfferInfo label="Email" value={contract.candidateEmail || application.candidate.email} />
        <OfferInfo label="Phone" value={contract.onboarding.phone || application.candidate.phone || "Not provided"} />
        <OfferInfo label="Date of Birth" value={contract.onboarding.dateOfBirth ? formatDate(contract.onboarding.dateOfBirth) : "Not provided"} />
        <OfferInfo label="Nationality" value={contract.onboarding.nationality || "Not provided"} />
        <OfferInfo label="Address" value={addressSummary || "Not provided"} />
        <OfferInfo label="Emergency Contact" value={emergencySummary || "Not provided"} />
        <OfferInfo
          label={contract.onboarding.governmentIdType || "Government ID"}
          value={contract.onboarding.governmentIdLast4 ? `****${contract.onboarding.governmentIdLast4}` : "Not provided"}
        />
        <OfferInfo label="Bank" value={bankSummary} />
        <OfferInfo label="IFSC" value={contract.onboarding.bankingInfo?.ifscCode || "Not provided"} />
        <OfferInfo label="Branch" value={contract.onboarding.bankingInfo?.branch || "Not provided"} />
        <OfferInfo label="Agreement" value={agreementSummary} />
      </div>

      {contract.onboarding.acceptanceComments ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Candidate Comments</p>
          <p className="safe-text mt-2 whitespace-pre-line rounded-md border bg-card p-3 text-sm">{contract.onboarding.acceptanceComments}</p>
        </div>
      ) : null}

      {contract.documents.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Documents</p>
          <div className="mt-2 grid gap-2">
            {contract.documents.map((document) => (
              <div key={document.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="safe-text min-w-0 flex-1">{document.fileName}</span>
                <span className="text-xs text-muted-foreground">{document.type}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {contract.rejectionReason ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {contract.rejectionReason}
        </div>
      ) : null}

      <div className="space-y-3 border-t pt-4">
        <Field id="contract-status" label="Contract Status">
          <Select id="contract-status" value={reviewStatus} onChange={(event) => onStatusChange(event.target.value as ContractStatus)}>
            {contractStatuses.map((status) => (
              <option key={status} value={status}>{labelFor(status)}</option>
            ))}
          </Select>
        </Field>
        <Field id="contract-review-note" label="Review Note">
          <Textarea id="contract-review-note" className="min-h-20" value={reviewNote} onChange={(event) => onNoteChange(event.target.value)} />
        </Field>
        <div className="grid gap-2">
          <Button type="button" onClick={onSubmitStatus} disabled={loading}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Save Contract Status
          </Button>
          {application.status !== "hired" ? (
            <Button type="button" variant="outline" onClick={onApprove} disabled={loading}>
              <UserRound className="size-4" aria-hidden="true" />
              Hire Candidate
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onDownload} disabled={loading}>
            <Download className="size-4" aria-hidden="true" />
            Download Contract
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatContractAddress(onboarding: EmploymentContract["onboarding"]) {
  const address = onboarding.addressDetails;
  const cityLine = [address?.city, address?.state, address?.zipCode].filter(Boolean).join(" ");
  return [address?.street, cityLine, address?.country].filter(Boolean).join(", ");
}

function formatContractEmergencyContact(onboarding: EmploymentContract["onboarding"]) {
  const contact = onboarding.emergencyContactDetails;
  const contactLine = [contact?.relationship, contact?.phone, contact?.email].filter(Boolean).join(" - ");
  return [contact?.name, contactLine].filter(Boolean).join(" - ");
}

function formatContractBank(onboarding: EmploymentContract["onboarding"]) {
  const bank = onboarding.bankingInfo;
  return [
    bank?.bankName || onboarding.bankName,
    bank?.accountHolderName,
    bank?.accountType,
    onboarding.accountLast4 ? `****${onboarding.accountLast4}` : "",
  ].filter(Boolean).join(" - ") || "Not provided";
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
  size?: "sm" | "lg";
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className={cn("max-h-[90vh] w-full overflow-y-auto rounded-lg border bg-card p-5 shadow-2xl", size === "sm" ? "max-w-lg" : "max-w-3xl")}>
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
