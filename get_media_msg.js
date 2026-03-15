const mongoose = require('mongoose');
require('./server/src/config/env');
const db = require('./server/src/config/database');
const Message = require('./server/src/models/messaging/Message');

async function run() {
  await db();
  const msg = await Message.findOne({ "media": { $exists: true, $type: "object" } }).lean();
  console.log(JSON.stringify(msg, null, 2));
  process.exit();
}
run();
