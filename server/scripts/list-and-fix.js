const axios = require('axios');
const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";

async function run() {
    console.log("Checking current subs...");
    let getRes = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/subscription`, {
        headers: {'Authorization': token, 'token': token}
    });

    let currentModes = getRes.data?.subscriptions?.map(s => s.modes?.[0] || s.tag) || [];
    console.log("Existing:", currentModes);
    
    const needed = ['MESSAGE', 'FAILED', 'BILLING', 'STATUS', 'USER_EVENT'];
    
    for(const mode of needed) {
        if(!currentModes.includes(mode) && !currentModes.includes(mode.toLowerCase()+'_events')) {
             console.log(`Need to add ${mode}`);
             const form = new URLSearchParams();
             form.set('url', "https://w-api-mu.vercel.app/api/v1/webhook/gupshup");
             form.set('tag', mode.toLowerCase() + '_events');
             form.set('version', '3');
             form.set('modes', mode);
             try {
                await axios.post(`https://partner.gupshup.io/partner/app/${appId}/subscription`, form, {
                  headers: {'Authorization': token, 'token': token, 'Content-Type': 'application/x-www-form-urlencoded'}
                });
                console.log(`Added ${mode}`);
             } catch(e) {
                console.log(`Failed ${mode}:`, e.response?.data?.message || e.message);
             }
             await new Promise(r => setTimeout(r, 2000));
        }
    }
}
run();