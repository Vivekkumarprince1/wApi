import { NextRequest, NextResponse } from "next/server";
import { withFeature } from "@/lib/middlewares/auth";
import { GupshupPartnerService } from "@/lib/services/bsp/gupshup-partner-service";
import { WhatsAppFlow } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

// GET /api/flows/[flowId] -> Get flow details & JSON
export const GET = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { params, workspace }) => {
  try {
    await dbConnect();
    const { flowId } = params;

    const flow = await WhatsAppFlow.findOne({ _id: flowId, workspace: workspace._id });
    if (!flow) {
      return NextResponse.json({ message: "Flow not found" }, { status: 404 });
    }

    if (!workspace.gupshupAppId) {
      return NextResponse.json({ message: "WhatsApp not configured for this workspace" }, { status: 400 });
    }

    // Try to get JSON from BSP if we have a gupshup flow ID
    let flowJson = null;
    let bspDetails = null;

    if (flow.gupshupFlowId) {
      try {
        const jsonRes = await GupshupPartnerService.getFlowJson(workspace.gupshupAppId, flow.gupshupFlowId);
        flowJson = jsonRes.data || jsonRes;
        
        const detailsRes = await GupshupPartnerService.getFlowById(workspace.gupshupAppId, flow.gupshupFlowId);
        bspDetails = detailsRes.data || detailsRes;
      } catch (err: any) {
        console.warn("Could not fetch BSP flow details:", err.message);
      }
    }

    return NextResponse.json({ flow, flowJson, bspDetails }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching flow details:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

// DELETE /api/flows/[flowId] -> Delete flow
export const DELETE = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { params, workspace }) => {
  try {
    await dbConnect();
    const { flowId } = params;

    const flow = await WhatsAppFlow.findOne({ _id: flowId, workspace: workspace._id });
    if (!flow) {
      return NextResponse.json({ message: "Flow not found" }, { status: 404 });
    }

    if (flow.gupshupFlowId && workspace.gupshupAppId) {
      try {
        await GupshupPartnerService.deleteFlow(workspace.gupshupAppId, flow.gupshupFlowId);
      } catch (err: any) {
        console.warn("Failed to delete flow on BSP, continuing to delete locally:", err.message);
      }
    }

    await WhatsAppFlow.deleteOne({ _id: flowId });

    return NextResponse.json({ message: "Flow deleted successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting flow:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
