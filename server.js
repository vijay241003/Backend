/**
 * ══════════════════════════════════════════════
 *   NetScan Pro — Backend API  (MongoDB Edition)
 *   Deploy on Render.com free tier
 * ══════════════════════════════════════════════
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const connectDB    = require('./config/db');
const User         = require('./models/User');
const TestResult   = require('./models/TestResult');
const { protect, generateToken } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// ── Connect to MongoDB Atlas
connectDB();

const app  = express();
const PORT = process.env.PORT || 5000;

// ══════════════════════════════════════════
//  GLOBAL MIDDLEWARE
// ══════════════════════════════════════════
app.use(helmet());

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);   // Postman / curl
    const allowed = (process.env.CORS_ORIGINS || '')
      .split(',').map(o => o.trim()).filter(Boolean);
    if (allowed.includes(origin)) return cb(null, true);
    // Allow all in development
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods:         ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders:  ['Content-Type','Authorization'],
  credentials:     true,
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
app.get('/', (req, res) => res.json({ success: true, message: '📡 NetScan Pro API is running!' }));

app.get('/api/health', async (req, res) => {
  try {
    const [users, records] = await Promise.all([
      User.countDocuments(),
      TestResult.countDocuments(),
    ]);
    res.json({
      success:   true,
      status:    'OK',
      uptime:    Math.round(process.uptime()) + 's',
      timestamp: new Date().toISOString(),
      database:  { users, testRecords: records },
    });
  } catch {
    res.status(500).json({ success: false, status: 'DB_ERROR' });
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

    const user  = await User.create({ name, email, password });
    const token = generateToken(user._id);

    console.log(`✅ Registered: ${email}`);
    res.status(201).json({ success: true, message: 'Account created!', token, user: user.toSafeObject() });

  } catch (err) { next(err); }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    // Must explicitly select password (select: false in schema)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const match = await user.matchPassword(password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    console.log(`✅ Login: ${email}`);
    res.json({ success: true, message: 'Login successful.', token, user: user.toSafeObject() });

  } catch (err) { next(err); }
});

// GET /api/auth/me  [protected]
app.get('/api/auth/me', protect, (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
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

    req.user.name = name.trim();
    await req.user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Profile updated.', user: req.user.toSafeObject() });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════
//  NETWORK ROUTES  (all protected)
// ══════════════════════════════════════════

// POST /api/network/save-result
app.post('/api/network/save-result', protect, async (req, res, next) => {
  try {
    const {
      downloadSpeed, uploadSpeed, ping, jitter,
      packetLoss, networkScore, networkType, isp, ip, location,
    } = req.body;

    if (downloadSpeed === undefined || uploadSpeed === undefined || ping === undefined)
      return res.status(400).json({ success: false, message: 'downloadSpeed, uploadSpeed and ping are required.' });

    const result = await TestResult.create({
      user: req.user._id,
      downloadSpeed, uploadSpeed, ping, jitter,
      packetLoss, networkScore, networkType, isp, ip, location,
    });

    console.log(`📊 Test saved: ${req.user.email} | score: ${networkScore}`);
    res.status(201).json({ success: true, message: 'Result saved.', result });

  } catch (err) { next(err); }
});

// GET /api/network/history?page=1&limit=20
app.get('/api/network/history', protect, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [data, total] = await Promise.all([
      TestResult.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TestResult.countDocuments({ user: req.user._id }),
    ]);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit), limit });
  } catch (err) { next(err); }
});

// GET /api/network/stats
app.get('/api/network/stats', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const total  = await TestResult.countDocuments({ user: userId });

    if (!total) return res.json({ success: true, message: 'No tests yet.', stats: null });

    const agg = await TestResult.aggregate([
      { $match: { user: userId } },
      { $group: {
        _id:           null,
        avgDownload:   { $avg: '$downloadSpeed' },
        avgUpload:     { $avg: '$uploadSpeed' },
        avgPing:       { $avg: '$ping' },
        avgJitter:     { $avg: '$jitter' },
        avgScore:      { $avg: '$networkScore' },
        maxDownload:   { $max: '$downloadSpeed' },
        maxUpload:     { $max: '$uploadSpeed' },
        minPing:       { $min: '$ping' },
        bestScore:     { $max: '$networkScore' },
        worstScore:    { $min: '$networkScore' },
      }},
    ]);

    const last = await TestResult.findOne({ user: userId }).sort({ createdAt: -1 }).select('createdAt');
    const s = agg[0];

    res.json({ success: true, stats: {
      totalTests:    total,
      avgDownload:   +s.avgDownload.toFixed(2),
      avgUpload:     +s.avgUpload.toFixed(2),
      avgPing:       +s.avgPing.toFixed(0),
      avgJitter:     +s.avgJitter.toFixed(0),
      avgScore:      +s.avgScore.toFixed(1),
      maxDownload:   +s.maxDownload.toFixed(2),
      maxUpload:     +s.maxUpload.toFixed(2),
      minPing:       s.minPing,
      bestScore:     s.bestScore,
      worstScore:    s.worstScore,
      lastTestedAt:  last?.createdAt,
    }});
  } catch (err) { next(err); }
});

// DELETE /api/network/history
app.delete('/api/network/history', protect, async (req, res, next) => {
  try {
    const result  = await TestResult.deleteMany({ user: req.user._id });
    console.log(`🗑  Cleared ${result.deletedCount} records for ${req.user.email}`);
    res.json({ success: true, message: `Deleted ${result.deletedCount} record(s).`, deleted: result.deletedCount });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════
//  ERROR HANDLERS (must be last)
// ══════════════════════════════════════════
app.use(notFound);
app.use(errorHandler);

// ══════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log('   NetScan Pro API  —  MongoDB Edition   ');
  console.log('==========================================');
  console.log(`  Port    : ${PORT}`);
  console.log(`  Env     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Health  : http://localhost:${PORT}/api/health`);
  console.log('==========================================');
  console.log('');
});

module.exports = app;
