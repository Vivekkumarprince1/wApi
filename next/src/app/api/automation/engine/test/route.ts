import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { AutomationRule, AutomationExecution, Conversation, Contact, Message } from '@/lib/models';
import { FlowExecutorService } from '@/lib/services/automation/flow-executor';
import dbConnect from '@/lib/db-connect';

/**
 * POST /api/automation/engine/test
 * Dry-run an automation rule against a specific conversation.
 * NOW USES: FlowExecutorService for real execution
 */
export const POST = withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace }: any) => {
  try {
    await dbConnect();

    const { ruleId, conversationId, messageBody = 'test message', dryRun = true } = await req.json();

    if (!ruleId) return NextResponse.json({ success: false, error: 'ruleId is required' }, { status: 400 });
    if (!conversationId) return NextResponse.json({ success: false, error: 'conversationId is required' }, { status: 400 });

    const [rule, conversation] = await Promise.all([
      AutomationRule.findOne({ _id: ruleId, workspace: workspace._id }),
      Conversation.findOne({ _id: conversationId, workspace: workspace._id })
        .populate('contact', 'name phone _id')
        .lean()
    ]);

    if (!rule) return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });

    const contact = (conversation as any).contact;
    if (!contact) return NextResponse.json({ success: false, error: 'Contact not found for conversation' }, { status: 400 });

    // Prepare execution context (matches what webhook passes)
    const executionContext = {
      contactId: contact._id,
      contact: contact,
      conversationId: conversation._id,
      conversation: conversation,
      messageBody: messageBody,
      messageId: `test_${Date.now()}`,
      dryRun: true,
      testMode: true
    };

    console.log(`[Test Route] Executing rule ${ruleId} for conversation ${conversationId} (dryRun=${dryRun})`);

    // Execute the flow using the real FlowExecutorService
    const executionResult = await FlowExecutorService.execute(ruleId.toString(), executionContext);

    return NextResponse.json({
      success: true,
      data: {
        rule: { id: rule._id, name: rule.name, enabled: rule.enabled, category: rule.category },
        conversation: { id: conversationId, contact: contact.name || contact.phone },
        execution: {
          result: executionResult,
          context: {
            contactId: contact._id,
            messageBody,
            testMode: true
          },
          timestamp: new Date().toISOString()
        },
        dryRun: true,
        info: 'Used FlowExecutorService for real execution validation'
      }
    });
  } catch (error: any) {
    console.error('[Test Route] Error during test execution:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Test execution failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
});
