/**
 * API: /api/auth/me
 * Port of legacy authController.me
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withAuth(async (req: NextRequest, { user, workspace }) => {
  try {
    await dbConnect();

    // Ensure we have a valid plan object for the response
    let planObj = workspace?.plan;
    if (!planObj || typeof planObj === 'string') {
      // Resolve dynamic default if relationship is missing or broken
      planObj = await Plan.findOne({ isDefault: true }) || await Plan.findOne({ isActive: true });
    }

    // Prepare comprehensive response parity
    const response = {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        timezone: user.timezone || 'Asia/Kolkata',
        role: user.role,
        team: user.team,
        emailVerified: user.emailVerified || false,
        accountStatus: user.accountStatus || 'AWAITING_EMAIL_VERIFICATION',
        createdAt: user.createdAt
      },
      workspace: workspace ? {
        _id: workspace._id,
        name: workspace.name,
        plan: planObj || 'free',
        // planLimits & usage handled by Mongoose virtuals/logic if ported
        subscription: {
          status: workspace.billingStatus || 'active',
        },
        whatsapp: {
          isConnected: !!workspace.whatsappPhoneNumberId,
          phoneNumber: workspace.whatsappPhoneNumber || null,
          phoneNumberId: workspace.whatsappPhoneNumberId || null,
          wabaId: workspace.bspWabaId || null,
        },
        verification: {
          status: workspace.businessVerification?.status || 'not_submitted',
        },
        documents: {
          gstNumber: workspace.businessDocuments?.gstNumber,
          hasDocuments: !!(workspace.businessDocuments?.gstNumber || workspace.businessDocuments?.certificationNumber)
        }
      } : null,
      authenticated: true
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[Me API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  try {
    await dbConnect();

    const body = await req.json();
    const { name, phone, timezone } = body;

    const update: Record<string, any> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (timezone !== undefined) update.timezone = timezone;

    const updatedUser = await (await import('@/lib/models')).User.findByIdAndUpdate(
      user._id,
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        timezone: updatedUser.timezone || 'Asia/Kolkata',
      }
    });
  } catch (err: any) {
    console.error('[Me PATCH Error]:', err.message);
    return NextResponse.json({ message: 'Server Error', error: err.message }, { status: 500 });
  }
});
