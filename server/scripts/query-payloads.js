require('dotenv').config({path: '../.env'});
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.collection('webhooklogs');
    
    const logs = await db.find().sort({_id: -1}).limit(20).toArray();
    for (const log of logs) {
        console.log("PAYLOAD:");
        console.log(JSON.stringify(log.payload, null, 2));
        console.log("---");
    }
    process.exit(0);
}
run();
