import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  normalizeAdminRole,
  isAdminRole,
  adminCan,
  type AdminRole,
  type AdminCapability,
} from "@wapi/contracts";
import type { IUser } from "./db-models";
import { coreModels } from "./models";

/**
 * Admin authentication.
 *
 * Issues/verifies a dedicated `admin_token` cookie — entirely separate from
 * the customer portal's `auth_token`. Only the four platform-admin roles
 * (super_admin, super_admin_support, super_admin_finance, super_admin_readonly)
 * may authenticate here; customer workspace roles are rejected at login.
 *
 * Role logic is delegated to @wapi/contracts (single source of truth) — this
 * module never re-implements role checks.
 */

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "admin_token";
const SESSION_TTL = Number(process.env.ADMIN_SESSION_TTL || 28800); // 8h

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[admin-portal/auth] JWT_SECRET is not set");
  return secret;
}

/** Lean User shape returned from the shared model for login. */
type AdminUserLean = Pick<IUser, "name" | "email" | "passwordHash" | "role" | "status"> & {
  _id: unknown;
};

export interface AdminSession {
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  /** Random per-login id for audit/session tracking. */
  sid: string;
}

export interface AdminTokenPayload extends AdminSession {
  iat?: number;
  exp?: number;
}

/* ── Login ─────────────────────────────────────────────────────────────── */

export interface LoginResult {
  ok: boolean;
  status: number;
  message?: string;
  session?: AdminSession;
  token?: string;
}

/**
 * Verifies email + password against the core User collection and confirms the
 * user holds a platform-admin role. Returns a signed admin token on success.
 * Does NOT set the cookie — the route handler does that.
 */
export async function authenticateAdmin(
  email: string,
  password: string
): Promise<LoginResult> {
  if (!email || !password) {
    return { ok: false, status: 400, message: "Email and password are required" };
  }

  const { User } = await coreModels();
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select("passwordHash name email role status")
    .lean<AdminUserLean | null>();

  // Uniform failure to avoid user enumeration.
  const invalid: LoginResult = { ok: false, status: 401, message: "Invalid credentials" };

  if (!user || !user.passwordHash) return invalid;
  if (user.status && user.status === "removed") return invalid;

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return invalid;

  if (!isAdminRole(user.role)) {
    return { ok: false, status: 403, message: "This account is not authorized for the admin portal" };
  }

  const role = normalizeAdminRole(user.role) as AdminRole;
  const sid = randomId();
  const session: AdminSession = {
    userId: String(user._id),
    name: user.name || "",
    email: user.email || "",
    role,
    sid,
  };

  const token = jwt.sign(session, getJwtSecret(), { expiresIn: SESSION_TTL });
  return { ok: true, status: 200, session, token };
}

/* ── Token / cookie helpers ───────────────────────────────────────────── */

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AdminTokenPayload;
    if (!decoded || !isAdminRole(decoded.role)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Reads + verifies the admin session from the request cookie (server-side). */
export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/* ── Authorization guard for route handlers ───────────────────────────── */

export class AdminAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Enforces an authenticated admin session and (optionally) a capability.
 * Throws AdminAuthError (401/403) which route handlers translate to a response.
 */
export async function requireAdmin(capability?: AdminCapability): Promise<AdminTokenPayload> {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError(401, "Not authenticated");
  if (capability && !adminCan(session.role, capability)) {
    throw new AdminAuthError(403, `Your role (${session.role}) cannot perform "${capability}" actions`);
  }
  return session;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

function randomId(): string {
  // 16 random bytes hex — good enough for a session/audit correlation id.
  const bytes = new Uint8Array(16);
  (globalThis.crypto || require("crypto").webcrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
