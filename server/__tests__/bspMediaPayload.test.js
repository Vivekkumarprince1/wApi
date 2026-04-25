const gupshupService = require('../src/services/bsp/gupshupService');
const bspMessagingService = require('../src/services/bsp/bspMessagingService');
const { Template, Workspace } = require('../src/models');

jest.mock('../src/services/bsp/gupshupService', () => ({
  sendTemplateV3: jest.fn(),
  normalizePhoneNumber: jest.fn(to => to)
}));
jest.mock('../src/models');
jest.mock('../src/services/messaging/optOutService', () => ({
  isOptedOutByPhone: jest.fn().mockResolvedValue(false)
}));
jest.mock('../src/services/billing/billingEnforcementService', () => ({
  enforceWorkspaceBilling: jest.fn().mockResolvedValue(true)
}));
jest.mock('../src/utils/mediaUtils', () => ({
  isUrl: jest.fn(str => str.startsWith('http')),
  isMediaHandle: jest.fn(str => str.startsWith('4::'))
}));

describe('bspMessagingService - Media Handle Payload', () => {
  let mockWorkspace;
  let mockTemplate;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWorkspace = {
      _id: 'ws-123',
      bspManaged: true,
      bspPhoneNumberId: 'phone-123',
      gupshupIdentity: { 
        appApiKey: 'test-key', 
        appName: 'test-app', 
        source: '919876543210',
        partnerAppId: 'app-123'
      },
      ensureWorkspaceBspReady: jest.fn(),
      getMessagingCapabilityState: jest.fn().mockReturnValue({ blocked: false, stale: false }),
      canSendMessage: jest.fn().mockReturnValue(true),
      incrementBspMessageUsage: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };

    mockTemplate = {
      _id: 'temp-123',
      workspace: 'ws-123',
      name: 'test_template',
      metaTemplateName: 'test_template',
      status: 'APPROVED',
      header: { mediaUrl: 'http://example.com/img.png' },
      metaPayloadSnapshot: {
        components: [{ type: 'HEADER', format: 'IMAGE' }]
      }
    };

    Workspace.findById.mockResolvedValue(mockWorkspace);
    Template.findOne.mockResolvedValue(mockTemplate);
    gupshupService.sendTemplateV3.mockResolvedValue({ status: 'submitted', messageId: 'gs-123' });
  });

  test('should use "link" for http URLs in header', async () => {
    await bspMessagingService.sendTemplateMessage(
      'ws-123',
      '919876543210',
      'test_template',
      'en',
      []
    );

    expect(gupshupService.sendTemplateV3).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'app-123',
        destination: '919876543210',
        templateName: 'test_template',
        components: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            parameters: [
              expect.objectContaining({
                image: { link: 'http://example.com/img.png' }
              })
            ]
          })
        ])
      })
    );
  });

  test('should use "id" for media handles in header', async () => {
    const mediaHandle = '4::YWJjMTIz';
    
    await bspMessagingService.sendTemplateMessage(
      'ws-123',
      '919876543210',
      'test_template',
      'en',
      [],
      { headerMediaUrl: mediaHandle }
    );

    expect(gupshupService.sendTemplateV3).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'app-123',
        destination: '919876543210',
        templateName: 'test_template',
        components: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            parameters: [
              expect.objectContaining({
                image: { id: mediaHandle }
              })
            ]
          })
        ])
      })
    );
  });
});
