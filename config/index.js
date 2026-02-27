require('dotenv').config();

const config = {
  port:    parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV           || 'development',

  jwt: {
    secret:    process.env.JWT_SECRET    || 'fallback_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    origins: (
      process.env.CORS_ORIGINS ||
      'http://localhost:5500,http://127.0.0.1:5500'
    )
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_MAX, 10)        || 200,
  },

  maxHistoryPerUser: parseInt(process.env.MAX_HISTORY_PER_USER, 10) || 100,
};

module.exports = config;
