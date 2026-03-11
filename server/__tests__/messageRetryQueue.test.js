const {
  buildRetryRequestFromMessage,
  calculateBackoffDelay
} = require('../src/services/infrastructure/messageRetryQueue');

describe('messageRetryQueue helpers', () => {
  test('buildRetryRequestFromMessage rebuilds template retry request from stored message', () => {
    const request = buildRetryRequestFromMessage({
      workspace: 'workspace_1',
      contact: 'contact_1',
      conversation: 'conversation_1',
      sentBy: 'agent_1',
      recipientPhone: '919999000000',
      type: 'template',
      template: {
        metaTemplateName: 'order_update',
        language: 'en',
        variables: {
          body: ['John', 'ORD-123']
        }
      },
      meta: {
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'John' },
              { type: 'text', text: 'ORD-123' }
            ]
          }
        ]
      }
    });

    expect(request.method).toBe('sendTemplateMessage');
    expect(request.args[0]).toBe('workspace_1');
    expect(request.args[1]).toBe('919999000000');
    expect(request.args[2]).toBe('order_update');
    expect(request.args[3]).toBe('en');
    expect(request.args[4]).toHaveLength(1);
    expect(request.args[5]).toEqual(expect.objectContaining({
      contactId: 'contact_1',
      conversationId: 'conversation_1',
      sentBy: 'agent_1',
      skipMessageLog: true
    }));
  });

  test('buildRetryRequestFromMessage rebuilds text retry request', () => {
    const request = buildRetryRequestFromMessage({
      workspace: 'workspace_1',
      recipientPhone: '919999000000',
      type: 'text',
      body: 'Hello again'
    });

    expect(request.method).toBe('sendTextMessage');
    expect(request.args[2]).toBe('Hello again');
  });

  test('calculateBackoffDelay uses capped retry schedule', () => {
    expect(calculateBackoffDelay(0)).toBe(60 * 1000);
    expect(calculateBackoffDelay(1)).toBe(5 * 60 * 1000);
    expect(calculateBackoffDelay(2)).toBe(15 * 60 * 1000);
    expect(calculateBackoffDelay(10)).toBe(60 * 60 * 1000);
  });
});
