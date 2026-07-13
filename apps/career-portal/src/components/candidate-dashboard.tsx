"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Search,
  X,
} from "lucide-react";
import type { Application, NotificationItem, OfferLetter, QuestionAnswer } from "@/types/career";
import { Badge, Button, EmptyState, Input, StatusBadge, Surface, WorkflowSteps } from "@/components/ui";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type ResumeAccess = {
  fileName: string;
  url: string;
  expiresAt: string;
};

function formatAnswer(answer: QuestionAnswer) {
  if (answer.questionType === "checkbox" && Array.isArray(answer.answer)) return answer.answer.join(", ");
  if (typeof answer.answer === "boolean") return answer.answer ? "Yes" : "No";
  return String(answer.answer || "No answer provided");
}

function offerStatusTone(status: OfferLetter["status"]) {
  const tones: Record<OfferLetter["status"], string> = {
    issued: "border-amber-200 bg-amber-50 text-amber-800",
    accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    expired: "border-muted bg-muted text-muted-foreground",
    cancelled: "border-muted bg-muted text-muted-foreground",
  };
  return tones[status];
}

function relatedJobNotifications(application: Application, notifications: NotificationItem[]) {
  const haystack = [application.jobTitle, application.reference, application.status].join(" ").toLowerCase();
  return notifications.filter((notification) => {
    if (notification.read || notification.type !== "job-update") return false;
    const notificationText = [notification.title, notification.message].join(" ").toLowerCase();
    return (
      notificationText.includes(application.jobTitle.toLowerCase()) ||
      notificationText.includes(application.reference.toLowerCase()) ||
      application.jobTitle
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 5)
        .some((word) => notificationText.includes(word)) ||
      haystack.includes(notificationText)
    );
  });
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

