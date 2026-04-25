const axios = require('axios');
const fs = require('fs');
const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";

async function run() {
    try {
        const res = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/subscription`, {
            headers: {'Authorization': token, 'token': token}
        });
        const out = [];
        res.data?.subscriptions?.forEach(s => out.push(`${s.id} | ${s.tag} | ${(s.modes || []).join(',')}`));
        fs.writeFileSync('subs.txt', out.join('\n'));
    } catch(e) {
        fs.writeFileSync('subs.txt', e.message);
    }
}
run();
