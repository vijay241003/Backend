/**
 * config/db.js
 * Connect to MongoDB Atlas
 */

const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌  MONGODB_URI is not set in environment variables!');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,  // 15 seconds to find a server
      socketTimeoutMS:          45000,  // 45 seconds socket timeout
      connectTimeoutMS:         15000,  // 15 seconds connection timeout
      family:                   4,      // Force IPv4 — fixes ECONNREFUSED on Windows
    });
    console.log(`✅  MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️   MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄  MongoDB reconnected');
});

module.exports = connectDB;
