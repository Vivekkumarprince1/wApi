const mongoose = require('mongoose');
const { mongoUri } = require('../src/config');
const WebhookLog = require('../src/models/bsp/WebhookLog');

mongoose.connect(mongoUri).then(async () => {
  const logs = await WebhookLog.find({}).sort({ createdAt: -1 }).limit(100);
  let statusLogs = 0;
  logs.forEach(log => {
      const str = JSON.stringify(log.payload);
      if(str.indexOf('status') !== -1) {
          console.log("Found:", JSON.stringify(log.payload, null, 2));
          statusLogs++;
      }
  });
  console.log(`Summary: ${statusLogs} logs had the word status.`);
  process.exit(0);
});
