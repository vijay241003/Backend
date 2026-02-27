/**
 * ╔══════════════════════════════════════════╗
 *   routes/auth.js
 *
 *   POST  /api/auth/register    create account
 *   POST  /api/auth/login       login → JWT
 *   GET   /api/auth/me          current user     [protected]
 *   POST  /api/auth/logout      logout           [protected]
 *   PUT   /api/auth/profile     update name      [protected]
 * ╚══════════════════════════════════════════╝
 */

const router = require('express').Router();

const {
  register,
  login,
  getMe,
  logout,
  updateProfile,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

const {
  registerRules,
  loginRules,
  handleValidation,
} = require('../middleware/validate');

// ── Public routes
router.post('/register', registerRules, handleValidation, register);
router.post('/login',    loginRules,    handleValidation, login);

// ── Protected routes
router.get ('/me',      protect, getMe);
router.post('/logout',  protect, logout);
router.put ('/profile', protect, updateProfile);

module.exports = router;
