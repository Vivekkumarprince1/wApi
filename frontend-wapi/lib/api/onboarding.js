import { get, post, put, del } from './client';

const logIntegrationDebug = (label, response) => {
	if (typeof window !== 'undefined' && response?.debug) {
		console.log(`[integration:${label}]`, response.debug);
	}

	return response;
};

export const getOnboardingStatus = async () => get('/onboarding/status');
export const getVerificationStatus = async () => get('/onboarding/verification-status');
export const saveBusinessInfo = async (businessInfo) => post('/onboarding/business-info', businessInfo);
export const completeOnboarding = async () => post('/onboarding/complete', {});

// BSP Specific
export const bspStart = async (payload = {}) => logIntegrationDebug('bsp-start', await post('/onboarding/bsp/start', payload));
export const bspRegisterPhone = async (payload = {}) => post('/onboarding/bsp/register-phone', payload);
export const bspComplete = async (payload) => logIntegrationDebug('bsp-complete', await post('/onboarding/bsp/complete', payload));
export const bspStatus = async () => get('/onboarding/bsp/status');
export const bspStage1Status = async () => get('/onboarding/bsp/stage1-status');
export const bspRuntimeProfile = async () => logIntegrationDebug('bsp-runtime-profile', await get('/onboarding/bsp/runtime-profile'));
export const bspSync = async () => logIntegrationDebug('bsp-sync', await post('/onboarding/bsp/sync', {}));
export const bspDisconnect = async () => logIntegrationDebug('bsp-disconnect', await post('/onboarding/bsp/disconnect', {}));

export const connectWhatsApp = async (data) => bspStart();

// WABA Settings
export const getWABASettings = async () => get('/settings/waba');
export const updateWABASettings = async (settings) => put('/settings/waba', settings);
export const testWABAConnection = async () => post('/settings/waba/test', {});
export const initializeWABAFromEnv = async () => post('/settings/waba/init-from-env', {});
export const debugWABACredentials = async () => get('/settings/waba/debug');

export const getProviderSettings = getWABASettings;
export const updateProviderSettings = updateWABASettings;
