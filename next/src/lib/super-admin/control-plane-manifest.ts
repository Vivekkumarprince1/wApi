import { SuperAdminControlPlaneManifest } from './control-plane-types';

export const SUPER_ADMIN_CONTROL_PLANE_MANIFEST: SuperAdminControlPlaneManifest = {
  version: '2026.04.20',
  releasedAt: '2026-04-20',
  domains: [
    {
      key: 'control-plane-overview',
      title: 'Control Plane Overview',
      summary: 'Monitor live platform health, fleet counters, revenue, and operational actions from the dashboard.',
      owner: 'Platform',
      route: '/super-admin',
      capabilities: [
        {
          key: 'overview.snapshot',
          title: 'Control Plane Snapshot',
          description: 'Track live workspace, user, revenue, and BSP state in one place.',
        },
        {
          key: 'overview.actions',
          title: 'Operator Actions',
          description: 'Trigger safe platform-wide refresh, reconciliation, and freeze workflows.',
        },
      ],
      actions: [
        { key: 'overview.refresh.snapshot', title: 'Refresh Snapshot', risk: 'low', route: '/api/super-admin/control-plane' },
        { key: 'overview.view.health', title: 'View Health', risk: 'low', route: '/api/super-admin/health' },
      ],
    },
    {
      key: 'tenant-governance',
      title: 'Tenant Governance',
      summary: 'Manage workspace lifecycle, ownership, access state, and tenancy risk controls.',
      owner: 'Platform',
      route: '/super-admin/workspaces',
      capabilities: [
        {
          key: 'tenant.lifecycle',
          title: 'Workspace Lifecycle',
          description: 'Provision, suspend, reactivate, and archive tenant workspaces with audit trails.'
        },
        {
          key: 'tenant.impersonation',
          title: 'Scoped Impersonation',
          description: 'Grant time-bound and reason-bound tenant impersonation sessions.'
        },
        {
          key: 'tenant.risk',
          title: 'Risk Controls',
          description: 'Flag risky workspaces, apply restrictions, and force remediation workflows.'
        }
      ],
      actions: [
        { key: 'tenant.workspace.repair', title: 'Repair Workspace State', risk: 'medium', route: '/api/super-admin/workspaces' },
        { key: 'tenant.workspace.impersonate', title: 'Impersonate Workspace', risk: 'high', route: '/api/super-admin/workspaces/[id]/impersonate' },
      ],
    },
    {
      key: 'gupshup-control',
      title: 'Gupshup Control',
      summary: 'Control onboarding flows, app assignment, webhook health, and template sync integrity.',
      owner: 'BSP Integrations',
      route: '/super-admin/gupshup',
      capabilities: [
        {
          key: 'gupshup.assignment.reconcile',
          title: 'App Assignment Reconciliation',
          description: 'Detect and repair mismatches between workspace identity and partner assignments.'
        },
        {
          key: 'gupshup.onboarding.repair',
          title: 'Onboarding Repair',
          description: 'Replay onboarding stages from fallback snapshots for failed flows.'
        },
        {
          key: 'gupshup.webhook.observability',
          title: 'Webhook and Token Health',
          description: 'Track delivery, auth failures, and endpoint health for BSP operations.'
        }
      ],
      actions: [
        { key: 'gupshup.reconcile.apps', title: 'Reconcile Partner Apps', risk: 'medium', route: '/api/super-admin/gupshup/apps/reconcile' },
        { key: 'gupshup.retry.webhooks', title: 'Retry Failed Webhooks', risk: 'medium', route: '/api/super-admin/gupshup/health' },
      ]
    },
    {
      key: 'billing-plan-governance',
      title: 'Billing and Plan Governance',
      summary: 'Control plan catalog, entitlement policies, and revenue operations across tenants.',
      owner: 'Revenue Ops',
      route: '/super-admin/plans',
      capabilities: [
        {
          key: 'billing.plan-catalog',
          title: 'Plan Catalog Governance',
          description: 'Create, revise, and retire plans with central policy ownership.'
        },
        {
          key: 'billing.entitlement-drift',
          title: 'Entitlement Drift Detection',
          description: 'Compare actual feature access against policy and trigger correction workflows.'
        },
        {
          key: 'billing.wallet-reconciliation',
          title: 'Wallet and Ledger Reconciliation',
          description: 'Run settlement checks and reconcile anomalies safely.'
        }
      ],
      actions: [
        { key: 'billing.plan.update', title: 'Update Plan Policy', risk: 'high', route: '/api/super-admin/plans/[id]' },
        { key: 'billing.wallet.reconcile', title: 'Run Wallet Reconciliation', risk: 'medium', route: '/api/super-admin/billing/reconcile' },
      ]
    }
  ]
};
