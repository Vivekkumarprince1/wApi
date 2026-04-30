import { NextRequest, NextResponse } from "next/server";
import { WabaService } from "@/lib/services/messaging/waba-service";
import { PreflightPolicyService } from "@/lib/services/marketing/preflight-policy";
import { broadcastToWorkspace as socketBroadcast } from "@/lib/services/socket-emitter";
import axios from "axios";

const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || "your-service-secret";
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://localhost:3003";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-service-secret");
  if (secret !== INTERNAL_SERVICE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, data } = await req.json();

    switch (action) {
      case "send-template":
        const result = await WabaService.sendTemplateMessage(
          data.workspaceId,
          data.to,
          data.templateName,
          data.languageCode,
          data.components,
          data.options
        );
        return NextResponse.json(result);

      case "preflight-validate":
        const preflight = await PreflightPolicyService.validate(data.workspaceId, data.templateId, data.contactsCount);
        return NextResponse.json(preflight);

      case "socket-broadcast":
        socketBroadcast(data.workspaceId, data.event, data.payload);
        return NextResponse.json({ success: true });

      case "get-pricing":
        const response = await axios.get(`${BILLING_SERVICE_URL}/api/billing/wallets/${data.workspaceId}/pricing`, {
          params: { category: data.category }
        });
        return NextResponse.json({ cost: response.data.cost });

      case "get-template":
        const { Template } = await import("@/lib/models/template/Template");
        const template = await Template.findById(data.templateId).lean();
        return NextResponse.json({ template });

      case "get-contact":
        const { Contact } = await import("@/lib/models/messaging/Contact");
        const contact = await Contact.findById(data.contactId).lean();
        return NextResponse.json({ contact });

      case "query-contacts":
        const { Contact: QueryContact } = await import("@/lib/models/messaging/Contact");
        const contacts = await QueryContact.find(data.query).distinct('_id');
        return NextResponse.json({ contacts });
        
      case "count-contacts":
        const { Contact: CountContact } = await import("@/lib/models/messaging/Contact");
        const count = await CountContact.countDocuments(data.query);
        return NextResponse.json({ count });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[WorkerBridge] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
