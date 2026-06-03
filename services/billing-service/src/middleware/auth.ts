import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { isPlatformAdmin, normalizeRole, Roles } from '@wapi/contracts';

const JWT_SECRET = config.jwtSecret;
const INTERNAL_SECRET = config.internalServiceSecret;

/** sha-256 prefix of the secret — for debug logs only, never the secret itself. */
function secretFingerprint(s: string | undefined): string {
  if (!s) return 'empty';
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
}

function safeEqualSecret(provided: string | undefined): boolean {
  if (!provided || !INTERNAL_SECRET) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(INTERNAL_SECRET, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Track whether we've already warned about a fingerprint mismatch for a
// given upstream secret. Without this dedupe the log line fires every
// single request and drowns the actual auth signal.
const warnedFingerprints = new Set<string>();

function warnSecretMismatch(req: Request, provided: string | undefined) {
  const providedFp = secretFingerprint(provided);
  const expectedFp = secretFingerprint(INTERNAL_SECRET);
  const key = `${providedFp}->${expectedFp}`;
  if (warnedFingerprints.has(key)) return;
  warnedFingerprints.add(key);
  console.warn(
    `[Billing Auth] x-internal-service-secret mismatch on ${req.method} ${req.originalUrl}: ` +
      `provided=${providedFp} expected=${expectedFp}. Check INTERNAL_SERVICE_SECRET in both .env files.`
  );
}

// The startup check is handled by the config module, but we double-check here
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required for billing-service.');
  process.exit(1);
}

export interface AuthRequest extends Request {
  user?: any;
  workspace?: any;
  role?: string;
  permissions?: string[];
}

/**
 * Middleware to handle authentication.
 * Supports both Gateway Headers and Direct JWT.
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Check for Gateway Headers - ONLY trusted if internal secret matches
  const internalSecret = req.header('x-internal-service-secret');
  const gatewayUserId = req.header('x-user-id');
  const gatewayWorkspaceId = req.header('x-workspace-id');
  const gatewayRole = req.header('x-user-role');

  if (safeEqualSecret(internalSecret) && gatewayUserId) {
    // 'system' is a marker for internal service callers, not a user
    // role. Preserve it as-is so commerce controller's
    // `req.role === 'system'` checks still work.
    const canonicalRole = gatewayRole === 'system' ? 'system' : normalizeRole(gatewayRole, Roles.Agent);
    req.user = {
      id: gatewayUserId,
      _id: gatewayUserId,
      role: canonicalRole,
    };
    req.role = canonicalRole;

    if (gatewayWorkspaceId) {
      req.workspace = {
        id: gatewayWorkspaceId,
        _id: gatewayWorkspaceId
      };
    }
    return next();
  }

  // Diagnostic: surface secret drift loudly in dev so config issues
  // don't masquerade as billing bugs. Only fires when something looks
  // like a gateway call (we have user-id but the secret didn't match).
  if (internalSecret && gatewayUserId) {
    warnSecretMismatch(req, internalSecret);
  }

  // 2. Fallback: Direct JWT
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: 'Authorization denied: No token or headers provided' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const canonicalRole = normalizeRole(decoded.role, Roles.Agent);
    req.user = {
      id: decoded.id,
      _id: decoded.id,
      role: canonicalRole,
    };
    req.role = canonicalRole;

    if (decoded.workspaceId) {
      req.workspace = {
        id: decoded.workspaceId,
        _id: decoded.workspaceId
      };
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Middleware for secure inter-service communication. Uses constant-time
 * compare so the secret can't be probed via timing.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const provided = req.header('x-internal-service-secret');
  if (!safeEqualSecret(provided)) {
    warnSecretMismatch(req, provided);
    return res.status(401).json({ message: 'Unauthorized: Internal service secret missing or invalid' });
  }
  next();
};

/**
 * Middleware for endpoints that are used by both the gateway and internal services.
 */
export const authenticateOrInternal = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (safeEqualSecret(req.header('x-internal-service-secret'))) {
    req.user = { id: 'internal-service', _id: 'internal-service', role: 'system' };
    req.role = 'system';
    const workspaceParam = req.params.workspaceId;
    const workspaceId = (Array.isArray(workspaceParam) ? workspaceParam[0] : workspaceParam) || req.header('x-workspace-id');
    if (workspaceId) {
      req.workspace = { id: workspaceId, _id: workspaceId };
    }
    return next();
  }

  return authenticate(req, res, next);
};

/**
 * Middleware to restrict access by role. Compares against the canonical
 * role enum, so the legacy 'admin' string is treated as workspace admin
 * (not super admin) and aliases like 'superadmin' / 'staff' map back to
 * super_admin.
 */
export const authorize = (roles: string[]) => {
  const allowed = new Set(roles.map((r) => normalizeRole(r)));
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ message: 'Permission denied: You do not have the required role' });
    }
    const current = normalizeRole(req.user.role);
    if (!allowed.has(current)) {
      return res.status(403).json({
        message: 'Permission denied: You do not have the required role',
      });
    }
    next();
  };
};

/**
 * Convenience middleware for platform-admin-only endpoints. Accepts the
 * canonical `super_admin` role and its documented aliases (`staff`,
 * `superadmin`, …) — never the legacy workspace `admin`.
 */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!isPlatformAdmin(req.user?.role)) {
    return res.status(403).json({
      message: 'Permission denied: super_admin required',
    });
  }
  next();
};
