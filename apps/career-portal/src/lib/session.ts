import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthUser, SessionPayload } from "@/types/career";
import { findAuthUserById, sanitizeUser } from "@/lib/auth-store";

export const SESSION_COOKIE = "career_session";
const SESSION_SECONDS = 60 * 60 * 24;

const secret = process.env.CAREER_AUTH_SECRET || "connectsphere-career-demo-secret";

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(user: AuthUser) {
  const payload: SessionPayload = {
    userId: user.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const user = findAuthUserById(payload.userId);
    if (!user || user.status === "suspended") return null;
    return sanitizeUser(user);
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_SECONDS,
};
