/**
 * models/User.js
 * User operations using Firestore
 */

const bcrypt     = require('bcryptjs');
const { getDB }  = require('../config/db');

const COLLECTION = 'users';

async function createUser({ name, email, password }) {
  const db = getDB();

  // Check if email already exists
  const existing = await db.collection(COLLECTION)
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();

  if (!existing.empty) {
    const err = new Error('An account with that email already exists.');
    err.statusCode = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 12);
  const now    = new Date().toISOString();

  const docRef = await db.collection(COLLECTION).add({
    name:      name.trim(),
    email:     email.toLowerCase().trim(),
    password:  hashed,
    createdAt: now,
    lastLogin: now,
  });

  return {
    id:        docRef.id,
    name:      name.trim(),
    email:     email.toLowerCase().trim(),
    createdAt: now,
    lastLogin: now,
  };
}

async function findUserByEmail(email) {
  const db  = getDB();
  const snap = await db.collection(COLLECTION)
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function findUserById(id) {
  const db  = getDB();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  // Remove password from returned object
  const { password, ...safe } = data;
  return { id: doc.id, ...safe };
}

async function updateLastLogin(id) {
  const db = getDB();
  await db.collection(COLLECTION).doc(id).update({
    lastLogin: new Date().toISOString(),
  });
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
