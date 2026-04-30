import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db-connect";
import { WorkspaceInvitation, User } from "@/lib/models";

/**
 * GET /api/auth/invitation/[token]
 * Public endpoint to fetch invitation details and check if user exists globally.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    await dbConnect();
    const { token } = await params;
    const email = req.nextUrl.searchParams.get('email');

    if (!token || !email) {
      return NextResponse.json({ error: "Token and Email are required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log(`[Auth:Verify] Checking token: ${token}, email: ${cleanEmail}`);

    // Query by token only — it is a unique 64-char hex hash
    const invitation = await WorkspaceInvitation.findOne({ token }).populate('workspace', 'name');

    if (!invitation) {
      console.log(`[Auth:Verify] ❌ No invitation found for token: ${token}`);
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    // Email sanity check
    if (invitation.email.toLowerCase() !== cleanEmail) {
      console.log(`[Auth:Verify] ❌ Email mismatch. DB: ${invitation.email}, URL: ${cleanEmail}`);
      return NextResponse.json({ error: "This invitation was sent to a different email address." }, { status: 403 });
    }

    // Status check — provide a helpful message instead of generic error
    if (invitation.status === 'accepted') {
      // Check if there's a newer pending invitation for the same workspace+email
      const newInvite = await WorkspaceInvitation.findOne({
        email: cleanEmail,
        workspace: invitation.workspace,
        status: 'pending',
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      if (newInvite) {
        // Transparently redirect client to the newer invitation
        return NextResponse.json({
          error: "This invitation link is outdated. A newer invitation is available.",
          redirectToken: newInvite.token,
          redirectEmail: newInvite.email
        }, { status: 410 });
      }

      return NextResponse.json({ error: "You have already accepted this invitation!" }, { status: 400 });
    }

    if (invitation.status !== 'pending') {
      console.log(`[Auth:Verify] ❌ Invitation status is ${invitation.status}`);
      return NextResponse.json({ error: `This invitation has been ${invitation.status}.` }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invitation has expired. Please request a new one." }, { status: 410 });
    }

    // Check if user already exists globally
    const existingUser = await User.findOne({ email: cleanEmail });

    return NextResponse.json({
      success: true,
      data: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        workspaceName: (invitation.workspace as any)?.name,
        userExists: !!existingUser,
        authProvider: existingUser?.authProvider || 'local'
      }
    });

  } catch (error: any) {
    console.error("[Auth] Invitation info error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
