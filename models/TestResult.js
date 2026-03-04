/**
 * models/TestResult.js
 * Test result operations using Firestore
 */

const { getDB } = require('../config/db');

const COLLECTION = 'testresults';

async function saveResult(userId, data) {
  const db  = getDB();
  const now = new Date().toISOString();

  const docRef = await db.collection(COLLECTION).add({
    userId,
    downloadSpeed: data.downloadSpeed || 0,
    uploadSpeed:   data.uploadSpeed   || 0,
    ping:          data.ping          || 0,
    jitter:        data.jitter        || 0,
    packetLoss:    data.packetLoss    || 0,
    networkScore:  data.networkScore  || 0,
    networkType:   data.networkType   || 'unknown',
    isp:           data.isp           || '',
    ip:            data.ip            || '',
    location:      data.location      || '',
    createdAt:     now,
  });

  return { id: docRef.id, userId, ...data, createdAt: now };
}

async function getHistory(userId, { page = 1, limit = 20 } = {}) {
  const db   = getDB();
  const skip = (page - 1) * limit;

  // Get total count
  const countSnap = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .count().get();
  const total = countSnap.data().count;

  // Get paginated results
  const snap = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .offset(skip)
    .limit(limit)
    .get();

  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return {
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
}

async function getStats(userId) {
  const db   = getDB();
  const snap = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .get();

  if (snap.empty) return null;

  const results = snap.docs.map(doc => doc.data());
  const total   = results.length;

  const sum = results.reduce((acc, r) => ({
    download: acc.download + (r.downloadSpeed || 0),
    upload:   acc.upload   + (r.uploadSpeed   || 0),
    ping:     acc.ping     + (r.ping          || 0),
    jitter:   acc.jitter   + (r.jitter        || 0),
    score:    acc.score    + (r.networkScore  || 0),
  }), { download: 0, upload: 0, ping: 0, jitter: 0, score: 0 });

  const maxDownload = Math.max(...results.map(r => r.downloadSpeed || 0));
  const maxUpload   = Math.max(...results.map(r => r.uploadSpeed   || 0));
  const minPing     = Math.min(...results.map(r => r.ping          || 9999));
  const bestScore   = Math.max(...results.map(r => r.networkScore  || 0));
  const worstScore  = Math.min(...results.map(r => r.networkScore  || 0));

  const sorted      = results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lastTestedAt = sorted[0]?.createdAt || null;

  return {
    totalTests:   total,
    avgDownload:  +(sum.download / total).toFixed(2),
    avgUpload:    +(sum.upload   / total).toFixed(2),
    avgPing:      +(sum.ping     / total).toFixed(0),
    avgJitter:    +(sum.jitter   / total).toFixed(0),
    avgScore:     +(sum.score    / total).toFixed(1),
    maxDownload:  +maxDownload.toFixed(2),
    maxUpload:    +maxUpload.toFixed(2),
    minPing,
    bestScore,
    worstScore,
    lastTestedAt,
  };
}

async function clearHistory(userId) {
  const db   = getDB();
  const snap = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .get();

  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  return snap.size;
}

async function countResults() {
  const db   = getDB();
  const snap = await db.collection(COLLECTION).count().get();
  return snap.data().count;
}

module.exports = {
  saveResult,
  getHistory,
  getStats,
  clearHistory,
  countResults,
};
