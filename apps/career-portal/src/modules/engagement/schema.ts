import {
  AlertFrequency,
  AnalyticsEventName,
  EmploymentType,
} from "@prisma/client";
import { z } from "zod";

export const jobAlertSchema = z.object({
  jobId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  query: z.string().trim().max(100).optional(),
  locations: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  departments: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  employmentTypes: z.array(z.enum(EmploymentType)).max(10).default([]),
  frequency: z.enum(AlertFrequency).default(AlertFrequency.WEEKLY),
});

export const applicationDraftSchema = z.object({
  jobId: z.string().regex(/^[a-f\d]{24}$/i),
  payload: z.record(z.string(), z.unknown()),
  currentStep: z.number().int().min(0).max(20).default(0),
});

export const talentCommunitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  interests: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  locations: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  consentVersion: z.string().trim().min(1).max(40),
  consentAccepted: z.literal(true),
});

export const analyticsEventSchema = z.object({
  name: z.enum(AnalyticsEventName),
  anonymousId: z.string().trim().max(100).optional(),
  jobId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  applicationId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  sessionId: z.string().trim().max(100).optional(),
  source: z.string().trim().max(120).optional(),
  medium: z.string().trim().max(120).optional(),
  campaign: z.string().trim().max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
