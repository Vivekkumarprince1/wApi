import { NextResponse } from 'next/server';
import { WabaService } from '@/lib/services/messaging/waba-service';
import dbConnect from '@/lib/db-connect';
import { Workspace, Contact, Conversation } from '@/lib/models';

export async function GET(req: Request) {
  try {
    await dbConnect();
    
    // Extract query parameters for dynamic testing
    const { searchParams } = new URL(req.url);
    const targetPhone = searchParams.get('phone') || '919000000000'; // Default test phone
    const normPhone = targetPhone.replace(/\D/g, '');
    
    // Find any connected Workspace that's BSP Managed to mock the test
    const workspace = await Workspace.findOne({ bspManaged: true }).lean();
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No BSP managed workspace found' }, { status: 400 });
    }

    // 1. Force open a 24-hour session by mocking an inbound conversation
    let contact = await Contact.findOne({ workspace: workspace._id, phone: normPhone });
    if (!contact) {
      contact = await Contact.create({
        workspace: workspace._id,
        phone: normPhone,
        name: "Flow Test User",
        lastInboundAt: new Date()
      });
    } else {
      contact.lastInboundAt = new Date();
      await contact.save();
    }

    let conversation = await Conversation.findOne({ workspace: workspace._id, contact: contact._id, status: 'active' });
    if (!conversation) {
      conversation = await Conversation.create({
        workspace: workspace._id,
        contact: contact._id,
        status: 'active',
        lastMessageAt: new Date(),
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } else {
      conversation.lastMessageAt = new Date();
      conversation.windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await conversation.save();
    }

    // Mock interactive flow payload defined previously
    const flowPayload = {
      body: { text: "Please click below to start the interactive flow." },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: "TEST_TOKEN_123",
          flow_id: "test_flow_123",
          flow_cta: "Start Flow",
          flow_action: "navigate",
          flow_action_payload: {
            screen: "START_SCREEN"
          }
        }
      }
    };

    console.log(`[Test-Flow-Send] Attempting to dispatch flow to: ${targetPhone} on workspace ${workspace._id}`);

    // Execute the outbound Dispatch
    const result = await WabaService.sendFlowMessage(
      workspace._id.toString(),
      targetPhone,
      flowPayload,
      {
        contactId: contact._id.toString(),
        conversationId: conversation._id.toString(),
        metadata: { source: 'api-test' }
      }
    );

    return NextResponse.json({ 
      success: true, 
      workspaceId: workspace._id,
      targetPhone,
      gushupResponse: result 
    }, { status: 200 });

  } catch (error: any) {
    console.error("[Test-Flow-Send] Dispatch Failed:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error',
      details: error.result || {}
    }, { status: 500 });
  }
}
