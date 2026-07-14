import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { sendAccountEmail } from "@/lib/email/mailer";
import { apiErrorResponse } from "@/lib/http/api-error";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { verifyRecaptcha } from "@/lib/security/recaptcha";
import { contactSchema } from "@/modules/contact/schema";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, {
      namespace: "contact",
      limit: 5,
      windowMs: 15 * 60_000,
    });
    const body = await request.json().catch(() => null);
    await verifyRecaptcha(
      typeof body === "object" &&
        body !== null &&
        "recaptchaToken" in body &&
        typeof body.recaptchaToken === "string"
        ? body.recaptchaToken
        : null,
      "contact",
      request,
    );
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "Invalid contact request",
        },
        { status: 400 },
      );
    if (!env.EMAIL_REPLY_TO)
      return NextResponse.json(
        { message: "Contact email is not configured" },
        { status: 503 },
      );

    const { name, email, phone, company, message } = parsed.data;
    await sendAccountEmail({
      to: env.EMAIL_REPLY_TO,
      subject: `Career enquiry from ${name}`,
      heading: `New career enquiry from ${name}`,
      message: [
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : "",
        company ? `Company: ${company}` : "",
        "",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
      actionLabel: "Reply by email",
      actionUrl: `mailto:${email}`,
    });
    return NextResponse.json({
      message: "Your message has been sent successfully.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to send contact request");
  }
}
