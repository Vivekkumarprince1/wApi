import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { User } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withRole(['super_admin'], async (req) => {
  try {
    await dbConnect();
    
    // Fetch all users with workspace populate
    const users = await User.find({})
      .populate('workspace', 'name')
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return NextResponse.json(users);
  } catch (err: any) {
    console.error("[Users Admin API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;
