import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Conversation, Message, Team, Permission, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { getIO } from "@/lib/services/socket-bridge";

/**
 * Handle individual conversation actions
 * PATCH /api/inbox/:id
 * Body: { action: 'resolve' | 'reopen' | 'snooze' | 'claim' | 'unassign' | 'priority' | 'spam', ...data }
 */
export const PATCH = withFeature('INBOX', async (req: NextRequest, { params, user, workspace }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, ...data } = body;

    await dbConnect();

    const conversation = await Conversation.findOne({
      _id: id,
      workspace: workspace._id
    });

    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 });
    }

    const previousAssignee = conversation.assignedTo;
    const io = getIO();

    switch (action) {
      case 'resolve':
        conversation.updateStatus('resolved', user._id);
        break;

      case 'reopen':
        conversation.updateStatus('open', user._id);
        break;

      case 'snooze':
        if (!data.until) {
          return NextResponse.json({ success: false, message: "Snooze duration required" }, { status: 400 });
        }
        conversation.updateStatus('snoozed', user._id);
        conversation.snoozedUntil = new Date(data.until);
        break;

      case 'claim':
        // Only allow claiming if currently unassigned or if user has assignment permission
        const canClaim = !conversation.assignedTo || await Permission.checkAccess(workspace._id, user._id, 'assignConversations', { conversationId: conversation._id });
        
        if (!canClaim) {
            return NextResponse.json({ success: false, message: "Conversation already assigned and you do not have permission to reassign it" }, { status: 403 });
        }
        (conversation as any).assignTo(user._id, user._id);
        
        // Also associate with user's primary team if they have one
        const userWithTeam = await Team.findOne({ 'members.user': user._id, isActive: true });
        if (userWithTeam) {
          conversation.team = userWithTeam._id as any;
        }
        break;

      case 'assign':
        if (!data.agentId) {
          return NextResponse.json({ success: false, message: "Agent ID required" }, { status: 400 });
        }
        
        // Use Team-Aware Permissions Check
        const canAssign = await Permission.checkAccess(workspace._id, user._id, 'assignConversations', { conversationId: conversation._id });
        
        if (!canAssign) {
          return NextResponse.json({ success: false, message: "Permission denied: You can only assign within your team scope" }, { status: 403 });
        }
        
        (conversation as any).assignTo(data.agentId, user._id);
        
        // Auto-assign to the first team they both share if not already assigned to a team
        const sharedTeam = await Team.findOne({ 
          isActive: true, 
          'members.user': { $all: [user._id, data.agentId] } 
        });
        if (sharedTeam) conversation.team = sharedTeam._id as any;
        break;

      case 'assignToTeam':
        if (!data.teamId) {
          return NextResponse.json({ success: false, message: "Team ID required" }, { status: 400 });
        }
        
        // Use Team-Aware Permissions Check for team reassignment
        const canAssignTeam = await Permission.checkAccess(workspace._id, user._id, 'assignConversations', { teamId: data.teamId });
        
        if (!canAssignTeam) {
          return NextResponse.json({ success: false, message: "Permission denied: You can only assign to your own teams" }, { status: 403 });
        }
        
        conversation.team = data.teamId;
        break;


      case 'unassign':
        (conversation as any).unassign(user._id);
        break;

      case 'label':
        if (!data.label) {
          // If label is null/empty, clear it
          conversation.label = undefined;
        } else {
          if (data.label.length > 22) {
            return NextResponse.json({ success: false, message: "Label too long (max 22 chars)" }, { status: 400 });
          }
          conversation.label = data.label;
        }
        break;

      case 'priority':
        if (!['low', 'normal', 'high', 'urgent'].includes(data.priority)) {
          return NextResponse.json({ success: false, message: "Invalid priority level" }, { status: 400 });
        }
        conversation.priority = data.priority;
        break;

      case 'spam':
        conversation.updateStatus('spam', user._id);
        break;

      case 'add-tag':
        if (!data.tag) {
          return NextResponse.json({ success: false, message: "Tag required" }, { status: 400 });
        }
        // Add to Conversation for the current thread view
        if (!conversation.tags.includes(data.tag)) {
          conversation.tags.push(data.tag);
        }
        // Add to Contact for global persistence
        await Contact.findByIdAndUpdate(conversation.contact, {
          $addToSet: { tags: data.tag }
        });
        break;

      case 'remove-tag':
        if (!data.tag) {
          return NextResponse.json({ success: false, message: "Tag required" }, { status: 400 });
        }
        // Remove from Conversation
        conversation.tags = conversation.tags.filter(t => t !== data.tag);
        // Remove from Contact
        await Contact.findByIdAndUpdate(conversation.contact, {
          $pull: { tags: data.tag }
        });
        break;

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }

    await conversation.save();
    
    // Populate for response parity
    await conversation.populate([
        { path: 'contact', select: 'name phone email avatar tags' },
        { path: 'assignedTo', select: 'name email' }
    ]);

    // Broadcast update via socket bridge
    if (io) {
      const isAssignmentAction = action === 'claim' || action === 'unassign' || action === 'assign' || action === 'assignToTeam';

      const conversationPayload: any = {
        conversationId: conversation._id,
        action,
        updatedBy: { _id: user._id, name: user.name },
        conversation: conversation.toObject()
      };

      if (isAssignmentAction) {
        conversationPayload.assignment = {
          assignedTo: conversation.assignedTo,
          team: conversation.team,
          previousAssignee
        };
      }

      io.to(`workspace:${workspace._id}`).emit('inbox:conversation_updated', conversationPayload);
    }

    return NextResponse.json({
      success: true,
      data: conversation,
      message: `Conversation ${action}ed successfully`
    });

  } catch (err: any) {
    console.error(`[Inbox Action Error]`, err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * Fetch a single conversation thread details
 */
export const GET = withFeature('INBOX', async (req: NextRequest, { params, workspace }) => {
    try {
      const { id } = await params;
      await dbConnect();
  
      const conversation = await Conversation.findOne({
        _id: id,
        workspace: workspace._id
      }).populate([
        { path: 'contact', select: 'name phone email avatar tags customFields' },
        { path: 'assignedTo', select: 'name email' },
        { path: 'team', select: 'name' }
      ]);
  
      if (!conversation) {
        return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 });
      }
  
      return NextResponse.json({ success: true, data: conversation });
  
    } catch (err: any) {
      return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
});

/**
 * Delete a conversation and all its messages
 */
export const DELETE = withFeature('INBOX', async (req: NextRequest, { params, workspace }) => {
  try {
    const { id } = await params;
    await dbConnect();

    // 1. Verify existence and ownership
    const conversation = await Conversation.findOne({
      _id: id,
      workspace: workspace._id
    });

    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 });
    }

    // 2. Delete all messages associated with this conversation
    const messageRes = await Message.deleteMany({ 
      conversation: id,
      workspace: workspace._id 
    });

    // 3. Delete the conversation itself
    await Conversation.deleteOne({ _id: id });

    // 4. Broadcast via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspace._id}`).emit('inbox:conversation_deleted', {
        conversationId: id,
        workspaceId: workspace._id
      });
    }

    return NextResponse.json({
      success: true,
      message: `Conversation and ${messageRes.deletedCount} messages deleted successfully`
    });

  } catch (err: any) {
    console.error(`[Conversation Delete Error]`, err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
