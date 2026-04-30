import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import { CommerceSettings } from '@/lib/models/commerce/CommerceSettings';
import dbConnect from '@/lib/db-connect';

/**
 * GET commerce settings for current workspace
 */
export const GET = withFeature('COMMERCE_SETTINGS', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    
    let settings = await CommerceSettings.findOne({ workspaceId: workspace._id });
    
    if (!settings) {
      // Create default settings if not exists
      settings = await CommerceSettings.create({
        workspaceId: workspace._id,
        enabled: true,
        currency: 'INR',
        taxPercentage: 0,
        shipping: {
          enabled: false,
          flatRate: { enabled: false, amount: 0 }
        }
      });
    }
    
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error("[Commerce Settings GET Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * POST update commerce settings
 */
export const POST = withFeature('COMMERCE_SETTINGS', async (req: NextRequest, { workspace, user }) => {
  try {
    await dbConnect();
    const body = await req.json();

    const settings = await CommerceSettings.findOneAndUpdate(
      { workspaceId: workspace._id },
      { 
        ...body, 
        workspaceId: workspace._id,
        updatedBy: user._id, 
        lastModifiedBy: user._id 
      },
      { returnDocument: 'after', upsert: true }
    );

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error("[Commerce Settings POST Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
