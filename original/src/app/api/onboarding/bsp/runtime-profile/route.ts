import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { GupshupPartnerService } from '@/lib/services/bsp/gupshup-partner-service';

export const GET = withAuth(async (_req: NextRequest, { workspace }) => {
  const appId = workspace?.gupshupAppId || workspace?.gupshupIdentity?.partnerAppId;
  if (!appId) {
    return NextResponse.json({ success: true, connected: false, profile: null });
  }

  if (String(appId).startsWith('mock_')) {
    return NextResponse.json({
      success: true,
      connected: true,
      profile: { app: { id: appId, mock: true }, persisted: workspace }
    });
  }

  const [app, waba] = await Promise.allSettled([
    GupshupPartnerService.getPartnerApp(appId),
    GupshupPartnerService.getWabaInfo(appId)
  ]);

  return NextResponse.json({
    success: true,
    connected: !!workspace?.whatsappConnected,
    profile: {
      persisted: workspace,
      live: {
        app: app.status === 'fulfilled' ? { ok: true, data: app.value } : { ok: false, error: app.reason?.message },
        waba: waba.status === 'fulfilled' ? { ok: true, data: waba.value } : { ok: false, error: waba.reason?.message }
      }
    }
  });
});
