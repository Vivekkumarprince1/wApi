#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const { mongoUri } = require('../src/config');
const { Contact, Conversation, Message } = require('../src/models');
const { normalizePhone } = require('../src/utils/phoneUtils');

async function mergeContacts(workspaceId, survivor, duplicate) {
  console.log(`Merging contact ${duplicate.phone} (${duplicate._id}) into ${survivor.phone} (${survivor._id})`);

  // 1. Handle Conversations
  const duplicateConv = await Conversation.findOne({ workspace: workspaceId, contact: duplicate._id });
  const survivorConv = await Conversation.findOne({ workspace: workspaceId, contact: survivor._id });

  if (duplicateConv) {
    if (survivorConv) {
      console.log(`Merging conversation ${duplicateConv._id} into ${survivorConv._id}`);
      // Move all messages from duplicate conversation to survivor conversation
      await Message.updateMany(
        { workspace: workspaceId, conversation: duplicateConv._id },
        { $set: { conversation: survivorConv._id, contact: survivor._id } }
      );

      // Update survivor conversation stats
      survivorConv.unreadCount = (survivorConv.unreadCount || 0) + (duplicateConv.unreadCount || 0);
      if (!survivorConv.lastMessageAt || (duplicateConv.lastMessageAt && duplicateConv.lastMessageAt > survivorConv.lastMessageAt)) {
        survivorConv.lastMessageAt = duplicateConv.lastMessageAt;
        survivorConv.lastMessagePreview = duplicateConv.lastMessagePreview;
        survivorConv.lastMessageDirection = duplicateConv.lastMessageDirection;
        survivorConv.lastMessageType = duplicateConv.lastMessageType;
      }
      survivorConv.lastActivityAt = new Date(Math.max(
        survivorConv.lastActivityAt ? survivorConv.lastActivityAt.getTime() : 0,
        duplicateConv.lastActivityAt ? duplicateConv.lastActivityAt.getTime() : 0
      ));
      
      await survivorConv.save();
      await duplicateConv.deleteOne();
    } else {
      // No survivor conversation, just move the duplicate one to the survivor contact
      console.log(`Moving conversation ${duplicateConv._id} to contact ${survivor._id}`);
      duplicateConv.contact = survivor._id;
      await duplicateConv.save();
      
      // Also update messages
      await Message.updateMany(
        { workspace: workspaceId, conversation: duplicateConv._id },
        { $set: { contact: survivor._id } }
      );
    }
  }

  // 2. Move orphaned messages (if any)
  await Message.updateMany(
    { workspace: workspaceId, contact: duplicate._id },
    { $set: { contact: survivor._id } }
  );

  // 3. Merge Metadata and Tags
  const mergedTags = [...new Set([...(survivor.tags || []), ...(duplicate.tags || [])])];
  const mergedMetadata = { ...(duplicate.metadata || {}), ...(survivor.metadata || {}) };

  survivor.tags = mergedTags;
  survivor.metadata = mergedMetadata;
  if (!survivor.name || survivor.name === 'Unknown') {
    survivor.name = duplicate.name !== 'Unknown' ? duplicate.name : survivor.name;
  }
  
  await survivor.save();

  // 4. Delete Duplicate Contact
  await duplicate.deleteOne();
}

async function runMigration() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'RUNNING MIGRATION (APPLY MODE)' : 'DRY RUN MODE - No changes will be saved');

  const contacts = await Contact.find({}).sort({ createdAt: 1 });
  console.log(`Checking ${contacts.length} contacts...`);

  // Group by workspace and normalized phone
  const groups = {}; // workspaceId: { normalizedPhone: [contacts] }

  for (const contact of contacts) {
    const wsId = contact.workspace.toString();
    const normPhone = normalizePhone(contact.phone);

    if (!groups[wsId]) groups[wsId] = {};
    if (!groups[wsId][normPhone]) groups[wsId][normPhone] = [];
    
    groups[wsId][normPhone].push(contact);
  }

  let mergeCount = 0;

  for (const wsId in groups) {
    for (const normPhone in groups[wsId]) {
      const cluster = groups[wsId][normPhone];
      
      // 1. Pick survivor
      const survivor = cluster[0];
      
      // 2. Merge duplicates if any
      if (cluster.length > 1) {
        const duplicates = cluster.slice(1);
        console.log(`\nCluster for ${normPhone} in workspace ${wsId}:`);
        console.log(` Survivor: ${survivor._id} (${survivor.phone})`);
        
        for (const duplicate of duplicates) {
          console.log(` Duplicate: ${duplicate._id} (${duplicate.phone})`);
          if (apply) {
            await mergeContacts(wsId, survivor, duplicate);
            mergeCount++;
          }
        }
      }

      // 3. Normalize survivor's phone if needed
      if (survivor.phone !== normPhone && apply) {
        console.log(`Normalizing survivor phone: ${survivor.phone} -> ${normPhone}`);
        survivor.phone = normPhone;
        await survivor.save();
      }
    }
  }

  console.log(`\nMigration complete. Merged Clusters: ${mergeCount}`);
}

async function main() {
  await mongoose.connect(mongoUri);
  try {
    await runMigration();
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
