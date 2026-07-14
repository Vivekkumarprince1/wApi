"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";

import type { auth } from "@/lib/auth/auth";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({ twoFactorPage: "/two-factor" }),
    inferAdditionalFields<typeof auth>(),
  ],
});
