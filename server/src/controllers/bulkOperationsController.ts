/**
 * Bulk Operations Controller
 * Handles bulk create, update, delete, and export operations
 */

import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Contact, Message, Conversation } from '../models';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

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

      // Enqueue bulk import job
      const importQueue = new Queue('contact-imports', { connection: redis });
      const job = await importQueue.add('bulk-import', {
        workspaceId,
        contacts,
        createdBy: req.user._id
      });

      res.status(202).json({
        success: true,
        jobId: job.id,
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

      // Enqueue bulk message job
      const messageQueue = new Queue('bulk-messages', { connection: redis });
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
        message: 'Bulk message sending started',
        status: 'pending'
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Export contacts to CSV
   */
  async exportContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const workspaceId = req.workspace._id;
      const tags = (req.query.tags as string)?.split(',') || [];
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

      const contacts = await Contact.find(query)
        .select('name phone metadata.email tags createdAt lastMessageAt status leadStatus')
        .lean() as any[];

      // Convert to CSV
      const headers = ['ID', 'Name', 'Phone', 'Email', 'Tags', 'Created', 'Last Message', 'Status', 'Lead Status', 'Custom Fields'];
      const rows = contacts.map(c => [
        c._id.toString(),
        c.name || '',
        c.phone || '',
        c.metadata?.email || '',
        (c.tags || []).join(';'),
        new Date(c.createdAt).toISOString(),
        c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : '',
        c.status || '',
        c.leadStatus || '',
        JSON.stringify(c.metadata?.customFields || {})
      ]);

      const csv = [headers, ...rows].map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.send(csv);
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Get bulk operation status
   */
  async getBulkOperationStatus(req: AuthRequest, res: Response, next: Function) {
    try {
      const { jobId } = req.params;
      const importQueue = new Queue('contact-imports', { connection: redis });
      const job = await importQueue.getJob(jobId);

      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      const progress = (job as any).progress();
      const state = await (job as any).getState();
      const progress_value = typeof progress === 'object' ? (progress as any).value || 0 : progress;

      res.json({
        success: true,
        jobId,
        status: state,
        progress: progress_value,
        data: job.data
      });
    } catch (err: any) {
      next(err);
    }
  }
};
