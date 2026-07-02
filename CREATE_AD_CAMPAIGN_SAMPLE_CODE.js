/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 * @flow
 */

'use strict';
const bizSdk = require('facebook-nodejs-business-sdk');
const AdAccount = bizSdk.AdAccount;
const Campaign = bizSdk.Campaign;

let access_token = 'EAAUiH1SBbLkBRZCCdlkRT9449KZACfj2aor5wQkRZCtQBD81qDFEteZBFM2vKYEZBao1ZCZAz1q5muwn0MPn70YPqUCvvWneZA1wCV4jrTlyWSP1JibZCERx63SASz63icYVTMliHWscNPsNsuigoV7ZCngShg8oGb83F4YxupUAZC0dBgRHHTGKN9LD7LCwRvmPyBJFoZCT';
let app_id = '1444892840651961';
let ad_account_id = 'act_2305054976903227';
let campaign_name = '';

const api = bizSdk.FacebookAdsApi.init(access_token);
const showDebugingInfo = true; // Setting this to true shows more debugging info.
if (showDebugingInfo) {
  api.setDebug(true);
}

const logApiCallResult = (apiCallName, data) => {
  console.log(apiCallName);
  if (showDebugingInfo) {
    console.log('Data:' + JSON.stringify(data));
  }
};

let fields, params;

void async function() {
  try {
    // Create an ad campaign with objective OUTCOME_TRAFFIC
    fields = [
    ];
    params = {
      'name': campaign_name,
      'objective': 'OUTCOME_TRAFFIC',
      'status': 'PAUSED',
      'special_ad_categories': [],
    };
    let campaign = await (new AdAccount(account_id)).createCampaign(
      fields,
      params
    );
    let campaign_id = campaign.id;

    console.log('Your created campaign is with campaign_id:' + campaign_id);

  } catch(error) {
    console.log(error);
    process.exit(1);
  }
}();