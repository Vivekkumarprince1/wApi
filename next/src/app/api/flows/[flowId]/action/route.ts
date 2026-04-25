import { NextRequest, NextResponse } from "next/server";
import { withFeature } from "@/lib/middlewares/auth";
import { GupshupPartnerService } from "@/lib/services/bsp/gupshup-partner-service";
import { WhatsAppFlow } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

// POST /api/flows/[flowId]/action
export const POST = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { params, workspace }) => {
  try {
    await dbConnect();
    const { flowId } = params;
    const body = await req.json();
    const { action, json, name, categories } = body;

    if (!action) {
      return NextResponse.json({ message: "Action is required" }, { status: 400 });
    }

    const flow = await WhatsAppFlow.findOne({ _id: flowId, workspace: workspace._id });
    if (!flow) {
      return NextResponse.json({ message: "Flow not found" }, { status: 404 });
    }

    if (!workspace.gupshupAppId) {
      return NextResponse.json({ message: "WhatsApp not configured for this workspace" }, { status: 400 });
    }

    const gFlowId = flow.gupshupFlowId;
    if (!gFlowId) {
      return NextResponse.json({ message: "Flow is not synced with BSP yet" }, { status: 400 });
    }

    let result: any = null;

    switch (action) {
      case 'updateJson':
        if (!json || !name) {
          return NextResponse.json({ message: "json and name are required for updateJson" }, { status: 400 });
        }
        result = await GupshupPartnerService.updateFlowJson(workspace.gupshupAppId, gFlowId, name, json);
        break;

      case 'updateCategories':
        if (!categories || !Array.isArray(categories)) {
          return NextResponse.json({ message: "categories array is required for updateCategories" }, { status: 400 });
        }
        result = await GupshupPartnerService.updateFlow(workspace.gupshupAppId, gFlowId, categories);
        flow.categories = categories;
        await flow.save();
        break;

      case 'preview':
        result = await GupshupPartnerService.getFlowPreviewUrl(workspace.gupshupAppId, gFlowId);
        if (result.data?.preview_url || result.preview_url) {
          flow.previewUrl = result.data?.preview_url || result.preview_url;
          await flow.save();
        }
        break;

      case 'publish':
        result = await GupshupPartnerService.publishFlow(workspace.gupshupAppId, gFlowId);
        flow.status = 'PUBLISHED';
        await flow.save();
        break;

      case 'deprecate':
        result = await GupshupPartnerService.deprecateFlow(workspace.gupshupAppId, gFlowId);
        flow.status = 'DEPRECATED';
        await flow.save();
        break;

      default:
        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ message: `Action ${action} executed successfully`, data: result, flow }, { status: 200 });
  } catch (error: any) {
    console.error(`Error executing flow action:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});
