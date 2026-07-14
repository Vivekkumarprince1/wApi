export const OPTIONAL_FEATURES = [
    'COMMERCE',
    'AI_FAQ',
    'META_ADS',
    'INSTAGRAM',
    'PETPOOJA',
    'ADVANCED_ANSWERBOT',
    'DEVELOPER_API',
    'FORMS',
] as const;

export type OptionalFeature = (typeof OPTIONAL_FEATURES)[number];
export type FeatureFlags = Record<OptionalFeature, boolean>;

export function resolveFeatureFlags(env: NodeJS.ProcessEnv): FeatureFlags {
    return Object.fromEntries(
        OPTIONAL_FEATURES.map((feature) => [feature, env[`FEATURE_${feature}`] === 'true']),
    ) as FeatureFlags;
}

export function featureForApiPath(path: string): OptionalFeature | null {
    if (path.startsWith('/api/v1/commerce')) return 'COMMERCE';
    if (path.startsWith('/api/v1/ads') || path.startsWith('/api/v1/integrations/meta-ads')) return 'META_ADS';
    if (path.startsWith('/api/v1/integrations/instagram') || path.startsWith('/api/v1/automation/instagram-quickflows')) return 'INSTAGRAM';
    if (path.startsWith('/api/v1/integrations/petpooja')) return 'PETPOOJA';
    if (path.startsWith('/api/v1/automation/answerbot/faqs/generate')) return 'AI_FAQ';
    if (path.startsWith('/api/v1/automation/answerbot')) return 'ADVANCED_ANSWERBOT';
    if (path.startsWith('/api/v1/developer') || path.startsWith('/api/v1/external') || path.startsWith('/api/v1/settings/api-keys')) return 'DEVELOPER_API';
    if (path.startsWith('/api/v1/automation/whatsapp-forms')) return 'FORMS';
    return null;
}