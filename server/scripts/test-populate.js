require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../src/models/messaging/Message');
require('../src/models/template/Template.js'); // check template path

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    let messages = await Message.find({ type: 'template' })
      .populate('template.id')
      .sort({_id: -1})
      .limit(2)
      .lean();
      
    messages.forEach(msg => {
       if (msg.template && msg.template.id && msg.template.id.components) {
           const btnComp = msg.template.id.components.find(c => c.type === 'BUTTONS');
           if (btnComp && btnComp.buttons) {
               msg.template.buttons = btnComp.buttons;
           }
       }
       console.log('Template name:', msg.template.name);
       console.log('Final Buttons:', msg.template.buttons);
    });
    
    process.exit(0);
}
run();
