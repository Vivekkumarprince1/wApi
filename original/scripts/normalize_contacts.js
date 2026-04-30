/**
 * Script to normalize existing contact phone numbers.
 * Handles conflicts by merging tags and moving conversations/messages.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Simple normalization logic (mirroring src/lib/phone-utils.ts)
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
    if (!MONGODB_URI) throw new Error('MONGODB_URI or DATABASE_URL is missing');

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Contact = mongoose.model('Contact', new mongoose.Schema({
      workspace: mongoose.Schema.Types.ObjectId,
      phone: String,
      tags: [String],
      name: String,
    }, { timestamps: true, strict: false }));

    const Conversation = mongoose.model('Conversation', new mongoose.Schema({
      workspace: mongoose.Schema.Types.ObjectId,
      contact: mongoose.Schema.Types.ObjectId,
    }, { strict: false }));

    const Message = mongoose.model('Message', new mongoose.Schema({
      workspace: mongoose.Schema.Types.ObjectId,
      contact: mongoose.Schema.Types.ObjectId,
      conversation: mongoose.Schema.Types.ObjectId,
    }, { strict: false }));

    const contacts = await Contact.find({});
    console.log(`Found ${contacts.length} contacts to process`);

    let updated = 0;
    let merged = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const normalized = normalizePhoneNumber(contact.phone);
      if (normalized === contact.phone) {
        skipped++;
        continue;
      }

      console.log(`\nProcessing ${contact.phone} -> ${normalized} (Workspace: ${contact.workspace})`);

      try {
        const existing = await Contact.findOne({ workspace: contact.workspace, phone: normalized });
        
        if (existing) {
          console.log(`Conflict: ${normalized} already exists. Merging...`);
          
          // 1. Merge tags
          const combinedTags = [...new Set([...(existing.tags || []), ...(contact.tags || [])])];
          await Contact.updateOne({ _id: existing._id }, { $set: { tags: combinedTags } });

          // 2. Resolve Conversations
          const existingConv = await Conversation.findOne({ workspace: contact.workspace, contact: existing._id });
          const currentConv = await Conversation.findOne({ workspace: contact.workspace, contact: contact._id });

          if (currentConv) {
            if (existingConv) {
              console.log(`Merging conversations: ${currentConv._id} -> ${existingConv._id}`);
              // Move messages to existing conversation
              const msgUpdate = await Message.updateMany(
                { conversation: currentConv._id },
                { $set: { conversation: existingConv._id, contact: existing._id } }
              );
              console.log(`Moved ${msgUpdate.modifiedCount} messages`);
              
              // Delete duplicate conversation
              await Conversation.deleteOne({ _id: currentConv._id });
            } else {
              console.log(`Moving conversation ${currentConv._id} to contact ${existing._id}`);
              // Just point conversation to the existing contact
              await Conversation.updateOne(
                { _id: currentConv._id },
                { $set: { contact: existing._id } }
              );
              // Update messages contact ref too
              await Message.updateMany(
                { conversation: currentConv._id },
                { $set: { contact: existing._id } }
              );
            }
          }

          // 3. Delete the unnormalized contact
          await Contact.deleteOne({ _id: contact._id });
          merged++;
          console.log(`Merge complete for ${contact.phone}`);
        } else {
          // No conflict, just update
          await Contact.updateOne({ _id: contact._id }, { $set: { phone: normalized } });
          updated++;
          console.log(`Normalized ${contact.phone}`);
        }
      } catch (err) {
        console.error(`Error processing contact ${contact._id}:`, err.message);
      }
    }

    console.log('\n--- Final Summary ---');
    console.log(`Processed: ${contacts.length}`);
    console.log(`Normalized: ${updated}`);
    console.log(`Merged: ${merged}`);
    console.log(`Unchanged: ${skipped}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
