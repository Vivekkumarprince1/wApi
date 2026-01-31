const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { deleteAccount } = require('../controllers/dataDeletionController');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const AuditLog = require('../models/AuditLog');
const WebhookLog = require('../models/WebhookLog');

const modelsToPurge = [
	'Contact', 'Message', 'Order', 'Campaign', 'CampaignMessage', 'CheckoutCart',
	'CommerceSettings', 'Conversation', 'Template', 'WhatsAppFormResponse', 'WhatsAppForm',
	'Product', 'Deal', 'Pipeline', 'WorkflowExecution', 'WebhookLog', 'InstagramQuickflow',
	'InstagramQuickflowLog', 'AutoReply', 'AutoReplyLog', 'AnswerBotSource', 'Integration'
];

async function purgeWorkspaceData(workspaceId) {
	const results = {};
	for (const name of modelsToPurge) {
		try {
			// eslint-disable-next-line import/no-dynamic-require, global-require
			const Model = require(`../models/${name}`);
			const res = await Model.deleteMany({ workspace: workspaceId });
			results[name] = { deletedCount: res.deletedCount || 0 };
		} catch (err) {
			results[name] = { error: err.message };
		}
	}
	return results;
}

async function purgeByIdentifiers({ email, phone }) {
	const results = {};

	const contacts = await Contact.find({
		$or: [
			...(phone ? [{ phone }] : []),
			...(email ? [{ 'metadata.email': email }] : [])
		]
	}).select('_id').lean();

	const contactIds = contacts.map(c => c._id);

	if (contactIds.length > 0) {
		const msgRes = await Message.deleteMany({ contact: { $in: contactIds } });
		const convRes = await Conversation.deleteMany({ contact: { $in: contactIds } });
		results.messages = { deletedCount: msgRes.deletedCount || 0 };
		results.conversations = { deletedCount: convRes.deletedCount || 0 };
	}

	if (phone) {
		const msgByPhone = await Message.deleteMany({ recipientPhone: phone });
		results.messagesByPhone = { deletedCount: msgByPhone.deletedCount || 0 };
	}

	const contactDelete = await Contact.deleteByIdentifiers({ phone, email });
	results.contacts = contactDelete;

	return results;
}

// Authenticated user deletes own account
router.delete('/delete-account', auth, deleteAccount);

// Public endpoint for Meta or other privacy callbacks
router.post('/data-deletion-callback', async (req, res, next) => {
	try {
		const body = req.body || {};
		const { email, phone, id } = body;

		let user = null;
		if (email) user = await User.findOne({ email });
		if (!user && phone) user = await User.findOne({ phone });
		if (!user && id) user = await User.findOne({ $or: [{ facebookId: id }, { googleId: id }] });

		if (user) {
			const workspaceId = user.workspace;
			if (workspaceId) {
				await purgeWorkspaceData(workspaceId);
				await Workspace.deleteOne({ _id: workspaceId });
			}
			await AuditLog.deleteMany({ workspace: workspaceId });
			await WebhookLog.deleteMany({ workspace: workspaceId });
			await User.deleteOne({ _id: user._id });
			return res.json({ success: true, status: 'deleted' });
		}

		if (email || phone) {
			await purgeByIdentifiers({ email, phone });
			return res.json({ success: true, status: 'deleted' });
		}

		const instructionsUrl = process.env.FRONTEND_URL
			? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/privacy/data-deletion-instructions`
			: `${req.protocol}://${req.get('host')}/privacy/data-deletion-instructions`;
		return res.json({ success: false, message: 'User not found', instructions_url: instructionsUrl });
	} catch (err) {
		next(err);
	}
});

module.exports = router;
