require('dotenv').config({path: '../.env'});
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.collection('messages');
    
    const logs = await db.find({type: 'template'}).sort({_id: -1}).limit(5).toArray();
    for (const log of logs) {
        console.log("MESSAGE:");
        console.log(JSON.stringify(log, null, 2));
        console.log("---");
    }
    process.exit(0);
}
run();
