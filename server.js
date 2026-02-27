/**
 * NetScan Pro — Complete Backend (Single File)
 * Run: npm run dev
 */

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();

const PORT       = process.env.PORT           || 5000;
const JWT_SECRET = process.env.JWT_SECRET     || 'netscan_secret_key_change_this';
const JWT_EXPIRY = process.env.JWT_EXPIRES_IN || '7d';
const NODE_ENV   = process.env.NODE_ENV       || 'development';

// ── IN-MEMORY DATABASE
const users      = new Map();
const emailIndex = new Map();
const history    = new Map();

async function createUser(name, email, password) {
  const key = email.toLowerCase().trim();
  if (emailIndex.has(key)) throw { status: 409, message: 'Email already registered.' };
  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const user = { id, name: name.trim(), email: key, password: hashed, createdAt: now, lastLogin: now };
  users.set(id, user);
  emailIndex.set(key, id);
  return sanitizeUser(user);
}
function findUserByEmail(email) {
  const id = emailIndex.get(email.toLowerCase().trim());
  return id ? users.get(id) : null;
}
function findUserById(id) { return users.get(id) || null; }
function sanitizeUser(u) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, lastLogin: u.lastLogin };
}
function saveTestResult(userId, data) {
  const entry = {
    id: uuidv4(), userId,
    downloadSpeed: parseFloat(data.downloadSpeed) || 0,
    uploadSpeed:   parseFloat(data.uploadSpeed)   || 0,
    ping:          parseInt(data.ping)             || 0,
    jitter:        parseInt(data.jitter)           || 0,
    packetLoss:    parseFloat(data.packetLoss)     || 0,
    networkScore:  parseInt(data.networkScore)     || 0,
    networkType:   data.networkType || 'unknown',
    isp:           data.isp         || 'unknown',
    ip:            data.ip          || 'unknown',
    location:      data.location    || 'unknown',
    timestamp:     new Date().toISOString(),
  };
  if (!history.has(userId)) history.set(userId, []);
  const arr = history.get(userId);
  arr.unshift(entry);
  if (arr.length > 100) arr.splice(100);
  return entry;
}
function getUserHistory(userId, page, limit) {
  const all = history.get(userId) || [];
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  return { data: all.slice((page - 1) * limit, page * limit), total, page, pages, limit };
}
function getUserStats(userId) {
  const all = history.get(userId) || [];
  if (!all.length) return null;
  const avg = key => +(all.reduce((s, r) => s + (r[key] || 0), 0) / all.length).toFixed(2);
  return {
    totalTests: all.length,
    avgDownload: avg('downloadSpeed'), avgUpload: avg('uploadSpeed'),
    avgPing: avg('ping'), avgScore: avg('networkScore'),
    bestScore: Math.max(...all.map(r => r.networkScore)),
    maxDownload: Math.max(...all.map(r => r.downloadSpeed)),
    minPing: Math.min(...all.map(r => r.ping)),
    lastTestedAt: all[0].timestamp,
  };
}

// ── AUTH MIDDLEWARE
function protect(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'No token. Please log in.' });
  const token = header.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
    req.user = sanitizeUser(user);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired.' : 'Invalid token.';
    return res.status(401).json({ success: false, message: msg });
  }
}
function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// ── GLOBAL MIDDLEWARE
app.use(helmet());
app.use(cors({
  origin: function(origin, cb) {
    if (!origin || NODE_ENV === 'development') return cb(null, true);
    const allowed = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim());
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { success: false, message: 'Too many requests.' } }));

// ── HEALTH
app.get('/', (req, res) => res.json({ success: true, message: 'NetScan Pro API running!' }));
app.get('/api/health', (req, res) => {
  let total = 0; history.forEach(a => { total += a.length; });
  res.json({ success: true, status: 'OK', uptime: Math.round(process.uptime()) + 's', database: { users: users.size, testRecords: total } });
});

// ── AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    if (!/\d/.test(password))
      return res.status(400).json({ success: false, message: 'Password must contain at least one number.' });
    const user = await createUser(name, email, password);
    const token = generateToken(user.id);
    console.log('Registered:', user.email);
    res.status(201).json({ success: true, message: 'Account created!', token, user });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ success: false, message: err.message });
    console.error(err); res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    const rawUser = findUserByEmail(email);
    if (!rawUser) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const match = await bcrypt.compare(password, rawUser.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    rawUser.lastLogin = new Date().toISOString();
    const token = generateToken(rawUser.id);
    console.log('Login:', rawUser.email);
    res.json({ success: true, message: 'Login successful.', token, user: sanitizeUser(rawUser) });
  } catch (err) {
    console.error(err); res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.get('/api/auth/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/auth/logout', protect, (req, res) => {
  console.log('Logout:', req.user.email);
  res.json({ success: true, message: 'Logged out.' });
});

// ── NETWORK ROUTES
app.post('/api/network/save-result', protect, (req, res) => {
  try {
    const { downloadSpeed, uploadSpeed, ping } = req.body;
    if (downloadSpeed === undefined || uploadSpeed === undefined || ping === undefined)
      return res.status(400).json({ success: false, message: 'downloadSpeed, uploadSpeed and ping are required.' });
    const entry = saveTestResult(req.user.id, req.body);
    console.log('Saved test:', req.user.email, '| score:', req.body.networkScore);
    res.status(201).json({ success: true, message: 'Result saved.', result: entry });
  } catch (err) {
    console.error(err); res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.get('/api/network/history', protect, (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  res.json({ success: true, ...getUserHistory(req.user.id, page, limit) });
});

app.get('/api/network/stats', protect, (req, res) => {
  const stats = getUserStats(req.user.id);
  if (!stats) return res.json({ success: true, message: 'No tests yet.', stats: null });
  res.json({ success: true, stats });
});

app.delete('/api/network/history', protect, (req, res) => {
  const count = (history.get(req.user.id) || []).length;
  history.set(req.user.id, []);
  console.log('Cleared', count, 'records for', req.user.email);
  res.json({ success: true, message: 'Cleared ' + count + ' record(s).', deleted: count });
});

// ── ERROR HANDLERS
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found: ' + req.method + ' ' + req.url });
});
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error.' });
});

// ── START
app.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log('   NetScan Pro API Server - RUNNING!      ');
  console.log('==========================================');
  console.log('  Port   : ' + PORT);
  console.log('  Health : http://localhost:' + PORT + '/api/health');
  console.log('==========================================');
  console.log('');
});

module.exports = app;
