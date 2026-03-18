/**
 * middleware/auth.js
 * JWT protect middleware with single-session enforcement
 */

const jwt              = require('jsonwebtoken');
const { findUserById } = require('../models/User');

const JWT_SECRET     = process.env.JWT_SECRET     || 'changeme_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (id, sessionId) =>
  jwt.sign({ id, sessionId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorised. No token provided.' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    // ── Single-session check ──
    // If sessionId in token doesn't match Firestore, this token is from an old session
    if (user.sessionId !== decoded.sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Your account was logged in on another device. Please login again.',
        code:    'SESSION_INVALIDATED',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Token expired. Please log in again.'  :
      err.name === 'JsonWebTokenError' ? 'Invalid token. Please log in again.'  :
      'Not authorised.';
    return res.status(401).json({ success: false, message });
  }
};

module.exports = { protect, generateToken };
