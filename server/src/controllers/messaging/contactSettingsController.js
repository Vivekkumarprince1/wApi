const ContactSettings = require('../../models/messaging/ContactSettings');
const ContactEvent = require('../../models/messaging/ContactEvent');

class ContactSettingsController {
  
  async getSettings(req, res) {
    try {
      const workspaceId = req.user.workspace;
      let settings = await ContactSettings.findOne({ workspace: workspaceId });
      
      if (!settings) {
        settings = new ContactSettings({ workspace: workspaceId });
        await settings.save();
      }

      res.json({ success: true, data: settings });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch contact settings' });
    }
  }

  async updateSettings(req, res) {
    try {
      const workspaceId = req.user.workspace;
      const updates = req.body;
      
      const settings = await ContactSettings.findOneAndUpdate(
        { workspace: workspaceId },
        { $set: updates },
        { new: true, upsert: true }
      );

      res.json({ success: true, data: settings });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update contact settings' });
    }
  }

  async getEvents(req, res) {
    try {
      const workspaceId = req.user.workspace;
      const { contactId } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      const events = await ContactEvent.find({ workspace: workspaceId, contact: contactId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'name email');

      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch events' });
    }
  }

  async logEvent(req, res) {
    try {
      const workspaceId = req.user.workspace;
      const { contactId } = req.params;
      const { type, description, metadata } = req.body;

      const event = new ContactEvent({
        workspace: workspaceId,
        contact: contactId,
        type,
        description,
        metadata,
        createdBy: req.user._id
      });
      
      await event.save();

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to log event' });
    }
  }
}

module.exports = new ContactSettingsController();