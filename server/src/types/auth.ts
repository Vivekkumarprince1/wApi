/**
 * SHARED AUTH TYPES
 * Strongly-typed interfaces for authentication context used across all middleware and handlers.
 */

import { Types } from 'mongoose';

/**
 * Authenticated user object (populated from DB, minus passwordHash)
 */
export interface IAuthUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: string;
  status?: string;
  workspace?: Types.ObjectId;
  activeWorkspace?: Types.ObjectId;
  phone?: string;
}

/**
 * Workspace object populated with plan
 */
export interface IAuthWorkspace {
  _id: Types.ObjectId;
  name: string;
  plan?: IAuthPlan | Types.ObjectId;
  billingStatus?: string;
  subscription?: { status?: string };
  usage?: Record<string, number>;
  features?: string[];
  inboxSettings?: {
    autoAssignmentEnabled?: boolean;
    [key: string]: any;
  };
  settings?: Record<string, any>;
  gupshupAppId?: string;
  phoneNumberId?: string;
  gupshupIdentity?: {
    partnerAppId?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Subscription plan
 */
export interface IAuthPlan {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  features: string[];
  limits: {
    maxMessagesPerMonth?: number;
    maxContacts?: number;
    maxAutomations?: number;
    maxTemplates?: number;
    [key: string]: number | undefined;
  };
  billingIntervalMonths?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

/**
 * Permission record linking user to workspace
 */
export interface IAuthPermission {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  workspace: Types.ObjectId;
  role: string;
  permissions: string[];
  isActive: boolean;
}

/**
 * Context passed to authenticated route handlers
 */
export interface IAuthContext {
  params: Record<string, string>;
  user: IAuthUser;
  workspace: IAuthWorkspace | null;
  isImpersonating?: boolean;
  permissions: string[] | null;
  role: string | null;
}

/**
 * Authenticated handler function signature
 */
export type AuthenticatedHandler = (
  req: import('next/server').NextRequest,
  context: IAuthContext
) => Promise<import('next/server').NextResponse | Response> | import('next/server').NextResponse | Response;
