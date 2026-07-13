"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  FileText,
  Gauge,
  History,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type {
  Application,
  AuditLog,
  AuthUser,
  Certificate,
  DashboardMetrics,
  Employee,
  Job,
  OfferLetter,
  PermissionFlag,
  Recommendation,
  Review,
} from "@/types/career";
import { Badge, Button, EmptyState, Input, MetricTile, Select, StatusBadge, Surface } from "@/components/ui";
import { formatDate, numberFormatter, statusLabel } from "@/lib/utils";
import { hasPermission, isSuperAdminUser, roleLabel } from "@/lib/auth-client";

type TabKey = "overview" | "applications" | "credentials" | "people" | "audit";

const tabs: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: PermissionFlag[];
  superAdminOnly?: boolean;
}[] = [
  { key: "overview", label: "Overview", icon: Gauge, permissions: ["canAccessDashboard"] },
  { key: "applications", label: "Applications", icon: FileText, permissions: ["canViewApplicants"] },
  { key: "credentials", label: "Offers & certificates", icon: BadgeCheck, permissions: ["canGenerateOfferLetter", "canGenerateCertificate"] },
  { key: "people", label: "People", icon: Users, permissions: ["canManageEmployees", "canManageReviews", "canManageRecommendations"] },
  { key: "audit", label: "Audit", icon: History, superAdminOnly: true },
];

const permissionLabels: Record<PermissionFlag, string> = {
  canGenerateCertificate: "Certificates",
  canGenerateOfferLetter: "Offers",
  canCreateJob: "Jobs",
  canViewApplicants: "Applicants",
  canManageReviews: "Reviews",
  canManageEmployees: "Employees",
  canManageRecommendations: "Referrals",
  canAccessDashboard: "Dashboard",
};

