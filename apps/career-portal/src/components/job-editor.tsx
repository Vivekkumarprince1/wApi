"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Eye,
  FileText,
  ImagePlus,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import type { Application, ApplicationStatus, EmploymentType, Job, QuestionType, ScreeningQuestion, WorkMode } from "@/types/career";
import { Badge, Button, Field, Input, Select, StatusBadge, Surface, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type EditableQuestion = ScreeningQuestion;
type TabKey = "details" | "questions" | "applications";

type NewQuestion = {
  questionText: string;
  required: boolean;
  questionType: QuestionType;
  options: string;
  allowFileUpload: boolean;
  maxRating: number;
};

const employmentTypes: EmploymentType[] = ["Full-time", "Part-time", "Contract", "Internship"];
const workModes: WorkMode[] = ["Remote", "On-site", "Hybrid"];
const statuses: (ApplicationStatus | "all")[] = ["all", "pending", "reviewing", "shortlisted", "offered", "hired", "rejected"];

const questionTypeOptions: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text (Short Answer)" },
  { value: "multipleChoice", label: "Multiple Choice" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File Upload" },
  { value: "rating", label: "Rating" },
];

const initialQuestion: NewQuestion = {
  questionText: "",
  required: false,
  questionType: "text",
  options: "",
  allowFileUpload: false,
  maxRating: 5,
};

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeQuestions(questions: EditableQuestion[]) {
  return questions.map((question, index) => ({
    ...question,
    order: index,
    options:
      question.questionType === "multipleChoice" || question.questionType === "checkbox"
        ? question.options?.map((option) => option.trim()).filter(Boolean)
        : undefined,
    allowFileUpload: question.allowFileUpload || question.questionType === "file" || undefined,
    maxRating: question.questionType === "rating" ? question.maxRating || 5 : undefined,
  }));
}

function questionTypeLabel(type: QuestionType) {
  return questionTypeOptions.find((item) => item.value === type)?.label || type;
}

export function JobEditor({
  job,
  initialApplications = [],
  canViewApplications = false,
  initialTab = "details",
}: {
  job?: Job;
  initialApplications?: Application[];
  canViewApplications?: boolean;
  initialTab?: TabKey;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(job && initialTab === "applications" ? "applications" : initialTab);
  const [title, setTitle] = useState(job?.title ?? "");
  const [company, setCompany] = useState(job?.company ?? "ConnectSphere");
  const [department, setDepartment] = useState(job?.department ?? "");
  const [position, setPosition] = useState(job?.position ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [type, setType] = useState<EmploymentType>(job?.type ?? "Full-time");
  const [workMode, setWorkMode] = useState<WorkMode>(job?.workMode ?? "Hybrid");
  const [salary, setSalary] = useState(job?.salary ?? "");
  const [reportingManager, setReportingManager] = useState(job?.reportingManager ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [requirements, setRequirements] = useState(listToText(job?.requirements ?? [""]));
  const [responsibilities, setResponsibilities] = useState(listToText(job?.responsibilities ?? [""]));
  const [isActive, setIsActive] = useState(job?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(job?.isFeatured ?? false);
  const [hrName, setHrName] = useState(job?.hrContact?.name ?? "");
  const [hrEmail, setHrEmail] = useState(job?.hrContact?.email ?? "");
  const [hrPhone, setHrPhone] = useState(job?.hrContact?.phone ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState(job?.imageFileName ?? "");
  const [imagePreview, setImagePreview] = useState(job?.imageUrl ?? "");
  const [questions, setQuestions] = useState<EditableQuestion[]>(job?.questions ?? []);
  const [newQuestion, setNewQuestion] = useState<NewQuestion>(initialQuestion);
  const [applications, setApplications] = useState(initialApplications);
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | "all">("all");
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [questionNotice, setQuestionNotice] = useState("");
  const [questionError, setQuestionError] = useState("");
  const [applicationError, setApplicationError] = useState("");

  const normalizedQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const canOpenApplications = Boolean(job && canViewApplications);

  const payload = () => ({
    id: job?.id,
    title,
    company,
    imageFileName,
    imageUrl: imagePreview && !imagePreview.startsWith("blob:") ? imagePreview : "",
    department,
    position,
    location,
    type,
    workMode,
    salary,
    reportingManager,
    description,
    requirements: textToList(requirements),
    responsibilities: textToList(responsibilities),
    isActive,
    isFeatured,
    hrContact: {
      name: hrName,
      email: hrEmail,
      phone: hrPhone,
    },
    questions: normalizedQuestions.filter((question) => question.questionText.trim()),
  });

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageFileName(file.name);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImageFileName("");
    setImagePreview("");
  };

  const save = async () => {
    setSaving(true);
    setNotice("");
    setError("");

    if (imageFile) {
      setIsUploading(true);
      setUploadProgress(35);
    }

    try {
      if (imageFile) setUploadProgress(80);
      const response = await fetch(job ? `/api/v1/admin/jobs/${job.id}` : "/api/v1/admin/jobs", {
        method: job ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Could not save this job.");
      setUploadProgress(100);
      setNotice(job ? "Job updated successfully." : "Job created successfully.");
      router.push(`/jobs/edit/${result.data.id}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this job.");
    } finally {
      setSaving(false);
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const updateNewQuestion = <K extends keyof NewQuestion>(key: K, value: NewQuestion[K]) => {
    setNewQuestion((current) => ({ ...current, [key]: value }));
  };

  const addQuestion = async () => {
    setQuestionError("");
    setQuestionNotice("");

    if (!job) {
      setQuestionError("Please save the job details first before adding application questions.");
      return;
    }
    if (!newQuestion.questionText.trim()) {
      setQuestionError("Question text is required.");
      return;
    }

    const options =
      newQuestion.questionType === "multipleChoice" || newQuestion.questionType === "checkbox"
        ? newQuestion.options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined;

    if ((newQuestion.questionType === "multipleChoice" || newQuestion.questionType === "checkbox") && !options?.length) {
      setQuestionError("Please provide valid comma-separated options for this question type.");
      return;
    }

    const questionPayload = {
      questionText: newQuestion.questionText,
      questionType: newQuestion.questionType,
      required: newQuestion.required,
      options,
      allowFileUpload: newQuestion.allowFileUpload || newQuestion.questionType === "file",
      maxRating: newQuestion.questionType === "rating" ? newQuestion.maxRating : undefined,
      order: questions.length,
    };

    try {
      const response = await fetch(`/api/v1/admin/jobs/${job.id}/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(questionPayload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Could not add question.");
      setQuestions((current) => [...current, result.data]);
      setNewQuestion(initialQuestion);
      setQuestionNotice("Question added successfully.");
    } catch (addError) {
      setQuestionError(addError instanceof Error ? addError.message : "Could not add question.");
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!job) return;
    const confirmed = window.confirm("Delete this application question?");
    if (!confirmed) return;

    setQuestionError("");
    setQuestionNotice("");
    try {
      const response = await fetch(`/api/v1/admin/jobs/${job.id}/questions/${questionId}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Could not delete question.");
      setQuestions((current) => current.filter((question) => question.id !== questionId).map((question, order) => ({ ...question, order })));
      setQuestionNotice("Question deleted successfully.");
    } catch (deleteError) {
      setQuestionError(deleteError instanceof Error ? deleteError.message : "Could not delete question.");
    }
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    if (!job) return;
    if ((index === 0 && direction === -1) || (index === questions.length - 1 && direction === 1)) return;

    const nextQuestions = [...questions];
    const swapWith = index + direction;
    [nextQuestions[index], nextQuestions[swapWith]] = [nextQuestions[swapWith], nextQuestions[index]];
    const ordered = nextQuestions.map((question, order) => ({ ...question, order }));
    setQuestions(ordered);

    try {
      const response = await fetch(`/api/v1/admin/jobs/${job.id}/questions-reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionIds: ordered.map((question) => question.id) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Could not reorder questions.");
      setQuestions(result.data);
    } catch (moveError) {
      setQuestionError(moveError instanceof Error ? moveError.message : "Could not reorder questions.");
    }
  };

  const loadApplications = async (status = filterStatus) => {
    if (!job || !canViewApplications) return;
    setLoadingApplications(true);
    setApplicationError("");
    try {
      const params = new URLSearchParams({ status });
      const response = await fetch(`/api/v1/applications/job/${job.id}?${params.toString()}`);
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Could not load applications for this job.");
      setApplications(result.data);
    } catch (applicationsError) {
      setApplicationError(applicationsError instanceof Error ? applicationsError.message : "Could not load applications for this job.");
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "applications" || !job || !canViewApplications) return;
    void loadApplications(filterStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterStatus, job?.id, canViewApplications]);

  const viewResume = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/v1/applications/${applicationId}/resume-access`);
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Could not prepare resume access.");
      setNotice(`Secure resume access prepared for ${result.data.fileName}.`);
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : "Could not prepare resume access.");
    }
  };

  const tabs: { key: TabKey; label: string; count?: number; disabled?: boolean }[] = [
    { key: "details", label: "Job Details" },
    { key: "questions", label: "Application Questions" },
    { key: "applications", label: "Applications", count: applications.length, disabled: !job },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b">
        <div className="flex flex-wrap gap-2 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                activeTab === tab.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && !tab.disabled ? <Badge className="bg-background text-foreground">{tab.count}</Badge> : null}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "details" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Surface className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="job-title" label="Job Title">
                  <Input id="job-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Senior React Developer" required />
                </Field>
                <Field id="job-company" label="Company">
                  <Input id="job-company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. ConnectSphere" required />
                </Field>
                <Field id="job-location" label="Location">
                  <Input id="job-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Remote, Bengaluru" />
                </Field>
                <Field id="job-type" label="Employment Type">
                  <Select id="job-type" value={type} onChange={(event) => setType(event.target.value as EmploymentType)}>
                    {employmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field id="job-salary" label="Salary">
                  <Input id="job-salary" value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="e.g., Rs. 12L - Rs. 18L" />
                </Field>
                <Field id="job-department" label="Department">
                  <Input id="job-department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g., Engineering, Marketing, Sales" />
                </Field>
                <Field id="job-position" label="Position">
                  <Input id="job-position" value={position} onChange={(event) => setPosition(event.target.value)} placeholder="e.g., Manager, SDE, Team Lead" />
                </Field>
                <Field id="job-work-mode" label="Work Mode">
                  <Select id="job-work-mode" value={workMode} onChange={(event) => setWorkMode(event.target.value as WorkMode)}>
                    {workModes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field id="job-manager" label="Reporting Manager">
                  <Input id="job-manager" value={reportingManager} onChange={(event) => setReportingManager(event.target.value)} placeholder="e.g. Head of Product" />
                </Field>
              </div>
              <div className="mt-4">
                <Field id="job-description" label="Job Description" hint="Provide a detailed description of the job role.">
                  <Textarea id="job-description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Provide a detailed description of the job role" required />
                </Field>
              </div>
            </Surface>

            <Surface className="p-5">
              <h2 className="text-base font-semibold">Job Image</h2>
              <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <label htmlFor="job-image" className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-5 text-center transition-colors hover:bg-muted/50">
                    <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
                    <span className="mt-2 text-sm font-medium">{imageFileName || "Choose job image"}</span>
                    <span className="mt-1 text-xs text-muted-foreground">Upload an image to represent this job. Large images may take a moment to save.</span>
                  </label>
                  <Input id="job-image" type="file" accept="image/*" className="sr-only" onChange={handleImageChange} disabled={isUploading} />
                </div>
                {imagePreview ? (
                  <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Job preview" className="h-full w-full object-cover" />
                    <Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2" aria-label="Remove image" onClick={removeImage}>
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </div>
              {isUploading ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Uploading image to job storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : null}
            </Surface>

            <Surface className="p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field id="job-requirements" label="Requirements" hint="Enter each requirement on a new line.">
                  <Textarea id="job-requirements" className="min-h-52" value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="Enter each requirement on a new line" />
                </Field>
                <Field id="job-responsibilities" label="Responsibilities" hint="Enter each responsibility on a new line.">
                  <Textarea id="job-responsibilities" className="min-h-52" value={responsibilities} onChange={(event) => setResponsibilities(event.target.value)} placeholder="Enter each responsibility on a new line" />
                </Field>
              </div>
            </Surface>

            <Surface className="p-5">
              <h2 className="text-base font-semibold">HR Contact Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field id="hr-name" label="Name">
                  <Input id="hr-name" value={hrName} onChange={(event) => setHrName(event.target.value)} placeholder="Enter HR name" />
                </Field>
                <Field id="hr-email" label="Email">
                  <Input id="hr-email" type="email" value={hrEmail} onChange={(event) => setHrEmail(event.target.value)} placeholder="Enter HR email" />
                </Field>
                <Field id="hr-phone" label="Phone">
                  <Input id="hr-phone" type="tel" value={hrPhone} onChange={(event) => setHrPhone(event.target.value)} placeholder="Enter HR phone" />
                </Field>
              </div>
            </Surface>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Publish settings</h2>
              <div className="mt-4 grid gap-3">
                <label className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                  <span>
                    <span className="block font-medium">Active</span>
                    <span className="text-xs text-muted-foreground">Visible in the public job directory.</span>
                  </span>
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                  <span>
                    <span className="block font-medium">Featured</span>
                    <span className="text-xs text-muted-foreground">Shown on the career home page.</span>
                  </span>
                  <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
                </label>
              </div>
              {notice ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
              {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
              <div className="mt-4 grid gap-2">
                <Button type="button" onClick={save} disabled={saving || isUploading}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : imageFile ? <UploadCloud className="size-4" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                  {saving ? "Saving" : job ? "Update Job" : "Create Job"}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/jobs">Cancel</Link>
                </Button>
              </div>
            </Surface>
          </aside>
        </div>
      ) : null}

      {activeTab === "questions" ? (
        <Surface className="p-5">
          {!job ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <div className="flex gap-3">
                <Info className="size-5 shrink-0 text-sky-700" aria-hidden="true" />
                <div>
                  <p className="font-medium">Please save the job details first before adding application questions.</p>
                  <p className="mt-1">After creating the job, you can define custom questions for applicants.</p>
                  <Button type="button" className="mt-3" variant="outline" onClick={() => setActiveTab("details")}>Go to Job Details</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <section>
                <h2 className="text-base font-semibold">Manage Application Questions</h2>
                {questionError ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{questionError}</p> : null}
                {questionNotice ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{questionNotice}</p> : null}
                <div className="mt-5">
                  <h3 className="text-sm font-semibold">Current Questions</h3>
                  {questions.length === 0 ? (
                    <p className="mt-3 rounded-md border border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                      No questions have been added yet. Add questions to include them in the job application.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      {questions.map((question, index) => (
                        <article key={question.id} className="rounded-md border bg-background p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{question.questionText}</p>
                                {question.required ? <Badge className="border-rose-200 bg-rose-50 text-rose-800">Required</Badge> : null}
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">Type: {questionTypeLabel(question.questionType)}</p>
                              {question.allowFileUpload ? <p className="mt-1 text-sm text-muted-foreground">Allows file upload</p> : null}
                              {question.options?.length ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {question.options.map((option) => <Badge key={option} className="bg-muted">{option}</Badge>)}
                                </div>
                              ) : null}
                              {question.questionType === "rating" ? <p className="mt-1 text-sm text-muted-foreground">Max rating: {question.maxRating || 5}</p> : null}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button type="button" size="icon" variant="outline" aria-label="Move question up" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>
                                <ArrowUp className="size-4" aria-hidden="true" />
                              </Button>
                              <Button type="button" size="icon" variant="outline" aria-label="Move question down" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>
                                <ArrowDown className="size-4" aria-hidden="true" />
                              </Button>
                              <Button type="button" size="icon" variant="outline" aria-label="Delete question" onClick={() => deleteQuestion(question.id)}>
                                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <aside className="rounded-md border bg-muted/20 p-4">
                <h3 className="text-base font-semibold">Add New Question</h3>
                <div className="mt-4 grid gap-4">
                  <Field id="new-question-text" label="Question Text*">
                    <Input id="new-question-text" value={newQuestion.questionText} onChange={(event) => updateNewQuestion("questionText", event.target.value)} placeholder="e.g. What makes you a good fit for this role?" required />
                  </Field>
                  <Field id="new-question-type" label="Question Type">
                    <Select id="new-question-type" value={newQuestion.questionType} onChange={(event) => updateNewQuestion("questionType", event.target.value as QuestionType)}>
                      {questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </Field>
                  {newQuestion.questionType === "multipleChoice" || newQuestion.questionType === "checkbox" ? (
                    <Field id="new-question-options" label="Options (comma separated)">
                      <Input id="new-question-options" value={newQuestion.options} onChange={(event) => updateNewQuestion("options", event.target.value)} placeholder="Option 1, Option 2, Option 3" />
                    </Field>
                  ) : null}
                  {newQuestion.questionType === "rating" ? (
                    <Field id="new-question-max-rating" label="Max Rating">
                      <Input id="new-question-max-rating" type="number" min={1} max={10} value={newQuestion.maxRating} onChange={(event) => updateNewQuestion("maxRating", Number(event.target.value))} />
                    </Field>
                  ) : null}
                  <div className="flex flex-wrap gap-5">
                    <label className="flex min-h-9 items-center gap-2 text-sm">
                      <input type="checkbox" checked={newQuestion.required} onChange={(event) => updateNewQuestion("required", event.target.checked)} />
                      Required Question
                    </label>
                    <label className="flex min-h-9 items-center gap-2 text-sm">
                      <input type="checkbox" checked={newQuestion.allowFileUpload} onChange={(event) => updateNewQuestion("allowFileUpload", event.target.checked)} />
                      Allow File Upload
                    </label>
                  </div>
                  <Button type="button" onClick={addQuestion}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add Question
                  </Button>
                </div>
              </aside>
            </div>
          )}
        </Surface>
      ) : null}

      {activeTab === "applications" ? (
        <Surface className="p-5">
          {!job ? null : !canOpenApplications ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              You do not have permission to view applications for this job.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <UsersRound className="size-4 text-primary" aria-hidden="true" />
                    Applications for this Job
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{applications.length} matching applications</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label htmlFor="application-status-filter" className="text-sm font-medium">Filter by Status:</label>
                  <Select id="application-status-filter" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as ApplicationStatus | "all")}>
                    {statuses.map((status) => <option key={status} value={status}>{status === "all" ? "All Applications" : status}</option>)}
                  </Select>
                  <Button type="button" variant="outline" size="icon" aria-label="Refresh applications" onClick={() => loadApplications()}>
                    {loadingApplications ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                  </Button>
                </div>
              </div>

              {applicationError ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{applicationError}</p> : null}

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Applicant</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Applied</th>
                      <th className="px-4 py-3 text-left font-medium">Skills</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {applications.map((application) => (
                      <tr key={application.id} className="hover:bg-muted/20">
                        <td className="px-4 py-4">
                          <p className="font-medium">{application.candidate.name}</p>
                          <p className="text-xs text-muted-foreground">{application.candidate.email}</p>
                          <p className="text-xs text-muted-foreground">{application.reference}</p>
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={application.status} /></td>
                        <td className="px-4 py-4 text-muted-foreground">{formatDate(application.createdAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex max-w-sm flex-wrap gap-1.5">
                            {application.skills.slice(0, 4).map((skill) => <Badge key={skill} className="bg-muted">{skill}</Badge>)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/applications/${application.id}`}>
                                <Eye className="size-4" aria-hidden="true" />
                                View
                              </Link>
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => viewResume(application.id)}>
                              <FileText className="size-4" aria-hidden="true" />
                              Resume
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {applications.map((application) => (
                  <article key={application.id} className="rounded-md border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{application.candidate.name}</p>
                        <p className="break-all text-xs text-muted-foreground">{application.candidate.email}</p>
                      </div>
                      <StatusBadge status={application.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{application.reference} · {formatDate(application.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {application.skills.slice(0, 4).map((skill) => <Badge key={skill} className="bg-muted">{skill}</Badge>)}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/applications/${application.id}`}>View Application</Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => viewResume(application.id)}>Resume</Button>
                    </div>
                  </article>
                ))}
              </div>

              {!loadingApplications && applications.length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/40 p-8 text-center">
                  <BriefcaseBusiness className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
                  <h3 className="mt-3 font-medium">No applications found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting the status filter or check back later.</p>
                </div>
              ) : null}
            </div>
          )}
        </Surface>
      ) : null}
    </div>
  );
}
