const db = require('../config/db');

// Mock dispatcher simulating an external service (email/Slack/webhook)
async function sendNotification(payload) {
  // Simulates an intermittent network failure (20% chance)
  if (Math.random() < 0.20) {
    throw new Error('External notification gateway timeout (504)');
  }
  return true;
}

// 1. Scans tasks and enqueues reminder jobs
function enqueueDueReminders() {
  const today = new Date().toISOString().split('T')[0];

  const tasksToRemind = db.prepare(`
    SELECT t.id, t.title, t.due_date, u.name as assignee_name, u.email as assignee_email
    FROM tasks t
    JOIN users u ON t.assigned_to = u.id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND t.due_date <= ?
      AND t.id NOT IN (
        SELECT json_extract(payload, '$.taskId') 
        FROM background_jobs 
        WHERE job_type = 'task_due_reminder' 
          AND status IN ('pending', 'processing', 'completed')
      )
  `).all(today);

  for (const task of tasksToRemind) {
    const payload = JSON.stringify({
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.due_date,
      recipientEmail: task.assignee_email,
      recipientName: task.assignee_name
    });

    db.prepare(`
      INSERT INTO background_jobs (job_type, payload, status)
      VALUES ('task_due_reminder', ?, 'pending')
    `).run(payload);

    console.log(`[Queue] Enqueued due-date reminder for task #${task.id}: "${task.title}"`);
  }
}

// 2. Processes pending and failed-with-retries jobs
async function processQueue() {
  const jobs = db.prepare(`
    SELECT * FROM background_jobs
    WHERE status IN ('pending', 'failed') AND retry_count < max_retries
    ORDER BY created_at ASC
    LIMIT 5
  `).all();

  for (const job of jobs) {
    db.prepare(`
      UPDATE background_jobs 
      SET status = 'processing', last_run_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(job.id);

    try {
      const payload = JSON.parse(job.payload);
      await sendNotification(payload);

      db.prepare(`
        UPDATE background_jobs 
        SET status = 'completed', error_message = NULL 
        WHERE id = ?
      `).run(job.id);

      console.log(`[Job Runner] Job #${job.id} (${job.job_type}) completed successfully.`);
    } catch (err) {
      const nextRetries = job.retry_count + 1;
      const isDead = nextRetries >= job.max_retries;

      db.prepare(`
        UPDATE background_jobs 
        SET status = ?, retry_count = ?, error_message = ?
        WHERE id = ?
      `).run(isDead ? 'failed' : 'pending', nextRetries, err.message, job.id);

      console.error(`[Job Runner] Job #${job.id} failed: "${err.message}". Retries left: ${job.max_retries - nextRetries}`);
    }
  }
}

function startBackgroundWorker(intervalMs = 30000) {
  console.log('[Worker] Background notification worker initialized.');
  
  // Run once immediately, then on an interval
  enqueueDueReminders();
  processQueue();

  setInterval(() => {
    enqueueDueReminders();
    processQueue();
  }, intervalMs);
}

module.exports = { startBackgroundWorker };