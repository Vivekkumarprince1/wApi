/**
 * Opt-Out Management Service
 * Handles STOP/UNSUBSCRIBE keywords and compliance
 * Required by Meta for WhatsApp messaging
 */

const Contact = require('../models/Contact');

const STOP_KEYWORDS = [
  'stop',
  'unsubscribe',
  'opt out',
  'optout',
  'opt-out',
  'cancel',
  'quit',
  'end',
  'nope',
  'no thanks'
];

const START_KEYWORDS = [
  'start',
  'subscribe',
  'opt in',
  'optin',
  'opt-in',
  'resume',
  'unstop',
  'yes',
  'continue'
];

/**
 * Check inbound message for opt-out/opt-in keywords
 * Auto-update contact status if detected
 * Send required confirmation message
 */
async function checkAndHandleOptOut(contact, messageBody, workspace, workspaceId) {
  if (!messageBody || !contact) {
    return { noChange: true };
  }

  const normalizedBody = messageBody.toLowerCase().trim();
  const firstWord = normalizedBody.split(/[\s\n]/)[0];

  // Check for opt-out
  if (STOP_KEYWORDS.includes(firstWord)) {
    if (contact.optOut?.status === true) {
      return { alreadyOptedOut: true };
    }

    // Mark as opted out
    contact.optOut = {
      status: true,
      optedOutAt: new Date(),
      optedOutVia: 'keyword'
    };
    await contact.save();

    console.log(`[OptOut] ✅ Contact ${contact.phone} opted out via keyword`);

    // Send confirmation message (required by Meta)
    try {
      const bspMessagingService = require('./bspMessagingService');
      await bspMessagingService.sendTextMessage(
        workspaceId,
        contact.phone,
        '✓ You have been unsubscribed from our messages. Reply START to subscribe again.',
        { contactId: contact._id }
      );
    } catch (err) {
      console.error('[OptOut] Failed to send confirmation:', err.message);
    }

    // Log audit
    try {
      const { log } = require('./auditService');
      await log(workspaceId, null, 'contact.opted_out', {
        type: 'contact',
        id: contact._id,
        phone: contact.phone
      });
    } catch (auditErr) {
      console.error('[OptOut] Audit log failed:', auditErr.message);
    }

    return { optedOut: true, confirmation: 'Message sent' };
  }

  // Check for opt-in
  if (contact.optOut?.status === true && START_KEYWORDS.includes(firstWord)) {
    contact.optOut = {
      status: false,
      optedBackInAt: new Date()
    };
    await contact.save();

    console.log(`[OptOut] ✅ Contact ${contact.phone} opted back in via keyword`);

    // Send confirmation
    try {
      const bspMessagingService = require('./bspMessagingService');
      await bspMessagingService.sendTextMessage(
        workspaceId,
        contact.phone,
        '✓ You have been resubscribed. We\'ll continue sending you updates.',
        { contactId: contact._id }
      );
    } catch (err) {
      console.error('[OptOut] Failed to send opt-in confirmation:', err.message);
    }

    try {
      const { log } = require('./auditService');
      await log(workspaceId, null, 'contact.opted_in', {
        type: 'contact',
        id: contact._id,
        phone: contact.phone
      });
    } catch (auditErr) {
      console.error('[OptOut] Audit log failed:', auditErr.message);
    }

    return { optedIn: true, confirmation: 'Message sent' };
  }

  return { noChange: true };
}

/**
 * Check if contact is opted out
 * Used as gate before sending messages
 */
async function isOptedOut(contactId) {
  try {
    const contact = await Contact.findById(contactId).select('optOut.status').lean();
    return contact?.optOut?.status === true;
  } catch (err) {
    console.error('[OptOut] Check failed:', err.message);
    return false; // Default to allowing send if check fails
  }
}

/**
 * Check if contact is opted out by phone number (workspace scoped)
 * Used for outbound sends where contactId is not available
 */
async function isOptedOutByPhone(workspaceId, phone) {
  try {
    if (!workspaceId || !phone) return false;
    const contact = await Contact.findOne({
      workspace: workspaceId,
      phone: phone
    }).select('optOut.status').lean();
    return contact?.optOut?.status === true;
  } catch (err) {
    console.error('[OptOut] Phone check failed:', err.message);
    return false;
  }
}

/**
 * Manual opt-out (by user/admin)
 */
async function manualOptOut(contactId, workspaceId) {
  try {
    const contact = await Contact.findByIdAndUpdate(
      contactId,
      {
        'optOut.status': true,
        'optOut.optedOutAt': new Date(),
        'optOut.optedOutVia': 'manual'
      },
      { new: true }
    );

    const { log } = require('./auditService');
    await log(workspaceId, null, 'contact.manually_opted_out', {
      type: 'contact',
      id: contactId
    });

    return { success: true, contact };
  } catch (err) {
    console.error('[OptOut] Manual opt-out failed:', err.message);
    throw err;
  }
}

/**
 * Manual opt-in (by user/admin)
 */
async function manualOptIn(contactId, workspaceId) {
  try {
    const contact = await Contact.findByIdAndUpdate(
      contactId,
      {
        'optOut.status': false,
        'optOut.optedBackInAt': new Date()
      },
      { new: true }
    );

    const { log } = require('./auditService');
    await log(workspaceId, null, 'contact.manually_opted_in', {
      type: 'contact',
      id: contactId
    });

    return { success: true, contact };
  } catch (err) {
    console.error('[OptOut] Manual opt-in failed:', err.message);
    throw err;
  }
}

module.exports = {
  checkAndHandleOptOut,
  isOptedOut,
  isOptedOutByPhone,
  manualOptOut,
  manualOptIn,
  STOP_KEYWORDS,
  START_KEYWORDS
};
