/**
 * Soft Lock Service - Stage 4 Hardening
 * 
 * Prevents reply collisions in shared inbox:
 * - When agent starts typing → acquire soft lock
 * - Show "Agent X is replying" to others
 * - Release lock on send or inactivity timeout
 * - Soft enforcement only (not hard block)
 */

const Conversation = require('../models/Conversation');
const Workspace = require('../models/Workspace');
const { getIO } = require('../utils/socket');

/**
 * Acquire soft lock for a conversation
 * @param {ObjectId} conversationId 
 * @param {ObjectId} agentId 
 * @param {ObjectId} workspaceId 
 * @returns {Object} { acquired: boolean, lockedBy: object }
 */
async function acquireSoftLock(conversationId, agentId, workspaceId) {
  try {
    // Get workspace settings
    const workspace = await Workspace.findById(workspaceId)
      .select('inboxSettings')
      .lean();

    if (!workspace?.inboxSettings?.softLockEnabled) {
      return { acquired: true, reason: 'SOFT_LOCK_DISABLED' };
    }

    const timeoutSeconds = workspace.inboxSettings.softLockTimeoutSeconds || 60;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutSeconds * 1000);

    // Get conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('softLock.lockedBy', 'name email')
      .lean();

    if (!conversation) {
      return { acquired: false, reason: 'CONVERSATION_NOT_FOUND' };
    }

    // Check if already locked by someone else
    const currentLock = conversation.softLock;
    
    if (currentLock?.lockedBy && 
        currentLock.lockedBy._id.toString() !== agentId.toString() &&
        currentLock.expiresAt > now) {
      
      // Lock held by another agent (soft warning, not blocking)
      return {
        acquired: false,
        softBlocked: true,
        lockedBy: {
          _id: currentLock.lockedBy._id,
          name: currentLock.lockedBy.name
        },
        expiresAt: currentLock.expiresAt,
        message: `${currentLock.lockedBy.name} is currently typing...`
      };
    }

    // Acquire or refresh lock
    await Conversation.findByIdAndUpdate(conversationId, {
      softLock: {
        lockedBy: agentId,
        lockedAt: now,
        expiresAt
      }
    });

    // Emit socket event to notify others
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation:soft-lock', {
        conversationId,
        lockedBy: agentId,
        expiresAt
      });

      io.to(`workspace:${workspaceId}`).emit('inbox:agent-typing', {
        conversationId,
        agentId,
        isTyping: true
      });
    }

    return {
      acquired: true,
      expiresAt,
      timeoutSeconds
    };

  } catch (err) {
    console.error('[SoftLock] Error acquiring lock:', err.message);
    return { acquired: true, error: err.message }; // Fail open
  }
}

/**
 * Release soft lock
 * @param {ObjectId} conversationId 
 * @param {ObjectId} agentId 
 * @param {ObjectId} workspaceId 
 */
async function releaseSoftLock(conversationId, agentId, workspaceId) {
  try {
    // Only release if current holder
    const conversation = await Conversation.findById(conversationId)
      .select('softLock')
      .lean();

    if (conversation?.softLock?.lockedBy?.toString() === agentId.toString()) {
      await Conversation.findByIdAndUpdate(conversationId, {
        $unset: { softLock: 1 }
      });

      // Emit socket event
      const io = getIO();
      if (io) {
        io.to(`conversation:${conversationId}`).emit('conversation:soft-lock-released', {
          conversationId,
          releasedBy: agentId
        });

        io.to(`workspace:${workspaceId}`).emit('inbox:agent-typing', {
          conversationId,
          agentId,
          isTyping: false
        });
      }

      console.log(`[SoftLock] Released lock for ${conversationId} by ${agentId}`);
    }

    return { success: true };

  } catch (err) {
    console.error('[SoftLock] Error releasing lock:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Refresh soft lock (extend timeout while still typing)
 */
async function refreshSoftLock(conversationId, agentId, workspaceId) {
  return acquireSoftLock(conversationId, agentId, workspaceId);
}

/**
 * Get current lock status for a conversation
 */
async function getLockStatus(conversationId) {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('softLock.lockedBy', 'name email')
      .select('softLock')
      .lean();

    if (!conversation) {
      return { locked: false, reason: 'CONVERSATION_NOT_FOUND' };
    }

    const lock = conversation.softLock;
    const now = new Date();

    if (!lock?.lockedBy || lock.expiresAt <= now) {
      return { locked: false };
    }

    return {
      locked: true,
      lockedBy: {
        _id: lock.lockedBy._id,
        name: lock.lockedBy.name
      },
      lockedAt: lock.lockedAt,
      expiresAt: lock.expiresAt,
      remainingSeconds: Math.ceil((lock.expiresAt - now) / 1000)
    };

  } catch (err) {
    console.error('[SoftLock] Error getting status:', err.message);
    return { locked: false, error: err.message };
  }
}

/**
 * Clean up expired locks (called periodically)
 */
async function cleanupExpiredLocks() {
  try {
    const now = new Date();

    const result = await Conversation.updateMany(
      {
        'softLock.expiresAt': { $lt: now }
      },
      {
        $unset: { softLock: 1 }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[SoftLock] Cleaned up ${result.modifiedCount} expired locks`);
    }

    return { cleaned: result.modifiedCount };

  } catch (err) {
    console.error('[SoftLock] Error cleaning up:', err.message);
    return { cleaned: 0, error: err.message };
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupExpiredLocks, 30000);

module.exports = {
  acquireSoftLock,
  releaseSoftLock,
  refreshSoftLock,
  getLockStatus,
  cleanupExpiredLocks
};
