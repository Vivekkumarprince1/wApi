"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BriefcaseBusiness, ClipboardList, FileCheck2, Gauge, Home, LogOut, Mail, Menu, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { canAccessAdminArea, hasPermission, isSuperAdminUser, roleLabel } from "@/lib/auth-client";

type NavItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const publicNav: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/verify", label: "Verify certificate", icon: ShieldCheck },
  { href: "/verify-offer", label: "Verify offer", icon: FileCheck2 },
  { href: "/contact", label: "Contact", icon: Mail },
];

function navForUser(user: ReturnType<typeof useAuth>["user"]): NavItem[] {
  if (!user) return publicNav;
  if (!user.verified) return publicNav;

  const items: NavItem[] = [...publicNav];
  items.push({ href: "/notifications", label: "Notifications", icon: Bell });

  if (user.role === "user") {
    items.push({ href: "/my-applications", label: "My applications", icon: ClipboardList });
  }

  if (user.role === "employee" && !canAccessAdminArea(user)) {
    items.push(
      { href: "/employee/profile", label: "Profile", icon: UserRound },
      { href: "/reviews/submit", label: "Review", icon: FileCheck2 },
    );
  }

  if (canAccessAdminArea(user)) {
    items.push(
      { href: "/admin/dashboard", label: "HR console", icon: Gauge },
      { href: "/admin/applications", label: "Applications", icon: ClipboardList },
    );

    if (hasPermission(user, "canCreateJob")) {
      items.push({ href: "/jobs/create", label: "Create role", icon: BriefcaseBusiness });
    }

    if (hasPermission(user, "canGenerateCertificate") || hasPermission(user, "canGenerateOfferLetter")) {
      items.push({ href: "/certificates", label: "Credentials", icon: ShieldCheck });
    }

    if (hasPermission(user, "canManageEmployees")) {
      items.push({ href: "/admin/employees", label: "Employees", icon: Users });
      items.push({ href: "/admin/users", label: "Users", icon: UserRound });
    }

    if (isSuperAdminUser(user)) {
      items.push({ href: "/admin/manage-hr", label: "Manage HR", icon: ShieldCheck });
      items.push({ href: "/admin/audit-logs", label: "Audit", icon: FileCheck2 });
    }
  }

  return items;
}

function useUnreadNotificationCount(userEmail?: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userEmail) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    const loadUnreadCount = async () => {
      try {
        const response = await fetch("/api/v1/notifications/count", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok) {
          setUnreadCount(Number(payload?.data?.unread ?? payload?.data?.unreadCount ?? payload?.data?.count ?? 0));
        }
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };

    void loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userEmail]);

  return unreadCount;
}

function NotificationCountBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;

  return (
    <span
      className={
        floating
          ? "absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full border border-background bg-destructive px-1 text-[10px] font-semibold leading-4 text-white"
          : "inline-flex min-w-5 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-700"
      }
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SiteHeader() {
  const { user, loading, logout, defaultRoute } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = navForUser(loading ? null : user);
  const unreadCount = useUnreadNotificationCount(!loading && user?.verified ? user.email : undefined);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur">
      <div className="container-page flex min-h-14 items-center justify-between gap-2 md:gap-4">
        <Link href={user ? defaultRoute : "/"} className="flex min-w-0 items-center gap-2 font-semibold" onClick={closeMenu}>
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate text-sm min-[380px]:text-base">ConnectSphere Careers</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
              {item.href === "/notifications" ? <NotificationCountBadge count={unreadCount} /> : null}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <Button disabled variant="outline" className="hidden sm:inline-flex">Checking session</Button>
          ) : user ? (
            <>
              {user.verified ? (
                <Link
                  href="/notifications"
                  className="relative hidden min-h-9 items-center justify-center rounded-md border bg-card px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex lg:hidden"
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                >
                  <Bell className="size-4" aria-hidden="true" />
                  <NotificationCountBadge count={unreadCount} floating />
                </Link>
              ) : null}
              <Link href={defaultRoute} className="hidden rounded-md border bg-card px-3 py-2 text-sm sm:block">
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{roleLabel(user.role)}</span>
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  closeMenu();
                  logout().then(() => router.push("/login"));
                }}
                aria-label="Sign out"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="hidden min-[420px]:inline-flex">
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
      {menuOpen ? (
        <div className="border-t bg-card shadow-sm lg:hidden">
          <nav className="container-page grid gap-1 py-3" aria-label="Mobile primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {Icon ? <Icon className="size-4 shrink-0" aria-hidden={true} /> : null}
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.href === "/notifications" ? <NotificationCountBadge count={unreadCount} /> : null}
                </Link>
              );
            })}
            <div className="mt-2 border-t pt-3">
              {loading ? (
                <Button disabled variant="outline" className="w-full">Checking session</Button>
              ) : user ? (
                <div className="grid gap-2">
                  <Link
                    href={defaultRoute}
                    onClick={closeMenu}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block text-xs text-muted-foreground">{roleLabel(user.role)}</span>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      closeMenu();
                      logout().then(() => router.push("/login"));
                    }}
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    Logout
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <Link href="/login" onClick={closeMenu}>Login</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register" onClick={closeMenu}>Sign up</Link>
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const { user, loading } = useAuth();
  const navItems = navForUser(loading ? null : user);

  return (
    <footer className="border-t bg-card">
      <div className="container-page grid gap-6 py-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BriefcaseBusiness className="size-4" aria-hidden="true" />
            </span>
            ConnectSphere Careers
          </div>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            ConnectSphere hiring portal for open roles and candidate applications, with internal tools available after sign in.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{user ? "Your access" : "Public"}</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {Icon ? <Icon className="mr-1 inline size-3.5" aria-hidden={true} /> : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{user ? "Session" : "Account"}</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {user ? (
              <>
                <span>{user.name}</span>
                <span>{roleLabel(user.role)}</span>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-foreground">Login</Link>
                <Link href="/register" className="hover:text-foreground">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
