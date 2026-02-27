const { HistoryModel } = require('../models/db');

// POST /api/network/save-result
function saveResult(req, res, next) {
  try {
    const entry = HistoryModel.save(req.user.id, req.body);
    console.log('Saved test for', req.user.email, '- score:', req.body.networkScore);
    return res.status(201).json({ success: true, message: 'Speed test result saved.', result: entry });
  } catch (err) {
    next(err);
  }
}

// GET /api/network/history?page=1&limit=20
function getHistory(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = HistoryModel.getByUser(req.user.id, { page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/network/stats
function getStats(req, res, next) {
  try {
    const stats = HistoryModel.getStats(req.user.id);
    if (!stats) {
      return res.status(200).json({ success: true, message: 'No tests recorded yet.', stats: null });
    }
    return res.status(200).json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

// GET /api/network/history/:id
function getEntry(req, res, next) {
  try {
    const entry = HistoryModel.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Test result not found.' });
    }
    if (entry.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    return res.status(200).json({ success: true, result: entry });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/network/history
function clearHistory(req, res, next) {
  try {
    const deleted = HistoryModel.clear(req.user.id);
    console.log('Cleared', deleted, 'records for', req.user.email);
    return res.status(200).json({ success: true, message: 'Deleted ' + deleted + ' record(s).', deleted });
  } catch (err) {
    next(err);
  }
}

module.exports = { saveResult, getHistory, getStats, getEntry, clearHistory };
