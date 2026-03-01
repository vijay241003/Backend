/**
 * ══════════════════════════════════════════════
 *   Data Pack Optimizer — Backend API
 *   Firebase Firestore Edition
 *   Deploy on Render.com free tier
 * ══════════════════════════════════════════════
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('');
console.log('🔍 ENV Check:');
console.log('   NODE_ENV         :', process.env.NODE_ENV || 'NOT SET');
console.log('   FIREBASE_PROJECT :', process.env.FIREBASE_PROJECT_ID || '❌ NOT FOUND');
console.log('   JWT_SECRET       :', process.env.JWT_SECRET ? '✅ SET' : '❌ NOT FOUND');
console.log('');

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB }              = require('./config/db');
const User                       = require('./models/User');
const TestResult                 = require('./models/TestResult');
const { protect, generateToken } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// ── Connect to Firebase Firestore
connectDB();

const app  = express();
const PORT = process.env.PORT || 5000;

// ══════════════════════════════════════════
//  GLOBAL MIDDLEWARE
// ══════════════════════════════════════════
app.use(helmet());

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const allowed = (process.env.CORS_ORIGINS || '')
      .split(',').map(o => o.trim()).filter(Boolean);
    if (allowed.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  message:  { success: false, message: 'Too many requests. Try again later.' },
}));

// ══════════════════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════════════════
app.get('/', (req, res) =>
  res.json({ success: true, message: '📡 Data Pack Optimizer API is running!' })
);

app.get('/api/health', async (req, res) => {
  try {
    const [users, records] = await Promise.all([
      User.countUsers(),
      TestResult.countResults(),
    ]);
    res.json({
      success:   true,
      status:    'OK',
      uptime:    Math.round(process.uptime()) + 's',
      timestamp: new Date().toISOString(),
      database:  { users, testRecords: records },
    });
  } catch (err) {
    res.status(500).json({ success: false, status: 'DB_ERROR', message: err.message });
  }
});

// ══════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    if (!/\d/.test(password))
      return res.status(400).json({ success: false, message: 'Password must contain at least one number.' });

    const user  = await User.createUser({ name, email, password });
    const token = generateToken(user.id, user.sessionId);

    console.log(`✅ Registered: ${email}`);
    res.status(201).json({ success: true, message: 'Account created!', token, user });

  } catch (err) { next(err); }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const userWithPass = await User.findUserByEmail(email);
    if (!userWithPass)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const match = await User.matchPassword(password, userWithPass.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const sessionId = await User.updateLastLogin(userWithPass.id);

    const token = generateToken(userWithPass.id, sessionId);
    const { password: _, ...safeUser } = userWithPass;

    console.log(`✅ Login: ${email}`);
    res.json({ success: true, message: 'Login successful.', token, user: safeUser });

  } catch (err) { next(err); }
});

// GET /api/auth/me  [protected]
app.get('/api/auth/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/logout  [protected]
app.post('/api/auth/logout', protect, (req, res) => {
  res.json({ success: true, message: 'Logged out. Please delete the token from localStorage.' });
});

// PUT /api/auth/profile  [protected]
app.put('/api/auth/profile', protect, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim())
      return res.status(400).json({ success: false, message: 'Name is required.' });

    const updated = await User.updateUserName(req.user.id, name);
    res.json({ success: true, message: 'Profile updated.', user: updated });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════
//  NETWORK ROUTES  (all protected)
// ══════════════════════════════════════════

// POST /api/network/save-result
app.post('/api/network/save-result', protect, async (req, res, next) => {
  try {
    const { downloadSpeed, uploadSpeed, ping } = req.body;

    if (downloadSpeed === undefined || uploadSpeed === undefined || ping === undefined)
      return res.status(400).json({ success: false, message: 'downloadSpeed, uploadSpeed and ping are required.' });

    const result = await TestResult.saveResult(req.user.id, req.body);

    console.log(`📊 Test saved: ${req.user.email} | score: ${req.body.networkScore}`);
    res.status(201).json({ success: true, message: 'Result saved.', result });

  } catch (err) { next(err); }
});

// GET /api/network/history?page=1&limit=20
app.get('/api/network/history', protect, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const result = await TestResult.getHistory(req.user.id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /api/network/stats
app.get('/api/network/stats', protect, async (req, res, next) => {
  try {
    const stats = await TestResult.getStats(req.user.id);
    if (!stats)
      return res.json({ success: true, message: 'No tests yet.', stats: null });
    res.json({ success: true, stats });
  } catch (err) { next(err); }
});

// DELETE /api/network/history
app.delete('/api/network/history', protect, async (req, res, next) => {
  try {
    const deleted = await TestResult.clearHistory(req.user.id);
    console.log(`🗑  Cleared ${deleted} records for ${req.user.email}`);
    res.json({ success: true, message: `Deleted ${deleted} record(s).`, deleted });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════
//  ERROR HANDLERS
// ══════════════════════════════════════════
app.use(notFound);
app.use(errorHandler);

// ══════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════
app.listen(PORT, () => {
  console.log('==========================================');
  console.log('  Data Pack Optimizer API — Firebase     ');
  console.log('==========================================');
  console.log(`  Port    : ${PORT}`);
  console.log(`  Env     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Health  : http://localhost:${PORT}/api/health`);
  console.log('==========================================');
  console.log('');
});

module.exports = app;
