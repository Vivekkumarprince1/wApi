/**
 * Gupshup Partner Send Service
 * 
 * Lightweight wrapper for direct Gupshup Partner API calls.
 * Endpoint: POST /partner/app/{appId}/v3/message
 * 
 * Used by the Inbox to send outbound WhatsApp messages.
 * Separate from bspMessagingService to provide explicit control
 * over the V3 partner endpoint format required by the requirement spec.
 * 
 * Session window is enforced upstream by:
 *   - bspMessagingService.canSendSessionMessage() for free messages
 *   - templates can always be sent (no 24h restriction)
 */

const axios = require('axios');
const { Workspace } = require('../../models');

const GUPSHUP_PARTNER_BASE = process.env.GUPSHUP_PARTNER_BASE_URL || 'https://partner.gupshup.io';

/**
 * Resolve app API key from Workspace document.
 * Checks both gupshupIdentity (primary) and legacy fields.
 */
function resolveCredentials(workspace) {
    const appId =
        workspace.gupshupIdentity?.partnerAppId ||
        workspace.gupshupAppId;

    const appApiKey =
        workspace.gupshupIdentity?.appApiKey ||
        workspace.bspConfig?.apiKey ||
        null;

    const phone =
        workspace.gupshupIdentity?.phone ||
        workspace.whatsappPhoneNumber ||
        workspace.bspDisplayPhoneNumber;

    return { appId, appApiKey, phone };
}

