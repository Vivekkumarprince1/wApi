/**
 * Bulk Operations Controller
 * Handles bulk create, update, delete, and export operations in-process for speed and reliability.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Contact, normalizePhoneNumber } from '../models/index.js';
import mongoose from 'mongoose';
import { contactImportService } from '../services/contact-import-service.js';
import { publishContactEvent } from '../services/eventBus.js';

export const bulkController = {
  /**
   * Bulk create/import contacts
   */
  async bulkCreateContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contacts } = req.body;
      const workspaceId = req.workspace?.id || req.workspace?._id;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ success: false, error: 'contacts array required' });
      }

      const imported = [];
      for (const c of contacts) {
        const rawPhone = c.phone || c.Phone || '';
        const phone = normalizePhoneNumber(rawPhone);
        if (!phone) continue;

        const name = c.name || c.Name || '';
        const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',').map((t: string) => t.trim()) : []);
        const email = c.email || c.Email || '';

        const updated = await (Contact as any).findOneAndUpdate(
          { phone, workspace: workspaceId },
          {
            $set: {
              name: name || undefined,
              leadStatus: c.leadStatus || 'new',
              'metadata.email': email || undefined
            },
            $addToSet: { tags: { $each: tags } }
          },
          { upsert: true, new: true }
        );
        imported.push(updated);
      }

      await publishContactEvent('contact_imported', String(workspaceId), {
        count: imported.length,
        contactIds: imported.map((contact: any) => String(contact._id)),
      });

      res.status(202).json({
        success: true,
        message: 'Bulk import completed',
        count: imported.length,
        status: 'completed'
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
      const workspaceId = req.workspace?.id || req.workspace?._id;

      if (!Array.isArray(contactIds) || !updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'contactIds array and updates object required'
        });
      }

      const result = await (Contact as any).updateMany(
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
      const workspaceId = req.workspace?.id || req.workspace?._id;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ success: false, error: 'contactIds array required' });
      }

      const result = await (Contact as any).deleteMany({
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
      const workspaceId = req.workspace?.id || req.workspace?._id;

      if (!Array.isArray(contactIds) || !Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: 'contactIds and tags arrays required'
        });
      }

      const result = await (Contact as any).updateMany(
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
      const workspaceId = req.workspace?.id || req.workspace?._id;

      if (!Array.isArray(contactIds) || !Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: 'contactIds and tags arrays required'
        });
      }

      const result = await (Contact as any).updateMany(
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
   * Bulk send messages
   */
  async bulkSendMessage(req: AuthRequest, res: Response, next: Function) {
    try {
      const { contactIds, message, channel = 'whatsapp', template } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ success: false, error: 'contactIds array required' });
      }

      if (!message && !template) {
        return res.status(400).json({ success: false, error: 'message or template required' });
      }

      return res.status(501).json({
        success: false,
        error: {
          code: 'FEATURE_NOT_IMPLEMENTED',
          message: 'Bulk message dispatch is not available',
          requestId: req.headers['x-correlation-id'] || null,
        },
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Export contacts to CSV via cursor streaming to prevent memory OOM
   */
  async exportContacts(req: AuthRequest, res: Response, next: Function) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
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

      const cursor = (Contact as any).find(query)
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
          await new Promise<void>((resolve) => res.once('drain', () => resolve()));
        }
      }

      res.end();
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
      res.json({
        success: true,
        jobId,
        queue: 'bulk-messages',
        status: 'completed',
        progress: 100,
        data: {}
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Upload and process CSV file for contact import
   */
  async uploadCSV(req: AuthRequest, res: Response, next: Function) {
    try {
      const { csvContent, fileName } = req.body;
      const workspaceId = req.workspace?.id || req.workspace?._id;

      if (!csvContent) {
        return res.status(400).json({ success: false, error: 'CSV content is required' });
      }

      const jobId = await contactImportService.startImport(
        workspaceId.toString(),
        fileName || 'import.csv',
        csvContent
      );

      res.status(202).json({
        success: true,
        jobId,
        message: 'CSV import started in background',
        statusUrl: `/api/v1/bulk/contacts/csv-import/${jobId}/progress`
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Get CSV import progress
   */
  async getCSVProgress(req: AuthRequest, res: Response, next: Function) {
    try {
      const { jobId } = req.params;
      const progress = await contactImportService.getProgress(jobId);
      if (!progress) {
        return res.status(404).json({ success: false, error: 'Import job not found' });
      }
      res.json({
        success: true,
        ...progress
      });
    } catch (err: any) {
      next(err);
    }
  },

  /**
   * Cancel CSV import
   */
  async cancelCSVImport(req: AuthRequest, res: Response, next: Function) {
    try {
      const { jobId } = req.params;
      await contactImportService.cancelImport(jobId);
      res.json({
        success: true,
        message: 'Import job cancelled'
      });
    } catch (err: any) {
      next(err);
    }
  }
};
