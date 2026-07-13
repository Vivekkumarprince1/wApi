"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";
import type { ApplicationStatus, AuthUser, Job, QuestionAnswer } from "@/types/career";
import { applicationFormSchema } from "@/lib/validators";
import { cn, formatDate } from "@/lib/utils";
import { Badge, Button, Field, Input, StatusBadge, Surface, Textarea } from "@/components/ui";

type AnswerValue = string | string[] | number | boolean;

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  resumeFileName: string;
  experience: string;
  education: string;
  skills: string;
  coverLetter: string;
  privacyAccepted: boolean;
  captchaConfirmed: boolean;
  isReferred: boolean;
  referrerEmployeeId: string;
  referrerName: string;
  referrerEmail: string;
  referralMessage: string;
  answers: Record<string, AnswerValue>;
  answerFiles: Record<string, { fileName: string; fileUrl: string }>;
};

type ExistingApplication = {
  applied: boolean;
  applicationId?: string;
  reference?: string;
  status?: ApplicationStatus | "Not Applied";
  updatedAt?: string;
};

const steps = ["Overview", "Identity", "Profile", "Review"];
const phonePattern = /^[6-9]\d{9}$/;

const initialDraft: Draft = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  resumeFileName: "",
  experience: "",
  education: "",
  skills: "",
  coverLetter: "",
  privacyAccepted: false,
  captchaConfirmed: false,
  isReferred: false,
  referrerEmployeeId: "",
  referrerName: "",
  referrerEmail: "",
  referralMessage: "",
  answers: {},
  answerFiles: {},
};

function normalizePhone(value?: string) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10);
}

function isEmptyAnswer(value: AnswerValue | undefined, questionType?: string, fileUrl?: string) {
  if (questionType === "file") return !fileUrl;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return value <= 0;
  if (typeof value === "boolean") return !value;
  return !String(value || "").trim();
}

function answerSummary(value: AnswerValue | undefined, fileName?: string) {
  if (fileName) return fileName;
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not answered";
  if (typeof value === "number") return value ? String(value) : "Not answered";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value || "Not answered");
}

