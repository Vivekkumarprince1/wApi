const mockFindOne = jest.fn();
const mockEnqueueRetry = jest.fn();
const mockEmitMessageStatus = jest.fn();

jest.mock('../src/models', () => ({
  Contact: {},
  Conversation: {},
  Message: { findOne: (...args) => mockFindOne(...args) },
  WebhookLog: {},
  Workspace: {},
  Template: {}
}));

jest.mock('../src/services/billing/billingLedgerService', () => ({}));
jest.mock('../src/services/automation/autoReplyService', () => ({}));
jest.mock('../src/services/integration/instagramQuickflowService', () => ({}));
jest.mock('../src/services/automation/answerbotService', () => ({}));
jest.mock('../src/services/bsp/bspMessagingService', () => ({}));
jest.mock('../src/services/automation/automationEventEmitter', () => ({
  automationEvents: {},
  AUTOMATION_EVENTS: {}
}));
jest.mock('../src/utils/socket', () => ({ getIO: () => null }));
jest.mock('../src/services/bsp/gupshupProvisioningService', () => ({
  runPostOnboardingAutomations: jest.fn()
}));
jest.mock('../src/services/messaging/inboxSocketService', () => ({
  emitMessageStatus: (...args) => mockEmitMessageStatus(...args)
}));
jest.mock('../src/services/infrastructure/messageRetryQueue', () => ({
  enqueueRetry: (...args) => mockEnqueueRetry(...args)
}));

const { processStatuses } = require('../src/controllers/bsp/gupshupWebhookController');

describe('gupshupWebhookController delivery failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('failed outbound status enqueues retry with stored message data', async () => {
    const savedMessage = {
      _id: 'message-1',
      workspace: 'workspace-1',
      conversation: 'conversation-1',
      direction: 'outbound',
      recipientPhone: '919999000000',
      body: 'Hello',
      status: 'queued',
      template: { id: 'template-1' },
      meta: {},
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn()
    };
    mockFindOne.mockResolvedValue(savedMessage);

    await processStatuses([
      {
        id: 'wamid-1',
        status: 'failed',
        errors: [{ code: 131026, title: 'Message undeliverable' }],
        timestamp: 1710000000
      }
    ], 'workspace-1');

    expect(savedMessage.status).toBe('failed');
    expect(savedMessage.failureReason).toContain('131026');
    expect(mockEnqueueRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'message-1',
        workspaceId: 'workspace-1',
        recipientPhone: '919999000000',
        messageBody: 'Hello',
        templateId: 'template-1'
      }),
      expect.stringContaining('131026'),
      0
    );
    expect(mockEmitMessageStatus).toHaveBeenCalled();
  });
});