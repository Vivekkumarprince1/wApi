const mongoose = require('mongoose');

const TARGETS = {
  central: 'mongodb://127.0.0.1:27017/wapi',
  campaigns: 'mongodb://127.0.0.1:27017/wa_campaigns',
  automation: 'mongodb://127.0.0.1:27017/wapi_automation',
  billing: 'mongodb://127.0.0.1:27017/wapi_billing',
  bsp: 'mongodb://127.0.0.1:27017/wapi_bsp'
};

async function connectWithFallback(uri) {
  try {
    return await mongoose.createConnection(uri).asPromise();
  } catch (err) {
    const fallbackUri = uri.replace('127.0.0.1', 'localhost');
    return await mongoose.createConnection(fallbackUri).asPromise();
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('VERIFYING MULTI-DB ALIGNMENT WITH wApi ARCHITECTURE');
  console.log('════════════════════════════════════════════════════════════');

  const conns = {};
  try {
    for (const [key, uri] of Object.entries(TARGETS)) {
      conns[key] = await connectWithFallback(uri);
    }
    console.log('✓ Successfully connected to all 5 microservice databases!');

    const userId = new mongoose.Types.ObjectId('699c21048e96ba1b49ab6947');
    const wsId = new mongoose.Types.ObjectId('699c21048e96ba1b49ab6945');

    // 1. Verify User exists in Central
    const user = await conns.central.db.collection('users').findOne({ _id: userId });
    if (user) {
      console.log('\n✓ [CENTRAL] Canonical User Profile: Verified!');
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Role: ${user.role}`);
    } else {
      console.error('\n✗ [CENTRAL] Canonical User Profile: NOT FOUND!');
    }

    // 2. Verify Workspace projection across ALL five databases
    console.log('\nVerifying Workspace Projection across all databases:');
    for (const [key, conn] of Object.entries(conns)) {
      const ws = await conn.db.collection('workspaces').findOne({ _id: wsId });
      if (ws) {
        console.log(`  - [${key.toUpperCase()}]: Projection exists! (Name: "${ws.name}")`);
      } else {
        console.error(`  - [${key.toUpperCase()}]: Projection NOT FOUND!`);
      }
    }

    const wsFilter = {
      $or: [
        { workspace: wsId },
        { workspace: wsId.toString() },
        { workspaceId: wsId },
        { workspaceId: wsId.toString() }
      ]
    };

    // Campaigns DB
    const campaignCount = await conns.campaigns.db.collection('campaigns').countDocuments(wsFilter);
    const batchCount = await conns.campaigns.db.collection('campaignbatches').countDocuments(wsFilter);
    console.log(`- [CAMPAIGNS] Campaigns: ${campaignCount} docs, Batches: ${batchCount} docs.`);

    // Billing DB
    const txCount = await conns.billing.db.collection('wallettransactions').countDocuments(wsFilter);
    const walletCount = await conns.billing.db.collection('wallets').countDocuments(wsFilter);
    const subCount = await conns.billing.db.collection('subscriptions').countDocuments(wsFilter);
    console.log(`- [BILLING] Wallet Tx: ${txCount} docs, Wallets: ${walletCount} docs, Subscriptions: ${subCount} docs.`);

    // Automation DB
    const formCount = await conns.automation.db.collection('whatsappforms').countDocuments(wsFilter);
    const integrationCount = await conns.automation.db.collection('integrations').countDocuments(wsFilter);
    const widgetCount = await conns.automation.db.collection('widgetconfigs').countDocuments(wsFilter);
    console.log(`- [AUTOMATION] Forms: ${formCount} docs, Integrations: ${integrationCount} docs, Widgets: ${widgetCount} docs.`);

    // BSP DB
    const smsCount = await conns.bsp.db.collection('smsconfigs').countDocuments(wsFilter);
    const rcsCount = await conns.bsp.db.collection('rcsconfigs').countDocuments(wsFilter);
    console.log(`- [BSP] SMS Configs: ${smsCount} docs, RCS Configs: ${rcsCount} docs.`);

  } catch (err) {
    console.error('✗ Verification failed with error:', err);
  } finally {
    for (const conn of Object.values(conns)) {
      if (conn) await conn.close();
    }
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('VERIFICATION COMPLETE');
    console.log('════════════════════════════════════════════════════════════');
  }
}

main();
