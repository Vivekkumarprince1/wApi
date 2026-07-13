"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, PermissionFlag } from "@/types/career";
import {
  canAccessAdminArea,
  defaultRouteForUser,
  hasPermission,
  isAdminUser,
  isEmployeeUser,
  isHRUser,
  isSuperAdminUser,
} from "@/lib/auth-client";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<{ user: AuthUser; redirectTo: string; requiresVerification: boolean }>;
  register: (input: { name: string; email: string; phone?: string; password: string }) => Promise<{ user: AuthUser; redirectTo: string; requiresVerification: boolean; otpHint?: string }>;
  verifyEmail: (input: { email: string; otp: string }) => Promise<{ user: AuthUser; redirectTo: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isEmployee: boolean;
  isHR: boolean;
  hasDashboardAccess: boolean;
  hasPermission: (permission: PermissionFlag) => boolean;
  defaultRoute: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Request failed.");
  }
  return payload.data as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await parseResponse<{ user: AuthUser }>(
        await fetch("/api/v1/auth/me", { cache: "no-store" })
      );
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login: AuthContextValue["login"] = async (input) => {
    const data = await parseResponse<{ user: AuthUser; redirectTo: string; requiresVerification: boolean }>(
      await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
    );
    setUser(data.user);
    return data;
  };

  const register: AuthContextValue["register"] = async (input) => {
    return parseResponse(
      await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
    );
  };

  const verifyEmail: AuthContextValue["verifyEmail"] = async (input) => {
    const data = await parseResponse<{ user: AuthUser; redirectTo: string }>(
      await fetch("/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
    );
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = isAdminUser(user);
    const isSuperAdmin = isSuperAdminUser(user);
    const isEmployee = isEmployeeUser(user);
    const isHR = isHRUser(user);
    return {
      user,
      loading,
      refresh,
      login,
      register,
      verifyEmail,
      logout,
      isAdmin,
      isSuperAdmin,
      isEmployee,
      isHR,
      hasDashboardAccess: canAccessAdminArea(user),
      hasPermission: (permission) => hasPermission(user, permission),
      defaultRoute: user ? defaultRouteForUser(user) : "/login",
    };
  }, [loading, refresh, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
