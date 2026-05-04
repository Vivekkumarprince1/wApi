
import mongoose from 'mongoose';
import { Macro } from './main-server/src/models/support/Macro';
import { config } from './main-server/src/config';

async function checkMacroById() {
  try {
    await mongoose.connect(config.mongodbUri);
    const id = '69f861d1f588284c2e152fd3';
    const macro = await Macro.findById(id);
    console.log('Macro:', JSON.stringify(macro, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkMacroById();