export function AdminConsole({
  initialTab = "overview",
  metrics,
  jobs,
  applications,
  offers,
  certificates,
  recommendations: initialRecommendations,
  employees,
  reviews: initialReviews,
  auditLogs,
  users,
  currentUser,
}: {
  initialTab?: TabKey;
  metrics: DashboardMetrics;
  jobs: Job[];
  applications: Application[];
  offers: OfferLetter[];
  certificates: Certificate[];
  recommendations: Recommendation[];
  employees: Employee[];
  reviews: Review[];
  auditLogs: AuditLog[];
  users: AuthUser[];
  currentUser: AuthUser;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [recommendationItems, setRecommendationItems] = useState(initialRecommendations);
  const [reviewItems, setReviewItems] = useState(initialReviews);
  const [actionError, setActionError] = useState("");

  const visibleApplications = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((application) => {
      const haystack = [application.reference, application.candidate.name, application.candidate.email, application.jobTitle, application.skills.join(" ")]
        .join(" ")
        .toLowerCase();
      return (!q || haystack.includes(q)) && (status === "all" || application.status === status);
    });
  }, [applications, query, status]);

  const canUseTab = (tab: (typeof tabs)[number]) => {
    if (tab.superAdminOnly) return isSuperAdminUser(currentUser);
    if (!tab.permissions?.length) return true;
    return tab.permissions.some((permission) => hasPermission(currentUser, permission));
  };

  const canViewApplicants = hasPermission(currentUser, "canViewApplicants");
  const canIssueOffers = hasPermission(currentUser, "canGenerateOfferLetter");
  const canIssueCertificates = hasPermission(currentUser, "canGenerateCertificate");
  const canCreateJob = hasPermission(currentUser, "canCreateJob");
  const canManageReviews = hasPermission(currentUser, "canManageReviews");
  const canManageRecommendations = hasPermission(currentUser, "canManageRecommendations");

  const updateRecommendationStatus = async (id: string, nextStatus: Recommendation["status"]) => {
    setActionError("");
    const response = await fetch(`/api/v1/admin/recommendations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setActionError(payload?.error?.message || "Could not update recommendation.");
      return;
    }
    setRecommendationItems((current) => current.map((item) => (item.id === id ? payload.data : item)));
  };

  const updateReviewStatus = async (id: string, nextStatus: Review["status"]) => {
    setActionError("");
    const response = await fetch(`/api/v1/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setActionError(payload?.error?.message || "Could not update review.");
      return;
    }
    setReviewItems((current) => current.map((item) => (item.id === id ? payload.data : item)));
  };

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="h-fit rounded-lg border bg-card p-2 lg:sticky lg:top-20">
        <div className="px-2 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">HR workspace</p>
          <h1 className="mt-1 text-lg font-semibold">Recruitment ops</h1>
          <div className="mt-3 rounded-md border bg-background p-2 text-xs">
            <div className="font-medium">{currentUser.name}</div>
            <div className="text-muted-foreground">{roleLabel(currentUser.role)} · {currentUser.department}</div>
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1" aria-label="Admin sections">
          {tabs.map((tab) => {
            const allowed = canUseTab(tab);
            return (
            <button
              key={tab.key}
              type="button"
              onClick={() => allowed && setActiveTab(tab.key)}
              disabled={!allowed}
              className={`flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                activeTab === tab.key
                  ? "bg-emerald-50 text-primary"
                  : allowed
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "cursor-not-allowed text-muted-foreground/50"
              }`}
            >
              <tab.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{tab.label}</span>
            </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 space-y-5">
        {activeTab === "overview" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Candidates" value={numberFormatter(metrics.totalCandidates)} detail="Unique applicants in active pipeline" icon={<Users className="size-4" />} />
              <MetricTile label="Active openings" value={metrics.activeOpenings} detail="Public roles accepting applications" icon={<BriefcaseBusiness className="size-4" />} />
              <MetricTile label="Pending contracts" value={metrics.pendingContracts} detail="Issued offers awaiting decision" icon={<FileText className="size-4" />} />
              <MetricTile label="Employees" value={metrics.totalEmployees} detail="Active HR/employee records" icon={<ShieldCheck className="size-4" />} />
            </div>
            <Surface className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Application funnel</h2>
                  <p className="text-sm text-muted-foreground">State transitions follow the PRD lifecycle and must append immutable history.</p>
                </div>
                {canViewApplicants ? (
                  <Button asChild variant="outline">
                    <Link href="/admin/applications">Open applications</Link>
                  </Button>
                ) : (
                  <Button disabled variant="outline">No applicant permission</Button>
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {Object.entries(metrics.applicationsByStatus).map(([key, value]) => (
                  <div key={key} className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{statusLabel(key as never)}</p>
                    <p className="mt-1 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold">Open roles</h2>
                {canCreateJob ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/jobs/create">Create role</Link>
                  </Button>
                ) : (
                  <Button disabled size="sm" variant="outline">
                    Create role locked
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{job.department} · {job.location}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className="bg-muted">{job.applicantCount} applicants</Badge>
                        {canCreateJob ? (
                          <Link href={`/jobs/edit/${job.slug}`} className="text-xs font-medium text-primary hover:underline">
                            Edit role
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </>
        ) : null}

        {activeTab === "applications" ? (
          <Surface className="p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">Applications</h2>
                <p className="text-sm text-muted-foreground">Search, review, status-change, and offer issue surface.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,260px)_170px]">
                <label className="relative">
                  <span className="sr-only">Search applications</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Candidate, job, reference" />
                </label>
                <label>
                  <span className="sr-only">Status</span>
                  <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="offered">Offered</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </label>
              </div>
            </div>
            {visibleApplications.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No applications match" description="Adjust search or status filters to inspect more candidate records." />
              </div>
            ) : (
              <>
                <div className="mt-4 hidden overflow-x-auto rounded-md border md:block">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Candidate</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Score</th>
                        <th className="px-3 py-2 font-medium">Updated</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleApplications.map((application) => (
                        <tr key={application.id} className="border-t hover:bg-muted/40">
                          <td className="px-3 py-3">
                            <div className="font-medium">{application.candidate.name}</div>
                            <div className="text-xs text-muted-foreground">{application.candidate.email}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div>{application.jobTitle}</div>
                            <div className="text-xs text-muted-foreground">{application.reference}</div>
                          </td>
                          <td className="px-3 py-3"><StatusBadge status={application.status} /></td>
                          <td className="px-3 py-3">{application.score ? `${application.score}%` : "Pending"}</td>
                          <td className="px-3 py-3">{formatDate(application.updatedAt)}</td>
                          <td className="px-3 py-3">
                            {canViewApplicants ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/applications/${application.id}`}>Review</Link>
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>Review</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-3 md:hidden">
                  {visibleApplications.map((application) => (
                    <div key={application.id} className="rounded-md border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{application.candidate.name}</p>
                          <p className="text-xs text-muted-foreground">{application.jobTitle}</p>
                        </div>
                        <StatusBadge status={application.status} />
                      </div>
                      {canViewApplicants ? (
                        <Button asChild className="mt-3 w-full" variant="outline">
                          <Link href={`/applications/${application.id}`}>Review</Link>
                        </Button>
                      ) : (
                        <Button className="mt-3 w-full" variant="outline" disabled>Review</Button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Surface>
        ) : null}

        {activeTab === "credentials" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Offer registry</h2>
              <div className="mt-3 space-y-3">
                {offers.map((offer) => (
                  <div key={offer.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{offer.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{offer.position} · {offer.publicId}</p>
                      </div>
                      <StatusBadge status={offer.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={!canIssueOffers}>Resend</Button>
                      <Button size="sm" variant="outline" disabled={!canIssueOffers}>Extend</Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/offer/accept/${applications.find((application) => application.id === offer.applicationId)?.jobSlug || "offer"}/${offer.publicId}`}>Acceptance</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/verify-offer/${offer.publicId}`}>Verify</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Certificates</h2>
              <div className="mt-3 space-y-3">
                {certificates.map((certificate) => (
                  <div key={certificate.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{certificate.recipientName}</p>
                        <p className="text-xs text-muted-foreground">{certificate.credential} · {certificate.publicId}</p>
                      </div>
                      <StatusBadge status={certificate.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={!canIssueCertificates}>Resend certificate</Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/verify/${certificate.publicId}`}>Open verification</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        ) : null}

        {activeTab === "people" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Employees and HR access</h2>
              <div className="mt-3 space-y-3">
                {employees.map((employee) => (
                  <div key={employee.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-muted-foreground">{employee.position} · {employee.department}</p>
                      </div>
                      <Badge className="bg-muted">{employee.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{employee.permissions.length} explicit permissions</p>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Referrals and reviews</h2>
              {actionError ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionError}</p> : null}
              <div className="mt-3 space-y-3">
                {recommendationItems.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-md border bg-background p-3">
                    <p className="font-medium">{recommendation.candidateName}</p>
                    <p className="text-xs text-muted-foreground">{recommendation.jobTitle} · referred by {recommendation.recommender}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{recommendation.rationale}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="bg-muted">{recommendation.status}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManageRecommendations}
                        onClick={() => updateRecommendationStatus(recommendation.id, "reviewed")}
                      >
                        Mark reviewed
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManageRecommendations}
                        onClick={() => updateRecommendationStatus(recommendation.id, "selected")}
                      >
                        Select
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManageRecommendations}
                        onClick={() => updateRecommendationStatus(recommendation.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {reviewItems.map((review) => (
                  <div key={review.id} className="rounded-md border bg-background p-3">
                    <p className="font-medium">{review.title}</p>
                    <p className="text-xs text-muted-foreground">{review.role} · {review.rating}/5 · {review.status}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{review.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManageReviews}
                        onClick={() => updateReviewStatus(review.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManageReviews}
                        onClick={() => updateReviewStatus(review.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface className="p-4 xl:col-span-2">
              <h2 className="text-base font-semibold">Role and permission matrix</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This mirrors the reference app behavior: role decides broad access; explicit permissions decide HR actions.
              </p>
              <div className="mt-4 overflow-x-auto rounded-md border">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">User</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      {Object.entries(permissionLabels).map(([permission, label]) => (
                        <th key={permission} className="px-3 py-2 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </td>
                        <td className="px-3 py-3">{roleLabel(user.role)}</td>
                        <td className="px-3 py-3"><Badge className="bg-muted">{user.verified ? user.status : "unverified"}</Badge></td>
                        {Object.keys(permissionLabels).map((permission) => (
                          <td key={permission} className="px-3 py-3">
                            {hasPermission(user, permission as PermissionFlag) ? (
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Allowed</Badge>
                            ) : (
                              <Badge className="bg-muted text-muted-foreground">Denied</Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          </div>
        ) : null}

        {activeTab === "audit" ? (
          <Surface className="p-4">
            <h2 className="text-base font-semibold">Audit log</h2>
            <p className="text-sm text-muted-foreground">Privileged actions are redacted, attributable, and filterable.</p>
            <div className="mt-4 overflow-x-auto rounded-md border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Resource</th>
                    <th className="px-3 py-2 font-medium">Outcome</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-3">{log.actor}<div className="text-xs text-muted-foreground">{log.actorRole}</div></td>
                      <td className="px-3 py-3">{log.action}</td>
                      <td className="px-3 py-3">{log.resource}</td>
                      <td className="px-3 py-3"><Badge className="bg-muted">{log.outcome}</Badge></td>
                      <td className="px-3 py-3">{formatDate(log.at, "dd MMM yyyy, HH:mm")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        ) : null}
      </section>
    </div>
  );
}
