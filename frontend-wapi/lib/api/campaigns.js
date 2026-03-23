import { post, get, put, del } from './client';

export const createCampaign = async (campaignData) => post('/campaigns', campaignData);

export const fetchCampaigns = async (appId, status = '', page = 1, limit = 10) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(status && { status })
  });
  return get(`/campaigns?${params}`);
};

export const fetchCampaign = async (appId, campaignId) => get(`/campaigns/${campaignId}`);

export const startCampaign = async (appId, campaignId, contactIds) => post(`/campaigns/${campaignId}/start`, { contactIds });

export const updateCampaign = async (appId, campaignId, campaignData) => put(`/campaigns/${campaignId}`, campaignData);

export const deleteCampaign = async (appId, campaignId) => del(`/campaigns/${campaignId}`);

export const getCampaignStats = async (campaignId) => get(`/campaigns/stats/${campaignId}`);

export const pauseCampaign = async (appId, campaignId) => post(`/campaigns/${campaignId}/pause`, {});

export const resumeCampaign = async (appId, campaignId) => post(`/campaigns/${campaignId}/resume`, {});

export const getCampaignProgress = async (campaignId) => get(`/campaigns/${campaignId}/progress`);

export const getCampaignSummary = async (campaignId) => get(`/campaigns/${campaignId}/summary`);

export const fetchContactsByTags = async (tags) => {
  const params = new URLSearchParams({ tags: tags.join(',') });
  return get(`/tags/filter/contacts?${params}`);
};
