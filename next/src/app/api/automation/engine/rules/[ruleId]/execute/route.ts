import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { AutomationRule, Conversation, Contact, Message } from '@/lib/models';
import { FlowExecutorService } from '@/lib/services/automation/flow-executor';
import { AutomationService } from '@/lib/services/automation/automation-service';
import dbConnect from '@/lib/db-connect';

/**
 * POST /api/automation/engine/rules/[ruleId]/execute
 * Directly execute an automation rule for a specific conversation.
 * This bypasses condition matching - always executes the flow.
 * 
 * Usage: POST /api/automation/engine/rules/123/execute
 * Body: { conversationId, contactId, messageBody }
 */
export const POST = withRole(
  ['owner', 'admin', 'manager'],
  async (req: NextRequest, { workspace, params }: any) => {
    try {
      await dbConnect();

      const { ruleId } = await Promise.resolve(params);
      const { conversationId, contactId, messageBody = 'Direct trigger' } = await req.json();

      if (!ruleId) {
        return NextResponse.json({ success: false, error: 'ruleId is required' }, { status: 400 });
      }
      if (!conversationId && !contactId) {
        return NextResponse.json(
          { success: false, error: 'Either conversationId or contactId is required' },
          { status: 400 }
        );
      }

      // Fetch automation rule
      const rule = await AutomationRule.findOne({ _id: ruleId, workspace: workspace._id });
      if (!rule) {
        return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
      }

      // Prepare execution context
      let contact = null;
      let conversation = null;

      if (conversationId) {
        conversation = await Conversation.findOne({
          _id: conversationId,
          workspace: workspace._id
        })
          .populate('contact', 'name phone _id')
          .lean();

        if (!conversation) {
          return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
        }
        contact = (conversation as any).contact;
      } else {
        // Fetch contact directly
        contact = await Contact.findOne({
          _id: contactId,
          workspace: workspace._id
        })
          .select('name phone _id')
          .lean();

        if (!contact) {
          return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });
        }

        // Get or create conversation
        conversation = await Conversation.findOne({
          contact: contactId,
          workspace: workspace._id
        }).lean();

        if (!conversation) {
          // Create minimal conversation for direct execution
          const newConv = await Conversation.create({
            contact: contactId,
            workspace: workspace._id,
            lastMessagePreview: messageBody,
            lastMessageAt: new Date(),
            status: 'open',
            isOpen: true,
            lastActivityAt: new Date()
          });
          conversation = newConv.toObject();
        }
      }

      // Build execution context
      const executionContext = {
        contactId: contact._id,
        contact: contact,
        conversationId: conversation._id,
        conversation: conversation,
        messageBody: messageBody,
        messageId: `direct_${Date.now()}`,
        dryRun: false,
        directTrigger: true
      };

      console.log(
        `[Execute Endpoint] Directly executing rule ${ruleId} for contact ${contact._id} in conversation ${conversation._id}`
      );

      // Execute the flow
      const executionResult = await FlowExecutorService.execute(ruleId.toString(), executionContext);

      return NextResponse.json({
        success: true,
        data: {
          rule: {
            id: rule._id,
            name: rule.name,
            enabled: rule.enabled,
            category: rule.category,
            actions: rule.actions?.length || 0
          },
          execution: {
            result: executionResult,
            contact: {
              id: contact._id,
              name: contact.name || contact.phone
            },
            conversation: {
              id: conversation._id
            },
            timestamp: new Date().toISOString(),
            directTrigger: true
          }
        }
      });
    } catch (error: any) {
      console.error('[Execute Endpoint] Error during direct execution:', error.message);

      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Direct execution failed',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /api/automation/engine/rules/[ruleId]/execute
 * Returns execution status and history for a rule.
 */
export const GET = withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace, params }: any) => {
  try {
    await dbConnect();

    const { ruleId } = await Promise.resolve(params);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const rule = await AutomationRule.findOne({ _id: ruleId, workspace: workspace._id });
    if (!rule) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    // This would return execution history - placeholder for now
    return NextResponse.json({
      success: true,
      data: {
        rule: {
          id: rule._id,
          name: rule.name,
          enabled: rule.enabled,
          category: rule.category
        },
        executionInfo: 'Execution history endpoint - implement as needed'
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch execution status' },
      { status: 500 }
    );
  }
});
