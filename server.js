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

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ── In-memory OTP store (keyed by email)
const otpStore = new Map();

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

    // ── Block login if account is already active on another device
    if (userWithPass.sessionActive === true) {
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_ALREADY_ACTIVE',
        message: 'This account is already logged in on another device. Please logout from that device first.',
      });
    }

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
app.post('/api/auth/logout', protect, async (req, res, next) => {
  try {
    await User.deactivateSession(req.user.id);
    console.log(`👋 Logout: ${req.user.email}`);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch(err) { next(err); }
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
//  FORGOT PASSWORD ROUTES
// ══════════════════════════════════════════

// Resend email helper
async function sendOtpEmail(toEmail, otp) {
  await resend.emails.send({
    from:    'Data Pack Optimizer <onboarding@resend.dev>',
    to:      toEmail,
    subject: 'Password Reset Code — Data Pack Optimizer',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#040810;color:#d0e8ff;padding:32px;border-radius:12px;border:1px solid #1a2d4a;">
        <h2 style="color:#00f5ff;font-size:20px;letter-spacing:2px;margin-bottom:8px;">DATA PACK OPTIMIZER</h2>
        <p style="color:#4a7090;font-size:12px;margin-bottom:24px;">PASSWORD RESET REQUEST</p>
        <p style="margin-bottom:16px;">Your verification code is:</p>
        <div style="background:#0f1929;border:1px solid #243d5c;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:42px;font-weight:bold;letter-spacing:10px;color:#00f5ff;">${otp}</span>
        </div>
        <p style="color:#4a7090;font-size:12px;margin-bottom:8px;">&#x23F1; This code expires in <strong style="color:#ff8c00;">10 minutes</strong>.</p>
        <p style="color:#4a7090;font-size:12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
}

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    // Check user exists (don't reveal if not — security)
    const user = await User.findUserByEmail(email);
    if (!user) {
      // Always return success to prevent email enumeration
      return res.json({ success: true, message: 'If this email is registered, a code has been sent.' });
    }

    // Generate 6-digit OTP
    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email.toLowerCase().trim(), { otp, expiresAt, verified: false });

    // Send email via Resend
    await sendOtpEmail(email, otp);

    console.log(`📧 OTP sent to: \${email}`);
    res.json({ success: true, message: 'Verification code sent to your email.' });

  } catch (err) {
    console.error('OTP send error:', err.message);
    next(err);
  }
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

  const key    = email.toLowerCase().trim();
  const record = otpStore.get(key);

  if (!record)
    return res.status(400).json({ success: false, message: 'No OTP found. Please request a new code.' });

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new code.' });
  }

  if (record.otp !== otp.trim())
    return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });

  // Mark as verified — generate one-time reset token
  const { v4: uuidv4 } = require('uuid');
  const resetToken = uuidv4();
  otpStore.set(key, { ...record, verified: true, resetToken, resetTokenExpiry: Date.now() + 5 * 60 * 1000 });

  res.json({ success: true, message: 'OTP verified.', resetToken });
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword)
      return res.status(400).json({ success: false, message: 'Email, reset token and new password are required.' });

    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    if (!/\d/.test(newPassword))
      return res.status(400).json({ success: false, message: 'Password must contain at least one number.' });

    const key    = email.toLowerCase().trim();
    const record = otpStore.get(key);

    if (!record || !record.verified)
      return res.status(400).json({ success: false, message: 'Please verify your email first.' });

    if (record.resetToken !== resetToken)
      return res.status(400).json({ success: false, message: 'Invalid reset token.' });

    if (Date.now() > record.resetTokenExpiry) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'Reset session expired. Please start again.' });
    }

    // Update password in Firestore
    const bcrypt = require('bcryptjs');
    const db     = require('./config/db').getDB();
    const snap   = await db.collection('users').where('email', '==', key).limit(1).get();
    if (snap.empty)
      return res.status(404).json({ success: false, message: 'Account not found.' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await snap.docs[0].ref.update({ password: hashed });

    // Clear OTP store
    otpStore.delete(key);

    console.log(`✅ Password reset: \${email}`);
    res.json({ success: true, message: 'Password reset successfully. Please login with your new password.' });

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
