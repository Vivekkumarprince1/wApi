import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { workspaceController } from '../controllers/workspaceController';
import { WorkspaceInvitation, Workspace, Contact, Conversation } from '../models';
import { WabaService } from '../services/messaging/waba-service';

const router = Router();

router.get('/tags', authenticate, workspaceController.listTags);
router.post('/tags', authenticate, workspaceController.createTag);
router.delete('/tags/:id', authenticate, workspaceController.deleteTag);

router.get('/messaging/quick-replies', authenticate, workspaceController.listQuickReplies);
router.post('/messaging/quick-replies', authenticate, workspaceController.saveQuickReply);
router.patch('/messaging/quick-replies/:id', authenticate, (req: any, res, next) => {
  req.body = { ...(req.body || {}), id: req.params.id };
  return workspaceController.saveQuickReply(req, res, next);
});
router.delete('/messaging/quick-replies/:id', authenticate, workspaceController.deleteQuickReply);

router.get('/inbox/settings', authenticate, workspaceController.getInboxSettings);
router.patch('/inbox/settings', authenticate, workspaceController.updateInboxSettings);

router.get('/debug/invites', async (_req, res) => {
  try {
    const invites = await WorkspaceInvitation.find({}).populate('workspace', 'name').lean();
    res.json(invites);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/test-flow-send', async (req, res) => {
  try {
    const targetPhone = String(req.query.phone || '919000000000').replace(/\D/g, '');
    const workspace = await Workspace.findOne({ bspManaged: true }).lean();
    if (!workspace) {
      return res.status(400).json({ success: false, error: 'No BSP managed workspace found' });
    }

    let contact = await Contact.findOne({ workspace: workspace._id, phone: targetPhone });
    if (!contact) {
      contact = await Contact.create({
        workspace: workspace._id,
        phone: targetPhone,
        name: 'Flow Test User',
        lastInboundAt: new Date()
      });
    } else {
      contact.lastInboundAt = new Date();
      await contact.save();
    }

    let conversation = await Conversation.findOne({ workspace: workspace._id, contact: contact._id, status: 'open' });
    if (!conversation) {
      conversation = await Conversation.create({
        workspace: workspace._id,
        contact: contact._id,
        channel: 'whatsapp',
        status: 'open',
        lastMessageAt: new Date(),
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } else {
      conversation.lastMessageAt = new Date();
      conversation.windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await conversation.save();
    }

    const flowPayload = {
      body: { text: 'Please click below to start the interactive flow.' },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: 'TEST_TOKEN_123',
          flow_id: 'test_flow_123',
          flow_cta: 'Start Flow',
          flow_action: 'navigate',
          flow_action_payload: { screen: 'START_SCREEN' }
        }
      }
    };

    const result = await WabaService.sendFlowMessage(workspace._id.toString(), targetPhone, flowPayload, {
      contactId: contact._id.toString(),
      conversationId: conversation._id.toString(),
      metadata: { source: 'api-test' }
    });

    res.json({ success: true, workspaceId: workspace._id, targetPhone, gupshupResponse: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error', details: err.result || {} });
  }
});

export default router;
