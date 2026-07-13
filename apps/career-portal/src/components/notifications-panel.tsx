"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  Info,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItem } from "@/types/career";
import { Badge, Button, EmptyState, Input, MetricTile, Select, Surface } from "@/components/ui";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type ReadFilter = "all" | "unread" | "read";
type TypeFilter = "all" | NotificationItem["type"];
type PriorityFilter = "all" | NotificationItem["priority"];

const PAGE_SIZE = 5;

const typeMeta: Record<
  NotificationItem["type"],
  {
    label: string;
    Icon: LucideIcon;
    tone: string;
    border: string;
  }
> = {
  "application-status": {
    label: "Application status",
    Icon: ClipboardCheck,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    border: "border-l-emerald-500",
  },
  "job-update": {
    label: "Job update",
    Icon: BriefcaseBusiness,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
    border: "border-l-sky-500",
  },
  system: {
    label: "System",
    Icon: Info,
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    border: "border-l-slate-400",
  },
};

const priorityMeta: Record<NotificationItem["priority"], { label: string; className: string }> = {
  high: { label: "High priority", className: "border-rose-200 bg-rose-50 text-rose-800" },
  normal: { label: "Medium", className: "border-amber-200 bg-amber-50 text-amber-800" },
  low: { label: "Low", className: "border-slate-200 bg-slate-50 text-slate-700" },
};

function getNotificationHref(notification: NotificationItem) {
  if (notification.actionUrl) return notification.actionUrl;
  if (notification.relatedApplicationId) return `/applications/${notification.relatedApplicationId}`;
  if (notification.relatedJobSlug) return `/apply/${notification.relatedJobSlug}`;
  return "";
}

function getNotificationActionLabel(notification: NotificationItem) {
  if (notification.type === "job-update") return "Review update";
  if (notification.relatedApplicationId) return "Open application";
  if (notification.actionUrl) return "Open";
  return "Mark read";
}

function diffItems(oldItems: string[] = [], newItems: string[] = []) {
  const oldSet = new Set(oldItems);
  const newSet = new Set(newItems);

  return {
    added: newItems.filter((item) => !oldSet.has(item)),
    removed: oldItems.filter((item) => !newSet.has(item)),
    unchanged: oldItems.filter((item) => newSet.has(item)),
  };
}

