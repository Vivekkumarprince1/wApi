const axios = require('axios');
const fs = require('fs');
const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const token = "sk_2294271f8ebd4e77968a67721b7a70f8";
const baseUrl = "https://partner.gupshup.io";

async function run() {
    try {
        await axios.delete(`${baseUrl}/partner/app/${appId}/subscription/10817991`, {headers:{'Authorization': token,'token': token}});
        await axios.delete(`${baseUrl}/partner/app/${appId}/subscription/10817992`, {headers:{'Authorization': token,'token': token}});
        console.log("Deleted broken subs");
    } catch(e) {
        console.log("Delete failed:", e.message);
    }
}
run();
