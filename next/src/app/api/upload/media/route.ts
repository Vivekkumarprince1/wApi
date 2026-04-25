import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { withAuth } from "@/lib/middlewares/auth";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
    const mimeType = file.type || '';
    if (mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      resourceType = 'video';
    } else {
      resourceType = 'raw';
    }

    const result = await uploadBufferToCloudinary(
      buffer, 
      resourceType, 
      (formData.get("folder") as string) || "whatsapp_templates",
      { originalFilename: file.name }
    );

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      filename: file.name,
      mimeType: mimeType
    });
  } catch (error: any) {
    console.error("[UPLOAD] Media upload error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload media", error: error.message },
      { status: 500 }
    );
  }
});
