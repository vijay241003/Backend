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
      dbName: 'netscan',
    });
    console.log(`✅  MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// Log disconnect events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️   MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄  MongoDB reconnected');
});

module.exports = connectDB;
