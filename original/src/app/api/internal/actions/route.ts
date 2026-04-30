import { NextRequest, NextResponse } from 'next/server';
import { WabaService } from '@/lib/services/messaging/waba-service';
import { DealService } from '@/lib/services/commerce/deal-service';
import { ContactService } from '@/lib/services/messaging/contact-service';
import dbConnect from '@/lib/db';
import { Conversation } from '@/lib/models';

/**
 * INTERNAL ACTION ENDPOINT
 * This allows the Automation Microservice to trigger actions in the monolith
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-service-secret');
  
  if (secret !== process.env.INTERNAL_SERVICE_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const { type, payload } = await req.json();
    const { workspaceId, contactId, config } = payload;

    console.log(`[InternalAction] Executing ${type} for workspace ${workspaceId}`);

    switch (type) {
      case 'send_message':
        await WabaService.sendTextMessage(workspaceId, payload.phone, config.body, {
          contactId,
          conversationId: payload.conversationId
        });
        break;

      case 'send_template':
        await WabaService.sendTemplateMessage(
          workspaceId,
          payload.phone,
          config.templateName,
          config.languageCode || 'en_US',
          config.components || []
        );
        break;

      case 'create_deal':
        await DealService.createDeal(workspaceId, {
          contactId,
          title: config.title || 'New Deal from Automation',
          value: config.value || 0,
          stageId: config.stageId
        });
        break;

      case 'add_tag':
        await ContactService.addTag(workspaceId, contactId, config.tagId);
        break;

      case 'bot_escalation':
        if (payload.conversationId) {
          await Conversation.findByIdAndUpdate(payload.conversationId, {
            'botMetadata.isBotPaused': true,
            'botMetadata.lastBotInteractionAt': new Date()
          });
        }
        break;

      case 'update_metadata':
        if (payload.conversationId) {
          await Conversation.findByIdAndUpdate(payload.conversationId, {
            botMetadata: payload.metadata
          });
        }
        break;

      default:
        console.warn(`[InternalAction] Unknown action type: ${type}`);
        return NextResponse.json({ success: false, error: 'Unknown action type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[InternalAction] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
