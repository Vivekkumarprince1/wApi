import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Contact, Conversation, Message, FormSubmission } from '../models';
import { AutomationClient } from '../services/automation/automation-client';
import { normalizePhoneNumber } from '../utils/phone-utils';
import { UsageTracker } from '../services/workspace/usage-tracker';
import { NotFoundError, ConflictError, ApiError, BadRequestError } from '../utils/errors';
import { InboxService } from '../services/messaging/inbox-service';
import * as SocketService from '../services/socket-service';
import { logActivity, getDifferences } from '../services/activity-logging-service';
import { QUEUE_NAMES } from '@wapi/contracts';

export const contactController = {
  /**
   * List contacts with search and pagination
   */
  async listContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string || "1");
      const limit = parseInt(req.query.limit as string || "20");
      const searchQuery = req.query.search as string;
      const tags = (req.query.tags as string)?.split(",") || [];

      // Build query
      const query: any = { workspace: req.workspace._id };
      
      if (searchQuery) {
        const normalizedSearch = normalizePhoneNumber(searchQuery);
        query.$or = [
          { name: { $regex: searchQuery, $options: "i" } },
          { phone: { $regex: searchQuery, $options: "i" } }
        ];
        
        if (normalizedSearch !== searchQuery && normalizedSearch.length > 5) {
          query.$or.push({ phone: { $regex: normalizedSearch, $options: "i" } });
        }
      }
      
      if (tags.length > 0 && tags[0] !== "") {
        query.tags = { $all: tags };
      }

      const [contacts, total] = await Promise.all([
        Contact.find(query)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit),
        Contact.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: contacts,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create a new contact manually
   */
  async createContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, phone, email, metadata, tags } = req.body;
      const normalizedPhone = normalizePhoneNumber(phone);

      // Check for duplicate
      const existing = await Contact.findOne({ workspace: req.workspace._id, phone: normalizedPhone });
      if (existing) {
        throw new ConflictError("Contact already exists", existing);
      }

      const contact = await Contact.create({
        workspace: req.workspace._id,
        name: name || "Unknown",
        phone: normalizedPhone,
        metadata: { ...metadata, email: email || metadata?.email },
        tags: tags || [],
        leadStatus: 'new'
      });

      // Increment usage counter
      await UsageTracker.increment(req.workspace._id, 'contacts');

      // Log activity
      await logActivity(req, 'create', 'contact', {
        entityId: contact._id.toString(),
        entityName: contact.name,
        metadata: { phone: normalizedPhone }
      });

      // Emit socket event for real-time updates
      SocketService.emitContactCreated(req.workspace._id, contact);

      // Trigger automation
      AutomationClient.triggerEvent(req.workspace._id.toString(), 'contact_created', {
        contactId: contact._id.toString(),
        name: contact.name,
        phone: contact.phone
      }).catch(err => console.error('[ContactController] Automation trigger failed:', err.message));

      res.status(201).json({
        success: true,
        data: contact
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * WhatsApp Flow / form submissions linked to this contact (timeline API).
   */
  async listFormSubmissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const exists = await Contact.exists({ _id: id, workspace: req.workspace._id });
      if (!exists) {
        throw new NotFoundError('Contact not found');
      }

      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const rows = await FormSubmission.find({
        workspace: req.workspace._id,
        contact: id,
      })
        .sort({ receivedAt: -1 })
        .limit(limit)
        .lean();

      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get single contact
   */
  async getContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const contact = await Contact.findOne({ _id: id, workspace: req.workspace._id }).lean();
      
      if (!contact) {
        throw new NotFoundError("Contact not found");
      }

      res.json({ success: true, data: contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update contact
   */
  async updateContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, email, phone, tags, metadata } = req.body;
      
      const contact = await Contact.findOne({ _id: id, workspace: req.workspace._id });
      if (!contact) {
        throw new NotFoundError("Contact not found");
      }

      // Store before state for activity log
      const beforeState = contact.toObject();

      if (name) contact.name = name;
      if (email) contact.metadata = { ...contact.metadata, email };
      if (phone) contact.phone = normalizePhoneNumber(phone);
      if (tags) contact.tags = tags;
      if (metadata) contact.metadata = { ...contact.metadata, ...metadata };

      await contact.save();

      // Log activity with changes
      const afterState = contact.toObject();
      const changes = getDifferences(beforeState, afterState);
      
      await logActivity(req, 'update', 'contact', {
        entityId: contact._id.toString(),
        entityName: contact.name,
        changes: { before: beforeState, after: afterState }
      });

      // Emit socket event for real-time updates
      SocketService.emitContactUpdated(req.workspace._id, contact._id.toString(), contact as any);

      res.json({ success: true, data: contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete contact
   */
  async deleteContact(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const contact = await Contact.findOne({ _id: id, workspace: req.workspace._id });
      if (!contact) {
        throw new NotFoundError("Contact not found");
      }

      // Store contact data before deletion for audit log
      const deletedContactData = contact.toObject();

      // Cleanup associated data
      const conversations = await Conversation.find({ contact: id, workspace: req.workspace._id }).select('_id').lean();
      const conversationIds = conversations.map(c => c._id);

      await Message.deleteMany({ conversation: { $in: conversationIds } });
      await Conversation.deleteMany({ _id: { $in: conversationIds } });
      await Contact.deleteOne({ _id: id });

      // Log activity
      await logActivity(req, 'delete', 'contact', {
        entityId: id,
        entityName: contact.name,
        metadata: { phone: contact.phone, deletedAt: new Date() }
      });

      // Emit socket event for real-time updates
      SocketService.emitContactDeleted(req.workspace._id, id);

      res.json({ success: true, message: "Contact and associated data deleted" });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Import contacts
   */
  async importContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contacts } = req.body;
      if (!contacts || !Array.isArray(contacts)) throw new BadRequestError("Invalid contacts array");

      // For large imports (> 50), offload to background worker
      if (contacts.length > 50) {
        const { Queue } = await import('bullmq');
        const importQueue = new Queue(QUEUE_NAMES.IMPORT_JSON, {
          connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') }
        });
        
        await importQueue.add('bulk-import', { 
          contacts, 
          workspaceId: req.workspace._id.toString() 
        });

        return res.json({
          success: true,
          message: `Large import of ${contacts.length} contacts started in background.`,
          isBackground: true
        });
      }
      
      const bulkOps = contacts.map((c: any) => ({
        updateOne: {
          filter: { workspace: req.workspace._id, phone: normalizePhoneNumber(c.phone) },
          update: {
            $setOnInsert: {
              workspace: req.workspace._id,
              name: c.name || "Valued Customer",
              phone: normalizePhoneNumber(c.phone),
              metadata: { email: c.email, ...c.metadata },
              tags: ['imported'],
              leadStatus: 'new',
              createdAt: new Date()
            }
          },
          upsert: true
        }
      }));

      const result = await Contact.bulkWrite(bulkOps);
      const imported = result.upsertedCount;

      if (imported > 0) {
        await UsageTracker.increment(req.workspace._id, 'contacts', imported);
      }

      res.json({
        success: true,
        message: `Processed ${contacts.length} contacts. Added ${imported} new ones.`,
        imported,
        total: contacts.length
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Send template to contact
   */
  async sendTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: contactId } = req.params;
      const { templateName, languageCode, variables } = req.body;

      const contact = await Contact.findOne({ _id: contactId, workspace: req.workspace._id });
      if (!contact) {
        throw new NotFoundError("Contact not found");
      }

      let conversation = await Conversation.findOne({ workspace: req.workspace._id, contact: contactId });
      if (!conversation) {
        conversation = await Conversation.create({
          workspace: req.workspace._id,
          contact: contactId,
          status: 'open',
          isOpen: true,
          channel: 'whatsapp',
          lastActivityAt: new Date()
        });
      }

      const result = await InboxService.sendTemplateMessage({
        workspaceId: req.workspace._id,
        conversationId: conversation._id,
        agentId: req.user._id,
        templateName,
        languageCode: languageCode || 'en',
        variables: variables || []
      });

      if (!result.success) {
        throw new ApiError(400, result.result?.error || "Failed to send template", 'SEND_TEMPLATE_FAILED');
      }

      res.json({ success: true, data: result.message, conversationId: conversation._id });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Upload and process CSV file for contact import
   */
  async uploadCSV(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { csvContent, fileName } = req.body;

      if (!csvContent) {
        throw new BadRequestError('CSV content is required');
      }

      const { contactImportService } = await import('../services/messaging/contact-import-service');
      
      const jobId = await contactImportService.startImport(
        req.workspace._id.toString(),
        req.user._id.toString(),
        fileName || 'import.csv',
        csvContent
      );

      res.json({
        success: true,
        jobId,
        message: 'Import started. You can track progress using this jobId.',
        statusUrl: `/api/contacts/csv-import/${jobId}/progress`
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get import job progress
   */
  async getImportProgress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { contactImportService } = await import('../services/messaging/contact-import-service');

      const progress = await contactImportService.getProgress(jobId);

      if (!progress) {
        throw new NotFoundError('Import job not found or expired');
      }

      res.json({
        success: true,
        data: progress
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Cancel an import job
   */
  async cancelImport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { contactImportService } = await import('../services/messaging/contact-import-service');

      await contactImportService.cancelImport(jobId);

      res.json({
        success: true,
        message: 'Import job cancelled'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List active imports for workspace
   */
  async listActiveImports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contactImportService } = await import('../services/messaging/contact-import-service');

      const imports = await contactImportService.getActiveImports(req.workspace._id.toString());

      res.json({
        success: true,
        data: imports
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export all contacts for the workspace as CSV
   */
  async exportContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace._id;
      const csvEscape = (val: any) => {
        const s = val === undefined || val === null ? '' : String(val);
        return `"${s.replace(/"/g, '""')}"`;
      };

      const headers = ['ID', 'Name', 'Phone', 'Email', 'Tags', 'Lead Status', 'Opted Out', 'Created At'];
      const filename = `contacts_${workspaceId}_${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.write(headers.map(csvEscape).join(',') + '\n');

      const cursor = Contact.find({ workspace: workspaceId }).sort({ createdAt: -1 }).lean().cursor();
      for await (const c of cursor as any) {
        const row = [
          c._id,
          c.name || c.metadata?.firstName || '',
          c.phone || '',
          c.metadata?.email || '',
          Array.isArray(c.tags) ? c.tags.join('; ') : '',
          c.leadStatus || '',
          c.optOut?.status ? 'yes' : 'no',
          c.createdAt ? new Date(c.createdAt).toISOString() : ''
        ];
        res.write(row.map(csvEscape).join(',') + '\n');
      }
      res.end();
    } catch (err) {
      next(err);
    }
  }
};
