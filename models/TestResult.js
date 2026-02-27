/**
 * models/TestResult.js
 * Mongoose schema for speed test results
 */

const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    downloadSpeed: { type: Number, default: 0 },
    uploadSpeed:   { type: Number, default: 0 },
    ping:          { type: Number, default: 0 },
    jitter:        { type: Number, default: 0 },
    packetLoss:    { type: Number, default: 0 },
    networkScore:  { type: Number, default: 0, min: 0, max: 100 },
    networkType:   { type: String, default: 'unknown', maxlength: 50 },
    isp:           { type: String, default: 'unknown', maxlength: 200 },
    ip:            { type: String, default: 'unknown', maxlength: 50  },
    location:      { type: String, default: 'unknown', maxlength: 200 },
  },
  {
    timestamps: true,   // createdAt = test timestamp
  }
);

// ── Index for fast per-user queries sorted by newest first
testResultSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('TestResult', testResultSchema);
