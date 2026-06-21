const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5001';
const token = process.env.AUTH_TOKEN || '';

const checks = [
  { method: 'GET', path: '/health', auth: false, ok: [200] },
  { method: 'GET', path: '/api/v1/auth/session', auth: true, ok: [200, 401, 403] },
  { method: 'GET', path: '/api/v1/inbox/bootstrap', auth: true, ok: [200, 401, 403] },
  { method: 'GET', path: '/api/v1/workspace/billing/info', auth: true, ok: [200, 401, 403, 502] },
  { method: 'GET', path: '/api/v1/campaign/segments', auth: true, ok: [200, 401, 403, 502] },
  { method: 'GET', path: '/api/v1/automation/engine/hub/summary', auth: true, ok: [200, 401, 403, 502] },
  { method: 'POST', path: '/api/v1/upload/media', auth: true, ok: [400, 401, 403] }
];

async function run() {
  const failures: string[] = [];

  for (const check of checks) {
    const headers: Record<string, string> = {};
    if (check.auth && token) {
      headers.Authorization = `Bearer ${token}`;
      headers.Cookie = `auth_token=${token}`;
    }

    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers
    }).catch((error) => {
      failures.push(`${check.method} ${check.path}: ${error.message}`);
      return null;
    });

    if (!response) continue;
    if (response.status === 404 || !check.ok.includes(response.status)) {
      failures.push(`${check.method} ${check.path}: expected ${check.ok.join('/')}, got ${response.status}`);
    }
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(`Route smoke checks passed against ${baseUrl}`);
}

run();
