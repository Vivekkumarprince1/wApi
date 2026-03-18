const axios = require('axios');
const fs = require('fs');
const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";
const delay = () => new Promise(r => setTimeout(r, 6000));
async function run() {
    try {
        const create = async (mode) => {
            const form = new URLSearchParams();
            form.set('url', "https://1bb9-2402-3a80-109c-3a21-75a5-1733-1e3c-7738.ngrok-free.app/api/v1/webhook/gupshup");
            form.set('tag', mode.toLowerCase() + '_events');
            form.set('version', '3');
            form.set('modes', mode);
            try {
                await axios.post(`https://partner.gupshup.io/partner/app/${appId}/subscription`, form, {
                  headers: {'Authorization': token, 'token': token, 'Content-Type': 'application/x-www-form-urlencoded'}
                });
                console.log(`Added ${mode}`);
            } catch(e) {
                console.log(`Failed ${mode}:`, e.response?.data?.message);
            }
            await delay();
        };

        await create('EVENT');
        await create('BILLING');
        await create('FAILED');
        await create('STATUS');
        
        console.log("Done");
    } catch(e) {
        console.log("Error:", e.message);
    }
}
run();