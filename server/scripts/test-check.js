const axios = require('axios');
const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";
async function run() {
    let getRes = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/subscription`, {
        headers: {'Authorization': token, 'token': token}
    });
    console.log(JSON.stringify(getRes.data, null, 2));
}
run();
