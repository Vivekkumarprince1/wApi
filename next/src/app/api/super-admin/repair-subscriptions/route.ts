import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Workspace, Business } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { syncAssignedGupshupApp } from "@/lib/services/bsp/gupshup-app-assignment-service";

/**
 * GET /api/super-admin/repair-subscriptions
 * Admin utility to fix missing Gupshup webhooks for all active workspaces.
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
    // Basic Admin check
    if (user.role !== 'admin' && user.role !== 'super_admin') {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    try {
        await dbConnect();
        
        const { searchParams } = new URL(req.url);
        const specificAppId = searchParams.get('appId');

        console.log(`[RepairAPI] Starting repair... ${specificAppId ? `Target: ${specificAppId}` : 'Target: ALL'}`);
        
        const query: any = { 
            whatsappConnected: true, 
            bspManaged: true 
        };
        if (specificAppId) {
            query.$or = [
                { gupshupAppId: specificAppId },
                { 'gupshupIdentity.partnerAppId': specificAppId }
            ];
        }

        const workspaces = await Workspace.find(query);

        const results = {
            total: workspaces.length,
            processed: 0,
            failed: 0,
            details: [] as any[]
        };

        // We process these sequentially to avoid flooding the Gupshup API
        for (const ws of workspaces) {
            try {
                const business = await Business.findOne({ workspace: ws._id });
                await syncAssignedGupshupApp(user, ws, business);
                results.processed++;
            } catch (err: any) {
                console.error(`[RepairAPI] Failed for ${ws.name}:`, err.message);
                results.failed++;
                results.details.push({ id: ws._id, name: ws.name, error: err.message });
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Repair completed. Processed ${results.processed} of ${results.total} workspaces.`,
            results 
        });
        
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
});
