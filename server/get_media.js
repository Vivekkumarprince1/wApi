const mongoose = require('mongoose');
const Message = require('./src/models/messaging/Message');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/wapi_development');
  const msgs = await Message.find({ type: { $ne: 'text' } }).limit(2).lean();
  console.log(JSON.stringify(msgs, null, 2));
  process.exit();
}
run();
