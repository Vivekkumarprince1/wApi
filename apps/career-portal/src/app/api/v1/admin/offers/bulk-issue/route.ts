import { NextRequest, NextResponse } from "next/server";
import { issueOffer } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { offerIssueSchema } from "@/lib/validators";

function parseCsv(text: string) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/).filter(Boolean);
  if (!headerLine) return [];
  const headers = headerLine.split(",").map((header) => header.trim());
  return lines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canGenerateOfferLetter")) return forbidden();

  const contentType = request.headers.get("content-type") || "";
  let rows: unknown[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    rows = file instanceof File ? parseCsv(await file.text()) : [];
  } else {
    const body = await request.json().catch(() => null);
    rows = Array.isArray(body?.offers) ? body.offers : [];
  }

  const created = [];
  const failed = [];
  for (const row of rows) {
    const result = offerIssueSchema.safeParse(row);
    if (!result.success) {
      failed.push({ row, error: "Invalid offer row." });
      continue;
    }
    created.push(issueOffer(result.data, user.name));
  }

  return NextResponse.json({ data: { created, failed, total: rows.length } }, { status: 201 });
}
