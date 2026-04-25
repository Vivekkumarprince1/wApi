import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, OnboardingState } from '@/lib/models';
import { startGupshupOnboarding } from '@/lib/services/bsp/gupshup-app-assignment-service';

export const POST = withAuth(async (_req: NextRequest, { user, workspace }) => {
  try {
    const body = await _req.json().catch(() => ({}));
    const connectionType = body.connectionType === 'new_number' || body.connectionType === 'migrate'
      ? body.connectionType
      : 'business_app';
    const region = typeof body.region === 'string' ? body.region : undefined;
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber : undefined;
    const idempotencyKey = _req.headers.get('x-idempotency-key') || _req.headers.get('idempotency-key') || undefined;
    const existingState = await OnboardingState.findOne({ user: user._id });

    const existingSession = existingState?.metadata?.bspSession as any;
    if (
      idempotencyKey &&
      existingSession?.idempotencyKey === idempotencyKey &&
      existingSession?.connectionType === connectionType &&
      existingSession?.region === region &&
      existingSession?.expiresAt &&
      new Date(existingSession.expiresAt).getTime() > Date.now() &&
      existingSession?.url
    ) {
      return NextResponse.json({
        success: true,
        url: existingSession.url,
        state: existingSession.state,
        expiresAt: existingSession.expiresAt,
        appId: existingSession.appId,
        reused: true
      });
    }

    const business = await Business.findOne({ workspace: workspace._id });
    if (!business) {
      return NextResponse.json({
        success: false,
        message: 'Complete business profile before WhatsApp setup',
        code: 'BUSINESS_NOT_READY'
      }, { status: 400 });
    }

    const result = await startGupshupOnboarding(user, workspace, business, { connectionType, region, phoneNumber });
    await OnboardingState.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          'metadata.bspState': result.state,
          'metadata.bspStateExpiresAt': result.expiresAt,
          'metadata.bspSession': {
            idempotencyKey,
            connectionType,
            region,
            phoneNumber,
            state: result.state,
            appId: result.app.gupshupAppId,
            url: result.url,
            expiresAt: result.expiresAt,
            updatedAt: new Date().toISOString()
          }
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      url: result.url,
      state: result.state,
      expiresAt: result.expiresAt,
      appId: result.app.gupshupAppId,
      connectionType: result.connectionType || connectionType
    });
  } catch (error: any) {
    const responseData = error.response?.data;
    console.error('[BSP/START] Failed to start onboarding:', responseData || error.message);
    const errorMsg = responseData?.message || responseData || error.message;
    return NextResponse.json({ 
      success: false, 
      message: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg), 
      code: error.code || error.response?.status 
    }, { status: error.response?.status || error.status || 500 });
  }
});
