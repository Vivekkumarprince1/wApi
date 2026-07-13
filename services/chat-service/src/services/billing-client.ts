type TemplateChargeInput = {
  workspaceId: string;
  templateName: string;
  templateCategory?: string;
  contactId?: string;
  phone?: string;
  source: 'inbox' | 'internal' | 'automation';
  idempotencyKey?: string;
};

type TemplateCharge = {
  charged: boolean;
  amount: number;
  idempotencyKey: string;
};

function billingBaseUrl() {
  return (process.env.BILLING_SERVICE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

function billingHeaders(workspaceId: string) {
  return {
    'Content-Type': 'application/json',
    'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET || '',
    'x-internal-service': 'chat-service',
    'x-workspace-id': workspaceId,
  };
}

function normalizeCategory(category?: string) {
  const value = String(category || 'MARKETING').trim().toUpperCase();
  if (value === 'PROMOTIONAL') return 'MARKETING';
  if (value === 'TRANSACTIONAL') return 'UTILITY';
  if (value === 'OTP') return 'AUTHENTICATION';
  return value || 'MARKETING';
}

async function parseBillingResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function getTemplatePrice(workspaceId: string, templateCategory?: string) {
  const category = normalizeCategory(templateCategory);
  const response = await fetch(
    `${billingBaseUrl()}/api/billing/wallets/${workspaceId}/pricing?category=${encodeURIComponent(category)}`,
    { headers: billingHeaders(workspaceId) }
  );
  const payload = await parseBillingResponse(response);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || 'Failed to resolve template pricing');
  }
  return Number(payload?.cost || 0);
}

export async function chargeTemplateMessage(input: TemplateChargeInput): Promise<TemplateCharge> {
  const amount = await getTemplatePrice(input.workspaceId, input.templateCategory);
  const idempotencyKey = input.idempotencyKey || [
    'template-send',
    input.source,
    input.workspaceId,
    input.contactId || input.phone || 'unknown',
    input.templateName,
    Date.now(),
  ].join(':');

  if (amount <= 0) {
    return { charged: false, amount, idempotencyKey };
  }

  const response = await fetch(`${billingBaseUrl()}/api/billing/wallets/${input.workspaceId}/deduct`, {
    method: 'POST',
    headers: billingHeaders(input.workspaceId),
    body: JSON.stringify({
      amount,
      description: `Template message: ${input.templateName}`,
      referenceType: 'TEMPLATE_MESSAGE',
      referenceId: input.contactId || input.phone,
      externalReferenceId: idempotencyKey,
    }),
  });

  const payload = await parseBillingResponse(response);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || 'Template message billing failed');
  }

  return { charged: true, amount, idempotencyKey };
}

export async function refundTemplateCharge(
  workspaceId: string,
  charge: TemplateCharge | null,
  reason: string
) {
  if (!charge?.charged || charge.amount <= 0) return;

  const response = await fetch(`${billingBaseUrl()}/api/billing/wallets/${workspaceId}/add-funds`, {
    method: 'POST',
    headers: billingHeaders(workspaceId),
    body: JSON.stringify({
      amount: charge.amount,
      description: `Template message refund: ${reason}`,
      externalReferenceId: `refund:${charge.idempotencyKey}`,
    }),
  });

  const payload = await parseBillingResponse(response);
  if (!response.ok || payload?.success === false) {
    console.error('[BillingClient] Failed to refund template charge:', payload?.error || payload?.message || response.statusText);
  }
}
