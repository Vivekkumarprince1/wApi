import mongoose from 'mongoose';
import {
  BspHealth,
  BusinessAppMap,
  Message,
  Plan,
  User,
  WalletTransaction,
  Workspace,
} from '@/lib/models';
import { SuperAdminControlPlaneSnapshot } from '@/lib/super-admin/control-plane-types';
import { getBusinessVerificationPolicy } from '@/lib/services/onboarding/business-verification-policy-service';

type PlanCountResult = {
  _id: string | null;
  count: number;
};

export class SuperAdminControlPlaneService {
  static async buildSnapshot(): Promise<SuperAdminControlPlaneSnapshot> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      workspaces,
      users,
      messages30d,
      connectedWhatsappWorkspaces,
      pendingOnboarding,
      mappedGupshupApps,
      orphanedGupshupMappings,
      rechargeRevenue,
      totalRechargeTransactions,
      planDistributionRaw,
      bspHealth,
    ] = await Promise.all([
      Workspace.countDocuments({}),
      User.countDocuments({}),
      Message.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isInternalNote: false }),
      Workspace.countDocuments({ whatsappConnected: true }),
      Workspace.countDocuments({
        $or: [
          { onboardingStatus: { $exists: false } },
          { onboardingStatus: { $nin: ['completed', 'COMPLETED'] } },
        ],
      }),
      BusinessAppMap.countDocuments({ active: true }),
      BusinessAppMap.countDocuments({
        active: true,
        $or: [{ workspace: null }, { app: null }, { gupshupAppId: { $in: [null, ''] } }],
      }),
      WalletTransaction.aggregate([{ $match: { type: 'RECHARGE', status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      WalletTransaction.countDocuments({ type: 'RECHARGE', status: 'COMPLETED' }),
      Workspace.aggregate<PlanCountResult>([
        {
          $project: {
            planKey: {
              $ifNull: [{ $toString: '$plan' }, 'unassigned'],
            },
          },
        },
        {
          $group: {
            _id: '$planKey',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      BspHealth.findOne({ key: 'system_token' }).lean<{ status?: string }>(),
    ]);
    const businessVerificationPolicy = await getBusinessVerificationPolicy();

    const activeRevenue = (rechargeRevenue[0]?.total as number | undefined) || 0;

    const planIds = planDistributionRaw
      .filter((entry) => entry._id && entry._id !== 'unassigned' && mongoose.Types.ObjectId.isValid(entry._id))
      .map((entry) => new mongoose.Types.ObjectId(entry._id as string));

    const planDocs = planIds.length
      ? await Plan.find({ _id: { $in: planIds } }).select('name slug').lean<Array<{ _id: mongoose.Types.ObjectId; name?: string; slug?: string }>>()
      : [];

    const planLabelMap = new Map<string, string>();
    planDocs.forEach((planDoc) => {
      const id = String(planDoc._id);
      planLabelMap.set(id, planDoc.name || planDoc.slug || id);
    });

    const planDistribution = planDistributionRaw.map((entry) => {
      const key = entry._id || 'unassigned';
      return {
        key: planLabelMap.get(key) || key,
        count: entry.count,
      };
    });

    return {
      counters: {
        workspaces,
        users,
        messages30d,
        connectedWhatsappWorkspaces,
        pendingOnboarding,
        mappedGupshupApps,
        orphanedGupshupMappings,
      },
      billing: {
        activeRevenue,
        totalRechargeTransactions,
        planDistribution,
      },
      health: {
        database: mongoose.connection.readyState === 1 ? 'operational' : 'degraded',
        bspStatus: bspHealth?.status || 'unknown',
      },
      policy: {
        businessVerificationMandatory: businessVerificationPolicy.mandatory,
        source: businessVerificationPolicy.source,
        updatedAt: businessVerificationPolicy.updatedAt,
      },
    };
  }
}
