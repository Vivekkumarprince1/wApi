const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const metaService = require('../services/metaService');

async function createContact(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const contact = await Contact.create({ workspace, ...req.body });
    res.status(201).json(contact);
  } catch (err) { next(err); }
}

async function uploadContacts(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: 'Invalid contacts data' });
    }

    const results = {
      success: [],
      failed: [],
      total: contacts.length
    };

    for (const contactData of contacts) {
      try {
        // Support both phone and phone_number fields
        const phone = contactData.phone || contactData.phone_number;
        
        if (!phone) {
          results.failed.push({ data: contactData, error: 'Phone number is required' });
          continue;
        }

        // Build contact object with proper field names
        const contactObj = {
          workspace,
          phone,
          name: contactData.name || (contactData.first_name || contactData.last_name 
            ? `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim() 
            : undefined),
          metadata: {}
        };

        // Add additional fields to metadata
        if (contactData.first_name) contactObj.metadata.firstName = contactData.first_name;
        if (contactData.last_name) contactObj.metadata.lastName = contactData.last_name;
        if (contactData.email) contactObj.metadata.email = contactData.email;

        // Use updateOne with upsert to avoid duplicates
        const result = await Contact.updateOne(
          { workspace, phone },
          { $set: contactObj },
          { upsert: true }
        );

        results.success.push(phone);
      } catch (err) {
        results.failed.push({ data: contactData, error: err.message });
      }
    }

    res.status(201).json({
      message: `Uploaded ${results.success.length} contacts successfully`,
      ...results
    });
  } catch (err) {
    next(err);
  }
}

async function listContacts(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { page = 1, limit = 50, search = '' } = req.query;
    
    const query = { workspace };
    
    // Add search functionality
    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { 'metadata.email': { $regex: search, $options: 'i' } },
        { 'metadata.firstName': { $regex: search, $options: 'i' } },
        { 'metadata.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    
    const total = await Contact.countDocuments(query);
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Transform contacts to include firstName, lastName, email at root level for frontend
    const transformedContacts = contacts.map(contact => ({
      _id: contact._id,
      id: contact._id,
      phone: contact.phone,
      name: contact.name,
      firstName: contact.metadata?.firstName || '',
      lastName: contact.metadata?.lastName || '',
      email: contact.metadata?.email || '',
      tags: contact.tags,
      metadata: contact.metadata,
      createdAt: contact.createdAt
    }));
    
    res.json({ 
      contacts: transformedContacts, 
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) { next(err); }
}

async function getContactStats(req, res, next) {
  try {
    const workspace = req.user.workspace;
    
    const total = await Contact.countDocuments({ workspace });
    const withEmail = await Contact.countDocuments({ 
      workspace, 
      'metadata.email': { $exists: true, $ne: '' } 
    });
    
    // Get contacts from this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await Contact.countDocuments({
      workspace,
      createdAt: { $gte: startOfMonth }
    });
    
    res.json({
      total,
      withEmail,
      withoutEmail: total - withEmail,
      newThisMonth
    });
  } catch (err) {
    next(err);
  }
}

async function getContact(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const contact = await Contact.findOne({ _id: req.params.id, workspace });
    if (!contact) return res.status(404).json({ message: 'Not found' });
    res.json(contact);
  } catch (err) { next(err); }
}

async function updateContact(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const contact = await Contact.findOneAndUpdate({ _id: req.params.id, workspace }, req.body, { new: true });
    res.json(contact);
  } catch (err) { next(err); }
}

async function deleteContact(req, res, next) {
  try {
    const workspace = req.user.workspace;
    await Contact.deleteOne({ _id: req.params.id, workspace });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { 
  createContact, 
  uploadContacts,
  listContacts, 
  getContactStats,
  getContact, 
  getContactWhatsAppProfile,
  updateContact, 
  deleteContact 
};

async function getContactWhatsAppProfile(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const contact = await Contact.findOne({ _id: req.params.id, workspace: workspaceId });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const accessToken = workspace.whatsappAccessToken || process.env.META_ACCESS_TOKEN;
    const wabaPhoneNumberId = workspace.whatsappPhoneNumberId || process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !wabaPhoneNumberId) {
      return res.status(400).json({ message: 'WABA credentials not configured for this workspace' });
    }

    // Lookup contact profile via Meta
    const profile = await metaService.lookupContactProfile(accessToken, wabaPhoneNumberId, contact.phone);

    res.json({ success: true, contact: contact, profile });
  } catch (err) {
    next(err);
  }
}
