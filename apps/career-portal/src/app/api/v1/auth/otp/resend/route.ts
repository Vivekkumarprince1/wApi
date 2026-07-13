import { NextResponse } from "next/server";
import { resendOtp } from "@/lib/auth-store";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  purpose: z.enum(["verify-email", "password-reset"]).default("verify-email"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (result.success) {
    resendOtp(result.data.email);
  }

  return NextResponse.json(
    {
      data: {
        accepted: true,
        otpHint: "123456",
      },
    },
    { status: 202 }
  );
}
