import { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

export const applicationStatusInputSchema = z.object({
  status: z.enum(ApplicationStatus),
});

export type ApplicationStatusInput = z.infer<
  typeof applicationStatusInputSchema
>;

export const applicationEmailActionSchema = z.object({
  action: z.enum(["rejection", "welcome"]),
  message: z.string().trim().max(2_000).optional(),
});
