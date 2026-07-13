import { NextResponse } from "next/server";
import { contractDocumentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let payload: unknown = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("document") || formData.get("file");
    payload = {
      documentType: formData.get("documentType") || "supporting-document",
      fileName: file instanceof File ? file.name : formData.get("fileName"),
    };
  } else {
    payload = await request.json().catch(() => null);
  }

  const result = contractDocumentSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Attach a valid document.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    data: {
      id: `doc_${crypto.randomUUID()}`,
      type: result.data.documentType,
      fileName: result.data.fileName,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/contracts/${encodeURIComponent(result.data.fileName)}`,
    },
  });
}
