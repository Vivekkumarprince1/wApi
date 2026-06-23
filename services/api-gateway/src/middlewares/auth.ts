import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { normalizeRole } from '@wapi/contracts';

export interface GatewayUser {
  id: string;
  workspaceId?: string;
  role?: string;
  isImpersonating?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: GatewayUser;
  }
}

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    const value = parts[1]?.trim();
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
};

const getBearerToken = (authorization: string | undefined) =>
  authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;

async function resolveUserFromCoreSession(request: FastifyRequest, reply: FastifyReply) {
  const cookie = request.headers.cookie;
  const authorization = request.headers.authorization;
  if (!cookie && !authorization) return false;

  const response = await fetch(`${config.coreServerUrl}/api/v1/auth/session`, {
    method: 'GET',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
      'x-correlation-id':
        (request.headers['x-correlation-id'] as string) ||
        `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Core session validation failed',
    }));
    reply.status(response.status).send(body);
    return true;
  }

  const session = await response.json().catch(() => null);
  const userId = session?.user?.id || session?.user?._id;
  if (!session?.authenticated || !userId) return false;

  const sessionRole = session?.workspace?.role || session?.user?.role;
  request.user = {
    id: String(userId),
    workspaceId: session?.workspace?.id || session?.workspace?._id,
    role: sessionRole ? normalizeRole(sessionRole) : undefined,
    isImpersonating: !!session?.isImpersonating,
  };
  return true;
}

/**
 * Fastify preHandler hook to perform stateless JWT validation.
 * Rejects with 401 if token is missing or invalid.
 */
export const authenticateGateway = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies['auth_token'] || getBearerToken(request.headers.authorization);

    if (!token) {
      if (await resolveUserFromCoreSession(request, reply)) return;
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authorization token is missing',
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as any;
    } catch {
      if (await resolveUserFromCoreSession(request, reply)) return;
      throw new Error('Token validation failed');
    }

    if (!decoded || !decoded.id) {
      if (await resolveUserFromCoreSession(request, reply)) return;
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid token payload structure',
      });
    }

    // Attach stateless user payload to request. We normalize the role
    // through the canonical enum here so downstream services never see
    // alias drift like 'workspace_admin' or 'staff'. If the JWT didn't
    // carry a role at all, leave it undefined — the proxy layer will
    // skip the x-user-role header and the downstream service falls
    // back to its own default (typically 'agent'), preserving legacy
    // behaviour for old tokens.
    request.user = {
      id: decoded.id,
      workspaceId: decoded.workspaceId,
      role: decoded.role ? normalizeRole(decoded.role) : undefined,
      isImpersonating: !!decoded.isImpersonating,
    };
  } catch (err: any) {
    return reply.status(401).send({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token validation failed',
      details: err.message,
    });
  }
};
