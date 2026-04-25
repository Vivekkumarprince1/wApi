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
          language: {
            code: 'en'
          },
          components: [{ type: 'body', parameters: [{ type: 'text', text: 'John' }] }]
        }
      }
    });
    expect(options.headers.Authorization).toBe('token-123');
    expect(result.messageId).toBe('gs-msg-123');
  });

  test('createSubscription sends documented callbackUrl payload for required messaging subscriptions', async () => {
    axios.post.mockResolvedValue({
      data: {
        status: 'success',
        subscriptionId: 'sub-123'
      }
    });

    const result = await gupshupService.createSubscription({
      appId: 'app-123',
      appApiKey: 'token-123',
      callbackUrl: 'https://wapi-5al1.onrender.com/api/v1/webhook/gupshup',
      name: 'message_events',
      type: 'v3',
      mode: 'MESSAGE'
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, formBody, options] = axios.post.mock.calls[0];

    expect(url).toBe('https://partner.gupshup.io/partner/app/app-123/subscription');
    expect(formBody).toContain('callbackUrl=https%3A%2F%2Fwapi-5al1.onrender.com%2Fapi%2Fv1%2Fwebhook%2Fgupshup');
    expect(formBody).toContain('name=message_events');
    expect(formBody).toContain('type=v3');
    expect(formBody).toContain('mode=MESSAGE');
    expect(options.headers.Authorization).toBe('token-123');
    expect(result.subscriptionId).toBe('sub-123');
  });
});