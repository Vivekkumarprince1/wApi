import { NextRequest, NextResponse } from "next/server";
import { withFeature } from "@/lib/middlewares/auth";
import { GupshupPartnerService } from "@/lib/services/bsp/gupshup-partner-service";
import { WhatsAppFlow } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

// GET /api/flows -> List all flows
export const GET = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const flows = await WhatsAppFlow.find({ workspace: workspace._id }).sort({ createdAt: -1 });
    
    // Attempt to sync from Gupshup silently in the background or just return local
    // For now, returning local DB is faster. A separate sync endpoint or silent fetch could be used.
    
    return NextResponse.json({ flows }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching flows:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

// POST /api/flows -> Create a new Flow
export const POST = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { workspace, user }) => {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, categories } = body;

    if (!name || !categories || !Array.isArray(categories)) {
      return NextResponse.json({ message: "Name and categories array are required" }, { status: 400 });
    }

    if (!workspace.gupshupAppId) {
      return NextResponse.json({ message: "WhatsApp not configured for this workspace" }, { status: 400 });
    }

    // Call Gupshup API
    const response = await GupshupPartnerService.createFlow(workspace.gupshupAppId, name, categories);
    
    if (response.status !== 'success') {
      return NextResponse.json({ message: response.message || "Failed to create flow on BSP" }, { status: 400 });
    }

    const flowId = response.data?.id; // Assuming response format

    // Save to local DB
    const flow = await WhatsAppFlow.create({
      workspace: workspace._id,
      createdBy: user._id,
      name,
      categories,
      status: 'DRAFT',
      gupshupFlowId: flowId
    });

    return NextResponse.json({ flow, message: "Flow created successfully" }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating flow:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
