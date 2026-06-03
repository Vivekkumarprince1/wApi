"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

/**
 * Sticky page header / top bar. Shows a small breadcrumb (Super Admin ›
 * Section), the page title + optional description, any page-provided actions,
 * and the always-present theme toggle on the far right.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumb = sectionLabel(pathname);

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between gap-4 px-6 py-3 min-h-16">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <span>Super Admin</span>
            {crumb ? (
              <>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-foreground/70">{crumb}</span>
              </>
            ) : null}
          </nav>
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="truncate text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <div className="h-5 w-px bg-border" aria-hidden />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function sectionLabel(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;
  const seg = pathname.split("/").filter(Boolean)[0] || "";
  const map: Record<string, string> = {
    workspaces: "Workspaces",
    users: "User Directory",
    billing: "Billing & Plans",
    analytics: "Analytics",
    gupshup: "BSP Providers",
    "whatsapp-requests": "WhatsApp Requests",
    operations: "Operations",
    "data-explorer": "Data Explorer",
    monitoring: "Infrastructure",
    "entitlement-drift": "Entitlement Drift",
    "audit-logs": "Audit Logs",
    compliance: "Compliance",
    settings: "Settings",
  };
  return map[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
