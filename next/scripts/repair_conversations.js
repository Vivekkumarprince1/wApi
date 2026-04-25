/**
 * Script to repair orphaned conversations and merge duplicates.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Standard normalization logic
function normalizePhoneNumber(phone, defaultCountryCode = "91") {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length >= 15) return cleaned;
  if (cleaned.length > 10) {
    const validCountryCodes = ['1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98'];
    if (validCountryCodes.some(code => cleaned.startsWith(code))) return cleaned;
  }
  if (cleaned.length === 10) return `${defaultCountryCode}${cleaned}`;
  return cleaned;
}

async function run() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Contact = mongoose.model('Contact', new mongoose.Schema({
      workspace: mongoose.Schema.Types.ObjectId,
      phone: String,
      tags: [String],
    }, { strict: false }));

    const Conversation = mongoose.model('Conversation', new mongoose.Schema({
      workspace: mongoose.Schema.Types.ObjectId,
      contact: mongoose.Schema.Types.ObjectId,
    }, { strict: false }));

    const Message = mongoose.model('Message', new mongoose.Schema({
      workspace: mongoose.Schema.Types.ObjectId,
      contact: mongoose.Schema.Types.ObjectId,
      conversation: mongoose.Schema.Types.ObjectId,
      recipientPhone: String,
    }, { strict: false }));

    const conversations = await Conversation.find({}).lean();
    console.log(`Processing ${conversations.length} total conversations...`);

    let repaired = 0;
    let merged = 0;

    for (const conv of conversations) {
      // 1. Check if contact exists
      const contactExists = await Contact.exists({ _id: conv.contact });
      
      if (!contactExists) {
        console.log(`\nFound Orphaned Conversation: ${conv._id} (Contact ID ${conv.contact} missing)`);
        
        // 2. Try to find the phone number from messages in this conversation
        const sampleMsg = await Message.findOne({ conversation: conv._id, recipientPhone: { $exists: true } }).lean();
        let phone = sampleMsg ? sampleMsg.recipientPhone : null;
        
        if (!phone) {
          console.warn(`Could not determine phone number for conversation ${conv._id}. Skipping.`);
          continue;
        }

        const normalizedPhone = normalizePhoneNumber(phone);
        console.log(`Determined phone order: ${phone} -> Normalized: ${normalizedPhone}`);

        // 3. Find the correct contact record for this workspace and phone
        let correctContact = await Contact.findOne({ workspace: conv.workspace, phone: normalizedPhone });
        
        if (!correctContact) {
            console.log(`Contact for ${normalizedPhone} not found. Creating a new one...`);
            correctContact = await Contact.create({
                workspace: conv.workspace,
                phone: normalizedPhone,
                name: 'Unknown',
                isColdContact: true
            });
        }

        // 4. Update the conversation to point to the correct contact
        console.log(`Linking conversation ${conv._id} to contact ${correctContact._id} (${normalizedPhone})`);
        
        try {
            await Conversation.updateOne({ _id: conv._id }, { $set: { contact: correctContact._id } });
            // Also update all messages in this conversation
            await Message.updateMany({ conversation: conv._id }, { $set: { contact: correctContact._id } });
            repaired++;
        } catch (err) {
            if (err.code === 11000) {
                console.log(`Conflict: A conversation already exists for contact ${correctContact._id}. Merging...`);
                // Find the "Winner" conversation
                const existingConv = await Conversation.findOne({ workspace: conv.workspace, contact: correctContact._id });
                
                // Move messages to the winner
                const msgRes = await Message.updateMany({ conversation: conv._id }, { $set: { conversation: existingConv._id, contact: correctContact._id } });
                console.log(`Moved ${msgRes.modifiedCount} messages to existing conversation ${existingConv._id}`);
                
                // Delete the duplicate
                await Conversation.deleteOne({ _id: conv._id });
                merged++;
            } else {
                console.error(`Error repairing conversation ${conv._id}:`, err.message);
            }
        }
      }
    }

    console.log('\n--- Final Summary ---');
    console.log(`Orphans Repaired: ${repaired}`);
    console.log(`Duplicates Merged: ${merged}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Repair failed:', err.message);
    process.exit(1);
  }
}

run();
