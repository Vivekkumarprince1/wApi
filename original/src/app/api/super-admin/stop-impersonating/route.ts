import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, setAuthCookie, TokenPayload } from "@/lib/auth-utils";
import { User } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { cookies } from "next/headers";

/**
 * POST /api/super-admin/stop-impersonating
 * Restores the original administrative session.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    // 1. Get current token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // 2. Verify token and check for adminId
    const decoded = verifyToken(token) as TokenPayload;
    if (!decoded || !decoded.adminId) {
      return NextResponse.json({ error: "No active impersonation detected" }, { status: 400 });
    }

    // 3. Find the original admin user
    const adminUser = await User.findById(decoded.adminId);
    if (!adminUser) {
      return NextResponse.json({ error: "Original administrative identity not found" }, { status: 404 });
    }

    // 4. Log the exit
    console.log(`[Admin Audit] Admin ${adminUser.email} is terminating impersonation.`);

    // 5. Generate new token for the original admin (clean session)
    const newToken = signToken({ id: adminUser._id.toString() });

    // 6. Create response and restore admin dashboard
    const response = NextResponse.json({
      success: true,
      message: "Administrative session restored.",
      targetUrl: '/super-admin'
    });

    return setAuthCookie(response, newToken);

  } catch (error: any) {
    console.error("Stop impersonation failed", error);
    return NextResponse.json({ error: "System failure during session restoration" }, { status: 500 });
  }
}
