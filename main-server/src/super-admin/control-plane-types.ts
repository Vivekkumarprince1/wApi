export interface SuperAdminControlPlaneSnapshot {
  counters: {
    workspaces: number;
    users: number;
    messages30d: number;
    connectedWhatsappWorkspaces: number;
    pendingOnboarding: number;
    mappedGupshupApps: number;
    orphanedGupshupMappings: number;
  };
  billing: {
    activeRevenue: number;
    totalRechargeTransactions: number;
    planDistribution: Array<{ key: string; count: number }>;
  };
  health: {
    database: 'operational' | 'degraded' | 'disconnected';
    bspStatus: string;
  };
  policy: {
    businessVerificationMandatory: boolean;
    source: string;
    updatedAt: Date;
  };
}
