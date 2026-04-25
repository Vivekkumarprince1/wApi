import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/middlewares/auth";
import { Invoice } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = isSuperAdmin(async (req: NextRequest) => {
  try {
    await dbConnect();
    
    const invoices = await Invoice.find({})
      .populate('workspace', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json(invoices);
  } catch (err: any) {
    console.error("[Invoices Admin API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;
