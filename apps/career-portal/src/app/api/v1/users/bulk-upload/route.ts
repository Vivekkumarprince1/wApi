import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdminArea, createManagedUser, emptyPermissions, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

const rowSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  department: z.string().trim().optional(),
  position: z.string().trim().optional(),
  manager: z.string().trim().optional(),
});

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
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageEmployees")) return forbidden();

  const contentType = request.headers.get("content-type") || "";
  let rows: unknown[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    rows = file instanceof File ? parseCsv(await file.text()) : [];
  } else {
    const body = await request.json().catch(() => null);
    rows = Array.isArray(body?.users) ? body.users : [];
  }

  const created = [];
  const failed = [];
  for (const row of rows) {
    const result = rowSchema.safeParse(row);
    if (!result.success) {
      failed.push({ row, error: "Invalid employee row." });
      continue;
    }

    try {
      created.push(createManagedUser({ ...result.data, role: "employee", permissions: emptyPermissions() }));
    } catch (error) {
      failed.push({ row: result.data, error: error instanceof Error ? error.message : "Could not import employee." });
    }
  }

  return NextResponse.json({ data: { created, failed, total: rows.length } }, { status: 201 });
}
