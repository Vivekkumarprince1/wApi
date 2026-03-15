const axios = require('axios');
require('dotenv').config({path: '/Users/vivek/devlopment projects/wApi/wApi-new/server/.env'});
const appId = '203a5e43-c560-44c8-be2e-4044e0b0b941';

const headers = {
  Authorization: `Bearer ${process.env.GUPSHUP_PARTNER_TOKEN}`,
  token: appId
};

async function run() {
  try {
    const url = `${process.env.GUPSHUP_PARTNER_BASE_URL}/partner/app/${appId}`;
    const res = await axios.get(url, { headers });
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log(e.response?.data || e.message);
  }
}
run();
