const axios = require('axios');
const WhatsAppAd = require('../models/WhatsAppAd');
const adsValidationService = require('./adsValidationService');

const META_API_VERSION = 'v21.0';
const META_GRAPH_API = 'https://graph.instagram.com';

/**
 * ✅ Create Meta Ad Campaign for Click-to-WhatsApp
 * Returns: { campaignId, adSetId, creativeId, adId }
 */
async function createAdCampaign(workspace, adsData) {
  const systemUserToken = workspace.esbFlow?.systemUserToken;
  const businessAccountId = workspace.esbFlow?.businessAccountId || workspace.businessAccountId;

  if (!systemUserToken) {
    throw new Error('SYSTEM_USER_TOKEN_MISSING');
  }

  if (!businessAccountId) {
    throw new Error('BUSINESS_ACCOUNT_ID_MISSING');
  }

  try {
    // ✅ 1. Create Campaign
    const campaignData = {
      name: adsData.name,
      objective: 'MESSAGES', // Click-to-WhatsApp
      status: 'PAUSED' // Start paused, will activate after creative approval
    };

    const campaignUrl = `${META_GRAPH_API}/${META_API_VERSION}/${businessAccountId}/campaigns`;
    const campaignRes = await axios.post(campaignUrl, campaignData, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    const campaignId = campaignRes.data.id;
    console.log(`✅ [Ads] Campaign created: ${campaignId}`);

    // Log API call
    await logAdApiCall(adsData._id, 'create_campaign', campaignData, campaignRes.data);

    // ✅ 2. Create Ad Set
    const adSetData = {
      name: `${adsData.name} - Ad Set`,
      campaign_id: campaignId,
      daily_budget: adsData.budget, // In cents
      start_time: Math.floor(new Date(adsData.scheduleStart).getTime() / 1000), // Unix timestamp
      ...(adsData.scheduleEnd && { 
        end_time: Math.floor(new Date(adsData.scheduleEnd).getTime() / 1000) 
      }),
      targeting: buildTargetingSpec(adsData.targeting),
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS'
    };

    const adSetUrl = `${META_GRAPH_API}/${META_API_VERSION}/${businessAccountId}/adsets`;
    const adSetRes = await axios.post(adSetUrl, adSetData, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    const adSetId = adSetRes.data.id;
    console.log(`✅ [Ads] Ad Set created: ${adSetId}`);

    await logAdApiCall(adsData._id, 'create_ad_set', adSetData, adSetRes.data);

    // ✅ 3. Create Creative
    const creativeData = {
      name: `${adsData.name} - Creative`,
      object_story_spec: {
        link_data: {
          message: adsData.welcomeMessage || 'Message us on WhatsApp',
          link: buildWhatsAppLink(workspace, adsData),
          caption: adsData.ctaText || 'Message us',
          image_hash: 'placeholder' // Meta provides this
        }
      }
    };

    const creativeUrl = `${META_GRAPH_API}/${META_API_VERSION}/${businessAccountId}/adcreatives`;
    const creativeRes = await axios.post(creativeUrl, creativeData, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    const creativeId = creativeRes.data.id;
    console.log(`✅ [Ads] Creative created: ${creativeId}`);

    await logAdApiCall(adsData._id, 'create_creative', creativeData, creativeRes.data);

    // ✅ 4. Create Ad
    const adData = {
      name: `${adsData.name} - Ad`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED' // Start paused
    };

    const adUrl = `${META_GRAPH_API}/${META_API_VERSION}/${businessAccountId}/ads`;
    const adRes = await axios.post(adUrl, adData, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    const adId = adRes.data.id;
    console.log(`✅ [Ads] Ad created: ${adId}`);

    await logAdApiCall(adsData._id, 'create_ad', adData, adRes.data);

    return {
      campaignId,
      adSetId,
      creativeId,
      adId
    };
  } catch (err) {
    console.error('❌ [Ads] Meta API Error:', err.response?.data || err.message);
    
    // Log error
    if (adsData._id) {
      await logAdApiCall(adsData._id, 'create_campaign', null, null, err.message);
    }

    throw new Error(`META_ADS_ERROR: ${err.response?.data?.error?.message || err.message}`);
  }
}

/**
 * ✅ Build targeting spec for Meta Ads API
 */
function buildTargetingSpec(targeting) {
  const spec = {
    geo_locations: {
      regions: targeting.countries?.map(c => ({ key: c })) || []
    },
    age_min: targeting.ageMin || 18,
    age_max: targeting.ageMax || 65,
    genders: targeting.genders?.length ? targeting.genders.map(g => ({
      'MALE': 1,
      'FEMALE': 2,
      'ALL': 3
    }[g])) : [1, 2], // Default: all genders
    ...(targeting.interests?.length && {
      flexible_spec: [{
        interests: targeting.interests.map(id => ({ id }))
      }]
    }),
    ...(targeting.customAudiences?.length && {
      custom_audiences: targeting.customAudiences.map(id => ({ id }))
    }),
    ...(targeting.excludedAudiences?.length && {
      excluded_custom_audiences: targeting.excludedAudiences.map(id => ({ id }))
    })
  };

  return spec;
}

/**
 * ✅ Build WhatsApp Click-to-Chat URL
 */
function buildWhatsAppLink(workspace, adsData) {
  const phoneNumber = workspace.esbFlow?.phoneNumberIdForOTP || workspace.whatsappPhoneNumber;
  
  // Remove +, spaces, etc from phone number
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Pre-fill message with template greeting if available
  const message = encodeURIComponent(adsData.welcomeMessage || 'Hi there!');
  
  return `https://wa.me/${cleanPhone}?text=${message}`;
}

/**
 * ✅ Update ad status from Meta webhook
 */
async function updateAdStatus(metaAdId, metaStatus, metaData = {}) {
  try {
    const ad = await WhatsAppAd.findOne({ metaAdId });
    
    if (!ad) {
      console.log(`[Ads] Ad not found for metaAdId: ${metaAdId}`);
      return;
    }

    // Map Meta status to our status
    let appStatus = ad.status;
    if (metaStatus === 'ACTIVE') {
      appStatus = 'active';
    } else if (metaStatus === 'PAUSED') {
      appStatus = 'paused';
    } else if (metaStatus === 'PENDING_REVIEW') {
      appStatus = 'pending_review';
    } else if (metaStatus === 'REJECTED') {
      appStatus = 'rejected';
      ad.rejectionReason = metaData.disapproval_reasons?.[0] || 'Rejected by Meta';
      ad.rejectionDetails = metaData;
      ad.rejectedAt = new Date();
    } else if (metaStatus === 'DELETED') {
      appStatus = 'completed';
    }

    ad.metaStatus = metaStatus;
    ad.metaStatusUpdatedAt = new Date();
    ad.status = appStatus;

    await ad.save();
    console.log(`✅ [Ads] Updated ${metaAdId} status to ${appStatus}`);

    return ad;
  } catch (err) {
    console.error('❌ [Ads] Error updating ad status:', err.message);
  }
}

/**
 * ✅ Pause ad in Meta via API
 */
async function pauseAdInMeta(ad, workspace) {
  try {
    if (!ad.metaAdId) {
      console.log(`[Ads] No metaAdId found, skipping Meta pause`);
      return;
    }

    const systemUserToken = workspace.esbFlow?.systemUserToken;
    if (!systemUserToken) {
      throw new Error('SYSTEM_USER_TOKEN_MISSING');
    }

    const pauseUrl = `${META_GRAPH_API}/${META_API_VERSION}/${ad.metaAdId}`;
    const response = await axios.post(pauseUrl, { status: 'PAUSED' }, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [Ads] Paused in Meta: ${ad.metaAdId}`);
    await logAdApiCall(ad._id, 'pause_ad', { status: 'PAUSED' }, response.data);

    return response.data;
  } catch (err) {
    console.error('❌ [Ads] Error pausing ad in Meta:', err.response?.data || err.message);
    // Log error but don't throw - we still mark as paused locally
    if (ad._id) {
      await logAdApiCall(ad._id, 'pause_ad', null, null, err.message);
    }
  }
}

/**
 * ✅ Resume ad in Meta via API
 */
async function resumeAdInMeta(ad, workspace) {
  try {
    if (!ad.metaAdId) {
      throw new Error('NO_META_AD_ID');
    }

    const systemUserToken = workspace.esbFlow?.systemUserToken;
    if (!systemUserToken) {
      throw new Error('SYSTEM_USER_TOKEN_MISSING');
    }

    // Check if can resume
    const pauseCheck = await adsValidationService.checkShouldPauseAd(workspace, ad);
    if (pauseCheck.shouldPause) {
      throw new Error(`CANNOT_RESUME: ${pauseCheck.reason}`);
    }

    const resumeUrl = `${META_GRAPH_API}/${META_API_VERSION}/${ad.metaAdId}`;
    const response = await axios.post(resumeUrl, { status: 'ACTIVE' }, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [Ads] Resumed in Meta: ${ad.metaAdId}`);
    await logAdApiCall(ad._id, 'resume_ad', { status: 'ACTIVE' }, response.data);

    return response.data;
  } catch (err) {
    console.error('❌ [Ads] Error resuming ad in Meta:', err.response?.data || err.message);
    throw new Error(`META_ERROR: ${err.response?.data?.error?.message || err.message}`);
  }
}

/**
 * ✅ Delete ad in Meta
 */
async function deleteAdInMeta(ad, workspace) {
  try {
    if (!ad.metaAdId) {
      console.log(`[Ads] No metaAdId found, skipping Meta delete`);
      return;
    }

    const systemUserToken = workspace.esbFlow?.systemUserToken;
    if (!systemUserToken) {
      throw new Error('SYSTEM_USER_TOKEN_MISSING');
    }

    const deleteUrl = `${META_GRAPH_API}/${META_API_VERSION}/${ad.metaAdId}`;
    const response = await axios.delete(deleteUrl, {
      headers: {
        'Authorization': `Bearer ${systemUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [Ads] Deleted in Meta: ${ad.metaAdId}`);
    await logAdApiCall(ad._id, 'delete_ad', {}, response.data);

    return response.data;
  } catch (err) {
    console.error('❌ [Ads] Error deleting ad in Meta:', err.response?.data || err.message);
    throw new Error(`META_ERROR: ${err.response?.data?.error?.message || err.message}`);
  }
}

/**
 * ✅ Log Meta API call for audit
 */
async function logAdApiCall(adId, action, request, response, error = null) {
  try {
    if (!adId) return;

    const log = {
      timestamp: new Date(),
      action,
      request,
      response,
      error,
      metaRequestId: response?.request_id || null
    };

    await WhatsAppAd.updateOne(
      { _id: adId },
      { $push: { metaApiLogs: log } }
    );
  } catch (err) {
    console.error('Error logging ad API call:', err);
  }
}

module.exports = {
  createAdCampaign,
  updateAdStatus,
  pauseAdInMeta,
  resumeAdInMeta,
  deleteAdInMeta,
  logAdApiCall
};
