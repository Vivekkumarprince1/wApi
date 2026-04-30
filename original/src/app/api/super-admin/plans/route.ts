import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withRole(['super_admin'], async (req: NextRequest) => {
  try {
    await dbConnect();
    
    // Fetch all plans for admin view
    const plans = await Plan.find()
      .sort({ isActive: -1, monthlyBaseFeeCents: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: plans,
    });
  } catch (err: any) {
    console.error("[Plans Admin API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;

export const POST = withRole(['super_admin'], async (req: NextRequest) => {
  try {
    const body = await req.json();
    await dbConnect();
    
    const plan = await Plan.create(body);
    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (err: any) {
    console.error("[Plan Creation Error]:", err.message);
    return NextResponse.json({ message: "Failed to create plan", error: err.message }, { status: 400 });
  }
}) as any;
