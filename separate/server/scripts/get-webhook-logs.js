const mongoose = require('mongoose');
const { mongoUri } = require('../src/config');
const WebhookLog = require('../src/models/bsp/WebhookLog');

mongoose.connect(mongoUri)
  .then(async () => {
    const logs = await WebhookLog.find({}).sort({ createdAt: -1 }).limit(200);
    console.log(`Found ${logs.length} logs`);
    let foundMsgOrStatus = false;
    for(const log of logs) {
      if(log.payload?.type === 'message-event' || log.payload?.type === 'message') {
        console.log('--- EVENT ---');
        console.log(JSON.stringify(log.payload, null, 2));
        foundMsgOrStatus = true;
      }
    }
    if(!foundMsgOrStatus) {
        console.log('No older message-events or messages found, dumping 1 full recent payload');
        console.log(JSON.stringify(logs[0].payload, null, 2));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
