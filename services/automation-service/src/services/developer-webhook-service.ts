import crypto from 'crypto';
import { Workspace } from '../models';

type DeveloperEventPayload = {
  [key: string]: unknown;
};

function signPayload(secret: string | undefined, timestamp: string, body: string) {
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function emitDeveloperEvent(workspaceId: string, event: string, data: DeveloperEventPayload) {
  const workspace = await (Workspace as any)
    .findById(workspaceId)
    .select('webhookSubscriptions')
    .lean();

  const subscriptions = ((workspace as any)?.webhookSubscriptions || []).filter((hook: any) => {
    const events = Array.isArray(hook.events) ? hook.events : [];
    return hook.isActive !== false && (events.includes(event) || events.includes('*'));
  });

  if (subscriptions.length === 0) return;

  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    id: `evt_${crypto.randomBytes(12).toString('hex')}`,
    type: event,
    createdAt: timestamp,
    data,
  });

  await Promise.allSettled(
    subscriptions.map(async (hook: any) => {
      const signature = signPayload(hook.secret, timestamp, body);
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-connectsphere-event': event,
          'x-connectsphere-timestamp': timestamp,
          ...(signature ? { 'x-connectsphere-signature': `sha256=${signature}` } : {}),
        },
        body,
      });

      await (Workspace as any).updateOne(
        { _id: workspaceId, 'webhookSubscriptions._id': hook._id },
        {
          $set: {
            'webhookSubscriptions.$.lastDeliveryAt': new Date(),
            'webhookSubscriptions.$.lastDeliveryStatus': response.ok ? 'delivered' : `failed:${response.status}`,
          },
        }
      );
    })
  );
}
