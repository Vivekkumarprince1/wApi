"use client";

import { useEffect } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { useAdminAuth, type AdminUser } from "@/store/admin-auth-store";

/**
 * Client shell for the authenticated admin area. Seeds the auth store from the
 * server-resolved session so the sidebar can gate nav items by capability
 * without a flash, then keeps it in sync.
 */
export function AdminShell({
  initialUser,
  children,
}: {
  initialUser: AdminUser;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Seed once from the server session; refresh in the background.
    useAdminAuth.setState({ user: initialUser, initialized: true });
    useAdminAuth.getState().fetchSession();
  }, [initialUser]);

  return (
    <div className="admin-surface flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar />
      <main id="main" className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  );
}
