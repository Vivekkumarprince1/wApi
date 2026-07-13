"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  Plus,
  Send,
  Star,
  Trash2,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import type { Application, AuthUser, Employee, Job, Recommendation, Review } from "@/types/career";
import { Badge, Button, Field, Input, Surface, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

const recommendationStatusConfig: Record<
  Recommendation["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock,
  },
  reviewed: {
    label: "Reviewed",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Eye,
  },
  selected: {
    label: "Selected",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
};

function RecommendationStatusBadge({ status }: { status: Recommendation["status"] }) {
  const config = recommendationStatusConfig[status] || recommendationStatusConfig.pending;
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1.5", config.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

const reviewStatusConfig: Record<Review["status"], { label: string; className: string; icon: typeof Clock }> = {
  pending: {
    label: "Pending approval",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
};

function ReviewStatusBadge({ status }: { status: Review["status"] }) {
  const config = reviewStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1.5", config.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

function findApplication(applications: Application[], value: string) {
  const lookup = value.trim().toLowerCase();
  if (!lookup) return undefined;
  return applications.find(
    (application) => application.id.toLowerCase() === lookup || application.reference.toLowerCase() === lookup,
  );
}

export function EmployeeProfilePanel({
  user,
  employee,
  initialRecommendations,
  applications,
  jobs,
  reviewEligibility,
}: {
  user: AuthUser;
  employee?: Employee;
  initialRecommendations: Recommendation[];
  applications: Application[];
  jobs: Job[];
  reviewEligibility: {
    eligible: boolean;
    reason: string | null;
    existingReview?: Review | null;
  };
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [showAvailableIds, setShowAvailableIds] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lookupTouched, setLookupTouched] = useState(false);

  const pendingCount = useMemo(() => recommendations.filter((item) => item.status === "pending").length, [recommendations]);
  const selectedCount = useMemo(() => recommendations.filter((item) => item.status === "selected").length, [recommendations]);
  const sortedRecommendations = useMemo(
    () => [...recommendations].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [recommendations],
  );

  const selectedApplication = useMemo(() => findApplication(applications, applicationId), [applications, applicationId]);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedApplication?.jobId),
    [jobs, selectedApplication?.jobId],
  );
  const canRecommend = user.status === "active";
  const canMakeRecommendation = canRecommend && pendingCount < 5;

  const resetForm = () => {
    setApplicationId("");
    setRecommendationMessage("");
    setShowAvailableIds(false);
    setLookupTouched(false);
    setError("");
  };

  const submitRecommendation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setError("");
    setLookupTouched(true);

    if (!applicationId.trim() || !recommendationMessage.trim()) {
      setError("Please provide application ID and recommendation message.");
      return;
    }
    if (!canRecommend) {
      setError("Only active employees can make job recommendations.");
      return;
    }
    if (!selectedApplication) {
      setError(`Application ID "${applicationId}" was not found or is not available for recommendation.`);
      return;
    }
    if (pendingCount >= 5) {
      setError("Maximum pending recommendations reached (5/5).");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationId: applicationId.trim(),
          recommendationMessage,
          rationale: recommendationMessage,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Could not submit recommendation.");

      setRecommendations((current) => [payload.data, ...current]);
      setNotice("Recommendation submitted for HR review.");
      setShowRecommendationForm(false);
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit recommendation.");
    } finally {
      setSaving(false);
    }
  };

  const removeRecommendation = async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this recommendation?");
    if (!confirmed) return;

    setNotice("");
    setError("");
    const response = await fetch(`/api/v1/recommendations/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message || "Could not delete recommendation.");
      return;
    }
    setRecommendations((current) => current.filter((item) => item.id !== id));
    setNotice("Recommendation deleted successfully.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Employee Profile</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm md:text-base">
            Welcome, {user.name} ({user.id})
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {user.position || employee?.position || "Employee"} · {user.department || employee?.department || "Not assigned"}
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={!canMakeRecommendation}
          onClick={() => {
            setNotice("");
            setError("");
            setShowRecommendationForm(true);
          }}
          className="shrink-0 whitespace-nowrap"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">
            {!canRecommend
              ? "Only Active Employees Can Recommend"
              : canMakeRecommendation
                ? "Make New Recommendation"
                : "Maximum Recommendations Reached (5/5)"}
          </span>
          <span className="hidden sm:inline md:hidden">
            {!canRecommend ? "Not Active" : canMakeRecommendation ? "New Rec" : "Max Reached"}
          </span>
          <span className="sm:hidden">{!canRecommend ? "No" : canMakeRecommendation ? "Add" : "Max"}</span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Clock className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Pending Recommendations</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">of 5 allowed</p>
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Total Recommendations</p>
              <p className="text-2xl font-semibold">{recommendations.length}</p>
              <p className="text-xs text-muted-foreground">all time</p>
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Selected Recommendations</p>
              <p className="text-2xl font-semibold">{selectedCount}</p>
              <p className="text-xs text-muted-foreground">success rate</p>
            </div>
          </div>
        </Surface>
      </div>

      <Surface className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
              <Star className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold sm:text-lg">Employment Review</h2>
                {reviewEligibility.existingReview ? (
                  <ReviewStatusBadge status={reviewEligibility.existingReview.status} />
                ) : reviewEligibility.eligible ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Eligible</Badge>
                ) : (
                  <Badge className="border-muted bg-muted text-muted-foreground">Not eligible</Badge>
                )}
              </div>
              {reviewEligibility.existingReview ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviewEligibility.existingReview.title} · {reviewEligibility.existingReview.rating}/5
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviewEligibility.reason || "Eligible employees can submit one review for approval."}
                </p>
              )}
            </div>
          </div>
          <Button asChild variant={reviewEligibility.eligible ? "default" : "outline"} className="w-full sm:w-fit">
            <Link href="/reviews/submit">
              <Star className="size-4" aria-hidden="true" />
              {reviewEligibility.existingReview ? "View Review" : "Write Review"}
            </Link>
          </Button>
        </div>
      </Surface>

      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {!showRecommendationForm && error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      {showRecommendationForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <Surface className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">Make a Job Recommendation</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter an eligible application ID, review candidate details, then send your recommendation.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close recommendation form"
                onClick={() => {
                  setShowRecommendationForm(false);
                  resetForm();
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={submitRecommendation} className="mt-5 space-y-5">
              <Field
                id="recommendation-application-id"
                label="Application ID"
                hint="Paste the application ID or reference to automatically load candidate details."
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="recommendation-application-id"
                    name="applicationId"
                    value={applicationId}
                    onBlur={() => setLookupTouched(true)}
                    onChange={(event) => {
                      setApplicationId(event.target.value);
                      setLookupTouched(Boolean(event.target.value.trim()));
                    }}
                    placeholder="Enter or paste the application ID"
                    required
                  />
                  <Button type="button" variant="outline" onClick={() => setShowAvailableIds((current) => !current)}>
                    <Eye className="size-4" aria-hidden="true" />
                    Show Available IDs
                  </Button>
                </div>
              </Field>

              {showAvailableIds ? (
                <div className="rounded-md border bg-muted/30 p-3">
                  {applications.length > 0 ? (
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      {applications.map((application) => (
                        <button
                          key={application.id}
                          type="button"
                          className="min-w-0 rounded-md border bg-background p-2 text-left transition-colors hover:bg-muted"
                          onClick={() => {
                            setApplicationId(application.id);
                            setLookupTouched(true);
                          }}
                        >
                          <span className="block truncate font-medium">{application.id}</span>
                          <span className="block truncate text-muted-foreground">{application.candidate.name} · {application.jobTitle}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No applications available for recommendation at the moment.</p>
                  )}
                </div>
              ) : null}

              {lookupTouched && applicationId.trim() && !selectedApplication ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Application ID "{applicationId}" was not found or is not available for recommendation.
                </p>
              ) : null}

              {selectedApplication ? (
                <div className="rounded-md border bg-muted/30 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                    <h3 className="font-semibold">Application Details</h3>
                  </div>
                  <dl className="grid gap-4 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Candidate Name</dt>
                      <dd className="font-medium">{selectedApplication.candidate.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="break-all font-medium">{selectedApplication.candidate.email}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Position</dt>
                      <dd className="font-medium">{selectedApplication.jobTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Department</dt>
                      <dd className="font-medium">{selectedJob?.department || "Not assigned"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Applied Date</dt>
                      <dd className="font-medium">{formatDate(selectedApplication.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Reference</dt>
                      <dd className="font-medium">{selectedApplication.reference}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              <Field
                id="recommendation-message"
                label="Your Recommendation"
                hint="Explain why you recommend this candidate for the position."
              >
                <Textarea
                  id="recommendation-message"
                  name="recommendationMessage"
                  value={recommendationMessage}
                  onChange={(event) => setRecommendationMessage(event.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={!selectedApplication}
                  placeholder={
                    selectedApplication
                      ? "Why do you recommend this candidate? What makes them a good fit for this position?"
                      : "Enter an application ID first to continue"
                  }
                  required
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{recommendationMessage.length}/500</p>
              </Field>

              {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="submit"
                  disabled={saving || !canRecommend || !selectedApplication || !recommendationMessage.trim() || pendingCount >= 5}
                >
                  <Send className="size-4" aria-hidden="true" />
                  {saving ? "Submitting..." : "Submit Recommendation"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRecommendationForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Surface>
        </div>
      ) : null}

      <Surface className="overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UsersRound className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold sm:text-lg">My Recommendations</h2>
          </div>
        </div>

        <div className="divide-y">
          {sortedRecommendations.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <UsersRound className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No recommendations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start by recommending qualified candidates for open positions.
              </p>
            </div>
          ) : (
            sortedRecommendations.map((recommendation) => (
              <article key={recommendation.id} className="px-4 py-5 transition-colors hover:bg-muted/20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <h3 className="truncate text-base font-semibold">{recommendation.candidateName}</h3>
                          <RecommendationStatusBadge status={recommendation.status} />
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                          {recommendation.candidateEmail ? (
                            <p className="flex min-w-0 items-center gap-2">
                              <Mail className="size-4 shrink-0" aria-hidden="true" />
                              <span className="truncate">{recommendation.candidateEmail}</span>
                            </p>
                          ) : null}
                          <p className="flex min-w-0 items-center gap-2">
                            <BriefcaseBusiness className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {recommendation.jobTitle}
                              {recommendation.jobDepartment ? ` - ${recommendation.jobDepartment}` : ""}
                            </span>
                          </p>
                        </div>
                        <blockquote className="mt-3 rounded-md border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
                          "{recommendation.rationale}"
                        </blockquote>
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                          <span>Created: {formatDate(recommendation.createdAt)}</span>
                          {recommendation.reviewedAt ? <span>Reviewed: {formatDate(recommendation.reviewedAt)}</span> : null}
                          {recommendation.applicationReference ? <span>Application: {recommendation.applicationReference}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {recommendation.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="self-start text-destructive hover:bg-rose-50"
                      onClick={() => removeRecommendation(recommendation.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
}
