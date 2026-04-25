import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, BusinessAppMap } from '@/lib/models';

export const GET = withAuth(async (_req: NextRequest, { workspace }) => {
  const business = await Business.findOne({ workspace: workspace?._id });
  const map = business ? await BusinessAppMap.findOne({ business: business._id, active: true }) : null;

  return NextResponse.json({
    success: true,
    connected: !!workspace?.whatsappConnected || workspace?.bspPhoneStatus === 'CONNECTED',
    status: workspace?.onboardingStatus || workspace?.esbFlow?.status || 'not_started',
    app: map ? { gupshupAppId: map.gupshupAppId } : workspace?.gupshupAppId ? { gupshupAppId: workspace.gupshupAppId } : null,
    workspace: workspace ? {
      id: workspace._id,
      name: workspace.name,
      gupshupAppId: workspace.gupshupAppId,
      phoneNumber: workspace.whatsappPhoneNumber || workspace.bspDisplayPhoneNumber,
      phoneNumberId: workspace.whatsappPhoneNumberId || workspace.bspPhoneNumberId,
      phoneStatus: workspace.bspPhoneStatus,
      connectedAt: workspace.connectedAt
    } : null
  });
});
