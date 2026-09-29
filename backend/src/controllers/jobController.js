const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/jobs - Inspect recent background jobs and statuses
router.get('/', (req, res) => {
  try {
    const jobs = db.prepare(`
      SELECT * FROM background_jobs 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve background jobs' });
  }
});

module.exports = router;