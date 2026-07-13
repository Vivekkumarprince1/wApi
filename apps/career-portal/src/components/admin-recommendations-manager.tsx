"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  Link2,
  Loader2,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { Recommendation } from "@/types/career";
import { Badge, Button, Field, Input, Select, Surface, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type Filters = {
  status: Recommendation["status"] | "";
  search: string;
  page: number;
  limit: number;
};

const statusConfig: Record<Recommendation["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  reviewed: "border-sky-200 bg-sky-50 text-sky-800",
  selected: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
};

function RecommendationBadge({ status }: { status: Recommendation["status"] }) {
  return <Badge className={cn("capitalize", statusConfig[status])}>{status}</Badge>;
}

function statCounts(recommendations: Recommendation[]) {
  return recommendations.reduce(
    (acc, recommendation) => {
      acc.total += 1;
      acc[recommendation.status] += 1;
      return acc;
    },
    { total: 0, pending: 0, reviewed: 0, selected: 0, rejected: 0 },
  );
}

export function AdminRecommendationsManager({ recommendations }: { recommendations: Recommendation[] }) {
  const [items, setItems] = useState(recommendations);
  const [filters, setFilters] = useState<Filters>({ status: "", search: "", page: 1, limit: 10 });
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [reviewForm, setReviewForm] = useState<{ status: Recommendation["status"] | ""; adminNotes: string }>({
    status: "",
    adminNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [linkingApplications, setLinkingApplications] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => statCounts(items), [items]);
  const filteredItems = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return items.filter((recommendation) => {
      const haystack = [
        recommendation.candidateName,
        recommendation.candidateEmail,
        recommendation.jobTitle,
        recommendation.jobDepartment,
        recommendation.recommender,
        recommendation.recommenderId,
        recommendation.applicationId,
        recommendation.applicationReference,
        recommendation.rationale,
        recommendation.status,
      ]
        .join(" ")
        .toLowerCase();
      return (!filters.status || recommendation.status === filters.status) && (!query || haystack.includes(query));
    });
  }, [filters.search, filters.status, items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / filters.limit));
  const currentPage = Math.min(filters.page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * filters.limit, currentPage * filters.limit);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? (value as number) : 1 }));
  };

  const openReviewModal = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation);
    setReviewForm({
      status: recommendation.status,
      adminNotes: recommendation.adminNotes || "",
    });
    setError("");
  };

  const updateRecommendationStatus = async (status: Recommendation["status"], recommendation = selectedRecommendation) => {
    if (!recommendation) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/admin/recommendations/${recommendation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, adminNotes: reviewForm.adminNotes }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Failed to update recommendation status.");
      setItems((current) => current.map((item) => (item.id === recommendation.id ? payload.data : item)));
      setSelectedRecommendation(null);
      setReviewForm({ status: "", adminNotes: "" });
      setNotice(`Recommendation ${status} successfully.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update recommendation status.");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkApplications = async () => {
    const confirmed = window.confirm("This will link selected recommendations with existing applications based on email and job matching. Continue?");
    if (!confirmed) return;

    setLinkingApplications(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/recommendations/link-applications", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Failed to link applications.");
      if (Array.isArray(payload?.data?.recommendations)) {
        setItems(payload.data.recommendations);
      }
      setNotice(payload?.data?.message || "Applications linked successfully.");
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Failed to link applications.");
    } finally {
      setLinkingApplications(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recommendation Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and manage employee recommendations.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleLinkApplications} disabled={linkingApplications}>
          {linkingApplications ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {linkingApplications ? "Linking..." : "Link Applications"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-md bg-sky-50 text-sky-700">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Total Recommendations</p>
              <p className="text-2xl font-semibold">{counts.total}</p>
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <X className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-semibold">{counts.pending}</p>
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Check className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Selected</p>
              <p className="text-2xl font-semibold">{counts.selected}</p>
            </div>
          </div>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-md bg-rose-50 text-rose-700">
              <X className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-semibold">{counts.rejected}</p>
            </div>
          </div>
        </Surface>
      </div>

      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <Surface className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_140px_120px]">
          <div className="space-y-1.5">
            <label htmlFor="recommendation-search" className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="recommendation-search"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Name, email, job, or note"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="recommendation-status-filter" className="text-sm font-medium">Status</label>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Select
                id="recommendation-status-filter"
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value as Filters["status"])}
                className="pl-9"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="recommendation-limit" className="text-sm font-medium">Rows</label>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Select
                id="recommendation-limit"
                value={filters.limit}
                onChange={(event) => updateFilter("limit", Number(event.target.value))}
                className="pl-9"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => setFilters({ status: "", search: "", page: 1, limit: 10 })}
          >
            Clear Filters
          </Button>
        </div>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            Recommendations Directory
            <Badge className="bg-background">{filteredItems.length} recommendations</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
        </div>

        {pageItems.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 font-medium">No recommendations found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Candidate</th>
                    <th className="px-4 py-3 text-left font-medium">Job Position</th>
                    <th className="px-4 py-3 text-left font-medium">Recommender</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Application</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageItems.map((recommendation) => (
                    <tr key={recommendation.id} className="hover:bg-muted/20">
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {recommendation.candidateName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{recommendation.candidateName}</p>
                            <p className="truncate text-xs text-muted-foreground">{recommendation.candidateEmail || "Email not linked"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="flex min-w-0 items-center gap-2">
                          <BriefcaseBusiness className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          <span className="truncate">{recommendation.jobTitle}</span>
                        </p>
                        <p className="ml-6 text-xs text-muted-foreground">{recommendation.jobDepartment || "Department not linked"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="flex min-w-0 items-center gap-2">
                          <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          <span className="truncate">{recommendation.recommender}</span>
                        </p>
                        <p className="ml-6 text-xs text-muted-foreground">ID: {recommendation.recommenderId || "n/a"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <RecommendationBadge status={recommendation.status} />
                      </td>
                      <td className="px-4 py-4">
                        {recommendation.applicationId ? (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                              <Check className="size-3.5" aria-hidden="true" />
                              Application Linked
                            </p>
                            <p className="text-xs text-muted-foreground">{recommendation.applicationReference}</p>
                          </div>
                        ) : (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <X className="size-3.5" aria-hidden="true" />
                            No application
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(recommendation.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="icon" variant="ghost" title="Review Recommendation" onClick={() => openReviewModal(recommendation)}>
                            <Eye className="size-4" aria-hidden="true" />
                          </Button>
                          {recommendation.applicationId ? (
                            <Button asChild size="icon" variant="ghost" title="View Application">
                              <Link href={`/applications/${recommendation.applicationId}`}>
                                <BriefcaseBusiness className="size-4" aria-hidden="true" />
                              </Link>
                            </Button>
                          ) : null}
                          {recommendation.status === "pending" ? (
                            <>
                              <Button type="button" size="icon" variant="ghost" title="Select Candidate" onClick={() => updateRecommendationStatus("selected", recommendation)}>
                                <Check className="size-4 text-emerald-700" aria-hidden="true" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" title="Reject Recommendation" onClick={() => updateRecommendationStatus("rejected", recommendation)}>
                                <X className="size-4 text-rose-700" aria-hidden="true" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y lg:hidden">
              {pageItems.map((recommendation) => (
                <article key={recommendation.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{recommendation.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{recommendation.candidateEmail || "Email not linked"}</p>
                    </div>
                    <RecommendationBadge status={recommendation.status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <p>{recommendation.jobTitle}</p>
                    <p>Referred by {recommendation.recommender}</p>
                    <p>{formatDate(recommendation.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openReviewModal(recommendation)}>
                      <Eye className="size-4" aria-hidden="true" />
                      Review
                    </Button>
                    {recommendation.applicationId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/applications/${recommendation.applicationId}`}>Application</Link>
                      </Button>
                    ) : null}
                    {recommendation.status === "pending" ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => updateRecommendationStatus("selected", recommendation)}>Select</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => updateRecommendationStatus("rejected", recommendation)}>Reject</Button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * filters.limit + 1} to {Math.min(currentPage * filters.limit, filteredItems.length)} of {filteredItems.length} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => updateFilter("page", Math.max(currentPage - 1, 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Previous
                  </Button>
                  <Badge className="bg-muted">Page {currentPage} of {totalPages}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => updateFilter("page", Math.min(totalPages, currentPage + 1))}
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Surface>

      {selectedRecommendation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <Surface className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Eye className="size-5 text-primary" aria-hidden="true" />
                Review Recommendation
              </h2>
              <Button type="button" variant="ghost" size="icon" aria-label="Close review modal" onClick={() => setSelectedRecommendation(null)}>
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <UserRound className="size-4 text-primary" aria-hidden="true" />
                  Candidate Information
                </p>
                <p className="font-medium">{selectedRecommendation.candidateName}</p>
                <p className="text-sm text-muted-foreground">{selectedRecommendation.candidateEmail || "Email not linked"}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <BriefcaseBusiness className="size-4 text-primary" aria-hidden="true" />
                  Job Position
                </p>
                <p className="font-medium">{selectedRecommendation.jobTitle}</p>
                <p className="text-sm text-muted-foreground">{selectedRecommendation.jobDepartment || "Department not linked"}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <UsersRound className="size-4 text-primary" aria-hidden="true" />
                  Recommender
                </p>
                <p className="font-medium">{selectedRecommendation.recommender}</p>
                <p className="text-sm text-muted-foreground">Employee ID: {selectedRecommendation.recommenderId || "n/a"}</p>
              </div>
              {selectedRecommendation.applicationId ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Application Found
                  </p>
                  <div className="mt-2 text-sm">
                    <p>Reference: {selectedRecommendation.applicationReference || selectedRecommendation.applicationId}</p>
                  </div>
                  <Button asChild className="mt-3" size="sm" variant="outline">
                    <Link href={`/applications/${selectedRecommendation.applicationId}`}>
                      <BriefcaseBusiness className="size-4" aria-hidden="true" />
                      View Full Application
                    </Link>
                  </Button>
                </div>
              ) : null}
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 text-sm font-medium">Recommendation Message:</p>
                <blockquote className="border-l-4 border-primary bg-background p-3 text-sm italic text-muted-foreground">
                  "{selectedRecommendation.rationale}"
                </blockquote>
              </div>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (reviewForm.status) updateRecommendationStatus(reviewForm.status);
              }}
            >
              <Field id="recommendation-status" label="Update Status">
                <Select
                  id="recommendation-status"
                  value={reviewForm.status}
                  onChange={(event) => setReviewForm((current) => ({ ...current, status: event.target.value as typeof reviewForm.status }))}
                  required
                >
                  <option value="">Select status</option>
                  <option value="reviewed">Mark as Reviewed</option>
                  <option value="selected">Select Candidate</option>
                  <option value="rejected">Reject Recommendation</option>
                </Select>
              </Field>
              <Field id="admin-notes" label="Admin Notes">
                <Textarea
                  id="admin-notes"
                  value={reviewForm.adminNotes}
                  onChange={(event) => setReviewForm((current) => ({ ...current, adminNotes: event.target.value }))}
                  rows={4}
                  maxLength={500}
                  placeholder="Add any notes about this recommendation..."
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{reviewForm.adminNotes.length}/500 characters</p>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="submit" disabled={saving || !reviewForm.status}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                  Update Status
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedRecommendation(null)}>
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            </form>
          </Surface>
        </div>
      ) : null}
    </div>
  );
}
