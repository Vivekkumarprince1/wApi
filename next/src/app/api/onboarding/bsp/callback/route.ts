import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const payload = {
    code: params.get('code') || params.get('appId'),
    state: params.get('state'),
    error: params.get('error'),
    message: params.get('error_description') || params.get('message')
  };
  const target = `${config.frontendUrl.replace(/\/$/, '')}/dashboard`;

  return new NextResponse(`<!doctype html>
<html><head><meta charset="utf-8"><title>Finishing WhatsApp setup</title></head>
<body>
<p>Finishing WhatsApp setup...</p>
<script>
  (function () {
    var payload = ${JSON.stringify(payload)};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GUPSHUP_ONBOARDING_CALLBACK', payload: payload }, ${JSON.stringify(config.frontendUrl.replace(/\/$/, ''))});
        window.close();
        return;
      }
    } catch (error) {}
    var url = new URL(${JSON.stringify(target)});
    Object.keys(payload).forEach(function (key) { if (payload[key]) url.searchParams.set(key, payload[key]); });
    window.location.replace(url.toString());
  })();
</script>
</body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
