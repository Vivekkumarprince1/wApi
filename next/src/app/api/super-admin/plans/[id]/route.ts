/**
 * INDIVIDUAL PLAN MANAGEMENT API
 * 
 * Handles update and deletion of specific subscription tiers.
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const PATCH = withRole(['super_admin'], async (req: NextRequest, { params }: any) => {
  const { id } = await params;
  try {
    const body = await req.json();
    await dbConnect();

    const plan = await Plan.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true });

    if (!plan) {
      return NextResponse.json({ message: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (err: any) {
    console.error(`[Plan Update Error]: ${id}`, err.message);
    return NextResponse.json({ message: "Failed to update plan", error: err.message }, { status: 400 });
  }
}) as any;

export const DELETE = withRole(['super_admin'], async (req: NextRequest, { params }: any) => {
  const { id } = await params;
  try {
    // Hard delete the plan record
    const plan = await Plan.findByIdAndDelete(id);

    if (!plan) {
      return NextResponse.json({ message: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Plan permanently deleted successfully" });
  } catch (err: any) {
    console.error(`[Plan Deletion Error]: ${id}`, err.message);
    return NextResponse.json({ message: "Failed to delete plan", error: err.message }, { status: 400 });
  }
}) as any;
