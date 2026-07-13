"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  Star,
  UserRound,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Badge, Button, Field, Input, Select, Surface, Textarea } from "@/components/ui";
import { reviewSchema } from "@/lib/validators";
import { cn, formatDate } from "@/lib/utils";
import type { Review, WorkMode } from "@/types/career";

type ReviewValues = {
  rating: number;
  title: string;
  content: string;
  department: string;
  position: string;
  workType: WorkMode | "";
  employmentDuration: string;
  pros: string;
  cons: string;
  advice: string;
  isAnonymous: boolean;
};

type EligibilityResponse = {
  eligible: boolean;
  reason: string | null;
  existingReview?: Review | null;
};

const initialValues: ReviewValues = {
  rating: 0,
  title: "",
  content: "",
  department: "",
  position: "",
  workType: "",
  employmentDuration: "",
  pros: "",
  cons: "",
  advice: "",
  isAnonymous: false,
};

const statusConfig: Record<
  Review["status"],
  { label: string; className: string; icon: typeof AlertCircle }
> = {
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertCircle,
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
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1.5", config.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

function Stars({
  rating,
  interactive = false,
  hoverRating = 0,
  onHover,
  onSelect,
}: {
  rating: number;
  interactive?: boolean;
  hoverRating?: number;
  onHover?: (rating: number) => void;
  onSelect?: (rating: number) => void;
}) {
  const activeRating = interactive ? hoverRating || rating : rating;
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        const active = activeRating >= value;
        const star = (
          <Star
            className={cn(
              "size-7 transition-colors sm:size-8",
              active ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
              interactive ? "group-hover:text-amber-300" : "",
            )}
            aria-hidden="true"
          />
        );

        if (!interactive) return <span key={value}>{star}</span>;

        return (
          <button
            key={value}
            type="button"
            className="group rounded-md p-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => onSelect?.(value)}
            onMouseEnter={() => onHover?.(value)}
            onMouseLeave={() => onHover?.(0)}
            aria-label={`Choose ${value} star${value === 1 ? "" : "s"}`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

export function ReviewForm() {
  const [values, setValues] = useState<ReviewValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadEligibility = async () => {
      try {
        const response = await fetch("/api/v1/reviews/eligibility");
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error?.message || "Failed to check eligibility.");
        if (!mounted) return;
        setEligibility(payload.data);
        setExistingReview(payload.data?.existingReview || null);
      } catch (error) {
        if (!mounted) return;
        setErrors({ form: error instanceof Error ? error.message : "Failed to check eligibility." });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadEligibility();
    return () => {
      mounted = false;
    };
  }, []);

  const reviewerType = useMemo(() => {
    if (existingReview?.reviewerType === "offer-recipient") return "Offer Recipient";
    return "Employee";
  }, [existingReview?.reviewerType]);

  const update = <K extends keyof ReviewValues>(key: K, value: ReviewValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = reviewSchema.safeParse(values);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message])));
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch("/api/v1/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Review could not be submitted.");
      setExistingReview(payload.data);
      setEligibility({ eligible: false, reason: "A review has already been submitted.", existingReview: payload.data });
      setValues(initialValues);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Review could not be submitted." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Surface className="p-5">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Checking eligibility...
        </div>
      </Surface>
    );
  }

  if (!eligibility?.eligible && !existingReview) {
    return (
      <Surface className="mx-auto max-w-4xl p-6 text-center sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-50 text-rose-700">
          <XCircle className="size-9" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Not Eligible</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {eligibility?.reason || "Only employees or offer letter recipients can submit reviews."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          If you believe this is an error, please contact your administrator.
        </p>
        {errors.form ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errors.form}</p> : null}
      </Surface>
    );
  }

  if (existingReview) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-9" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold sm:text-3xl">Your Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">You have already submitted a review</p>
        </div>

        <Surface className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ReviewStatusBadge status={existingReview.status} />
              <Badge className="bg-muted">{reviewerType}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Stars rating={existingReview.rating} />
              <span className="text-sm text-muted-foreground">({existingReview.rating}/5)</span>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">{existingReview.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{existingReview.body}</p>
            </div>

            {(existingReview.department || existingReview.position || existingReview.workType || existingReview.employmentDuration) ? (
              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="font-semibold">Job Information</h3>
                <dl className="mt-3 grid gap-4 text-sm md:grid-cols-2">
                  {existingReview.position ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Position</dt>
                      <dd className="font-medium">{existingReview.position}</dd>
                    </div>
                  ) : null}
                  {existingReview.department ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Department</dt>
                      <dd className="font-medium">{existingReview.department}</dd>
                    </div>
                  ) : null}
                  {existingReview.workType ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Work Type</dt>
                      <dd className="font-medium">{existingReview.workType}</dd>
                    </div>
                  ) : null}
                  {existingReview.employmentDuration ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Employment Duration</dt>
                      <dd className="font-medium">{existingReview.employmentDuration}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {(existingReview.pros || existingReview.cons) ? (
              <div className="grid gap-4 md:grid-cols-2">
                {existingReview.pros ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                    <h3 className="font-semibold text-emerald-800">Pros</h3>
                    <p className="mt-2 text-sm leading-relaxed text-emerald-900">{existingReview.pros}</p>
                  </div>
                ) : null}
                {existingReview.cons ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
                    <h3 className="font-semibold text-rose-800">Cons</h3>
                    <p className="mt-2 text-sm leading-relaxed text-rose-900">{existingReview.cons}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {existingReview.advice ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
                <h3 className="font-semibold text-sky-800">Advice to Management</h3>
                <p className="mt-2 text-sm leading-relaxed text-sky-900">{existingReview.advice}</p>
              </div>
            ) : null}

            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              <strong>Submitted on:</strong> {existingReview.createdAt ? formatDate(existingReview.createdAt) : "Pending moderation"}
              {existingReview.status === "rejected" && existingReview.rejectionReason ? (
                <p className="mt-2 text-rose-700">Rejection reason: {existingReview.rejectionReason}</p>
              ) : null}
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardList className="size-9" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold sm:text-3xl">Submit Your Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">Share your experience working at ConnectSphere</p>
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-primary">
          <UserRoundCheck className="size-4" aria-hidden="true" />
          <strong>Status:</strong> Employee
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {errors.form ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errors.form}</p> : null}

        <Surface className="p-4 sm:p-5">
          <Field id="rating" label="Overall Rating *" error={errors.rating}>
            <div className="flex flex-wrap items-center gap-3">
              <Stars
                rating={values.rating}
                interactive
                hoverRating={hoverRating}
                onHover={setHoverRating}
                onSelect={(rating) => update("rating", rating)}
              />
              <span className="text-sm text-muted-foreground">
                {values.rating > 0 ? `${values.rating} star${values.rating === 1 ? "" : "s"}` : "Choose a rating"}
              </span>
            </div>
          </Field>
        </Surface>

        <Surface className="space-y-5 p-4 sm:p-5">
          <Field id="title" label="Review Title *" error={errors.title}>
            <Input
              id="title"
              name="title"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Summarize your experience in a few words"
              maxLength={100}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{values.title.length}/100 characters</p>
          </Field>

          <Field id="content" label="Review Content *" error={errors.body || errors.content}>
            <Textarea
              id="content"
              name="content"
              value={values.content}
              onChange={(event) => update("content", event.target.value)}
              placeholder="Share your detailed experience working at ConnectSphere..."
              rows={6}
              maxLength={1000}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{values.content.length}/1000 characters</p>
          </Field>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <BriefcaseBusiness className="size-4 text-primary" aria-hidden="true" />
            Job Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="position" label="Position">
              <Input
                id="position"
                name="position"
                value={values.position}
                onChange={(event) => update("position", event.target.value)}
                placeholder="Your job title"
              />
            </Field>
            <Field id="department" label="Department">
              <Input
                id="department"
                name="department"
                value={values.department}
                onChange={(event) => update("department", event.target.value)}
                placeholder="Your department"
              />
            </Field>
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <h2 className="mb-4 text-base font-semibold">Work Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="workType" label="Work Type">
              <Select
                id="workType"
                name="workType"
                value={values.workType}
                onChange={(event) => update("workType", event.target.value as ReviewValues["workType"])}
              >
                <option value="">Select work type</option>
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
              </Select>
            </Field>
            <Field id="employmentDuration" label="Employment Duration">
              <Input
                id="employmentDuration"
                name="employmentDuration"
                value={values.employmentDuration}
                onChange={(event) => update("employmentDuration", event.target.value)}
                placeholder="e.g., 6 months, 2 years"
              />
            </Field>
          </div>
        </Surface>

        <Surface className="space-y-5 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Detailed Review</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="pros" label="Pros" error={errors.pros}>
              <Textarea
                id="pros"
                name="pros"
                value={values.pros}
                onChange={(event) => update("pros", event.target.value)}
                placeholder="What did you like about working here?"
                rows={4}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-muted-foreground">{values.pros.length}/500 characters</p>
            </Field>
            <Field id="cons" label="Cons" error={errors.cons}>
              <Textarea
                id="cons"
                name="cons"
                value={values.cons}
                onChange={(event) => update("cons", event.target.value)}
                placeholder="What could be improved?"
                rows={4}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-muted-foreground">{values.cons.length}/500 characters</p>
            </Field>
          </div>
          <Field id="advice" label="Advice to Management" error={errors.advice}>
            <Textarea
              id="advice"
              name="advice"
              value={values.advice}
              onChange={(event) => update("advice", event.target.value)}
              placeholder="Any suggestions for management?"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-muted-foreground">{values.advice.length}/500 characters</p>
          </Field>
        </Surface>

        <Surface className="space-y-5 p-4 sm:p-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="isAnonymous"
              checked={values.isAnonymous}
              onChange={(event) => update("isAnonymous", event.target.checked)}
              className="mt-1 size-4 rounded border-input"
            />
            <span className="font-medium">
              <UserRound className="mr-2 inline size-4 text-muted-foreground" aria-hidden="true" />
              Post this review anonymously
            </span>
          </label>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {submitting ? "Submitting Review..." : "Submit Review"}
            </Button>
          </div>
        </Surface>
      </form>

      <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-sky-700" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-sky-950">Important Notice</h2>
            <p className="mt-1 leading-relaxed">
              Your review will be pending approval and will be visible on the public page only after admin approval.
              Please ensure your review is professional, constructive, and follows our community guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
