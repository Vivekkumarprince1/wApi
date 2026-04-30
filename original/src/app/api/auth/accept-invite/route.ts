import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db-connect";
import { User } from "@/lib/models";
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/accept-invite
 * Activates an invited user account by setting their name and password
 */
/**
 * POST /api/auth/accept-invite
 * Final endpoint to claim an invitation and join a workspace.
 * Handles both new signups and existing authenticated users.
 */
export async function POST(req: NextRequest) {
  await dbConnect();

  try {
    const body = await req.json();
    const { token, email, name, password, userId: providedUserId } = body;

    if (!token || !email) {
      return NextResponse.json({ error: "Token and Email are required" }, { status: 400 });
    }

    // 1. Resolve Invitation
    const { WorkspaceInvitation, Permission, Team, User } = await import("@/lib/models");
    
    const cleanEmail = String(email || '').trim().toLowerCase();
    
    const invitation = await WorkspaceInvitation.findOne({ 
      token 
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation token." }, { status: 404 });
    }

    if (invitation.email.toLowerCase() !== cleanEmail) {
      return NextResponse.json({ error: "This invitation belongs to a different email address." }, { status: 403 });
    }

    if (invitation.status === 'accepted') {
       return NextResponse.json({ error: "You have already accepted this invitation!" }, { status: 400 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: `Invitation is no longer valid (Status: ${invitation.status})` }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
       invitation.status = 'expired';
       await invitation.save();
       return NextResponse.json({ error: "This invitation has expired. Please request a new one." }, { status: 410 });
    }

    // 2. Resolve User
    // If providedUserId is sent (user just signed up/logged in) or if we can find by email
    let user = providedUserId ? await User.findById(providedUserId) : await User.findOne({ email: cleanEmail });

    // 3. Handle User Creation or Validation
    if (!user) {
      // New user MUST provide a password
      if (!password) {
        return NextResponse.json({ 
          error: "User account not found. A password is required to create your account.",
          actionRequired: 'signup'
        }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        name: name || invitation.name || email.split('@')[0],
        email,
        passwordHash,
        phone: invitation.phone,
        status: 'active',
        activeWorkspace: invitation.workspace,
        accountStatus: 'SIGNUP_COMPLETED',
        emailVerified: true,
        role: invitation.role as any
      });
    } else {
      // Existing user: We don't change their password.
      // We just ensure they are active.
      if (user.status === 'removed') {
        user.status = 'active';
        await user.save();
      }
    }

    // 4. Create or Re-activate Workspace Membership (Permission)
    const existingPerm = await Permission.findOne({ workspace: invitation.workspace, user: user._id });
    
    // Get role permissions
    let permissions;
    const systemRoles = ['owner', 'admin', 'manager', 'agent', 'viewer'];
    
    if (systemRoles.includes(invitation.role)) {
      permissions = (Permission as any).getDefaultPermissions(invitation.role);
    } else {
      const { Role } = await import("@/lib/models");
      const customRole = await Role.findOne({ workspace: invitation.workspace, name: invitation.role });
      permissions = customRole?.permissions || (Permission as any).getDefaultPermissions('agent');
    }

    const permissionData = {
      role: invitation.role,
      permissions: invitation.permissionsOverride || permissions,
      isActive: true, // Crucial for re-activating removed users
      joinedAt: new Date()
    };

    if (!existingPerm) {
      await Permission.create({
        workspace: invitation.workspace,
        user: user._id,
        ...permissionData
      });
    } else {
      // Re-activate and update role/permissions
      await Permission.findByIdAndUpdate(existingPerm._id, { $set: permissionData });
    }

    // 5. Update Team Memberships (Pre-assigned teams)
    if (invitation.teams && invitation.teams.length > 0) {
      await Team.updateMany(
        { _id: { $in: invitation.teams }, workspace: invitation.workspace },
        { $addToSet: { members: { user: user._id, role: 'member' } } }
      );
    }

    // 6. Update User Context
    user.activeWorkspace = invitation.workspace;
    user.status = 'active';
    await user.save();

    // 7. Mark Invitation as Accepted
    invitation.status = 'accepted';
    invitation.joinedAt = new Date();
    await invitation.save();

    console.log(`[Auth] Invitation accepted: User ${user.email} joined Workspace ${invitation.workspace}`);

    // 8. Create Notification for Admins/Inviter
    try {
      const { Notification, Permission } = await import("@/lib/models");
      
      // Find all owners of this workspace
      const owners = await Permission.find({
        workspace: invitation.workspace,
        role: 'owner',
        isActive: true
      }).select('user').lean();
      
      const ownerIds = owners.map(o => o.user.toString());
      
      // Determine all recipients (Inviter + Owners)
      const recipientIds = new Set<string>();
      if (invitation.invitedBy) recipientIds.add(invitation.invitedBy.toString());
      ownerIds.forEach(id => recipientIds.add(id));
      
      const notificationsToCreate = Array.from(recipientIds).map(recipientId => ({
        workspace: invitation.workspace,
        recipient: recipientId,
        type: 'invitation_accepted',
        title: 'New Team Member Joined',
        message: `${user.name || user.email} has accepted the invitation to join the workspace as ${invitation.role}.`,
        metadata: {
          joinedUserId: user._id,
          role: invitation.role
        }
      }));

      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
      }
    } catch (notifyErr) {
      console.error("[Auth] Failed to create admin notification:", notifyErr);
      // Don't fail the whole request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Successfully joined the workspace",
      workspaceId: invitation.workspace,
      userId: user._id
    });

  } catch (error: any) {
    console.error("[Auth] Invitation acceptance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

