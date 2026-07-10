"use client";

import { create } from "zustand";
import type { AdminRole, AdminCapability } from "@connectsphere/contracts";

export interface AdminUser {
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
}

interface AdminAuthState {
  user: AdminUser | null;
  loading: boolean;
  initialized: boolean;
  fetchSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  can: (capability: AdminCapability) => boolean;
}

// Mirror of @connectsphere/contracts adminCan, evaluated client-side for UI gating only.
// The server re-checks every mutation — this is purely for hiding controls.
const CAPS: Record<AdminRole, AdminCapability[]> = {
  super_admin: ["read", "workspaces", "billing", "operations", "system"],
  super_admin_support: ["read", "workspaces"],
  super_admin_finance: ["read", "billing"],
  super_admin_readonly: ["read"],
};

export const useAdminAuth = create<AdminAuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  fetchSession: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/admin/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, initialized: true, loading: false });
      } else {
        set({ user: null, initialized: true, loading: false });
      }
    } catch {
      set({ user: null, initialized: true, loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        set({ user: data.user, loading: false, initialized: true });
        return { ok: true };
      }
      set({ loading: false });
      return { ok: false, message: data.message || "Login failed" };
    } catch {
      set({ loading: false });
      return { ok: false, message: "Network error" };
    }
  },

  logout: async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
    set({ user: null });
    window.location.href = "/login";
  },

  can: (capability) => {
    const role = get().user?.role;
    if (!role) return false;
    return CAPS[role]?.includes(capability) ?? false;
  },
}));