export function ApplicationForm({ job, currentUser }: { job: Job; currentUser?: AuthUser }) {
  const [draft, setDraft] = useState<Draft>({
    ...initialDraft,
    fullName: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: normalizePhone(currentUser?.phone),
    location: currentUser?.department === "Candidate" ? "" : currentUser?.department || "",
    answers: Object.fromEntries(job.questions.map((question) => [question.id, question.questionType === "checkbox" ? [] : ""])),
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ reference: string; id: string } | null>(null);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState("");
  const [resumeProgress, setResumeProgress] = useState(0);
  const [questionUploading, setQuestionUploading] = useState("");

  const requiredQuestions = useMemo(() => job.questions.filter((question) => question.required), [job.questions]);

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      if (!currentUser) {
        setCheckingStatus(false);
        return;
      }

      try {
        const response = await fetch(`/api/v1/applications/check-status/${job.id}`);
        const payload = await response.json().catch(() => null);
        if (!mounted) return;
        if (response.ok && payload?.data?.applied) setExistingApplication(payload.data);
      } finally {
        if (mounted) setCheckingStatus(false);
      }
    };

    checkStatus();
    return () => {
      mounted = false;
    };
  }, [currentUser, job.id]);

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  };

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    setDraft((current) => ({ ...current, answers: { ...current.answers, [questionId]: value } }));
    if (errors[`question.${questionId}`]) setErrors((current) => ({ ...current, [`question.${questionId}`]: "" }));
  };

  const toggleCheckboxAnswer = (questionId: string, option: string, checked: boolean) => {
    const current = Array.isArray(draft.answers[questionId]) ? (draft.answers[questionId] as string[]) : [];
    const next = checked ? [...new Set([...current, option])] : current.filter((item) => item !== option);
    updateAnswer(questionId, next);
  };

  const handleResumeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateDraft("resumeFileName", file.name);
    setParseNotice("");
    setParsing(true);
    setResumeProgress(35);

    try {
      const response = await fetch("/api/v1/applications/parse-resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Resume could not be parsed.");

      setResumeProgress(100);
      setDraft((current) => {
        const data = payload.data || {};
        const extracted: string[] = [];
        const next = { ...current, resumeFileName: file.name };

        if (data.candidateName && !current.fullName.trim() && !currentUser?.name) {
          next.fullName = data.candidateName;
          extracted.push("name");
        }
        if (Array.isArray(data.skills) && data.skills.length && !current.skills.trim()) {
          next.skills = data.skills.join(", ");
          extracted.push("skills");
        }
        if (data.education && !current.education.trim()) {
          next.education = data.education;
          extracted.push("education");
        }
        if (data.experience && !current.experience.trim()) {
          next.experience = data.experience;
          extracted.push("experience");
        }

        setParseNotice(extracted.length ? `Resume parsed: ${extracted.join(", ")} filled.` : "Resume uploaded. Fill the remaining fields manually.");
        return next;
      });
    } catch (error) {
      setParseNotice(error instanceof Error ? error.message : "Resume uploaded, but parsing failed.");
    } finally {
      window.setTimeout(() => {
        setParsing(false);
        setResumeProgress(0);
      }, 600);
    }
  };

  const handleQuestionFile = async (questionId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setQuestionUploading(questionId);
    setErrors((current) => ({ ...current, [`question.${questionId}`]: "" }));

    try {
      const response = await fetch("/api/v1/applications/upload-question-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "File could not be uploaded.");

      setDraft((current) => ({
        ...current,
        answers: { ...current.answers, [questionId]: file.name },
        answerFiles: {
          ...current.answerFiles,
          [questionId]: {
            fileName: file.name,
            fileUrl: payload.data?.url || payload.data?.fileUrl || "",
          },
        },
      }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [`question.${questionId}`]: error instanceof Error ? error.message : "File could not be uploaded.",
      }));
    } finally {
      setQuestionUploading("");
    }
  };

  const buildPayload = () => {
    const questionAnswers: QuestionAnswer[] = job.questions.map((question) => {
      const answer = draft.answers[question.id];
      const file = draft.answerFiles[question.id];

      return {
        questionId: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        answer:
          question.questionType === "rating"
            ? Number(answer || 0)
            : question.questionType === "checkbox"
              ? Array.isArray(answer)
                ? answer
                : []
              : question.questionType === "file"
                ? file?.fileName || String(answer || "")
                : String(answer || ""),
        fileUrl: question.questionType === "file" ? file?.fileUrl : undefined,
      };
    });

    return {
      jobId: job.id,
      jobSlug: job.slug,
      fullName: draft.fullName,
      email: draft.email,
      phone: draft.phone,
      location: draft.location,
      resumeFileName: draft.resumeFileName,
      experience: draft.experience,
      education: draft.education,
      skills: draft.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      coverLetter: draft.coverLetter,
      questionAnswers,
      privacyAccepted: draft.privacyAccepted,
      captchaToken: draft.captchaConfirmed ? "demo-captcha-token" : "",
      isReferred: draft.isReferred,
      referrerEmployeeId: draft.referrerEmployeeId,
      referrerName: draft.referrerName,
      referrerEmail: draft.referrerEmail,
      referralMessage: draft.referralMessage,
    };
  };

  const validateStep = (targetStep = step) => {
    const nextErrors: Record<string, string> = {};

    if (targetStep === 1) {
      if (!draft.resumeFileName) nextErrors.resumeFileName = "Resume is required";
      if (!draft.fullName.trim()) nextErrors.fullName = "Full name is required";
      if (!draft.email.trim()) nextErrors.email = "Email is required";
      if (!phonePattern.test(draft.phone)) nextErrors.phone = "Phone number must be exactly 10 digits";
      if (!draft.location.trim()) nextErrors.location = "Current location is required";
    }

    if (targetStep === 2) {
      if (!draft.skills.split(",").some((skill) => skill.trim())) nextErrors.skills = "Add at least one skill";
      if (draft.experience.trim().length < 10) nextErrors.experience = "Summarise your experience";
      if (draft.education.trim().length < 3) nextErrors.education = "Add your education";
      if (draft.isReferred) {
        if (!draft.referrerEmployeeId.trim()) nextErrors.referrerEmployeeId = "Enter the referrer's employee ID";
        if (!draft.referrerName.trim()) nextErrors.referrerName = "Enter the referrer's name";
        if (!draft.referrerEmail.trim()) nextErrors.referrerEmail = "Enter the referrer's email";
        if (!draft.referralMessage.trim()) nextErrors.referralMessage = "Add the referral message";
      }
    }

    if (targetStep === 3) {
      if (!draft.coverLetter.trim()) nextErrors.coverLetter = "Cover letter is required";
      if (!draft.privacyAccepted) nextErrors.privacyAccepted = "Accept the privacy notice";
      if (!draft.captchaConfirmed) nextErrors.captchaToken = "Please complete the CAPTCHA";

      for (const question of requiredQuestions) {
        const file = draft.answerFiles[question.id];
        if (isEmptyAnswer(draft.answers[question.id], question.questionType, file?.fileUrl)) {
          nextErrors[`question.${question.id}`] = "This field is required";
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== steps.length - 1) {
      goNext();
      return;
    }

    if (existingApplication?.applied) {
      setErrors({ form: "You already have an application for this role." });
      return;
    }

    if (!validateStep(3)) return;

    const payload = buildPayload();
    const result = applicationFormSchema.safeParse(payload);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message])));
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/v1/applications", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(result.data),
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responsePayload?.error?.message || "Application could not be submitted.");
      }
      setReceipt({ reference: responsePayload.data.reference, id: responsePayload.data.id });
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Application could not be submitted." });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (question: Job["questions"][number]) => {
    const value = draft.answers[question.id];
    const file = draft.answerFiles[question.id];
    const error = errors[`question.${question.id}`];

    if (question.questionType === "multipleChoice") {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options?.map((option) => {
            const selected = value === option;
            return (
              <label
                key={option}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border bg-background p-3 text-sm transition-colors hover:bg-muted/70",
                  selected ? "border-primary bg-emerald-50 text-primary" : "border-border",
                )}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`question-${question.id}`}
                  value={option}
                  checked={selected}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                />
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
                </span>
                <span className="min-w-0 break-words">{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (question.questionType === "checkbox") {
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options?.map((option) => {
            const selected = selectedValues.includes(option);
            return (
              <label
                key={option}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border bg-background p-3 text-sm transition-colors hover:bg-muted/70",
                  selected ? "border-primary bg-emerald-50 text-primary" : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  value={option}
                  checked={selected}
                  onChange={(event) => toggleCheckboxAnswer(question.id, option, event.target.checked)}
                />
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                  )}
                >
                  {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 break-words">{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (question.questionType === "rating") {
      const maxRating = question.maxRating || 5;
      const rating = Number(value || 0);
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxRating }).map((_, index) => {
            const ratingValue = index + 1;
            const active = rating >= ratingValue;
            return (
              <button
                key={ratingValue}
                type="button"
                onClick={() => updateAnswer(question.id, ratingValue)}
                className={cn(
                  "flex size-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
                  active ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                aria-label={`Choose ${ratingValue} out of ${maxRating}`}
              >
                {ratingValue}
              </button>
            );
          })}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 text-amber-500" aria-hidden="true" />
            {rating ? `${rating}/${maxRating}` : `Choose 1-${maxRating}`}
          </span>
        </div>
      );
    }

    if (question.questionType === "file") {
      return (
        <label
          className={cn(
            "relative flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center transition-colors hover:bg-muted",
            file?.fileUrl ? "border-primary bg-emerald-50" : error ? "border-destructive bg-rose-50" : "border-border",
          )}
        >
          {questionUploading === question.id ? (
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="mt-2 text-sm font-medium">{file?.fileName || "Upload supporting document"}</span>
          <span className="mt-1 text-xs text-muted-foreground">PDF, DOC, image, or supporting file up to 10 MB.</span>
          <input type="file" className="sr-only" onChange={(event) => handleQuestionFile(question.id, event)} />
        </label>
      );
    }

    return (
      <Textarea
        id={question.id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => updateAnswer(question.id, event.target.value)}
        rows={4}
        placeholder="Describe your answer"
      />
    );
  };

  if (receipt) {
    return (
      <Surface className="p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold">Application received</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your reference is <span className="font-medium text-foreground">{receipt.reference}</span>. The candidate dashboard now shows the pending review state.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/jobs">Browse more roles</Link>
              </Button>
            </div>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Surface className="p-4 sm:p-5">
        <Button asChild variant="ghost" className="mb-4 w-fit px-0">
          <Link href="/jobs">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to jobs
          </Link>
        </Button>

        <div className="mb-5 grid grid-cols-4 gap-2" aria-label="Application steps">
          {steps.map((label, index) => {
            const isActive = step === index;
            const isDone = step > index;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors sm:min-h-14 sm:flex-row sm:text-sm",
                  isActive
                    ? "border-primary bg-emerald-50 text-primary"
                    : isDone
                      ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs">
                  {isDone ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {existingApplication?.applied ? (
          <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">You already applied for this role.</p>
                <p className="mt-1">
                  Reference {existingApplication.reference || existingApplication.applicationId}
                  {existingApplication.status && existingApplication.status !== "Not Applied" ? (
                    <>
                      {" "}
                      is currently <StatusBadge status={existingApplication.status} />.
                    </>
                  ) : null}
                </p>
                {existingApplication.updatedAt ? (
                  <p className="mt-1 text-xs text-amber-800">Last updated {formatDate(existingApplication.updatedAt)}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {errors.form ? (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errors.form}
          </div>
        ) : null}

        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{job.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge className="gap-1 bg-muted">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {job.location}
                </Badge>
                <Badge className="gap-1 bg-muted">
                  <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
                  {job.type} · {job.workMode}
                </Badge>
                <Badge className="gap-1 bg-muted">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {job.salary}
                </Badge>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-md border bg-muted/20 p-4">
                <h3 className="font-semibold">Description</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{job.description}</p>
              </section>
              <section className="rounded-md border bg-muted/20 p-4">
                <h3 className="font-semibold">Requirements</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {job.requirements.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <section className="rounded-md border bg-muted/20 p-4">
              <h3 className="font-semibold">Responsibilities</h3>
              <ul className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                {job.responsibilities.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <Field id="resume" label="Resume upload" error={errors.resumeFileName}>
              <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center hover:bg-muted">
                {parsing ? <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" /> : <Upload className="size-7 text-muted-foreground" aria-hidden="true" />}
                <span className="mt-2 text-sm font-medium">{draft.resumeFileName || "Choose or drop a resume"}</span>
                <span className="text-xs text-muted-foreground">PDF, DOC, or DOCX up to 10 MB.</span>
                <input id="resume" type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={handleResumeFile} />
                {resumeProgress > 0 ? (
                  <span className="absolute inset-x-4 bottom-4 h-1 overflow-hidden rounded bg-border">
                    <span className="block h-full rounded bg-primary transition-all" style={{ width: `${resumeProgress}%` }} />
                  </span>
                ) : null}
              </label>
              {parseNotice ? <p className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{parseNotice}</p> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="fullName" label="Full name" error={errors.fullName}>
                <Input id="fullName" value={draft.fullName} onChange={(event) => updateDraft("fullName", event.target.value)} autoComplete="name" />
              </Field>
              <Field id="email" label="Email address" error={errors.email} hint="Must match your verified candidate account.">
                <Input
                  id="email"
                  value={draft.email}
                  onChange={(event) => updateDraft("email", event.target.value)}
                  autoComplete="email"
                  readOnly={Boolean(currentUser)}
                  aria-readonly={Boolean(currentUser)}
                />
              </Field>
              <Field id="phone" label="Phone number" error={errors.phone}>
                <Input
                  id="phone"
                  value={draft.phone}
                  onChange={(event) => updateDraft("phone", normalizePhone(event.target.value))}
                  placeholder="9876543210"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </Field>
              <Field id="location" label="Current location" error={errors.location}>
                <Input id="location" value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} placeholder="City, state" />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <Field id="skills" label="Skills" error={errors.skills} hint="Comma-separated, for example: Next.js, TypeScript, Customer success">
              <Textarea id="skills" value={draft.skills} onChange={(event) => updateDraft("skills", event.target.value)} rows={3} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="experience" label="Total experience" error={errors.experience}>
                <Textarea id="experience" value={draft.experience} onChange={(event) => updateDraft("experience", event.target.value)} rows={5} />
              </Field>
              <Field id="education" label="Education" error={errors.education}>
                <Textarea id="education" value={draft.education} onChange={(event) => updateDraft("education", event.target.value)} rows={5} />
              </Field>
            </div>

            <section className="rounded-lg border bg-muted/20 p-4">
              <label className="flex items-start gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={draft.isReferred}
                  onChange={(event) => updateDraft("isReferred", event.target.checked)}
                  className="mt-1 size-4"
                />
                <span>
                  I was referred by a ConnectSphere employee
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Add referrer details so HR can attach the referral to this application.
                  </span>
                </span>
              </label>

              {draft.isReferred ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id="referrerEmployeeId" label="Referrer employee ID" error={errors.referrerEmployeeId}>
                    <Input id="referrerEmployeeId" value={draft.referrerEmployeeId} onChange={(event) => updateDraft("referrerEmployeeId", event.target.value)} />
                  </Field>
                  <Field id="referrerName" label="Referrer name" error={errors.referrerName}>
                    <Input id="referrerName" value={draft.referrerName} onChange={(event) => updateDraft("referrerName", event.target.value)} />
                  </Field>
                  <Field id="referrerEmail" label="Referrer email" error={errors.referrerEmail}>
                    <Input id="referrerEmail" value={draft.referrerEmail} onChange={(event) => updateDraft("referrerEmail", event.target.value)} />
                  </Field>
                  <Field id="referralMessage" label="Referral message" error={errors.referralMessage}>
                    <Textarea id="referralMessage" value={draft.referralMessage} onChange={(event) => updateDraft("referralMessage", event.target.value)} rows={3} />
                  </Field>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <Field id="coverLetter" label="Cover letter" error={errors.coverLetter}>
              <Textarea
                id="coverLetter"
                value={draft.coverLetter}
                onChange={(event) => updateDraft("coverLetter", event.target.value)}
                rows={6}
                placeholder="Tell us why you are the best fit for this role"
              />
            </Field>

            {job.questions.length > 0 ? (
              <section className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">Additional questions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Answer role-specific questions before submission.</p>
                </div>
                {job.questions.map((question) => (
                  <div key={question.id} className="rounded-lg border bg-muted/20 p-4">
                    <Field
                      id={question.id}
                      label={`${question.questionText}${question.required ? " *" : ""}`}
                      error={errors[`question.${question.id}`]}
                    >
                      {renderQuestionInput(question)}
                    </Field>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="rounded-lg border bg-muted/20 p-4">
              <h3 className="text-base font-semibold">Review summary</h3>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Candidate</dt>
                  <dd className="font-medium">{draft.fullName || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Resume</dt>
                  <dd className="font-medium">{draft.resumeFileName || "Not uploaded"}</dd>
                </div>
                {requiredQuestions.map((question) => (
                  <div key={question.id} className="md:col-span-2">
                    <dt className="text-xs text-muted-foreground">{question.questionText}</dt>
                    <dd className="break-words font-medium">
                      {answerSummary(draft.answers[question.id], draft.answerFiles[question.id]?.fileName)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={draft.privacyAccepted}
                onChange={(event) => updateDraft("privacyAccepted", event.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                I agree that ConnectSphere may process my application data for recruitment, verification, communication, and audit purposes.
                {errors.privacyAccepted ? <span className="mt-1 block text-xs font-medium text-destructive">{errors.privacyAccepted}</span> : null}
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={draft.captchaConfirmed}
                onChange={(event) => updateDraft("captchaConfirmed", event.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                <LockKeyhole className="mr-1 inline size-4 text-primary" aria-hidden="true" />
                I confirm this is a genuine application submission.
                {errors.captchaToken ? <span className="mt-1 block text-xs font-medium text-destructive">{errors.captchaToken}</span> : null}
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((current) => Math.max(0, current - 1))}>
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={checkingStatus}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={submitting || Boolean(existingApplication?.applied)}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
              Submit application
            </Button>
          )}
        </div>
      </Surface>

      <aside className="h-fit rounded-lg border bg-card p-4 lg:sticky lg:top-20">
        <p className="text-sm font-semibold">{job.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{job.department} · {job.location}</p>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Step</dt>
            <dd className="font-medium">{step + 1} of {steps.length}: {steps[step]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Screening questions</dt>
            <dd className="font-medium">{job.questions.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Required answers</dt>
            <dd className="font-medium">{requiredQuestions.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reporting manager</dt>
            <dd className="font-medium">{job.reportingManager}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">HR contact</dt>
            <dd className="font-medium">{job.hrContact.name}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline size-4 text-primary" aria-hidden="true" />
          Your application stays tied to your verified account and candidate timeline.
        </div>
      </aside>
    </form>
  );
}
