const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { User } = require('../models');

async function authMiddleware(req, res, next) {
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.id);
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = authMiddleware;
