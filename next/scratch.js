const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/wati-clone');
const Team = require('./src/lib/models/workspace/Team').Team;

async function run() {
  const teams = await Team.find({});
  console.log('Teams:', teams.map(t => t.name));
  process.exit(0);
}
run();
