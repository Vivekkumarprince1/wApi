const axios = require('axios');
const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";

async function run() {
    let getRes = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/subscription`, {
        headers: {'Authorization': token, 'token': token}
    });

    const url = getRes.data?.subscriptions?.find(s => s.url && s.url.includes('ngrok'))?.url || getRes.data?.subscriptions?.[0]?.url;
    console.log("Using URL:", url);
    let currentModes = getRes.data?.subscriptions?.map(s => s.modes?.[0] || s.tag) || [];
    
    // Make sure we have MESSAGE, BILLING from before
    const needed = ['FAILED', 'STATUS', 'USER_EVENT'];
    
    // Add missing
    for(const mode of needed) {
        if(!currentModes.includes(mode) && !currentModes.includes(mode.toLowerCase()+'_events')) {
             console.log(`Need to add ${mode}`);
             if (!url) { console.log("NO URL FOUND"); continue; }
             
             let success = false;
             let attempts = 0;
             while(!success && attempts < 10) {
                 attempts++;
                 const form = new URLSearchParams();
                 form.set('url', url);
                 form.set('tag', mode.toLowerCase() + '_events');
                 form.set('version', '3');
                 form.set('modes', mode);
                 try {
                    await axios.post(`https://partner.gupshup.io/partner/app/${appId}/subscription`, form, {
                      headers: {'Authorization': token, 'token': token, 'Content-Type': 'application/x-www-form-urlencoded'}
                    });
                    console.log(`Added ${mode}`);
                    success = true;
                 } catch(e) {
                    if (e.response?.status === 429) {
                        console.log(`429 Too Many Requests for ${mode}, waiting 30s...`);
                        await new Promise(r => setTimeout(r, 30000));
                    } else if (e.response?.data?.message?.includes("Maximum of 5 subscriptions")) {
                        console.log("Hit limit, need to delete something first.");
                        break;
                    } else {
                        console.log(`Failed ${mode}:`, e.response?.data?.message || e.message);
                        break;
                    }
                 }
             }
             await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    // Check final subscriptions
    getRes = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/subscription`, {
        headers: {'Authorization': token, 'token': token}
    });
    console.log("Final subscriptions:", getRes.data?.subscriptions?.map(s => s.modes?.[0] || s.tag));
}
run();
