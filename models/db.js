const { v4: uuidv4 } = require('uuid');
const bcrypt         = require('bcryptjs');
const config         = require('../config/index');

// ── In-memory storage
const _users      = new Map();
const _history    = new Map();
const _emailIndex = new Map();

// ════════════════════════════════
//  USER MODEL
// ════════════════════════════════
const UserModel = {

  async create({ name, email, password }) {
    const key = email.toLowerCase().trim();
    if (_emailIndex.has(key)) {
      const err = new Error('EMAIL_TAKEN');
      err.statusCode = 409;
      throw err;
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const id  = uuidv4();
    const user = { id, name: name.trim(), email: key, password: hashedPassword, createdAt: now, lastLogin: now };
    _users.set(id, user);
    _emailIndex.set(key, id);
    return UserModel._sanitize(user);
  },

  findByEmailRaw(email) {
    const id = _emailIndex.get(email.toLowerCase().trim());
    return id ? _users.get(id) : null;
  },

  findById(id) {
    const user = _users.get(id);
    return user ? UserModel._sanitize(user) : null;
  },

  async verifyPassword(plain, hashed) {
    return bcrypt.compare(plain, hashed);
  },

  touchLogin(id) {
    const user = _users.get(id);
    if (user) user.lastLogin = new Date().toISOString();
  },

  update(id, fields) {
    const user = _users.get(id);
    if (!user) return null;
    if (fields.name) user.name = fields.name.trim();
    return UserModel._sanitize(user);
  },

  count() { return _users.size; },

  _sanitize({ id, name, email, createdAt, lastLogin }) {
    return { id, name, email, createdAt, lastLogin };
  },
};

// ════════════════════════════════
//  HISTORY MODEL
// ════════════════════════════════
const HistoryModel = {

  save(userId, data) {
    const entry = {
      id:            uuidv4(),
      userId,
      downloadSpeed: parseFloat(data.downloadSpeed) || 0,
      uploadSpeed:   parseFloat(data.uploadSpeed)   || 0,
      ping:          parseInt(data.ping,  10)        || 0,
      jitter:        parseInt(data.jitter, 10)       || 0,
      packetLoss:    parseFloat(data.packetLoss)     || 0,
      networkScore:  parseInt(data.networkScore, 10) || 0,
      networkType:   (data.networkType || 'unknown').slice(0, 50),
      isp:           (data.isp      || 'unknown').slice(0, 100),
      ip:            (data.ip       || 'unknown').slice(0, 50),
      location:      (data.location || 'unknown').slice(0, 100),
      timestamp:     new Date().toISOString(),
    };
    if (!_history.has(userId)) _history.set(userId, []);
    const arr = _history.get(userId);
    arr.unshift(entry);
    if (arr.length > config.maxHistoryPerUser) arr.splice(config.maxHistoryPerUser);
    return entry;
  },

  getByUser(userId, { page = 1, limit = 20 } = {}) {
    const all   = _history.get(userId) || [];
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const data  = all.slice(start, start + limit);
    return { data, total, page, pages, limit };
  },

  findById(entryId) {
    for (const arr of _history.values()) {
      const found = arr.find(e => e.id === entryId);
      if (found) return found;
    }
    return null;
  },

  getStats(userId) {
    const all = _history.get(userId) || [];
    if (!all.length) return null;
    const avg = key => +(all.reduce((s, r) => s + (r[key] || 0), 0) / all.length).toFixed(2);
    const max = key => Math.max(...all.map(r => r[key] || 0));
    const min = key => Math.min(...all.map(r => r[key] || 0));
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      totalTests:      all.length,
      avgDownload:     avg('downloadSpeed'),
      avgUpload:       avg('uploadSpeed'),
      avgPing:         avg('ping'),
      avgJitter:       avg('jitter'),
      avgPacketLoss:   avg('packetLoss'),
      avgScore:        avg('networkScore'),
      maxDownload:     max('downloadSpeed'),
      maxUpload:       max('uploadSpeed'),
      minPing:         min('ping'),
      bestScore:       max('networkScore'),
      worstScore:      min('networkScore'),
      testsLast7Days:  all.filter(e => new Date(e.timestamp).getTime() > sevenDaysAgo).length,
      lastTestedAt:    all[0].timestamp,
      firstTestedAt:   all[all.length - 1].timestamp,
    };
  },

  clear(userId) {
    const count = (_history.get(userId) || []).length;
    _history.set(userId, []);
    return count;
  },

  totalCount() {
    let n = 0;
    _history.forEach(arr => { n += arr.length; });
    return n;
  },
};

module.exports = { UserModel, HistoryModel };
