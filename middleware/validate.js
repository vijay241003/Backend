const { body, query, validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors:  errors.array(),
    });
  }
  next();
}

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters.'),
  body('email').trim().notEmpty().withMessage('Email is required.').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.').matches(/[a-zA-Z]/).withMessage('Password must contain a letter.').matches(/[0-9]/).withMessage('Password must contain a number.'),
];

const loginRules = [
  body('email').trim().notEmpty().withMessage('Email is required.').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

const saveResultRules = [
  body('downloadSpeed').notEmpty().withMessage('downloadSpeed is required.').isFloat({ min: 0 }).withMessage('downloadSpeed must be a positive number.'),
  body('uploadSpeed').notEmpty().withMessage('uploadSpeed is required.').isFloat({ min: 0 }).withMessage('uploadSpeed must be a positive number.'),
  body('ping').notEmpty().withMessage('ping is required.').isInt({ min: 0 }).withMessage('ping must be a non-negative integer.'),
  body('jitter').notEmpty().withMessage('jitter is required.').isInt({ min: 0 }).withMessage('jitter must be a non-negative integer.'),
  body('packetLoss').notEmpty().withMessage('packetLoss is required.').isFloat({ min: 0, max: 100 }).withMessage('packetLoss must be 0-100.'),
  body('networkScore').notEmpty().withMessage('networkScore is required.').isInt({ min: 0, max: 100 }).withMessage('networkScore must be 0-100.'),
  body('networkType').optional().trim().isLength({ max: 50 }),
  body('isp').optional().trim().isLength({ max: 200 }),
  body('ip').optional().trim().isLength({ max: 50 }),
  body('location').optional().trim().isLength({ max: 200 }),
];

const historyQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100.'),
];

module.exports = { handleValidation, registerRules, loginRules, saveResultRules, historyQueryRules };
