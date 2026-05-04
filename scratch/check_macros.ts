
import mongoose from 'mongoose';
import { Macro } from './main-server/src/models/support/Macro';
import { config } from './main-server/src/config';

async function checkMacros() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to DB');
    const macros = await Macro.find({});
    console.log(`Found ${macros.length} macros`);
    console.log(JSON.stringify(macros, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkMacros();