export function CandidateDashboard({
  applications,
  notifications,
  offers,
}: {
  applications: Application[];
  notifications: NotificationItem[];
  offers: OfferLetter[];
}) {
  const [query, setQuery] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState(applications[0]?.id || "");
  const [copiedId, setCopiedId] = useState("");
  const [dismissedUpdates, setDismissedUpdates] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(""), 2500);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  const filteredApplications = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((application) => {
      const haystack = [
        application.id,
        application.reference,
        application.jobTitle,
        application.status,
        application.resumeFileName,
        application.skills.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [applications, query]);

  const selectedApplication = filteredApplications.find((application) => application.id === selectedApplicationId) || filteredApplications[0];
  const unread = notifications.filter((notification) => !notification.read).length;

  const getOffer = (applicationId: string) => offers.find((offer) => offer.applicationId === applicationId);

  const copyApplicationId = async (applicationId: string) => {
    try {
      await navigator.clipboard?.writeText(applicationId);
      setCopiedId(applicationId);
      setNotice("Application ID copied.");
    } catch {
      setCopiedId(applicationId);
      setNotice("Application ID selected for copying.");
    }
  };

  const openResume = async (application: Application) => {
    setBusy(`resume:${application.id}`);
    setNotice("");
    try {
      const response = await fetch(`/api/v1/applications/${application.id}/resume-access`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Could not prepare resume access.");
      const access = payload.data as ResumeAccess;
      window.open(access.url, "_blank", "noopener,noreferrer");
      setNotice(`Secure resume access prepared for ${access.fileName}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not prepare resume access.");
    } finally {
      setBusy("");
    }
  };

  const downloadOffer = async (application: Application) => {
    setBusy(`offer:${application.id}`);
    setNotice("");
    try {
      const response = await fetch(`/api/v1/applications/${application.id}/offer-letter/download`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || "Could not download offer letter.");
      }
      downloadTextFile(await response.text(), `${application.reference}-offer-letter.txt`);
      setNotice("Offer letter downloaded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not download offer letter.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Surface className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">My Applications</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track submitted roles, offer actions, resume access, and HR updates.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
          </div>
          <label className="relative mt-4 block">
            <span className="sr-only">Search applications</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-9"
              placeholder="Search by application ID, reference, job, status, or skill"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </Surface>

        {notice ? (
          <div className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {filteredApplications.length === 0 ? (
          <EmptyState
            title="No applications found"
            description="Apply to an active role and your status tracker will appear here."
            actionHref="/jobs"
            actionLabel="Browse open roles"
          />
        ) : (
          <div className="space-y-3">
            {filteredApplications.map((application) => {
              const offer = getOffer(application.id);
              const isSelected = selectedApplication?.id === application.id;
              const updates = relatedJobNotifications(application, notifications).filter((notification) => !dismissedUpdates[`${application.id}:${notification.id}`]);

              return (
                <article
                  key={application.id}
                  className={cn(
                    "overflow-hidden rounded-lg border bg-card transition-colors",
                    isSelected ? "border-primary/50" : "hover:bg-muted/20",
                  )}
                >
                  {updates.length ? (
                    <div className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{updates.length > 1 ? `${updates.length} job updates available` : updates[0].title}</p>
                          <p className="mt-1 text-xs">{updates.length > 1 ? "Review notification details before the next hiring step." : updates[0].message}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href="/notifications">View details</Link>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDismissedUpdates((current) => ({
                                  ...current,
                                  ...Object.fromEntries(updates.map((notification) => [`${application.id}:${notification.id}`, true])),
                                }))
                              }
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-start sm:justify-between"
                    onClick={() => setSelectedApplicationId(isSelected ? "" : application.id)}
                    aria-expanded={isSelected}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={application.status} />
                        <span className="rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{application.reference}</span>
                        {offer ? <Badge className={offerStatusTone(offer.status)}>Offer {offer.status}</Badge> : null}
                      </div>
                      <h2 className="safe-text mt-2 text-lg font-semibold">{application.jobTitle}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>Applied {formatDate(application.createdAt)}</span>
                        <span>Updated {timeAgo(application.updatedAt)}</span>
                      </p>
                    </div>
                    <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground">
                      {isSelected ? (
                        <>
                          <ChevronUp className="size-4" aria-hidden="true" />
                          Hide details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-4" aria-hidden="true" />
                          View details
                        </>
                      )}
                    </span>
                  </button>

                  {isSelected ? (
                    <div className="border-t bg-muted/20 p-4">
                      <div className="rounded-md border bg-background p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Application ID</p>
                            <p className="break-all font-mono text-sm font-medium">{application.id}</p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => copyApplicationId(application.id)}>
                            {copiedId === application.id ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                            {copiedId === application.id ? "Copied" : "Copy ID"}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <section className="rounded-md border bg-background p-3">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <Mail className="size-4 text-primary" aria-hidden="true" />
                            Contact Information
                          </h3>
                          <dl className="mt-3 grid gap-2 text-sm">
                            <div>
                              <dt className="text-xs text-muted-foreground">Name</dt>
                              <dd className="font-medium">{application.candidate.name}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Email</dt>
                              <dd className="break-all font-medium">{application.candidate.email}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Phone</dt>
                              <dd className="font-medium">{application.candidate.phone || "Not provided"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Location</dt>
                              <dd className="font-medium">{application.candidate.location || "Not provided"}</dd>
                            </div>
                          </dl>
                        </section>

                        <section className="rounded-md border bg-background p-3">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <FileText className="size-4 text-primary" aria-hidden="true" />
                            Resume
                          </h3>
                          <p className="mt-3 break-words text-sm text-muted-foreground">
                            {application.resumeFileName || "No resume uploaded"}
                          </p>
                          <Button
                            type="button"
                            className="mt-3 w-full justify-start"
                            variant="outline"
                            size="sm"
                            disabled={!application.resumeFileName || busy === `resume:${application.id}`}
                            onClick={() => openResume(application)}
                          >
                            {busy === `resume:${application.id}` ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                            View Resume
                          </Button>
                        </section>
                      </div>

                      <div className="mt-4">
                        <WorkflowSteps current={application.status} />
                      </div>

                      <div className="mt-4 grid gap-3">
                        {application.skills.length ? (
                          <section className="rounded-md border bg-background p-3">
                            <h3 className="text-sm font-semibold">Skills</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {application.skills.map((skill) => (
                                <Badge key={skill} className="border-border bg-muted">{skill}</Badge>
                              ))}
                            </div>
                          </section>
                        ) : null}

                        {application.coverLetter ? (
                          <section className="rounded-md border bg-background p-3">
                            <h3 className="text-sm font-semibold">Cover Letter</h3>
                            <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-6 text-muted-foreground">{application.coverLetter}</p>
                          </section>
                        ) : null}

                        {application.questionAnswers.length ? (
                          <section className="rounded-md border bg-background p-3">
                            <h3 className="text-sm font-semibold">Question Responses</h3>
                            <div className="mt-3 grid gap-3">
                              {application.questionAnswers.map((answer, index) => (
                                <div key={`${answer.questionId}-${index}`} className="rounded-md border bg-muted/20 p-3">
                                  <p className="text-sm font-medium">{index + 1}. {answer.questionText}</p>
                                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{formatAnswer(answer)}</p>
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
                                </div>
                              ))}
                            </div>
                          </section>
                        ) : null}

                        {offer ? (
                          <section className="rounded-md border bg-background p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="text-sm font-semibold">Offer Letter</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Congratulations, an offer has been issued for this application.</p>
                              </div>
                              <Badge className={offerStatusTone(offer.status)}>{offer.status}</Badge>
                            </div>
                            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="text-xs text-muted-foreground">Position</dt>
                                <dd className="font-medium">{offer.position}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">Department</dt>
                                <dd className="font-medium">{offer.department}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">Salary</dt>
                                <dd className="font-medium">{offer.salary}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">Valid Until</dt>
                                <dd className="font-medium">{formatDate(offer.validUntil)}</dd>
                              </div>
                            </dl>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button asChild size="sm">
                                <Link href={`/offer/accept/${application.jobSlug}/${offer.publicId}`}>Review offer</Link>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy === `offer:${application.id}`}
                                onClick={() => downloadOffer(application)}
                              >
                                {busy === `offer:${application.id}` ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                                Download
                              </Button>
                            </div>
                          </section>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/applications/${application.id}`}>Open full details</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/jobs/${application.jobSlug}`}>
                              <BriefcaseBusiness className="size-4" aria-hidden="true" />
                              View job
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <Surface className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Notifications</h2>
              <p className="text-sm text-muted-foreground">{unread} unread item{unread === 1 ? "" : "s"}</p>
            </div>
            <Bell className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-4 space-y-3">
            {notifications.slice(0, 3).map((notification) => (
              <div key={notification.id} className="rounded-md border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{notification.title}</p>
                  {!notification.read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
              </div>
            ))}
          </div>
          <Button asChild className="mt-4 w-full" variant="outline">
            <Link href="/notifications">Open all notifications</Link>
          </Button>
        </Surface>

        {selectedApplication ? (
          <Surface className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">Selected Application</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedApplication.jobTitle}</p>
                <p className="mt-2 text-xs text-muted-foreground">Reference {selectedApplication.reference}</p>
              </div>
            </div>
          </Surface>
        ) : null}

        <Surface className="p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold">Document access</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Resume and offer documents open through permission-checked links tied to your signed-in account.
              </p>
            </div>
          </div>
        </Surface>
      </aside>
    </div>
  );
}
