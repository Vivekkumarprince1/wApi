"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Server,
  CreditCard,
  Settings2,
  BarChart3,
  ShieldCheck,
  LogOut,
  ScrollText,
  Sliders,
  Database,
  MessageSquare,
  Smartphone,
  GitCompareArrows,
} from "lucide-react";
import type { AdminCapability } from "@wapi/contracts";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/store/admin-auth-store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  cap: AdminCapability;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, cap: "read" },
      { href: "/workspaces", label: "Workspaces", icon: Building2, cap: "workspaces" },
      { href: "/users", label: "User Directory", icon: Users, cap: "workspaces" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/billing", label: "Billing & Plans", icon: CreditCard, cap: "billing" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, cap: "read" },
    ],
  },
  {
    label: "BSP / Messaging",
    items: [
      { href: "/gupshup", label: "BSP Providers", icon: MessageSquare, cap: "operations" },
      { href: "/whatsapp-requests", label: "WhatsApp Requests", icon: Smartphone, cap: "operations" },
      { href: "/operations", label: "Operations", icon: Settings2, cap: "operations" },
    ],
  },
  {
    label: "Infrastructure & Security",
    items: [
      { href: "/monitoring", label: "Infrastructure", icon: Server, cap: "read" },
      { href: "/data-explorer", label: "Data Explorer", icon: Database, cap: "system" },
      { href: "/entitlement-drift", label: "Entitlement Drift", icon: GitCompareArrows, cap: "read" },
      { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, cap: "read" },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, cap: "read" },
      { href: "/settings", label: "Settings", icon: Sliders, cap: "system" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminSidebar() {
  const pathname = usePathname();
  const user = useAdminAuth((s) => s.user);
  const can = useAdminAuth((s) => s.can);
  const logout = useAdminAuth((s) => s.logout);

  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(i.cap)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <ShieldCheck className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">wApi</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">Super Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-1 pb-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
            {(user?.name || user?.email || "?").charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={user?.name || user?.email}>
              {user?.name || user?.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{formatRole(user?.role)}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function formatRole(role?: string): string {
  if (!role) return "";
  if (role === "super_admin") return "Super Admin";
  return (
    role
      .replace(/^super_admin_?/, "")
      .replace(/_/g, " ")
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase()) || "Super Admin"
  );
}