export function NotificationsPanel({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications],
  );

  const unread = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);
  const read = notifications.length - unread;
  const jobUpdates = useMemo(() => notifications.filter((notification) => notification.type === "job-update").length, [notifications]);
  const highPriority = useMemo(() => notifications.filter((notification) => notification.priority === "high").length, [notifications]);

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sortedNotifications.filter((notification) => {
      if (readFilter === "unread" && notification.read) return false;
      if (readFilter === "read" && !notification.read) return false;
      if (typeFilter !== "all" && notification.type !== typeFilter) return false;
      if (priorityFilter !== "all" && notification.priority !== priorityFilter) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        notification.title,
        notification.message,
        notification.relatedJobTitle,
        notification.relatedApplicationId,
        notification.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [priorityFilter, query, readFilter, sortedNotifications, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const visibleNotifications = filteredNotifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [priorityFilter, query, readFilter, typeFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const setPending = (id: string, value: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (value) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const markRead = async (id: string) => {
    const currentNotification = notifications.find((notification) => notification.id === id);
    if (!currentNotification || currentNotification.read) return currentNotification || null;

    setError("");
    setPending(id, true);
    const response = await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    const payload = await response.json().catch(() => null);
    setPending(id, false);

    if (!response.ok) {
      setError(payload?.error?.message || "Could not mark notification read.");
      return null;
    }

    const updatedNotification = (payload?.data || { ...currentNotification, read: true }) as NotificationItem;
    setNotifications((current) => current.map((item) => (item.id === id ? updatedNotification : item)));
    return updatedNotification;
  };

  const markAllRead = async () => {
    if (unread === 0) return;

    setError("");
    setBulkBusy(true);
    const response = await fetch("/api/v1/notifications/mark-all-read", { method: "PATCH" });
    const payload = await response.json().catch(() => null);
    setBulkBusy(false);

    if (!response.ok) {
      setError(payload?.error?.message || "Could not mark notifications read.");
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const removeNotification = async (id: string) => {
    const confirmed = window.confirm("Delete this notification?");
    if (!confirmed) return;

    setError("");
    setPending(id, true);
    const response = await fetch(`/api/v1/notifications/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    setPending(id, false);

    if (!response.ok) {
      setError(payload?.error?.message || "Could not delete notification.");
      return;
    }
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  const openNotification = async (notification: NotificationItem) => {
    const href = getNotificationHref(notification);
    const updatedNotification = await markRead(notification.id);
    if (!updatedNotification && !notification.read) return;

    if (href) {
      router.push(href);
    }
  };

  const filterTabs: Array<{ id: ReadFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unread },
    { id: "read", label: "Read", count: read },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Total" value={notifications.length} detail={`${read} read notifications`} icon={<Bell className="size-4" aria-hidden="true" />} />
        <MetricTile label="Unread" value={unread} detail={unread ? "Needs review" : "Inbox is clear"} icon={<CheckCheck className="size-4" aria-hidden="true" />} />
        <MetricTile label="Job updates" value={jobUpdates} detail="Role or application changes" icon={<BriefcaseBusiness className="size-4" aria-hidden="true" />} />
        <MetricTile label="High priority" value={highPriority} detail="Important hiring events" icon={<Info className="size-4" aria-hidden="true" />} />
      </div>

      <Surface className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">Notification triage</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter application, job-update, and employee-system notices, then open the related workflow.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={markAllRead} disabled={unread === 0 || bulkBusy}>
              <CheckCheck className="size-4" aria-hidden="true" />
              {bulkBusy ? "Updating..." : "Mark all read"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Read status filter">
            {filterTabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={readFilter === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setReadFilter(tab.id)}
                aria-pressed={readFilter === tab.id}
              >
                {tab.label}
                <span className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-foreground">{tab.count}</span>
              </Button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_170px]">
            <div className="space-y-1.5">
              <label htmlFor="notification-search" className="text-sm font-medium">
                Search notifications
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="notification-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, message, job, or application ID"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="notification-type" className="text-sm font-medium">
                Type
              </label>
              <Select id="notification-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
                <option value="all">All types</option>
                <option value="application-status">Application status</option>
                <option value="job-update">Job updates</option>
                <option value="system">System</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="notification-priority" className="text-sm font-medium">
                Priority
              </label>
              <Select id="notification-priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}>
                <option value="all">All priorities</option>
                <option value="high">High priority</option>
                <option value="normal">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
      </Surface>

      {filteredNotifications.length === 0 ? (
        <EmptyState
          title={notifications.length === 0 ? "No notifications yet" : "No notifications match these filters"}
          description={
            notifications.length === 0
              ? "Application updates, job changes, and employee review prompts will appear here."
              : "Adjust the read status, type, priority, or search term to find more notifications."
          }
          actionHref="/my-applications"
          actionLabel="View applications"
        />
      ) : (
        <Surface className="overflow-hidden">
          {visibleNotifications.map((notification) => (
            <NotificationRecord
              key={notification.id}
              notification={notification}
              expanded={expandedId === notification.id}
              pending={pendingIds.has(notification.id)}
              onOpen={() => openNotification(notification)}
              onMarkRead={() => markRead(notification.id)}
              onDelete={() => removeNotification(notification.id)}
              onToggleDetails={() => setExpandedId((current) => (current === notification.id ? null : notification.id))}
            />
          ))}
        </Surface>
      )}

      {filteredNotifications.length > PAGE_SIZE ? (
        <Surface className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredNotifications.length)} of {filteredNotifications.length}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>
            <span className="min-w-20 text-center text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}

function NotificationRecord({
  notification,
  expanded,
  pending,
  onOpen,
  onMarkRead,
  onDelete,
  onToggleDetails,
}: {
  notification: NotificationItem;
  expanded: boolean;
  pending: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onToggleDetails: () => void;
}) {
  const meta = typeMeta[notification.type];
  const Icon = meta.Icon;
  const href = getNotificationHref(notification);
  const hasDetails = notification.type === "job-update" && Boolean(notification.jobUpdateDetails);

  return (
    <article
      className={cn(
        "border-b border-l-4 p-4 transition-colors last:border-b-0 hover:bg-muted/30",
        notification.read ? "border-l-transparent" : meta.border,
        !notification.read && "bg-emerald-50/20",
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 gap-3">
          <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md border", meta.tone)}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="safe-text text-sm font-semibold sm:text-base">{notification.title}</h3>
              {!notification.read ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Unread</Badge> : null}
              <Badge className={meta.tone}>{meta.label}</Badge>
              <Badge className={priorityMeta[notification.priority].className}>{priorityMeta[notification.priority].label}</Badge>
            </div>

            <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{notification.message}</p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{timeAgo(notification.createdAt)}</span>
              <span aria-hidden="true">/</span>
              <span>{formatDate(notification.createdAt, "dd MMM yyyy, HH:mm")}</span>
              {notification.relatedJobTitle ? (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="safe-text">Job: {notification.relatedJobTitle}</span>
                </>
              ) : null}
              {notification.relatedApplicationId ? (
                <>
                  <span aria-hidden="true">/</span>
                  <span>Application: {notification.relatedApplicationId}</span>
                </>
              ) : null}
            </div>

            {hasDetails ? (
              <div className="mt-3">
                <Button type="button" variant="ghost" size="sm" onClick={onToggleDetails} aria-expanded={expanded}>
                  <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                  {expanded ? "Hide detailed changes" : "View detailed changes"}
                </Button>
                {expanded ? <JobUpdateDetails notification={notification} /> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button type="button" size="sm" onClick={onOpen} disabled={pending}>
            <ArrowUpRight className="size-4" aria-hidden="true" />
            {pending ? "Updating..." : getNotificationActionLabel(notification)}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onMarkRead} disabled={notification.read || pending}>
            <CheckCheck className="size-4" aria-hidden="true" />
            Read
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={pending} className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
          {!href ? <span className="sr-only">This notification has no related page.</span> : null}
        </div>
      </div>
    </article>
  );
}

function JobUpdateDetails({ notification }: { notification: NotificationItem }) {
  const details = notification.jobUpdateDetails;
  if (!details) return null;

  return (
    <div className="mt-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">What changed</h4>
        <Badge className="bg-muted">{details.updateType}</Badge>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {(details.updateType === "requirements" || details.updateType === "both") ? (
          <ChangeList title="Requirements" oldItems={details.oldRequirements} newItems={details.newRequirements} />
        ) : null}
        {(details.updateType === "responsibilities" || details.updateType === "both") ? (
          <ChangeList title="Responsibilities" oldItems={details.oldResponsibilities} newItems={details.newResponsibilities} />
        ) : null}
      </div>
      <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        Review the updated role, then refresh your application, skills, or portfolio if the new criteria affect your candidacy.
      </div>
    </div>
  );
}

function ChangeList({ title, oldItems, newItems }: { title: string; oldItems?: string[]; newItems?: string[] }) {
  const changes = diffItems(oldItems, newItems);
  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  if (!hasChanges) {
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <h5 className="text-sm font-medium">{title}</h5>
        <p className="mt-1 text-sm text-muted-foreground">No visible changes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <h5 className="text-sm font-medium">{title}</h5>
      <div className="mt-3 space-y-3">
        {changes.added.length ? <ChangeGroup label="Added" className="border-emerald-200 bg-emerald-50 text-emerald-900" items={changes.added} /> : null}
        {changes.removed.length ? <ChangeGroup label="Removed" className="border-rose-200 bg-rose-50 text-rose-900" items={changes.removed} /> : null}
        {changes.unchanged.length ? <ChangeGroup label="Still required" className="border-slate-200 bg-white text-slate-700" items={changes.unchanged.slice(0, 3)} /> : null}
      </div>
    </div>
  );
}

function ChangeGroup({ label, className, items }: { label: string; className: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <ul className="mt-1 grid gap-1.5">
        {items.map((item) => (
          <li key={item} className={cn("rounded-md border px-2 py-1.5 text-sm", className)}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
