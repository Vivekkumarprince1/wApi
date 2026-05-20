import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  workspace?: { _id: string; [key: string]: unknown };
  user?: { _id: string; [key: string]: unknown };
  role?: string;
}

@Injectable()
export class WorkspaceAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    // 1. Check for internal service credentials bypass
    const secret = request.headers['x-internal-secret'] || request.headers['x-internal-service-secret'];
    const service = request.headers['x-internal-service'];

    if (service && secret === config.internalServiceSecret) {
      const workspaceId = request.headers['x-workspace-id'] as string;
      const userId = request.headers['x-user-id'] as string;
      const role = request.headers['x-user-role'] as string;

      if (!workspaceId) {
        throw new UnauthorizedException('x-workspace-id header required for internal bypass');
      }

      request.user = userId ? { _id: userId } : undefined;
      request.workspace = { _id: workspaceId };
      request.role = role;
      return true;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-default-secret';

    try {
      const token = this.extractToken(request);
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const decoded = jwt.verify(token, jwtSecret) as any;

      if (!decoded.id && !decoded.workspaceId && !decoded.userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Attach to request for downstream handlers
      request.user = { _id: decoded.id || decoded.userId };
      request.workspace = { _id: decoded.workspaceId };
      request.role = decoded.role;

      return true;
    } catch (error: any) {
      throw new UnauthorizedException(`Authentication failed: ${error.message}`);
    }
  }

  private extractToken(request: AuthRequest): string | null {
    // Try Bearer token first
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Try cookie
    const cookies = request.cookies || {};
    if (cookies.auth_token) {
      return cookies.auth_token;
    }

    return null;
  }
}
