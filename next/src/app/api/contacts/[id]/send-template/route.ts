import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Contact, Conversation } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { InboxService } from "@/lib/services/messaging/inbox-service";

/**
 * POST: Send a template message to a contact directly
 * /api/contacts/[id]/send-template
 */
export const POST = withAuth(async (req: NextRequest, { params, user, workspace }) => {
  try {
    const { id: contactId } = await params;
    const body = await req.json();
    const { templateName, languageCode, variables } = body;

    if (!templateName) {
      return NextResponse.json({ success: false, message: "Template name is required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Verify contact exists and belongs to workspace
    const contact = await Contact.findOne({
      _id: contactId,
      workspace: workspace._id
    });

    if (!contact) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    // 2. Find or Create conversation
    let conversation = await Conversation.findOne({
      workspace: workspace._id,
      contact: contactId
    });

    if (!conversation) {
      conversation = await Conversation.create({
        workspace: workspace._id,
        contact: contactId,
        status: 'open',
        isOpen: true,
        lastInboundAt: undefined,
        lastActivityAt: new Date(),
        channel: 'whatsapp' // Default to whatsapp for templates
      });
    }

    // 3. Send template via InboxService
    console.log(`[DirectSend] Dispatching template ${templateName} to conversation ${conversation._id}`);
    const result = await InboxService.sendTemplateMessage({
      workspaceId: workspace._id,
      conversationId: conversation._id,
      agentId: user._id,
      templateName,
      languageCode: languageCode || 'en',
      variables: variables || []
    });

    if (!result.success) {
      console.warn(`[DirectSend] Template dispatch failed:`, result.result?.error);
      return NextResponse.json({ 
        success: false, 
        message: result.result?.error || "Failed to send template message" 
      }, { status: 400 });
    }

    console.log(`[DirectSend] Successfully dispatched template.`, {
      providerMessageId: (result.result as any)?.messageId || result.message?.whatsappMessageId || null,
      providerResponse: (result.result as any)?.data || null
    });

    return NextResponse.json({
      success: true,
      data: result.message,
      conversationId: conversation._id,
      providerMessageId: (result.result as any)?.messageId || result.message?.whatsappMessageId || null,
      providerResponse: (result.result as any)?.data || null
    });

  } catch (err: any) {
    console.error("[Direct Template Send Error]:", err.message);

    if (typeof err.message === 'string' && (
      err.message.includes('MARKETING_COLD_CONTACT_BLOCKED') ||
      err.message.includes('SELF_SEND_NOT_ALLOWED') ||
      err.message.includes('TEMPLATE_NOT_APPROVED') ||
      err.message.includes('TEMPLATE_NOT_FOUND')
    )) {
      return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    }

    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
