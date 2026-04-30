import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db-connect";
import { verifyToken } from "@/lib/auth-utils";
import { User, WorkspaceInvitation } from "@/lib/models";

/**
 * GET /api/auth/invitations/pending
 * List all pending invitations for the current logged-in user.
 */
export async function GET(req: NextRequest) {
  await dbConnect();

  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ success: true, data: [] });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return NextResponse.json({ success: true, data: [] });
  }

  const user = await User.findById(decoded.id).select('email');
  if (!user || !user.email) {
    return NextResponse.json({ success: true, data: [] });
  }

  console.log(`[Invitations:Pending] Fetching for email: ${user.email}`);

  const invitations = await WorkspaceInvitation.find({
    email: user.email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
  .populate('workspace', 'name')
  .lean();

  const { Notification } = await import("@/lib/models");
  const notifications = await Notification.find({
    recipient: user._id,
    read: false
  }).sort({ createdAt: -1 }).limit(10).lean();

  const formattedInvites = invitations.map((inv: any) => ({
    id: inv._id,
    type: 'invitation',
    workspaceName: inv.workspace?.name || 'Unknown Workspace',
    role: inv.role,
    token: inv.token,
    email: inv.email,
    createdAt: inv.createdAt
  }));

  const formattedNotifications = notifications.map((n: any) => ({
    id: n._id,
    type: 'system',
    title: n.title,
    message: n.message,
    link: n.link,
    createdAt: n.createdAt,
    metadata: n.metadata
  }));

  return NextResponse.json({
    success: true,
    data: [...formattedInvites, ...formattedNotifications]
  });
}
