import mongoose from 'mongoose';
import {
  BspHealth,
  BusinessAppMap,
  Plan,
  User,
  Workspace,
  SystemSettings,
} from '../../models/index.js';
import { getBusinessVerificationPolicy } from '../business/business-verification-policy-service.js';
import { config } from '../../config/index.js';

type PlanCountResult = {
  _id: string | null;
  count: number;
};

export class SuperAdminControlPlaneService {
  static async buildSnapshot(): Promise<any> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Call billing service for global stats
    let billingStats = { grossRevenue: 0 };
    try {
      const response = await fetch(`${config.billingServiceUrl}/api/billing/wallets/admin/stats`, {
        headers: {
          'x-internal-service-secret': config.internalServiceSecret,
          'content-type': 'application/json'
        }
      });
      if (response.ok) {
        billingStats = await response.json() as any;
      }
    } catch (err: any) {
      console.warn('[ControlPlane] Failed to retrieve billing-service stats:', err.message);
    }

    const db = mongoose.connection.db;

    const [
      workspaces,
      users,
      messages30d,
      connectedWhatsappWorkspaces,
      pendingOnboarding,
      mappedGupshupApps,
      orphanedGupshupMappings,
      planDistributionRaw,
      bspHealthDoc,
    ] = await Promise.all([
      Workspace.countDocuments({}),
      User.countDocuments({}),
      db?.collection('messages').countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isInternalNote: false }) || Promise.resolve(0),
      Workspace.countDocuments({ whatsappConnected: true }),
      Workspace.countDocuments({
        $or: [
          { onboardingStatus: { $exists: false } },
          { onboardingStatus: { $nin: ['completed', 'COMPLETED'] } },
        ],
      }),
      (BusinessAppMap as any).countDocuments({ active: true }),
      (BusinessAppMap as any).countDocuments({
        active: true,
        $or: [{ workspace: null }, { app: null }, { gupshupAppId: { $in: [null, ''] } }],
      }),
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
      (BspHealth as any).findOne({ key: 'system_token' }).lean(),
    ]);

    const businessVerificationPolicy = await getBusinessVerificationPolicy();
    const systemSettings = await (SystemSettings as any).getSettings();

    const activeRevenue = billingStats.grossRevenue || 0;
    const totalRechargeTransactions = 0;

    const planIds = planDistributionRaw
      .filter((entry) => entry._id && entry._id !== 'unassigned' && mongoose.Types.ObjectId.isValid(entry._id))
      .map((entry) => new mongoose.Types.ObjectId(entry._id as string));

    const planDocs: any[] = planIds.length
      ? await Plan.find({ _id: { $in: planIds } }).select('name slug').lean()
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
        bspStatus: (bspHealthDoc as any)?.status || 'unknown',
      },
      policy: {
        businessVerificationMandatory: businessVerificationPolicy.mandatory,
        source: businessVerificationPolicy.source,
        updatedAt: businessVerificationPolicy.updatedAt ? new Date(businessVerificationPolicy.updatedAt) : new Date(),
      },
      systemStatus: {
        maintenanceMode: systemSettings.maintenanceMode,
        maintenanceMessage: systemSettings.maintenanceMessage,
        systemNotice: systemSettings.systemNotice || null,
      }
    };
  }
}
