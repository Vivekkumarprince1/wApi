/**
 * Bulk Operations Controller
 * Handles bulk create, update, delete, and export operations
 */

import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Contact, Message, Conversation } from '../models';
import { Queue } from 'bullmq';
import { getSharedRedis } from '../utils/ioredis';

// Shared connection + queue handles. The previous version constructed a
// new Queue (and Redis connection) per request, which leaked file
// descriptors at scale. The shared client also wires an `error` handler.
const importQueue = new Queue('contact-imports', { connection: getSharedRedis() as any });
const messageQueue = new Queue('bulk-messages', { connection: getSharedRedis() as any });

const BULK_QUEUES: Record<string, Queue> = {
  'contact-imports': importQueue,
  'bulk-messages': messageQueue,
};

export const bulkOperationsController = {
  /**
   * Bulk create contacts from CSV/JSON
   */
  async bulkCreateContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contacts } = req.body;
      const workspaceId = req.workspace._id;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ success: false, error: 'contacts array required' });
      }

      const job = await importQueue.add('bulk-import', {
        workspaceId,
        contacts,
        createdBy: req.user._id
      });

      res.status(202).json({
        success: true,
        jobId: job.id,
        queue: 'contact-imports',
        message: 'Bulk import started',
        status: 'pending'
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Bulk update contacts
   */
  async bulkUpdateContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contactIds, updates } = req.body;
      const workspaceId = req.workspace._id;

      if (!Array.isArray(contactIds) || !updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'contactIds array and updates object required'
        });
      }

      const result = await Contact.updateMany(
        { _id: { $in: contactIds }, workspace: workspaceId },
        { $set: updates }
      );

      res.json({
        success: true,
        matched: result.matchedCount,
        updated: result.modifiedCount
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Bulk delete contacts
   */
  async bulkDeleteContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contactIds } = req.body;
      const workspaceId = req.workspace._id;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ success: false, error: 'contactIds array required' });
      }

      const result = await Contact.deleteMany({
        _id: { $in: contactIds },
        workspace: workspaceId
      });

      res.json({
        success: true,
        deleted: result.deletedCount
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Bulk tag contacts
   */
  async bulkTagContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contactIds, tags } = req.body;
      const workspaceId = req.workspace._id;

      if (!Array.isArray(contactIds) || !Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: 'contactIds and tags arrays required'
        });
      }

      const result = await Contact.updateMany(
        { _id: { $in: contactIds }, workspace: workspaceId },
        { $addToSet: { tags: { $each: tags } } }
      );

      res.json({
        success: true,
        updated: result.modifiedCount
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Bulk untag contacts
   */
  async bulkUntagContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contactIds, tags } = req.body;
      const workspaceId = req.workspace._id;

      if (!Array.isArray(contactIds) || !Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: 'contactIds and tags arrays required'
        });
      }

      const result = await Contact.updateMany(
        { _id: { $in: contactIds }, workspace: workspaceId },
        { $pullAll: { tags: tags } }
      );

      res.json({
        success: true,
        updated: result.modifiedCount
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Bulk send messages (via Queue)
   */
  async bulkSendMessage(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contactIds, message, channel = 'whatsapp', template } = req.body;
      const workspaceId = req.workspace._id;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ success: false, error: 'contactIds array required' });
      }

      if (!message && !template) {
        return res.status(400).json({ success: false, error: 'message or template required' });
      }

      const job = await messageQueue.add('send-mass-messages', {
        workspaceId,
        contactIds,
        message,
        channel,
        template,
        createdBy: req.user._id
      });

      res.status(202).json({
        success: true,
        jobId: job.id,
        queue: 'bulk-messages',
        message: 'Bulk message sending started',
        status: 'pending'
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Export contacts to CSV by streaming a Mongo cursor.
   *
   * Previous version did `Contact.find(query).lean()` which loaded the
   * full result set into memory before writing the response — easy OOM
   * on large workspaces. We now stream rows as they're read and buffer at
   * most one chunk at a time.
   */
  async exportContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const workspaceId = req.workspace._id;
      const tags = (req.query.tags as string)?.split(',').filter(Boolean) || [];
      const search = req.query.search as string;

      const query: any = { workspace: workspaceId };
      if (tags.length > 0) query.tags = { $all: tags };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { 'metadata.email': { $regex: search, $options: 'i' } }
        ];
      }

      const headers = ['ID', 'Name', 'Phone', 'Email', 'Tags', 'Created', 'Last Message', 'Status', 'Lead Status', 'Custom Fields'];
      const csvCell = (cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
      const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.write(csvRow(headers) + '\n');

      const cursor = Contact.find(query)
        .select('name phone metadata.email tags createdAt lastMessageAt status leadStatus metadata.customFields')
        .lean()
        .cursor();

      for await (const c of cursor as any) {
        const row = [
          c._id.toString(),
          c.name || '',
          c.phone || '',
          c.metadata?.email || '',
          (c.tags || []).join(';'),
          c.createdAt ? new Date(c.createdAt).toISOString() : '',
          c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : '',
          c.status || '',
          c.leadStatus || '',
          JSON.stringify(c.metadata?.customFields || {}),
        ];
        if (!res.write(csvRow(row) + '\n')) {
          // Backpressure: pause the cursor until the socket drains.
          await new Promise<void>((resolve) => res.once('drain', () => resolve()));
        }
      }

      res.end();
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Get bulk operation status. Looks up the job in both the contact-import
   * queue and the bulk-message queue, optionally narrowed by `?queue=...`
   * for callers that already know which one to ask.
   */
  async getBulkOperationStatus(req: AuthRequest, res: Response, next: Function) {
    try {
      const { jobId } = req.params;
      const queueHint = String(req.query.queue || '').trim();

      const queuesToCheck: Array<{ name: string; queue: Queue }> = queueHint && BULK_QUEUES[queueHint]
        ? [{ name: queueHint, queue: BULK_QUEUES[queueHint] }]
        : Object.entries(BULK_QUEUES).map(([name, queue]) => ({ name, queue }));

      let found: { name: string; job: any } | null = null;
      for (const { name, queue } of queuesToCheck) {
        const job = await queue.getJob(jobId);
        if (job) {
          found = { name, job };
          break;
        }
      }

      if (!found) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      const job: any = found.job;
      const rawProgress = typeof job.progress === 'function' ? job.progress() : job.progress;
      const state = await job.getState();
      const progress_value = typeof rawProgress === 'object' ? (rawProgress?.value || 0) : (rawProgress || 0);

      res.json({
        success: true,
        jobId,
        queue: found.name,
        status: state,
        progress: progress_value,
        data: job.data
      });
    } catch (err: any) {
      next(err);
    }
  }
};
