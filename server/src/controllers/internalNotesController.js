/**
 * Internal Notes Controller - Stage 4 Hardening
 * 
 * Internal notes visible only to agents:
 * - Not sent to Meta/WhatsApp
 * - Stored separately from message thread
 * - Socket events to workspace only
 * - Supports mentions and message references
 */

const InternalNote = require('../models/InternalNote');
const Conversation = require('../models/Conversation');
const Permission = require('../models/Permission');
const { getIO } = require('../utils/socket');
const mongoose = require('mongoose');

/**
 * Create internal note
 * POST /api/inbox/:conversationId/notes
 */
exports.createNote = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, mentions, referencedMessage } = req.body;
    const agentId = req.user?._id || req.user?.id;
    const workspaceId = req.workspace?._id || req.body.workspaceId;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Note content is required'
      });
    }

    // Verify conversation exists and agent has access
    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    }).select('contact').lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Create note
    const note = new InternalNote({
      workspace: workspaceId,
      conversation: conversationId,
      contact: conversation.contact,
      content: content.trim(),
      createdBy: agentId,
      mentions: mentions || [],
      referencedMessage: referencedMessage || null
    });

    await note.save();

    // Populate for response
    await note.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'mentions', select: 'name email' }
    ]);

    // Emit socket event to workspace (agents only)
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('internal-note:created', {
        conversationId,
        note: {
          _id: note._id,
          content: note.content,
          createdBy: note.createdBy,
          createdAt: note.createdAt,
          mentions: note.mentions,
          referencedMessage: note.referencedMessage
        }
      });

      // Notify mentioned agents
      if (mentions?.length > 0) {
        mentions.forEach(mentionedAgentId => {
          io.to(`agent:${mentionedAgentId}`).emit('internal-note:mentioned', {
            conversationId,
            note: {
              _id: note._id,
              content: note.content,
              createdBy: note.createdBy
            }
          });
        });
      }
    }

    console.log(`[InternalNotes] Created note for conversation ${conversationId} by ${agentId}`);

    res.status(201).json({
      success: true,
      data: note
    });

  } catch (err) {
    console.error('[InternalNotes] Error creating note:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create internal note'
    });
  }
};

/**
 * Get notes for a conversation
 * GET /api/inbox/:conversationId/notes
 */
exports.getNotes = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.workspace?._id || req.query.workspaceId;
    const { limit = 50, before } = req.query;

    const query = {
      conversation: conversationId,
      workspace: workspaceId,
      isDeleted: { $ne: true }
    };

    // Pagination: get notes before a certain date
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const notes = await InternalNote.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('mentions', 'name email')
      .lean();

    res.json({
      success: true,
      data: notes.reverse(), // Return in chronological order
      hasMore: notes.length === parseInt(limit)
    });

  } catch (err) {
    console.error('[InternalNotes] Error getting notes:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get internal notes'
    });
  }
};

/**
 * Update a note
 * PUT /api/inbox/:conversationId/notes/:noteId
 */
exports.updateNote = async (req, res) => {
  try {
    const { conversationId, noteId } = req.params;
    const { content } = req.body;
    const agentId = req.user?._id || req.user?.id;
    const workspaceId = req.workspace?._id || req.body.workspaceId;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Note content is required'
      });
    }

    // Find and update only if owner
    const note = await InternalNote.findOne({
      _id: noteId,
      conversation: conversationId,
      workspace: workspaceId,
      createdBy: agentId,
      isDeleted: { $ne: true }
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or you do not have permission to edit'
      });
    }

    note.content = content.trim();
    note.updatedAt = new Date();
    await note.save();

    await note.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'mentions', select: 'name email' }
    ]);

    // Emit update event
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('internal-note:updated', {
        conversationId,
        note: {
          _id: note._id,
          content: note.content,
          updatedAt: note.updatedAt
        }
      });
    }

    res.json({
      success: true,
      data: note
    });

  } catch (err) {
    console.error('[InternalNotes] Error updating note:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update internal note'
    });
  }
};

/**
 * Delete a note (soft delete)
 * DELETE /api/inbox/:conversationId/notes/:noteId
 */
exports.deleteNote = async (req, res) => {
  try {
    const { conversationId, noteId } = req.params;
    const agentId = req.user?._id || req.user?.id;
    const workspaceId = req.workspace?._id || req.body.workspaceId;

    // Check if user is owner or admin
    const note = await InternalNote.findOne({
      _id: noteId,
      conversation: conversationId,
      workspace: workspaceId,
      isDeleted: { $ne: true }
    }).lean();

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Check permission (owner or admin)
    const isOwner = note.createdBy.toString() === agentId.toString();
    const permission = await Permission.findOne({
      user: agentId,
      workspace: workspaceId
    }).select('role').lean();

    const isAdmin = ['owner', 'admin'].includes(permission?.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this note'
      });
    }

    // Soft delete
    await InternalNote.findByIdAndUpdate(noteId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: agentId
    });

    // Emit delete event
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('internal-note:deleted', {
        conversationId,
        noteId
      });
    }

    res.json({
      success: true,
      message: 'Note deleted'
    });

  } catch (err) {
    console.error('[InternalNotes] Error deleting note:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete internal note'
    });
  }
};

/**
 * Get notes for a contact (across all conversations)
 * GET /api/contacts/:contactId/notes
 */
exports.getContactNotes = async (req, res) => {
  try {
    const { contactId } = req.params;
    const workspaceId = req.workspace?._id || req.query.workspaceId;
    const { limit = 50 } = req.query;

    const notes = await InternalNote.find({
      contact: contactId,
      workspace: workspaceId,
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('conversation', 'phoneNumber status')
      .lean();

    res.json({
      success: true,
      data: notes
    });

  } catch (err) {
    console.error('[InternalNotes] Error getting contact notes:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact notes'
    });
  }
};

/**
 * Search notes
 * GET /api/inbox/notes/search
 */
exports.searchNotes = async (req, res) => {
  try {
    const workspaceId = req.workspace?._id || req.query.workspaceId;
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const notes = await InternalNote.find({
      workspace: workspaceId,
      isDeleted: { $ne: true },
      content: { $regex: q, $options: 'i' }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('conversation', 'phoneNumber contactName')
      .lean();

    res.json({
      success: true,
      data: notes,
      query: q
    });

  } catch (err) {
    console.error('[InternalNotes] Error searching notes:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to search notes'
    });
  }
};
