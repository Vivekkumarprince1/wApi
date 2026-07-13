import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { twMerge } from "tailwind-merge";
import type { ApplicationStatus, CredentialStatus, OfferStatus } from "@/types/career";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(value: string, pattern = "dd MMM yyyy") {
  return format(new Date(value), pattern);
}

export function timeAgo(value: string) {
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function statusLabel(status: ApplicationStatus | OfferStatus | CredentialStatus) {
  return status
    .split("_")
    .join(" ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function statusClassName(status: ApplicationStatus | OfferStatus | CredentialStatus) {
  const classes: Record<string, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    reviewing: "border-sky-200 bg-sky-50 text-sky-800",
    shortlisted: "border-indigo-200 bg-indigo-50 text-indigo-800",
    offered: "border-emerald-200 bg-emerald-50 text-emerald-800",
    hired: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    issued: "border-sky-200 bg-sky-50 text-sky-800",
    accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
    expired: "border-slate-200 bg-slate-50 text-slate-700",
    cancelled: "border-rose-200 bg-rose-50 text-rose-800",
    valid: "border-emerald-200 bg-emerald-50 text-emerald-800",
    revoked: "border-rose-200 bg-rose-50 text-rose-800",
    not_found: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return classes[status] || "border-slate-200 bg-slate-50 text-slate-700";
}

export function applicationReference() {
  const token = Math.random().toString(16).slice(2, 6).toUpperCase();
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `APP-${date}-${token}`;
}

export function numberFormatter(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}
