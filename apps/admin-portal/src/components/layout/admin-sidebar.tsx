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
  LogOut,
  ScrollText,
  Sliders,
  Database,
  MessageSquare,
  Smartphone,
  GitCompareArrows,
  ShieldCheck,
} from "lucide-react";
import type { AdminCapability } from "@wapi/contracts";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/store/admin-auth-store";
import { BrandMark } from "@/components/layout/brand-mark";

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
  const initials = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar/95 shadow-[1px_0_0_rgba(255,255,255,0.35)_inset] backdrop-blur-xl">
      <div className="border-b border-sidebar-border/70 p-4">
        <Link href="/" className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark />
        </Link>
        <div className="mt-4 rounded-xl border border-sidebar-border/70 bg-background/60 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Control Plane</p>
              <p className="mt-0.5 text-sm font-semibold leading-tight">Platform operations</p>
            </div>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.75)]" />
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-1">
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
                      "group relative flex h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-all duration-300",
                      active
                        ? "bg-primary/10 font-bold text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" aria-hidden />
                    )}
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        active ? "bg-primary/10 text-primary" : "bg-transparent text-muted-foreground group-hover:bg-background/70 group-hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="truncate tracking-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/70 p-3">
        <div className="rounded-xl border border-sidebar-border/70 bg-background/60 p-2 shadow-sm">
          <div className="flex items-center gap-2.5 px-1 pb-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold uppercase text-primary ring-1 ring-primary/15">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" title={user?.name || user?.email}>
                {user?.name || user?.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">{formatRole(user?.role)}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
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
