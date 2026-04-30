import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";

export const GET = withAuth(async (req: NextRequest, { params }) => {
  const { slug } = params as any;
  const path = slug ? slug.join('/') : '';

  // Generic mock response for template analytics
  return NextResponse.json({
    success: true,
    message: `Mock analytics data for ${path}`,
    data: {
      metrics: [
        { label: "Sent", value: 1000 },
        { label: "Delivered", value: 950 },
        { label: "Read", value: 800 },
        { label: "Clicked", value: 300 }
      ],
      items: [
        { id: "1", name: "Template A", performance: 85 },
        { id: "2", name: "Template B", performance: 45 }
      ]
    }
  });
});
