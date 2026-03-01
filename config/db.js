/**
 * config/db.js
 * Initialize Firebase Firestore
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

let db;

function connectDB() {
  try {
    initializeApp({
      credential: cert({
        projectId:    process.env.FIREBASE_PROJECT_ID,
        clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });

    db = getFirestore();
    console.log('✅  Firebase Firestore connected!');
  } catch (err) {
    console.error('❌  Firebase connection failed:', err.message);
    process.exit(1);
  }
}

function getDB() {
  return db;
}

module.exports = { connectDB, getDB };
