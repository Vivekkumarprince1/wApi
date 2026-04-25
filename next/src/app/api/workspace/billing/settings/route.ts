/**
 * BILLING SETTINGS API
 * 
 * Securely updates workspace billing configurations (Autopay, Tax ID).
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const PATCH = withAuth(async (req: any, { workspace, user, role }: any) => {
  try {
    const { autoPay, taxId } = await req.json();
    await dbConnect();

    // Ensure only owners/admins can change billing settings (super_admin bypasses)
    if (user.role !== 'super_admin' && role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ message: "Forbidden: Higher clearance required" }, { status: 403 });
    }

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      { 
        $set: { 
          autoPay: typeof autoPay === 'boolean' ? autoPay : undefined,
          taxId: taxId !== undefined ? taxId : undefined
        } 
      },
      { new: true, runValidators: true }
    );

    if (!updatedWorkspace) {
      return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        autoPay: updatedWorkspace.autoPay,
        taxId: updatedWorkspace.taxId
      }
    });
  } catch (err: any) {
    console.error("[Billing Settings Error]:", err.message);
    return NextResponse.json({ message: "Failed to update settings", error: err.message }, { status: 400 });
  }
}) as any;
