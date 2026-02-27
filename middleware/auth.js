const jwt           = require('jsonwebtoken');
const config        = require('../config/index');
const { UserModel } = require('../models/db');

function protect(req, res, next) {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }

  const token = authHeader.slice(7).trim();

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }

  const user = UserModel.findById(decoded.id);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User no longer exists.' });
  }

  req.user = user;
  next();
}

function generateToken(userId) {
  return jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

module.exports = { protect, generateToken };
