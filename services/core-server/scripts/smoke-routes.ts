import 'dotenv/config';

const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5001';
const billingUrl = process.env.BILLING_SERVICE_URL || 'http://127.0.0.1:3003';
const campaignUrl = process.env.CAMPAIGN_SERVICE_URL || 'http://127.0.0.1:3002';
const automationUrl = process.env.AUTOMATION_SERVICE_URL || 'http://127.0.0.1:3001';
const internalSecret = process.env.INTERNAL_SERVICE_SECRET || '';

type Check = {
  method: string;
  url: string;
  auth?: boolean;
  internal?: boolean;
  ok: number[];
  body?: unknown;
};

async function login() {
  if (process.env.AUTH_TOKEN) return process.env.AUTH_TOKEN;
  if (!process.env.SMOKE_EMAIL || !process.env.SMOKE_PASSWORD) return '';

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SMOKE_EMAIL,
      password: process.env.SMOKE_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`login failed: ${response.status}`);
  }

  const body = await response.json();
  return body.token || '';
}

async function run() {
  const token = await login();
  const authOk = token ? [200] : [401];
  const protectedProxyOk = token ? [200] : [401];
  const uploadOk = token ? [400] : [401];

  const checks: Check[] = [
    { method: 'GET', url: `${baseUrl}/live`, ok: [200] },
    { method: 'GET', url: `${baseUrl}/ready`, ok: [200] },
    { method: 'GET', url: `${baseUrl}/health`, ok: [200] },
    { method: 'GET', url: `${billingUrl}/live`, ok: [200] },
    { method: 'GET', url: `${campaignUrl}/live`, ok: [200] },
    { method: 'GET', url: `${automationUrl}/live`, ok: [200] },
    { method: 'GET', url: `${baseUrl}/api/v1/auth/session`, auth: true, ok: authOk },
    { method: 'GET', url: `${baseUrl}/api/v1/inbox/bootstrap`, auth: true, ok: protectedProxyOk },
    { method: 'GET', url: `${baseUrl}/api/v1/workspace/billing/info`, auth: true, ok: protectedProxyOk },
    { method: 'GET', url: `${baseUrl}/api/v1/campaign/segments`, auth: true, ok: protectedProxyOk },
    { method: 'GET', url: `${baseUrl}/api/v1/automation/hub/summary`, auth: true, ok: protectedProxyOk },
    { method: 'POST', url: `${baseUrl}/api/v1/upload/media`, auth: true, ok: uploadOk },
    { method: 'GET', url: `${baseUrl}/api/admin/core/health`, internal: true, ok: [200] },
    { method: 'GET', url: `${baseUrl}/api/admin/billing/health`, internal: true, ok: [200] },
    { method: 'GET', url: `${baseUrl}/api/admin/campaign/health`, internal: true, ok: [200] },
    { method: 'GET', url: `${baseUrl}/api/admin/automation/health`, internal: true, ok: [200] },
  ];

  const failures: string[] = [];

  for (const check of checks) {
    const headers: Record<string, string> = {};
    if (check.auth && token) {
      headers.Authorization = `Bearer ${token}`;
      headers.Cookie = `auth_token=${token}`;
    }
    if (check.internal) {
      headers['x-internal-service-secret'] = internalSecret;
    }
    if (check.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(check.url, {
      method: check.method,
      headers,
      body: check.body === undefined ? undefined : JSON.stringify(check.body),
    }).catch((error) => {
      failures.push(`${check.method} ${check.url}: ${error.message}`);
      return null;
    });

    if (!response) continue;
    if ([404, 502].includes(response.status) || !check.ok.includes(response.status)) {
      failures.push(`${check.method} ${check.url}: expected ${check.ok.join('/')}, got ${response.status}`);
    }
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(`Route smoke checks passed against ${baseUrl}`);
}

run();
