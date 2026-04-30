/**
 * API: /api/inbox/[id]/read
 * Port of legacy inboxController.markRead
 * Marks a conversation as read for the current agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Conversation, Message } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { GupshupService } from "@/lib/services/messaging/gupshup-service";
import { getIO } from "@/lib/services/socket-bridge";

export const POST = withAuth(async (req: NextRequest, { params, user, workspace }) => {
  try {
    // Explicitly consume the body to prevent 'disturbed or locked' stream errors
    await req.json().catch(() => ({}));
    
    const { id: conversationId } = await params;
    await dbConnect();

    // 1. Find the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspace._id
    });

    if (!conversation) {
      return NextResponse.json({ 
        success: false, 
        message: "Conversation not found" 
      }, { status: 404 });
    }

    // 2. Mark as read for this agent
    // Reset global unreadCount and per-agent counts via model method
    (conversation as any).markReadForAgent(user._id);
    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`workspace:${workspace._id}`).emit('inbox:conversation_updated', {
        conversationId: conversation._id,
        action: 'read',
        updatedBy: { _id: user._id, name: user.name },
        unreadCount: 0,
        conversation: conversation.toObject()
      });
    }

    // 3. Sync "Read" status to WhatsApp (Gupshup V3)
    // Find the latest inbound message that has a provider ID to mark it as read on their side
    const lastInbound = await Message.findOne({
      conversation: conversation._id,
      direction: 'inbound',
      whatsappMessageId: { $ne: null }
    }).sort({ createdAt: -1 });

    if (lastInbound?.whatsappMessageId && workspace.gupshupAppId) {
       const appId = workspace.gupshupAppId;

       console.log(`[Inbox API] Syncing READ status to WhatsApp for message ${lastInbound.whatsappMessageId}`);
       // Fire and forget - don't block the user interface for provider latency
       GupshupService.markRead(
         appId, 
         undefined, 
         lastInbound.recipientPhone || '', 
         lastInbound.whatsappMessageId
       ).catch(err => console.error("[Inbox API:WhatsApp Read Sync Failed]:", err.message));
    }

    return NextResponse.json({
      success: true,
      message: "Conversation marked as read"
    });

  } catch (err: any) {
    console.error("[Inbox Read API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to mark as read", 
      error: err.message 
    }, { status: 500 });
  }
});
