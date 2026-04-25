/**
 * API: /api/inbox/[id]/messages
 * Port of legacy inboxController.getMessages
 * Fetches message thread and handles sending new messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Message, Conversation } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: Fetch message history for a conversation
 */
export const GET = withAuth(async (req: NextRequest, { params, user, workspace }) => {
  try {
    const { id: conversationId } = await params;
    await dbConnect();

    // 1. Verify conversation belongs to workspace
    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspace._id
    });

    if (!conversation) {
      return NextResponse.json({ 
        success: false, 
        message: "Conversation not found in this workspace" 
      }, { status: 404 });
    }

    // 2. Parse query params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const before = searchParams.get("before");

    // 3. Build query
    const query: any = {
      workspace: workspace._id,
      conversation: conversationId
    };

    if (before && before !== 'undefined') {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // 4. Fetch messages — Use selective population to reduce DB load
    const messages = await Message.find(query)
        .populate("sentBy", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    // 5. Populate template details only for template messages
    const templateIds = messages
      .filter(m => m.type === 'template' && m.template?.id)
      .map(m => m.template!.id);

    if (templateIds.length > 0) {
      const { Template } = await import("@/lib/models/template/Template");
      const templatesDoc = await Template.find({ _id: { $in: templateIds } } as any).lean();
      const templateMap = new Map(templatesDoc.map(t => [t._id.toString(), t]));

      messages.forEach((msg: any) => {
        if (msg.type === 'template' && msg.template?.id) {
          const templateDoc = templateMap.get(msg.template.id.toString());
          if (templateDoc) {
             // Inject missing fields from template definition
             const isRealUrl = (url: string) => typeof url === 'string' && url.startsWith('http');
             
             if (!msg.template.header?.format) {
                const headerComp = (templateDoc as any).components?.find((c: any) => c.type === 'HEADER');
                if (headerComp) {
                   msg.template.header = {
                      format: headerComp.format || 'TEXT',
                      text: headerComp.text,
                      mediaUrl: isRealUrl(headerComp.example?.header_url?.[0]) ? headerComp.example.header_url[0] : ''
                   };
                }
             }

             if (!msg.template.buttons || msg.template.buttons.length === 0) {
                const btnComp = (templateDoc as any).components?.find((c: any) => c.type === 'BUTTONS');
                if (btnComp?.buttons) msg.template.buttons = btnComp.buttons;
             }

             if (!msg.body) {
                msg.body = (templateDoc as any).body?.text || `[Template: ${templateDoc.name}]`;
             }
          }
        }
      });
    }

    // 6. Chronological order for the UI thread
    const thread = messages.reverse();

    return NextResponse.json({
      success: true,
      data: thread,
      pagination: {
        limit,
        hasMore: messages.length === limit,
        lastTimestamp: messages.length > 0 ? messages[0].createdAt : null
      }
    });

  } catch (err: any) {
    console.error("[Inbox Messages GET Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch messages", 
      error: err.message 
    }, { status: 500 });
  }
});

/**
 * POST: Send a new message or internal note
 */
export const POST = withAuth(async (req: NextRequest, { params, user, workspace }) => {
  try {
    const { id: conversationId } = await params;
    const body = await req.json();
    const { body: text, isInternalNote, type = 'text', media, template } = body;

    await dbConnect();

    // 1. Internal Notes: Handle directly in DB (No WABA involvement)
    if (isInternalNote) {
        const conversation = await Conversation.findOne({ _id: conversationId, workspace: workspace._id });
        if (!conversation) return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 });

        const newMessage = await Message.create({
            workspace: workspace._id,
            conversation: conversationId,
            contact: conversation.contact,
            direction: 'outbound',
            type: 'note',
            body: text,
            isInternalNote: true,
            sentBy: user._id,
            status: 'received',
            sentAt: new Date(),
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            $set: {
                lastMessageAt: new Date(),
                lastMessagePreview: text.substring(0, 100),
                lastMessageDirection: 'outbound',
                lastMessageType: 'note',
                lastActivityAt: new Date(),
            }
        });

        const { emitMessageSent } = await import("@/lib/services/socket-service");
        await emitMessageSent(workspace._id.toString(), conversationId, newMessage, user);

        return NextResponse.json({ success: true, data: newMessage });
    }

    // 2. Transmitted Messages: Use InboxService / WabaService
    const { InboxService } = await import("@/lib/services/messaging/inbox-service");

    let result;
    if (type === 'template' && template) {
        result = await InboxService.sendTemplateMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            templateName: template.name,
            languageCode: template.language || 'en',
            variables: template.variables || []
        });
    } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(type) && media?.url) {
        // Media message (enforces 24h window)
        result = await InboxService.sendMediaMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            type: type as any,
            mediaUrl: media.url,
            mimeType: media.mimeType,
            caption: media.caption || text,
            filename: media.filename
        });
    } else if (type === 'location' && (body.location || body.lat)) {
        result = await InboxService.sendLocationMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            location: body.location || {
               latitude: body.lat,
               longitude: body.long,
               name: body.name,
               address: body.address
            }
        });
    } else if (type === 'contacts' && body.contacts) {
        result = await InboxService.sendContactMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            contacts: body.contacts
        });
    } else if (type === 'interactive' && body.interactive) {
        result = await InboxService.sendInteractiveMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            interactive: body.interactive
        });
    } else if (type === 'reaction' && body.reaction) {
        result = await InboxService.sendReactionMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            messageId: body.reaction.messageId,
            emoji: body.reaction.emoji
        });
    } else if (type === 'pix' && body.pix) {
        result = await InboxService.sendPixMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            pix: body.pix
        });
    } else if (type === 'boleto' && body.boleto) {
        result = await InboxService.sendBoletoMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            boleto: body.boleto
        });
    } else {
        // Text message (enforces 24h window)
        result = await InboxService.sendTextMessage({
            workspaceId: workspace._id,
            conversationId,
            agentId: user._id,
            text
        });
    }

    if (!result.success) {
        return NextResponse.json({ success: false, message: result.result?.error || 'Failed to send message' }, { status: 400 });
    }

    return NextResponse.json({
        success: true,
        data: result.message,
        message: (result as any).fallbackUsed ? "Session expired; auto-fallback template sent." : "Message sent"
    });

  } catch (err: any) {
    console.error("[Inbox Messages POST Error]:", err.message);
    
    if (err.message === 'SESSION_EXPIRED' || err.message.includes('SESSION_EXPIRED')) {
        return NextResponse.json({ 
            success: false, 
            message: "Customer session window closed. Please send a template instead.",
            code: 'SESSION_EXPIRED'
        }, { status: 403 });
    }

    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
