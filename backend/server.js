const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./src/config/db');
const authRoutes = require('./src/controllers/authController');
const projectRoutes = require('./src/controllers/projectController');
const storyRoutes = require('./src/controllers/storyController');
const taskRoutes = require('./src/controllers/taskController');
const jobRoutes = require('./src/controllers/jobController');
const { startBackgroundWorker } = require('./src/jobs/taskAlertWorker');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/jobs', jobRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Start background worker (runs check every 30 seconds)
  startBackgroundWorker(30000);
});