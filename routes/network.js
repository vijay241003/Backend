const router = require('express').Router();

const { saveResult, getHistory, getStats, getEntry, clearHistory } = require('../controllers/networkController');
const { protect } = require('../middleware/auth');
const { saveResultRules, historyQueryRules, handleValidation } = require('../middleware/validate');

// All routes require login
router.use(protect);

router.post  ('/save-result', saveResultRules,   handleValidation, saveResult);
router.get   ('/history',     historyQueryRules, handleValidation, getHistory);
router.get   ('/history/:id', getEntry);
router.get   ('/stats',       getStats);
router.delete('/history',     clearHistory);

module.exports = router;
