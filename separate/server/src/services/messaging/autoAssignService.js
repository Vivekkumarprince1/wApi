const ContactSettings = require('../../models/messaging/ContactSettings');
const Contact = require('../../models/messaging/Contact');
const User = require('../../models/auth/User');
const Deal = require('../../models/commerce/Deal');

class AutoAssignService {
  /**
   * Determine the best agent for a contact based on rules or load equalizer
   */
  async determineAgentForContact(workspaceId, contact) {
    const settings = await ContactSettings.findOne({ workspace: workspaceId });
    if (!settings || !settings.autoAssign || !settings.autoAssign.enabled) {
      return null;
    }

    const { method, rules, fallbackAgents } = settings.autoAssign;

    if (method === 'rules' && rules && rules.length > 0) {
      // Evaluate Rules
      for (const rule of rules) {
        if (this.evaluateRule(contact, rule)) {
          return rule.assignTo;
        }
      }
    }

    // Default to Load Equalizer if rules fail or method is load_equalizer
    const candidates = (fallbackAgents && fallbackAgents.length > 0) ? fallbackAgents : await this.getAllWorkspaceAgents(workspaceId);
    
    if (candidates.length === 0) return null;

    if (method === 'round_robin') {
      // Basic random or sequential (simplified here)
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Load Equalizer: Find agent with least active contacts/deals
    return await this.findAgentWithLeastLoad(workspaceId, candidates);
  }

  evaluateRule(contact, rule) {
    const { field, operator, value } = rule;
    let contactValue;

    // Support dot-notation for nested fields like 'customFields.company_size'
    if (field.startsWith('customFields.')) {
      const f = field.split('.')[1];
      contactValue = contact.customFields && contact.customFields.get ? contact.customFields.get(f) : (contact.customFields || {})[f];
    } else {
      contactValue = contact[field];
    }

    if (!contactValue) return false;

    switch (operator) {
      case 'equals': return contactValue == value;
      case 'contains': return String(contactValue).toLowerCase().includes(String(value).toLowerCase());
      case 'gt': return Number(contactValue) > Number(value);
      case 'lt': return Number(contactValue) < Number(value);
      default: return false;
    }
  }

  async getAllWorkspaceAgents(workspaceId) {
    // Simplified: fetch users in workspace with agent role.
    const users = await User.find({ workspace: workspaceId, role: { $in: ['admin', 'agent'] } }).select('_id');
    return users.map(u => u._id);
  }

  async findAgentWithLeastLoad(workspaceId, agentIds) {
    // Count active contacts per agent
    const loads = await Contact.aggregate([
      { $match: { workspace: workspaceId, assignedAgentId: { $in: agentIds } } },
      { $group: { _id: '$assignedAgentId', count: { $sum: 1 } } }
    ]);

    const loadMap = {};
    agentIds.forEach(id => loadMap[id.toString()] = 0);
    loads.forEach(l => { if(l._id) loadMap[l._id.toString()] = l.count; });

    let leastLoaded = agentIds[0];
    let minCount = Infinity;

    for (const [id, count] of Object.entries(loadMap)) {
      if (count < minCount) {
        minCount = count;
        leastLoaded = id;
      }
    }

    return leastLoaded;
  }
}

module.exports = new AutoAssignService();