/**
 * Send a text message via Gupshup Partner API V3
 * POST /partner/app/{appId}/v3/message
 * 
 * @param {Object} workspace  - Mongoose workspace document
 * @param {string} destination - Recipient phone (digits only, no '+')
 * @param {string} text       - Message body
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendText(workspace, destination, text) {
    const { appId, appApiKey, phone } = resolveCredentials(workspace);

    if (!appId) throw new Error('GUPSHUP_PARTNER_SEND: appId missing on workspace');
    if (!appApiKey) throw new Error('GUPSHUP_PARTNER_SEND: appApiKey missing on workspace');

    const url = `${GUPSHUP_PARTNER_BASE}/partner/app/${appId}/v3/message`;

    const payload = {
        channel: 'whatsapp',
        source: String(phone).replace(/\D/g, ''),
        destination: String(destination).replace(/\D/g, ''),
        'src.name': workspace.name || appId,
        message: {
            type: 'text',
            text: { body: text }
        }
    };

    console.log(`[GupshupPartnerSend] POST ${url}`);
    console.log(`[GupshupPartnerSend] Payload:`, JSON.stringify(payload, null, 2));

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': appApiKey
            },
            timeout: 10000
        });

        const data = response.data || {};
        const messageId =
            data.messageId ||
            data.message?.id ||
            data.id ||
            null;

        console.log(`[GupshupPartnerSend] Text sent. messageId: ${messageId}`);

        return { success: true, messageId, raw: data };
    } catch (error) {
        const errMsg =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message;

        console.error(`[GupshupPartnerSend] Text send failed: ${errMsg}`, {
            status: error.response?.status,
            data: error.response?.data
        });

        return { success: false, error: errMsg };
    }
}

/**
 * Send a media message (image, video, document, audio) via Gupshup Partner API V3
 * 
 * @param {Object} workspace  - Mongoose workspace document
 * @param {string} destination - Recipient phone
 * @param {string} mediaType  - 'image' | 'video' | 'document' | 'audio'
 * @param {string} mediaUrl   - Public URL of the media
 * @param {string} caption    - Optional caption text
 * @param {string} filename   - Optional filename (for documents)
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendMedia(workspace, destination, mediaType, mediaUrl, caption = '', filename = null) {
    const { appId, appApiKey, phone } = resolveCredentials(workspace);

    if (!appId) throw new Error('GUPSHUP_PARTNER_SEND: appId missing on workspace');
    if (!appApiKey) throw new Error('GUPSHUP_PARTNER_SEND: appApiKey missing on workspace');

    const url = `${GUPSHUP_PARTNER_BASE}/partner/app/${appId}/v3/message`;

    const mediaPayload = { link: mediaUrl };
    if (caption) mediaPayload.caption = caption;
    if (filename && mediaType === 'document') mediaPayload.filename = filename;

    const payload = {
        channel: 'whatsapp',
        source: String(phone).replace(/\D/g, ''),
        destination: String(destination).replace(/\D/g, ''),
        'src.name': workspace.name || appId,
        message: {
            type: mediaType,
            [mediaType]: mediaPayload
        }
    };

    console.log(`[GupshupPartnerSend] Sending ${mediaType} to ${destination}`);

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': appApiKey
            },
            timeout: 10000
        });

        const data = response.data || {};
        const messageId = data.messageId || data.message?.id || data.id || null;

        console.log(`[GupshupPartnerSend] ${mediaType} sent. messageId: ${messageId}`);
        return { success: true, messageId, raw: data };
    } catch (error) {
        const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
        console.error(`[GupshupPartnerSend] ${mediaType} send failed: ${errMsg}`);
        return { success: false, error: errMsg };
    }
}

/**
 * Send a template message via Gupshup Partner API V3
 * 
 * @param {Object} workspace    - Mongoose workspace document
 * @param {string} destination  - Recipient phone
 * @param {string} templateName - WhatsApp template name
 * @param {string} languageCode - Template language (default: 'en')
 * @param {Array}  components   - Template components with parameters
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendTemplate(workspace, destination, templateName, languageCode = 'en', components = []) {
    const { appId, appApiKey, phone } = resolveCredentials(workspace);

    if (!appId) throw new Error('GUPSHUP_PARTNER_SEND: appId missing on workspace');
    if (!appApiKey) throw new Error('GUPSHUP_PARTNER_SEND: appApiKey missing on workspace');

    const url = `${GUPSHUP_PARTNER_BASE}/partner/app/${appId}/v3/message`;

    const payload = {
        channel: 'whatsapp',
        source: String(phone).replace(/\D/g, ''),
        destination: String(destination).replace(/\D/g, ''),
        'src.name': workspace.name || appId,
        message: {
            type: 'template',
            template: {
                name: templateName,
                languagePolicy: 'deterministic',
                language: languageCode,
                components
            }
        }
    };

    console.log(`[GupshupPartnerSend] Sending template "${templateName}" to ${destination}`);

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': appApiKey
            },
            timeout: 10000
        });

        const data = response.data || {};
        const messageId = data.messageId || data.message?.id || data.id || null;

        console.log(`[GupshupPartnerSend] Template sent. messageId: ${messageId}`);
        return { success: true, messageId, raw: data };
    } catch (error) {
        const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
        console.error(`[GupshupPartnerSend] Template send failed: ${errMsg}`);
        return { success: false, error: errMsg };
    }
}

/**
 * Check if the 24h session window is still open for a phone number in a workspace.
 * Returns { open: boolean, expiresAt: Date | null }
 */
async function getSessionWindowStatus(workspaceId, phone) {
    const { Conversation, Contact } = require('../../models');

    try {
        const normalizedPhone = String(phone).replace(/\D/g, '');
        const contact = await Contact.findOne({ workspace: workspaceId, phone: normalizedPhone }).lean();
        if (!contact) return { open: false, expiresAt: null };

        const conversation = await Conversation.findOne({
            workspace: workspaceId,
            contact: contact._id
        }).select('isOpen windowExpiresAt lastInboundAt').lean();

        if (!conversation) return { open: false, expiresAt: null };

        const now = new Date();
        const windowOpen =
            conversation.isOpen &&
            conversation.windowExpiresAt &&
            new Date(conversation.windowExpiresAt) > now;

        return {
            open: windowOpen,
            expiresAt: conversation.windowExpiresAt || null
        };
    } catch (err) {
        console.error('[GupshupPartnerSend] Session window check failed:', err.message);
        return { open: false, expiresAt: null };
    }
}

module.exports = {
    sendText,
    sendMedia,
    sendTemplate,
    getSessionWindowStatus
};
