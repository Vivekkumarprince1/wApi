import { getWorkspaceAccessDecision } from './src/services/workspace-access-service';
import mongoose from 'mongoose';

async function testAccessDecision() {
    console.log("Testing Workspace Access Decisions...");

    const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        role: 'agent'
    };

    const mockAdmin = {
        _id: new mongoose.Types.ObjectId(),
        role: 'super_admin'
    };

    const mockWorkspaceActive = {
        _id: new mongoose.Types.ObjectId(),
        billingStatus: 'active',
        onboarding: { step: 'COMPLETED', status: 'completed' }
    };

    const mockWorkspaceExpired = {
        _id: new mongoose.Types.ObjectId(),
        billingStatus: 'expired'
    };

    const mockWorkspaceOnboarding = {
        _id: new mongoose.Types.ObjectId(),
        billingStatus: 'active',
        onboarding: { step: 'BUSINESS_INFO', status: 'in-progress' }
    };

    console.log("\n1. Active Workspace (Agent):");
    const d1 = await getWorkspaceAccessDecision(mockUser, mockWorkspaceActive);
    console.log(JSON.stringify(d1, null, 2));

    console.log("\n2. Expired Workspace (Agent):");
    const d2 = await getWorkspaceAccessDecision(mockUser, mockWorkspaceExpired);
    console.log(JSON.stringify(d2, null, 2));

    console.log("\n3. Onboarding Workspace (Agent):");
    const d3 = await getWorkspaceAccessDecision(mockUser, mockWorkspaceOnboarding);
    console.log(JSON.stringify(d3, null, 2));

    console.log("\n4. Expired Workspace (Super Admin):");
    const d4 = await getWorkspaceAccessDecision(mockAdmin, mockWorkspaceExpired);
    console.log(JSON.stringify(d4, null, 2));
}

testAccessDecision().catch(console.error);
