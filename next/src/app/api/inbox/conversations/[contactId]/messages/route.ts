/**
 * API: /api/inbox/conversations/[contactId]/messages
 * Port of legacy conversationController.getMessageThread & messageController.sendMessage
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Message, Conversation, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { withPlanGate } from "@/lib/middlewares/plan-gate";

/**
 * GET: Fetch message history for a specific contact
 */
export const GET = withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { contactId } = params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    await dbConnect();

    const messages = await Message.find({
      workspace: workspace._id,
      contact: contactId,
      isInternalNote: false
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const total = await Message.countDocuments({
      workspace: workspace._id,
      contact: contactId,
      isInternalNote: false
    });

    // Return reversed for chronological order in UI
    return NextResponse.json({
      success: true,
      messages: messages.reverse(),
      total
    });
  } catch (err: any) {
    console.error("[Message Thread API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

/**
 * POST: Send a message to a contact
 */
export const POST = withAuth(withPlanGate('messages')(async (req: NextRequest, { params, user, workspace }: { params: any, user: any, workspace: any }) => {
  try {
    const { contactId } = params;
    const { body, isInternalNote, type = 'text', templateId, media, template } = await req.json();

    if (!body && type === 'text') {
      return NextResponse.json({ message: "Message body is required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Resolve Contact
    const contact = await Contact.findOne({ _id: contactId, workspace: workspace._id });
    if (!contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 });
    }

    const conversation = await Conversation.findOne({ workspace: workspace._id, contact: contact._id });
    if (!conversation) {
      return NextResponse.json({ message: "Conversation not found" }, { status: 404 });
    }

    const { InboxService } = await import("@/lib/services/messaging/inbox-service");

    if (isInternalNote) {
      const newMessage = await Message.create({
        workspace: workspace._id,
        conversation: conversation._id,
        contact: conversation.contact,
        direction: 'outbound',
        type: 'note',
        body,
        isInternalNote: true,
        sentBy: user._id,
        status: 'received',
        sentAt: new Date(),
      });

      await Conversation.findByIdAndUpdate(conversation._id, {
        $set: {
          lastMessageAt: new Date(),
          lastMessagePreview: body.substring(0, 100),
          lastMessageDirection: 'outbound',
          lastMessageType: 'note',
          lastActivityAt: new Date(),
        }
      });

      return NextResponse.json({ success: true, message: "Internal note added", data: newMessage });
    }

    if (type === 'template' && template) {
      const result = await InboxService.sendTemplateMessage({
        workspaceId: workspace._id,
        conversationId: conversation._id,
        agentId: user._id,
        templateName: template.name,
        languageCode: template.language || 'en',
        variables: template.variables || []
      });

      return NextResponse.json({
        success: true,
        message: "Template sent",
        data: result.message
      });
    }

    if (['image', 'video', 'audio', 'document', 'sticker'].includes(type) && media?.url) {
      const result = await InboxService.sendMediaMessage({
        workspaceId: workspace._id,
        conversationId: conversation._id,
        agentId: user._id,
        type: type as any,
        mediaUrl: media.url,
        mimeType: media.mimeType,
        caption: media.caption || body,
        filename: media.filename
      });

      return NextResponse.json({
        success: true,
        message: "Media sent",
        data: result.message
      });
    }

    const result = await InboxService.sendTextMessage({
      workspaceId: workspace._id,
      conversationId: conversation._id,
      agentId: user._id,
      text: body
    });

    return NextResponse.json({
      success: true,
      message: "Message sent",
      data: result.message
    });
  } catch (err: any) {
    console.error("[Send Message API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));
