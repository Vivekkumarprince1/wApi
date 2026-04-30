import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/middlewares/auth";
import { WorkspaceInvitation } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * POST /api/workspace/team/members/[memberId]/resend
 * Resend an invitation email for a pending invite.
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { params, user: currentUser, workspace }) => {
  try {
    const { memberId } = await params;
    const appOrigin = new URL(req.url).origin;
    await dbConnect();

    // 1. Find the invitation
    const invitation = await WorkspaceInvitation.findOne({
      _id: memberId,
      workspace: workspace._id,
      status: 'pending'
    });

    if (!invitation) {
      return NextResponse.json({ message: "Pending invitation not found" }, { status: 404 });
    }

    // 2. Refresh expiry (extend by 7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    invitation.expiresAt = expiresAt;
    
    // 3. Update resend metadata
    invitation.resendCount = (invitation.resendCount || 0) + 1;
    invitation.lastSentAt = new Date();

    await invitation.save();

    // 4. Generate Invitation URL
    const invitationUrl = `${appOrigin}/auth/accept-invite?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

    // 5. Send Invitation Email
    const { MailService } = await import("@/lib/services/shared/mail-service");
    let emailStatus: any = { success: false, method: 'none' };
    
    try {
      emailStatus = await MailService.sendInvitation({
        to: invitation.email,
        inviterName: currentUser.name,
        workspaceName: workspace.name,
        role: invitation.role,
        invitationUrl
      });
    } catch (mailErr: any) {
      console.warn(`[TeamInvitation:Resend] 📧 Mail error: ${mailErr.message}`);
      emailStatus = { success: false, error: mailErr.message };
    }

    return NextResponse.json({
      success: true,
      message: "Invitation email resent successfully",
      data: {
        id: invitation._id,
        email: invitation.email,
        resendCount: invitation.resendCount,
        lastSentAt: invitation.lastSentAt,
        emailStatus
      }
    });

  } catch (err: any) {
    console.error("[Team Member Resend Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
