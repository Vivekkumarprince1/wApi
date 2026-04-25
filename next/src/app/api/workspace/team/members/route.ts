import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/middlewares/auth";
import { User, Workspace, Permission, Conversation } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import crypto from 'crypto';

/**
 * GET /api/workspace/team/members
 * List all members in the workspace with enriched data (online status, load, teams)
 */
export const GET = withAuth(async (req: NextRequest, { user, workspace }) => {
  await dbConnect();

  const isElevatedRole = ['owner', 'admin', 'manager'].includes(user.role);
  const permission = await Permission.findOne({ workspace: workspace._id, user: user._id })
    .select('permissions.viewAllConversations permissions.assignConversations permissions.manageTeam')
    .lean();

  const canViewTeam = isElevatedRole || Boolean(
    permission?.permissions?.manageTeam ||
    permission?.permissions?.assignConversations ||
    permission?.permissions?.viewAllConversations
  );

  if (!canViewTeam) {
    return NextResponse.json({
      success: false,
      error: "Permission denied"
    }, { status: 403 });
  }
  
  const memberships = await Permission.find({
    workspace: workspace._id,
    isActive: { $ne: false }
  })
    .populate('user', '_id name email phone role status joinedAt invitedAt')
    .lean();

  // Fetch Pending Invitations
  const { WorkspaceInvitation, Team } = await import("@/lib/models");
  const pendingInvites = await WorkspaceInvitation.find({
    workspace: workspace._id,
    status: 'pending'
  }).lean();

  // Enrich with online status, conversation counts, and multi-team memberships
  const members = await Promise.all(memberships.map(async (m: any) => {
    const member = m.user;
    if (!member) return null;

    const [openCount, memberTeams] = await Promise.all([
      Conversation.countDocuments({
        workspace: workspace._id,
        assignedTo: member._id,
        status: { $in: ['open', 'pending'] }
      }),
      Team.find({ 
        workspace: workspace._id, 
        members: { $elemMatch: { user: member._id } }
      }).select('_id name').lean()
    ]);

    return {
      ...member,
      role: m.role, // Use the role from Permission record
      isOnline: m.isOnline || false,
      isAvailable: m.isAvailable || false,
      lastSeenAt: m.lastSeenAt || null,
      openConversations: openCount || 0,
      teams: memberTeams || []
    };
  }));

  const filteredMembers = members.filter(Boolean);


  // Combine and return
  return NextResponse.json({
    success: true,
    data: {
      members: filteredMembers,
      invitations: pendingInvites.map(inv => ({
        id: inv._id,
        email: inv.email,
        name: inv.name,
        phone: inv.phone || '',
        role: inv.role,
        status: 'pending',
        invitedAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        token: inv.token 
      }))
    }
  });
});


/**
 * POST /api/workspace/team/members
 * Invite a new member to the workspace
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { user: inviter, workspace }) => {
  await dbConnect();
  
  const body = await req.json();
  const rawEmail = body.email;
  const email = String(rawEmail || '').trim().toLowerCase();
  const { name, role, phone, teamIds = [] } = body;

  if (!email || !role) {
    return NextResponse.json({ error: "Email and Role are required" }, { status: 400 });
  }

  // 1. Check if an active invitation already exists for this email in THIS workspace
  const { WorkspaceInvitation } = await import("@/lib/models");
  
  const existingInvite = await WorkspaceInvitation.findOne({
    email,
    workspace: workspace._id,
    status: 'pending'
  });

  if (existingInvite) {
    // AUTOMATIC RESEND: If invite exists, refresh token/expiry and resend
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    existingInvite.token = invitationToken;
    existingInvite.expiresAt = expiresAt;
    existingInvite.status = 'pending'; // MUST reset status to pending for re-invites
    existingInvite.resendCount = (existingInvite.resendCount || 0) + 1;
    existingInvite.lastSentAt = new Date();
    await existingInvite.save();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5001';
    const invitationUrl = `${baseUrl}/auth/accept-invite?token=${invitationToken}&email=${encodeURIComponent(email)}`;

    const { MailService } = await import("@/lib/services/shared/mail-service");
    const emailStatus = await MailService.sendInvitation({
      to: email,
      inviterName: inviter.name,
      workspaceName: workspace.name,
      role: existingInvite.role,
      invitationUrl
    });

    return NextResponse.json({
      success: true,
      message: "Existing invitation updated and email resent.",
      data: {
        id: existingInvite._id,
        email: existingInvite.email,
        resendCount: existingInvite.resendCount,
        emailStatus
      }
    });
  }

  // 2. Check if user is already a member (has Permission record)
  const existingUser = await User.findOne({ email }).select('name phone email').lean();
  if (existingUser) {
    const { Permission } = await import("@/lib/models");
    const existingMember = await Permission.findOne({ 
      workspace: workspace._id, 
      user: existingUser._id,
      isActive: { $ne: false } // Only conflict if they are currently active
    });
    if (existingMember) {
      return NextResponse.json({ 
        error: "User is already a member of this workspace",
        user: existingUser,
        isMember: true
      }, { status: 409 });
    }
  }

  // 3. Create the Shadow Invitation
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const invitation = await WorkspaceInvitation.create({
    email,
    name: name || email.split('@')[0],
    workspace: workspace._id,
    role,
    invitedBy: inviter._id,
    token: invitationToken,
    teams: teamIds,
    phone: phone || undefined,
    expiresAt,
    status: 'pending'
  });

  // 4. Generate Smart Invitation URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const invitationUrl = `${baseUrl}/auth/accept-invite?token=${invitationToken}&email=${encodeURIComponent(email)}`;
  
  // 5. Send Invitation Email
  const { MailService } = await import("@/lib/services/shared/mail-service");
  let emailStatus: any = { success: false, method: 'none' };
  
  try {
    emailStatus = await MailService.sendInvitation({
      to: email,
      inviterName: inviter.name,
      workspaceName: workspace.name,
      role,
      invitationUrl
    });
  } catch (mailErr: any) {
    console.warn(`[TeamInvitation] 📧 Mail error: ${mailErr.message}`);
    emailStatus = { success: false, error: mailErr.message };
  }

  console.log(`[TeamInvitation] 📧 Shadow Invite created for ${email}: ${invitationUrl}`);

  return NextResponse.json({
    success: true,
    data: {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      invitationUrl: invitationUrl,
      isExistingUser: !!existingUser,
      emailStatus // Return the detailed email status
    }
  });
});
