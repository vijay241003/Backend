const router = require('express').Router();

const { register, login, getMe, logout, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { registerRules, loginRules, handleValidation } = require('../middleware/validate');

// Public
router.post('/register', registerRules, handleValidation, register);
router.post('/login',    loginRules,    handleValidation, login);

// Protected
router.get ('/me',      protect, getMe);
router.post('/logout',  protect, logout);
router.put ('/profile', protect, updateProfile);

module.exports = router;
