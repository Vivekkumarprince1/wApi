/**
 * API: /api/workspace/team/members/[memberId]
 * Port of legacy teamController.updateMember & teamController.removeTeamMember
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole, withAuth } from "@/lib/middlewares/auth";
import { User, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * PATCH: Update a specific team member
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { params, user: currentUser, workspace }) => {
  try {
    const { memberId } = params;
    const { name, role, phone, isActive, resendEmail, teamIds } = await req.json();

    await dbConnect();

    // Find the member
    const member = await User.findById(memberId);

    if (member) {
      if (resendEmail) {
        return NextResponse.json({
          success: false,
          message: "Resend email is only available for pending invitations",
        }, { status: 400 });
      }

      // Restriction: Cannot change own role if owner (to prevent lockout)
      if (memberId === currentUser._id.toString() && member.role === 'owner' && role && role !== 'owner') {
        return NextResponse.json({ message: "Owners cannot demote themselves" }, { status: 400 });
      }

      // Update User
      if (name !== undefined) member.name = name;
      
      // Protect global 'super_admin' and 'owner' from being overwritten by workspace role assignments
      if (role !== undefined && !['super_admin', 'owner'].includes(member.role)) {
        member.role = role;
      }
      
      if (phone !== undefined) member.phone = phone;
      
      await member.save();

      // Handle Permission specific updates (role and isActive)
      if (role || typeof isActive === 'boolean') {
        const updateData: any = {};
        
        if (typeof isActive === 'boolean') {
          updateData.isActive = isActive;
        }
        
        if (role) {
          let permissions;
          let resolvedRole = role;
          const normalizedRole = String(role).trim().toLowerCase();
          const systemRoles = ['owner', 'admin', 'manager', 'agent', 'viewer'];
          
          if (systemRoles.includes(normalizedRole)) {
            resolvedRole = normalizedRole;
            permissions = (Permission as any).getDefaultPermissions(normalizedRole);
          } else {
            const { Role } = await import("@/lib/models");
            const customRoles = await Role.find({ workspace: workspace._id }).select('name slug permissions').lean();
            const customRole = customRoles.find((candidate: any) => {
              const candidateNames = [candidate?.name, candidate?.slug]
                .filter(Boolean)
                .map((value) => String(value).trim().toLowerCase());
              return candidateNames.includes(normalizedRole);
            });

            if (customRole) {
              resolvedRole = customRole.name;
              permissions = customRole.permissions;
            } else {
              permissions = (Permission as any).getDefaultPermissions('agent');
            }
          }
          updateData.role = resolvedRole;
          updateData.permissions = permissions;
        }

        await Permission.findOneAndUpdate(
          { user: member._id, workspace: workspace._id },
          updateData
        );
      }

      // Handle team membership updates
      if (Array.isArray(teamIds)) {
        const { Team } = await import("@/lib/models");
        // Full replace: remove from all teams in this workspace, then re-add
        await Team.updateMany(
          { workspace: workspace._id },
          { $pull: { members: { user: member._id } } }
        );
        if (teamIds.length > 0) {
          await Team.updateMany(
            { _id: { $in: teamIds }, workspace: workspace._id },
            { $push: { members: { user: member._id, role: 'member', addedAt: new Date() } } }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: "Member updated successfully",
        data: member
      });
    }

    const { WorkspaceInvitation } = await import("@/lib/models");
    const invitation = await WorkspaceInvitation.findOne({
      _id: memberId,
      workspace: workspace._id,
      status: 'pending'
    });

    if (!invitation) {
      return NextResponse.json({ message: "Team member or invitation not found" }, { status: 404 });
    }

    if (name !== undefined) invitation.name = name;
    if (role !== undefined) {
      const normalizedRole = String(role).trim().toLowerCase();
      const systemRoles = ['owner', 'admin', 'manager', 'agent', 'viewer'];

      if (systemRoles.includes(normalizedRole)) {
        invitation.role = normalizedRole;
      } else {
        const { Role } = await import("@/lib/models");
        const customRoles = await Role.find({ workspace: workspace._id }).select('name slug').lean();
        const customRole = customRoles.find((candidate: any) => {
          const candidateNames = [candidate?.name, candidate?.slug]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase());
          return candidateNames.includes(normalizedRole);
        });

        invitation.role = customRole?.name || role;
      }
    }
    if (phone !== undefined) invitation.phone = phone;
    if (Array.isArray(teamIds)) invitation.teams = teamIds;

    await invitation.save();

    let emailStatus: any = { success: false, method: 'none' };
    let invitationUrl: string | null = null;

    if (resendEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      invitationUrl = `${baseUrl}/auth/accept-invite?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

      try {
        const { MailService } = await import("@/lib/services/shared/mail-service");
        emailStatus = await MailService.sendInvitation({
          to: invitation.email,
          inviterName: currentUser.name,
          workspaceName: workspace.name,
          role: invitation.role,
          invitationUrl,
        });
        
        if (emailStatus.success) {
           invitation.resendCount = (invitation.resendCount || 0) + 1;
           invitation.lastSentAt = new Date();
           await invitation.save();
        }
      } catch (mailErr: any) {
        console.warn(`[TeamInvitation] 📧 Resend mail error: ${mailErr.message}`);
        emailStatus = { success: false, error: mailErr.message };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Invitation updated successfully",
      data: {
        id: invitation._id,
        email: invitation.email,
        name: invitation.name,
        phone: invitation.phone,
        role: invitation.role,
        status: invitation.status,
        invitedAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        token: invitation.token,
        teams: invitation.teams,
        invitationUrl,
        emailStatus,
      }
    });
  } catch (err: any) {
    console.error("[Team Member PATCH Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

/**
 * DELETE: Remove a specific team member or revoke invitation
 */
