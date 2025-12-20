const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Contact = require('../models/Contact');

// Get all conversations for workspace
async function listConversations(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { status, assignedTo, limit = 50, offset = 0 } = req.query;
    
    const query = { workspace };
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    
    const conversations = await Conversation.find(query)
      .populate('contact', 'name phone email')
      .populate('assignedTo', 'name email')
      .sort({ lastActivityAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await Conversation.countDocuments(query);
    
    res.json({ conversations, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    next(err);
  }
}

// Get conversation by contact ID
async function getConversationByContact(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId } = req.params;
    
    let conversation = await Conversation.findOne({ workspace, contact: contactId })
      .populate('contact', 'name phone email metadata')
      .populate('assignedTo', 'name email');
    
    // Create conversation if it doesn't exist
    if (!conversation) {
      const contact = await Contact.findOne({ _id: contactId, workspace });
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }
      
      conversation = await Conversation.create({
        workspace,
        contact: contactId,
        status: 'open'
      });
      
      await conversation.populate('contact', 'name phone email metadata');
    }
    
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

// Get messages thread for a contact
async function getMessageThread(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Verify contact belongs to workspace
    const contact = await Contact.findOne({ _id: contactId, workspace });
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    const messages = await Message.find({ workspace, contact: contactId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await Message.countDocuments({ workspace, contact: contactId });
    
    // Reverse to show oldest first
    messages.reverse();
    
    res.json({ messages, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    next(err);
  }
}

// Update conversation (assign, status, etc.)
async function updateConversation(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId } = req.params;
    const { assignedTo, status, notes, tags } = req.body;
    
    const conversation = await Conversation.findOne({ workspace, contact: contactId });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    if (assignedTo !== undefined) conversation.assignedTo = assignedTo;
    if (status) conversation.status = status;
    if (notes !== undefined) conversation.notes = notes;
    if (tags) conversation.tags = tags;
    
    await conversation.save();
    await conversation.populate('contact assignedTo');
    
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

// Mark conversation as read
async function markAsRead(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId } = req.params;
    
    const conversation = await Conversation.findOne({ workspace, contact: contactId });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    conversation.unreadCount = 0;
    await conversation.save();
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConversations,
  getConversationByContact,
  getMessageThread,
  updateConversation,
  markAsRead
};
