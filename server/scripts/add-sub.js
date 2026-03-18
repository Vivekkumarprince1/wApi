const axios = require('axios');

const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";
const baseUrl = "https://partner.gupshup.io";

async function addSub(mode) {
    const form = new URLSearchParams();
    form.set('url', "https://1bb9-2402-3a80-109c-3a21-75a5-1733-1e3c-7738.ngrok-free.app/api/v1/webhook/gupshup");
    form.set('tag', mode.toLowerCase() + '_events');
    form.set('version', '3');
    form.set('modes', mode);
    
    try {
        const res = await axios.post(`${baseUrl}/partner/app/${appId}/subscription`, form, {
          headers: {
            'Authorization': token,
            'token': token,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        console.log(`Success for ${mode}:`, res.data);
    } catch(e) {
        console.log(`Failed for ${mode}:`, e.response?.data || e.message);
    }
}

async function run() {
    await addSub('USER_EVENT');
    await addSub('EVENT');
    await addSub('EVENTS');
    await addSub('STATUS');
    await addSub('DELIVERY');
    await addSub('READ');
    await addSub('ALL');
}
run();
