import express from 'express';
import mongoose from 'mongoose';

const escapeSearch = (value: unknown) => String(value || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { Contact, FormSubmission, normalizePhoneNumber } from '../models/index.js';
import { publishContactEvent } from '../services/eventBus.js';
import { logActivity } from '../services/activity-log.js';

function dbNameFromUri(uri?: string) {
  if (!uri) return undefined;
  try {
    const pathname = new URL(uri).pathname.replace(/^\//, '');
    return pathname || undefined;
  } catch {
    return undefined;
  }
}

function getWorkspaceDbNames() {
  const currentDbName = Contact.db.name;
  const candidates = [
    currentDbName,
    currentDbName?.endsWith('_contact') ? currentDbName.replace(/_contact$/, '_auth') : undefined,
    process.env.WORKSPACE_DB_NAME,
    process.env.AUTH_DB_NAME,
    process.env.AUTH_DATABASE_NAME,
    dbNameFromUri(process.env.AUTH_MONGO_URI || process.env.AUTH_MONGODB_URI),
    'wapi_auth',
    'wapi',
  ];

  return [...new Set(candidates.filter((name): name is string => Boolean(name)))];
}

async function findWorkspaceAndPlan(workspaceId: mongoose.Types.ObjectId) {
  for (const dbName of getWorkspaceDbNames()) {
    const db = Contact.db.useDb(dbName);
    const workspaceDoc = await db.collection('workspaces').findOne({ _id: workspaceId });
    if (!workspaceDoc) continue;

    const planId = workspaceDoc.plan || workspaceDoc.planId;
    const planDoc = planId ? await db.collection('plans').findOne({ _id: planId }) : null;
    return { workspaceDoc, planDoc };
  }

  return { workspaceDoc: null, planDoc: null };
}

async function enforceContactLimit(workspaceId: mongoose.Types.ObjectId, res: express.Response) {
  const { workspaceDoc, planDoc } = await findWorkspaceAndPlan(workspaceId);
  const limits = workspaceDoc?.limits || planDoc?.limits || {};
  const limit = limits.maxContacts || -1;

  if (limit !== -1) {
    const currentUsage = await Contact.countDocuments({ workspace: workspaceId });
    if (currentUsage >= limit) {
      res.status(402).json({
        success: false,
        message: `Plan limit exceeded for contacts. Current: ${currentUsage}/${limit}.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        limit,
        current: currentUsage,
        resource: 'contacts'
      });
      return false;
    }
  }

  return true;
}

export const getContactsInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'];
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const { page = 1, limit = 50, search, tags } = req.query as any;
    const boundedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
    const safeSearch = escapeSearch(search);
    const query: any = { workspace: new mongoose.Types.ObjectId(String(workspaceId)) };

    if (safeSearch) {
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch } },
        { 'metadata.email': { $regex: safeSearch, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : String(tags).split(',');
      query.tags = { $in: tagList };
    }

    const skip = (Number(page) - 1) * boundedLimit;
    const items = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(boundedLimit)
      .lean();

    const total = await Contact.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: parseInt(page, 10),
        limit: boundedLimit,
        total,
        pages: Math.ceil(total / boundedLimit)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createContactInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const { name, phone, tags, customFields, leadStatus, metadata } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // Idempotency: Verify if contact already exists in this workspace
    let contact = await Contact.findOne({ workspace: new mongoose.Types.ObjectId(String(workspaceId)), phone: normalizedPhone });
    if (contact) {
      return res.status(409).json({ success: false, message: 'Contact with this phone number already exists in workspace' });
    }

    const workspaceObjectId = new mongoose.Types.ObjectId(String(workspaceId));
    if (!(await enforceContactLimit(workspaceObjectId, res))) return;

    contact = await Contact.create({
      workspace: workspaceObjectId,
      name,
      phone: normalizedPhone,
      tags: tags || [],
      customFields: customFields || {},
      leadStatus: leadStatus || 'new',
      metadata: metadata || {},
    });

    await publishContactEvent('contact_created', String(workspaceId), { contact });
    return res.status(201).json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getContactByIdInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { id } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(id),
      workspace: new mongoose.Types.ObjectId(String(workspaceId))
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    return res.status(200).json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateContactInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { id } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const updateFields = req.body;
    if (updateFields.phone) {
      updateFields.phone = normalizePhoneNumber(updateFields.phone);
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), workspace: new mongoose.Types.ObjectId(String(workspaceId)) },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found or access denied' });
    }

    await publishContactEvent('contact_updated', String(workspaceId), { contact });
    return res.status(200).json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteContactInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { id } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const contact = await Contact.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      workspace: new mongoose.Types.ObjectId(String(workspaceId))
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found or access denied' });
    }

    await publishContactEvent('contact_deleted', String(workspaceId), { contactId: id });
    return res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getFormSubmissionsInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { id } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const submissions = await FormSubmission.find({
      workspace: new mongoose.Types.ObjectId(String(workspaceId)),
      contact: new mongoose.Types.ObjectId(id)
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: submissions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// --- Authenticated Public routes ---

export const getContactsPublic = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace context missing' });
    }

    const { page = 1, limit = 50, search, tags } = req.query as any;
    const boundedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
    const safeSearch = escapeSearch(search);
    const query: any = { workspace: workspaceId };

    if (safeSearch) {
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch } },
        { 'metadata.email': { $regex: safeSearch, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : String(tags).split(',');
      query.tags = { $in: tagList };
    }

    const skip = (Number(page) - 1) * boundedLimit;
    const items = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(boundedLimit)
      .lean();

    const total = await Contact.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: parseInt(page, 10),
        limit: boundedLimit,
        total,
        pages: Math.ceil(total / boundedLimit)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createContactPublic = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace context missing' });
    }

    const { name, phone, tags, customFields, leadStatus, metadata } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    let contact = await Contact.findOne({ workspace: workspaceId, phone: normalizedPhone });
    if (contact) {
      return res.status(409).json({ success: false, message: 'Contact already exists in workspace' });
    }

    if (!(await enforceContactLimit(new mongoose.Types.ObjectId(String(workspaceId)), res))) return;

    contact = await Contact.create({
      workspace: workspaceId,
      name,
      phone: normalizedPhone,
      tags: tags || [],
      customFields: customFields || {},
      leadStatus: leadStatus || 'new',
      metadata: metadata || {},
    });

    await publishContactEvent('contact_created', String(workspaceId), { contact });
    await logActivity(req, 'create', 'contact', {
      entityId: contact._id.toString(),
      entityName: name,
    });
    return res.status(201).json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getContactByIdPublic = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    const { id } = req.params;

    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(id),
      workspace: workspaceId
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await publishContactEvent('contact_updated', String(workspaceId), { contact });
    return res.status(200).json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateContactPublic = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    const { id } = req.params;

    const updateFields = req.body;
    if (updateFields.phone) {
      updateFields.phone = normalizePhoneNumber(updateFields.phone);
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), workspace: workspaceId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await logActivity(req, 'update', 'contact', {
      entityId: id,
      entityName: (contact as any).name,
      changes: { after: updateFields },
    });

    return res.status(200).json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteContactPublic = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    const { id } = req.params;

    const contact = await Contact.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      workspace: workspaceId
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await publishContactEvent('contact_deleted', String(workspaceId), { contactId: id });
    await logActivity(req, 'delete', 'contact', {
      entityId: id,
      entityName: (contact as any).name,
    });
    return res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getFormSubmissionsPublic = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    const { id } = req.params;

    const submissions = await FormSubmission.find({
      workspace: workspaceId,
      contact: new mongoose.Types.ObjectId(id)
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: submissions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const queryContactsInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] || req.body.workspaceId;
    const { query } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'workspaceId is required' });
    }
    const safeQuery = { ...(query || {}), workspace: new mongoose.Types.ObjectId(String(workspaceId)) };
    const contacts = await Contact.find(safeQuery).distinct('_id');
    return res.json({ success: true, contacts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const countContactsInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] || req.body.workspaceId;
    const { query } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'workspaceId is required' });
    }
    const safeQuery = { ...(query || {}), workspace: new mongoose.Types.ObjectId(String(workspaceId)) };
    const count = await Contact.countDocuments(safeQuery);
    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const resolveContactInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] || req.body.workspaceId;
    const { phone, name, lastInboundAt } = req.body;
    if (!workspaceId || !phone) {
      return res.status(400).json({ success: false, error: 'workspaceId and phone are required' });
    }
    const normalizedPhone = phone.replace(/\D/g, '');
    let contact = await Contact.findOne({
      workspace: new mongoose.Types.ObjectId(String(workspaceId)),
      phone: normalizedPhone,
    });
    if (contact && lastInboundAt) {
      // Inbound-message resolves stamp activity on the contact (monolith parity).
      const ts = new Date(lastInboundAt);
      if (!Number.isNaN(ts.getTime())) {
        (contact as any).lastInboundAt = ts;
        await contact.save();
      }
    }
    if (!contact) {
      contact = await Contact.create({
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        phone: normalizedPhone,
        name: name || phone,
        leadStatus: 'new',
      });
      await publishContactEvent('contact_created', String(workspaceId), { contact });
    }
    return res.json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
