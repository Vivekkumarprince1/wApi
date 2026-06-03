export type RoleOption = {
  value: string;
  label: string;
  description: string;
  isSystem: boolean;
  aliases: string[];
  name?: string;
  slug?: string;
  permissions?: any;
};

const SYSTEM_ROLE_ORDER = ['admin', 'manager', 'agent', 'member', 'viewer'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access to settings, team, and billing',
  manager: 'Manages team, templates, and campaigns',
  agent: 'Handles conversations and contacts',
  member: 'Basic workspace access',
  viewer: 'Read-only access to analytics',
};

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
}

function buildRoleOption(role: any): RoleOption | null {
  const isSystem = Boolean(role?.isSystem || (role?.slug && SYSTEM_ROLE_ORDER.includes(role.slug)));
  const value = isSystem
    ? String(role?.slug || role?.name || '').trim()
    : String(role?.name || role?.label || role?.slug || '').trim();

  if (!value) return null;
  if (value.toLowerCase() === 'owner') return null;

  const label = String(role?.name || role?.label || value).trim();
  const description = String(role?.description || ROLE_DESCRIPTIONS[value.toLowerCase()] || 'Custom workspace access role');

  return {
    value,
    label,
    description,
    isSystem,
    name: label,
    slug: role?.slug,
    permissions: role?.permissions,
    aliases: uniqueValues([
      value,
      label,
      role?.slug,
      role?.name,
    ]).map((item) => item.toLowerCase()),
  };
}

export function getWorkspaceRoleOptions(roles: any[] = []): RoleOption[] {
  const normalized = (Array.isArray(roles) ? roles : [])
    .map(buildRoleOption)
    .filter(Boolean) as RoleOption[];

  const byKey = new Map<string, RoleOption>();
  normalized.forEach((role) => {
    byKey.set(role.value.toLowerCase(), role);
    role.aliases.forEach((alias) => byKey.set(alias.toLowerCase(), role));
  });

  const systemRoles = SYSTEM_ROLE_ORDER.map((slug) => {
    const existing = byKey.get(slug);
    if (existing) return existing;

    return {
      value: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      description: ROLE_DESCRIPTIONS[slug],
      isSystem: true,
      aliases: [slug],
    } satisfies RoleOption;
  });

  const customRoles = normalized
    .filter((role) => !SYSTEM_ROLE_ORDER.includes(role.value.toLowerCase()) && role.value.toLowerCase() !== 'owner')
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...systemRoles, ...customRoles];
}

export function roleMatches(currentRole: string | undefined | null, option: RoleOption) {
  const normalizedCurrent = String(currentRole || '').trim().toLowerCase();
  if (!normalizedCurrent) return false;

  return option.aliases.includes(normalizedCurrent) || option.value.toLowerCase() === normalizedCurrent;
}
