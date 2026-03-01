/**
 * middleware/auth.js
 * JWT protect middleware
 */

const jwt             = require('jsonwebtoken');
const { findUserById } = require('../models/User');

const JWT_SECRET     = process.env.JWT_SECRET     || 'changeme_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

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
