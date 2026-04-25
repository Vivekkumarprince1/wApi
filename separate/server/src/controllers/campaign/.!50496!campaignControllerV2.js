const { Campaign, CampaignBatch, CampaignMessage, Template, Contact, Workspace } = require('../../models');
const campaignExecutionService = require('../../services/campaign/campaignExecutionService');
const { validateCampaignCreation, validateCampaignStart, checkShouldPauseCampaign } = require('../../services/campaign/campaignValidationService');

/**
