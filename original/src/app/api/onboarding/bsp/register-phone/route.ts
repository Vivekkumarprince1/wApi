import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { GupshupPartnerService } from '@/lib/services/bsp/gupshup-partner-service';

export const POST = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const appId = body.appId || workspace?.gupshupAppId || workspace?.gupshupIdentity?.partnerAppId;
    if (!appId) return NextResponse.json({ success: false, message: 'No assigned app found' }, { status: 400 });
    if (String(appId).startsWith('mock_')) return NextResponse.json({ success: true, appId, mock: true });
    const providerResponse = await GupshupPartnerService.registerPhoneForApp({
      appId,
      region: body.region,
      phoneNumber: body.phoneNumber
    });
    return NextResponse.json({ success: true, appId, providerResponse });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
});
