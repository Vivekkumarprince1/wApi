export type SuperAdminDomainKey =
  | 'control-plane-overview'
  | 'tenant-governance'
  | 'gupshup-control'
  | 'billing-plan-governance'
;

export interface DomainCapability {
  key: string;
  title: string;
  description: string;
}

export interface DomainAction {
  key: string;
  title: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  route: string;
}

export interface SuperAdminDomain {
  key: SuperAdminDomainKey;
  title: string;
  summary: string;
  owner: string;
  route: string;
  capabilities: DomainCapability[];
  actions: DomainAction[];
}

export interface SuperAdminControlPlaneManifest {
  version: string;
  releasedAt: string;
  domains: SuperAdminDomain[];
}

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
    database: 'operational' | 'degraded';
    bspStatus: string;
  };
  policy: {
    businessVerificationMandatory: boolean;
    source: 'database' | 'environment';
    updatedAt: string | null;
  };
}
