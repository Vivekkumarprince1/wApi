const AutomationRule = require('../models/AutomationRule');

async function createRule(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const rule = await AutomationRule.create({ workspace, ...req.body });
    res.status(201).json(rule);
  } catch (err) { next(err); }
}

module.exports = { createRule };
