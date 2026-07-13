import { NextResponse } from "next/server";
import { uploadContractDocument } from "@/lib/career-store";
import { contractDocumentSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
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

  try {
    const { contractId } = await params;
    return NextResponse.json({ data: uploadContractDocument(contractId, result.data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Contract not found." } },
      { status: 404 },
    );
  }
}
