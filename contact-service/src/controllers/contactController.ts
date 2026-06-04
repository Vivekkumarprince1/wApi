import express from 'express';
import mongoose from 'mongoose';
import { Contact, FormSubmission, normalizePhoneNumber } from '../models/index.js';
import { publishContactEvent } from '../services/eventBus.js';

export const getContactsInternal = async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'];
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Missing workspace context header' });
    }

    const { page = 1, limit = 50, search, tags } = req.query as any;
    const query: any = { workspace: new mongoose.Types.ObjectId(String(workspaceId)) };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } },
        { 'metadata.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : String(tags).split(',');
      query.tags = { $in: tagList };
    }

    const skip = (page - 1) * limit;
    const items = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Contact.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
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

    const db = Contact.db.useDb('wapi');
    const workspaceDoc = await db.collection('workspaces').findOne({ _id: new mongoose.Types.ObjectId(String(workspaceId)) });
    if (!workspaceDoc) {
      return res.status(404).json({ success: false, message: 'Workspace context lost' });
    }

    const planId = workspaceDoc.plan;
    let planDoc = null;
    if (planId) {
      planDoc = await db.collection('plans').findOne({ _id: planId });
    }
    if (!planDoc) {
      planDoc = await db.collection('plans').findOne({ isDefault: true }) || await db.collection('plans').findOne({ isActive: true });
    }

    const limits = planDoc?.limits || {};
    const limit = limits.maxContacts || -1;

    if (limit !== -1) {
      const currentUsage = await Contact.countDocuments({ workspace: new mongoose.Types.ObjectId(String(workspaceId)) });
      if (currentUsage >= limit) {
        return res.status(402).json({
          success: false,
          message: `Plan limit exceeded for contacts. Current: ${currentUsage}/${limit}.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit,
          current: currentUsage,
          resource: 'contacts'
        });
      }
    }

    contact = await Contact.create({
      workspace: new mongoose.Types.ObjectId(String(workspaceId)),
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
    const query: any = { workspace: workspaceId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } },
        { 'metadata.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : String(tags).split(',');
      query.tags = { $in: tagList };
    }

    const skip = (page - 1) * limit;
    const items = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Contact.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
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

    const db = Contact.db.useDb('wapi');
    const workspaceDoc = await db.collection('workspaces').findOne({ _id: new mongoose.Types.ObjectId(String(workspaceId)) });
    if (!workspaceDoc) {
      return res.status(404).json({ success: false, message: 'Workspace context lost' });
    }

    const planId = workspaceDoc.plan;
    let planDoc = null;
    if (planId) {
      planDoc = await db.collection('plans').findOne({ _id: planId });
    }
    if (!planDoc) {
      planDoc = await db.collection('plans').findOne({ isDefault: true }) || await db.collection('plans').findOne({ isActive: true });
    }

    const limits = planDoc?.limits || {};
    const limit = limits.maxContacts || -1;

    if (limit !== -1) {
      const currentUsage = await Contact.countDocuments({ workspace: new mongoose.Types.ObjectId(String(workspaceId)) });
      if (currentUsage >= limit) {
        return res.status(402).json({
          success: false,
          message: `Plan limit exceeded for contacts. Current: ${currentUsage}/${limit}.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit,
          current: currentUsage,
          resource: 'contacts'
        });
      }
    }

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
    const { phone, name } = req.body;
    if (!workspaceId || !phone) {
      return res.status(400).json({ success: false, error: 'workspaceId and phone are required' });
    }
    const normalizedPhone = phone.replace(/\D/g, '');
    let contact = await Contact.findOne({
      workspace: new mongoose.Types.ObjectId(String(workspaceId)),
      phone: normalizedPhone,
    });
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
