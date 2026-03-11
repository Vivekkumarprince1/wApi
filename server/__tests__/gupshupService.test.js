jest.mock('axios', () => ({
  post: jest.fn()
}));

const axios = require('axios');
const gupshupService = require('../src/services/bsp/gupshupService');

describe('gupshupService partner V3 sends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sendTemplateV3 uses Gupshup partner envelope and extracts provider message id', async () => {
    axios.post.mockResolvedValue({
      data: {
        message: { id: 'gs-msg-123' },
        status: 'submitted'
      }
    });

    const result = await gupshupService.sendTemplateV3({
      appId: 'app-123',
      appApiKey: 'token-123',
      source: '919999111111',
      destination: '9999111111',
      templateName: 'order_update',
      languageCode: 'en',
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'John' }] }]
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, payload, options] = axios.post.mock.calls[0];

    expect(url).toBe('https://partner.gupshup.io/partner/app/app-123/v3/message');
    expect(payload).toEqual({
      channel: 'whatsapp',
      source: '919999111111',
      destination: '919999111111',
      'src.name': 'app-123',
      message: {
        type: 'template',
        template: {
          name: 'order_update',
          languagePolicy: 'deterministic',
          language: 'en',
          components: [{ type: 'body', parameters: [{ type: 'text', text: 'John' }] }]
        }
      }
    });
    expect(options.headers.Authorization).toBe('token-123');
    expect(result.messageId).toBe('gs-msg-123');
  });
});