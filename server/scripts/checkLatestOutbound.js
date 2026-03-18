const { listSubscriptions } = require('../src/services/bsp/gupshupService');

const appId = "203a5e43-c560-44c8-be2e-4044e0b0b941";
const appApiKey = "sk_2294271f8ebd4e77968a67721b7a70f8";

async function run() {
    try {
        const res = await listSubscriptions({ appId, appApiKey });
        console.log(JSON.stringify(res, null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
run();
