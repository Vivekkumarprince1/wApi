import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Contact, Message, Conversation } from '../models';
import { InboxService } from '../services/messaging/inbox-service';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

/**
 * Bulk Message Worker
 * 
 * Processes 'bulk-messages' queue for mass messaging campaigns.
 */
export const initBulkMessageWorker = () => {
  const worker = new Worker('bulk-messages', async (job: Job) => {
    const { workspaceId, contactIds, message, channel, template, createdBy } = job.data;
    console.log(`[BulkMessageWorker] Sending ${contactIds.length} messages for workspace ${workspaceId} via ${channel}`);

    let processed = 0;
    let failed = 0;

    for (const contactId of contactIds) {
      try {
        const contact = await Contact.findOne({ _id: contactId, workspace: workspaceId });
        if (!contact) {
          failed++;
          continue;
        }

        // Find or create conversation
        let conversation = await Conversation.findOne({ 
          workspace: workspaceId, 
          contact: contactId,
          channel: channel || 'whatsapp'
        });

        if (!conversation) {
          conversation = await Conversation.create({
            workspace: workspaceId,
            contact: contactId,
            channel: channel || 'whatsapp',
            status: 'open',
            lastMessageDirection: 'outbound'
          });
        }

        // Use InboxService to send the message based on channel and type
        if (template) {
          await InboxService.sendTemplateMessage({
            workspaceId,
            conversationId: conversation._id,
            agentId: createdBy,
            templateName: typeof template === 'string' ? template : template.name,
            languageCode: template.language?.code || 'en',
            variables: template.components || []
          });
        } else if (channel === 'sms') {
          await InboxService.sendSmsMessage({
            workspaceId,
            conversationId: conversation._id,
            agentId: createdBy,
            text: message
          });
        } else if (channel === 'email') {
          await InboxService.sendEmailMessage({
            workspaceId,
            conversationId: conversation._id,
            agentId: createdBy,
            subject: job.data.subject || 'Message from wApi',
            html: message
          });
        } else {
          await InboxService.sendTextMessage({
            workspaceId,
            conversationId: conversation._id,
            agentId: createdBy,
            text: message
          });
        }

        processed++;
        
        // Update progress
        await job.updateProgress(Math.round((processed / contactIds.length) * 100));
        
      } catch (err) {
        console.error(`[BulkMessageWorker] Error sending to contact ${contactId}:`, err);
        failed++;
      }
    }

    console.log(`[BulkMessageWorker] Completed: ${processed} sent, ${failed} failed.`);
    return { processed, failed, total: contactIds.length };
  }, { connection });

  return worker;
};
