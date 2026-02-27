const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    downloadSpeed: {
      type:     Number,
      required: [true, 'downloadSpeed is required'],
    },
    uploadSpeed: {
      type:     Number,
      required: [true, 'uploadSpeed is required'],
    },
    ping: {
      type:     Number,
      required: [true, 'ping is required'],
    },
    jitter: {
      type:    Number,
      default: 0,
    },
    packetLoss: {
      type:    Number,
      default: 0,
    },
    networkScore: {
      type:    Number,
      default: 0,
    },
    networkType: {
      type:    String,
      default: 'unknown',
    },
    isp: {
      type:    String,
      default: '',
    },
    ip: {
      type:    String,
      default: '',
    },
    location: {
      type:    String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestResult', testResultSchema);
