/**
 * API: /api/auth/session
 * Port of legacy authController.session
 * Provides unified state for frontend hydration.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Permission, Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { getNextOnboardingPath } from "@/lib/services/onboarding/onboarding-state-service";
import { getWorkspaceAccessDecision } from "@/lib/services/workspace-access-service";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export const GET = withAuth(async (req: NextRequest, { user, workspace, isImpersonating }) => {
  try {
    await dbConnect();

    // ✅ MULTI-TENANCY FIX: Always use activeWorkspace over the legacy 'workspace' field.
    // When a user switches workspaces, only activeWorkspace is updated.
    const resolvedWorkspaceId = user.activeWorkspace || user.workspace;
    
    // Re-fetch fresh workspace data for the ACTIVE workspace (not the legacy one)
    const fullWorkspace = resolvedWorkspaceId 
      ? await Workspace.findById(resolvedWorkspaceId).populate('plan')
      : null;
    const workspaceToUse: any = fullWorkspace || workspace;

    // Self-healing: Trigger background sync if connected but potentially stale
    if (workspaceToUse?.whatsappConnected && workspaceToUse?.bspManaged) {
        const lastSync = workspaceToUse.bspLastSyncedAt ? new Date(workspaceToUse.bspLastSyncedAt).getTime() : 0;
        const now = Date.now();
        if (now - lastSync > 3600000) {
            const { syncAssignedGupshupApp } = await import("@/lib/services/bsp/gupshup-app-assignment-service");
            const { Business } = await import("@/lib/models");
            const business = await Business.findOne({ workspace: workspaceToUse._id });
            syncAssignedGupshupApp(user, workspaceToUse, business).catch(err => 
                console.error(`[SessionSync] Failed auto-sync for ${workspaceToUse.name}:`, err.message)
            );
        }
    }

    // Lightweight connection check parity
    const stage1Complete = !!(
      workspaceToUse?.bspWabaId &&
      (workspaceToUse?.bspPhoneNumberId || workspaceToUse?.phoneNumberId) &&
      workspaceToUse?.bspPhoneStatus === 'CONNECTED'
    );

    // ✅ MULTI-TENANCY FIX: Fetch permissions for the ACTIVE workspace
    const permission = await Permission.findOne({
      workspace: resolvedWorkspaceId,
      user: user._id
    });

    // ✅ SINGLE SOURCE OF TRUTH: Fetch wallet data from Billing Microservice
    let walletData = { balance: 0, thresholdAmount: 500, currency: 'INR' };
    try {
        const walletResponse = await BillingProxy.forward('GET', `/api/billing/wallets/${resolvedWorkspaceId}`, {
            workspaceId: resolvedWorkspaceId?.toString(),
            userId: user._id.toString()
        });
        
        if (walletResponse.status === 200) {
            let remoteWallet = walletResponse.data.wallet || {};
            
            // Automated Sync Check: If remote has not synced legacy balance yet, trigger it now.
            const localBalancePaise = fullWorkspace?.wallet?.balance ?? fullWorkspace?.walletBalance ?? 0;
            if (!remoteWallet.isLegacySynced && localBalancePaise > 0) {
                console.log(`[SessionSync] Merging legacy balance for ${workspaceToUse.name}: ${localBalancePaise} paise`);
                const syncRes = await BillingProxy.forward('POST', `/api/billing/wallets/${resolvedWorkspaceId}/sync`, {
                    data: { balancePaise: localBalancePaise },
                    workspaceId: resolvedWorkspaceId?.toString(),
                    userId: user._id.toString()
                });
                if (syncRes.status === 200) {
                    remoteWallet = syncRes.data.wallet;
                }
            }

            walletData = {
                balance: (remoteWallet.availableBalance ?? 0) / 100,
                thresholdAmount: (remoteWallet.thresholdAmount ?? 50000) / 100,
                currency: remoteWallet.currency ?? 'INR'
            };
        }
    } catch (billingErr: any) {
        console.error(`[SessionWalletFetch] Billing service unreachable for ${resolvedWorkspaceId}:`, billingErr.message);
        // If service is down, show 0.00 instead of stale legacy data, per user request.
        walletData = {
          balance: 0,
          isServiceDown: true,
          currency: 'INR'
        };
    }

    // ✅ INVITED MEMBER FIX:
    // Invited members (non-owners) should NOT be blocked by the workspace owner's
    // onboarding flow. The onboarding is completed by the workspace owner.
    // We only run onboarding checks for owners setting up a workspace.
    const workspaceRole = permission?.role;
    const isWorkspaceOwner = workspaceRole === 'owner';

    let accessDecision;
    if (!isWorkspaceOwner && workspaceRole) {
      // Non-owner members: skip onboarding check, only check billing
      const { isWorkspaceBillingValid, getWorkspaceBillingStatus } = await import("@/lib/services/workspace-access-service");
      const billingStatus = getWorkspaceBillingStatus(workspaceToUse);
      const isBillingValid = isWorkspaceBillingValid(workspaceToUse);
      accessDecision = {
        accessRestriction: isBillingValid ? null : {
          kind: 'billing' as const,
          title: 'No valid plan',
          description: `This workspace does not have an active plan.`,
          targetPath: '/dashboard/billing',
          actionLabel: 'View Billing'
        },
        nextStep: null,
        billingStatus,
        isBillingValid
      };
    } else {
      // Owners and unresolved roles: full check
      accessDecision = await getWorkspaceAccessDecision(user, workspaceToUse);
    }

    const data = {
      permissions: permission?.permissions || null,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
        team: user.team,
        emailVerified: !!user.emailVerified,
        phoneVerified: !!user.phoneVerified,
        authProvider: user.authProvider || 'local',
        accountStatus: user.accountStatus || 'AWAITING_EMAIL_VERIFICATION',
        createdAt: user.createdAt
      },
      workspace: workspaceToUse ? {
        id: workspaceToUse._id,
        name: workspaceToUse.name,
        plan: workspaceToUse.plan || 'free',
        billingStatus: workspaceToUse.billingStatus || 'trialing',
        whatsappConnected: workspaceToUse.whatsappConnected || stage1Complete,
        onboarding: workspaceToUse.onboarding,
        stage1: { 
          complete: stage1Complete,
          phoneStatus: workspaceToUse.bspPhoneStatus || (workspaceToUse.whatsappConnected ? 'CONNECTED' : 'NOT_CONNECTED')
        }, 
        address: workspaceToUse.address,
        city: workspaceToUse.city,
        state: workspaceToUse.state,
        country: workspaceToUse.country,
        zipCode: workspaceToUse.zipCode,
        industry: workspaceToUse.industry,
        website: workspaceToUse.website,
        wallet: walletData,
        role: workspaceRole || null // expose the user's role in this workspace
      } : null,
      phone: {
        number: user.phone,
        verified: !!user.phoneVerified
      },
      nextStep: accessDecision.nextStep,
      accessRestriction: accessDecision.accessRestriction,
      authenticated: true,
      isImpersonating: !!isImpersonating
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[Session API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