export const DELETE = withAuth(async (req: NextRequest, { params, user: currentUser, workspace }) => {
  try {
    const { memberId } = params;
    const { Permission: CurrentPermission } = await import("@/lib/models");

    await dbConnect();

    // 1. Authorization Check
    const normalizedRole = String(currentUser?.role || '').toLowerCase();
    const permissionRecord = await CurrentPermission.findOne({ workspace: workspace._id, user: currentUser._id })
      .select('permissions.manageTeam')
      .lean();

    const isAuthorized = ['owner', 'admin', 'manager'].includes(normalizedRole) || Boolean(permissionRecord?.permissions?.manageTeam);

    if (!isAuthorized) {
      return NextResponse.json({ message: "You do not have permission to remove this member" }, { status: 403 });
    }

    // 2. Try to find active member (User)
    const member = await User.findById(memberId);
    
    if (member) {
      // Restriction: Cannot delete yourself
      if (memberId === currentUser._id.toString()) {
        return NextResponse.json({ message: "You cannot remove yourself from the workspace" }, { status: 400 });
      }

      // Restriction: Cannot delete the owner
      if (member.role === 'owner') {
        return NextResponse.json({ message: "Workspace owner cannot be removed" }, { status: 400 });
      }

      // Deactivate permissions for this workspace
      await Permission.findOneAndUpdate(
        { user: memberId, workspace: workspace._id },
        { $set: { isActive: false, isOnline: false, isAvailable: false } }
      );
      
      // Clean up team memberships
      const { Team } = await import("@/lib/models");
      await Team.updateMany(
         { workspace: workspace._id },
         { $pull: { members: { user: memberId } } }
      );

      const { Conversation } = await import("@/lib/models");
      await Conversation.updateMany(
        { workspace: workspace._id, assignedTo: memberId, status: { $in: ['open', 'pending'] } },
        { $unset: { assignedTo: '' } }
      );
      
      return NextResponse.json({
        success: true,
        message: "Team member removed from workspace"
      });
    }

    // 3. If not a User, check if it's a Pending Invitation
    const { WorkspaceInvitation } = await import("@/lib/models");
    const invitation = await WorkspaceInvitation.findOne({ _id: memberId, workspace: workspace._id });
    
    if (invitation) {
      await WorkspaceInvitation.findByIdAndDelete(memberId);
      return NextResponse.json({
        success: true,
        message: "Invitation revoked successfully"
      });
    }

    return NextResponse.json({ message: "Entity not found (Agent or Invitation)" }, { status: 404 });

  } catch (err: any) {
    console.error("[Team Member DELETE Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});


