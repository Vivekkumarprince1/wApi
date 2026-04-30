import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/middlewares/auth";
import axios from "axios";

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://localhost:3003";

export const GET = isSuperAdmin(async (req: NextRequest) => {
  try {
    const response = await axios.get(`${BILLING_SERVICE_URL}/api/billing/wallets/admin/stats`);
    return NextResponse.json(response.data);
  } catch (err: any) {
    console.error("[Billing Stats Admin API Error]:", err.response?.data || err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;
