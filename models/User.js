/**
 * models/User.js
 * User operations using Firestore
 * Includes single-session security (sessionId)
 */

const bcrypt         = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB }      = require('../config/db');

const COLLECTION = 'users';

async function createUser({ name, email, password }) {
  const db = getDB();

  const existing = await db.collection(COLLECTION)
    .where('email', '==', email.toLowerCase().trim())
    .limit(1).get();

  if (!existing.empty) {
    const err = new Error('An account with that email already exists.');
    err.statusCode = 409;
    throw err;
  }

  const hashed    = await bcrypt.hash(password, 12);
  const now       = new Date().toISOString();
  const sessionId = uuidv4();

  const docRef = await db.collection(COLLECTION).add({
    name:      name.trim(),
    email:     email.toLowerCase().trim(),
    password:  hashed,
    sessionId,
    createdAt: now,
    lastLogin: now,
  });

  return {
    id:        docRef.id,
    name:      name.trim(),
    email:     email.toLowerCase().trim(),
    sessionId,
    createdAt: now,
    lastLogin: now,
  };
}

async function findUserByEmail(email) {
  const db   = getDB();
  const snap = await db.collection(COLLECTION)
    .where('email', '==', email.toLowerCase().trim())
    .limit(1).get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function findUserById(id) {
  const db  = getDB();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const { password, ...safe } = doc.data();
  return { id: doc.id, ...safe };
}

// Called on every login — generates new sessionId, invalidating all old tokens
async function updateLastLogin(id) {
  const db        = getDB();
  const sessionId = uuidv4();
  await db.collection(COLLECTION).doc(id).update({
    lastLogin: new Date().toISOString(),
    sessionId,
  });
  return sessionId;
}

async function updateUserName(id, name) {
  const db = getDB();
  await db.collection(COLLECTION).doc(id).update({ name: name.trim() });
  return findUserById(id);
}

async function matchPassword(entered, hashed) {
  return bcrypt.compare(entered, hashed);
}

async function countUsers() {
  const db   = getDB();
  const snap = await db.collection(COLLECTION).count().get();
  return snap.data().count;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin,
  updateUserName,
  matchPassword,
  countUsers,
};
