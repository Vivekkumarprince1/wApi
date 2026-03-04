require('dotenv').config();
const mongoose = require('mongoose');
const { Message, Conversation } = require('./src/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const msgs = await Message.find({ conversation: { $exists: false } });
  
  let count = 0;
  for (const msg of msgs) {
    if (!msg.contact) continue;
    
    let conv = await Conversation.findOne({ workspace: msg.workspace, contact: msg.contact });
    if (!conv) {
      conv = await Conversation.create({
        workspace: msg.workspace,
        contact: msg.contact,
        status: 'open',
        conversationType: 'business_initiated',
        conversationStartedAt: msg.createdAt,
        lastActivityAt: msg.createdAt,
        lastMessageAt: msg.createdAt,
        lastMessageType: msg.type || 'template',
        lastMessageDirection: msg.direction || 'outbound',
        lastMessagePreview: msg.body ? msg.body.substring(0, 50) : 'Template message'
      });
      console.log('Created conversation for contact', msg.contact);
    }
    
    msg.conversation = conv._id;
    await msg.save();
    count++;
  }
  
  console.log('Fixed', count, 'messages');
  process.exit(0);
}).catch(console.error);
