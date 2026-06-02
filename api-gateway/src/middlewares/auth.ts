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

/**
 * Fastify preHandler hook to perform stateless JWT validation.
 * Rejects with 401 if token is missing or invalid.
 */
export const authenticateGateway = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies['auth_token'] || request.headers.authorization?.split(' ')[1];

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authorization token is missing',
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (!decoded || !decoded.id) {
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
