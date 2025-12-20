const Workspace = require('../models/Workspace');

async function planCheck(req, res, next) {
  const workspace = req.user.workspace;
  const ws = await Workspace.findById(workspace);
  if (!ws) return res.status(403).json({ message: 'Workspace not found' });
  // Example limit: free plan max 100 messages/day
  if (ws.plan === 'free' && ws.usage && ws.usage.messagesSent > 100) return res.status(403).json({ message: 'Plan limit exceeded' });
  next();
}

module.exports = planCheck;
