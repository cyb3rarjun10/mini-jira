const express = require('express');
const { z } = require('zod');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const createTaskSchema = z.object({
  storyId: z.number().int().positive('Valid story ID required'),
  title: z.string().min(1, 'Task title is required').max(150),
  description: z.string().optional().default(''),
  dueDate: z.string().optional().nullable(),
  assignedTo: z.number().int().positive().optional().nullable()
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  dueDate: z.string().optional().nullable(),
  assignedTo: z.number().int().positive().optional().nullable()
});

// GET /api/tasks/story/:storyId - List all tasks for a story
router.get('/story/:storyId', (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT t.*, u.name as assignee_name, u.email as assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.story_id = ?
      ORDER BY t.created_at ASC
    `).all(req.params.storyId);

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// POST /api/tasks - Create task under a story
router.post('/', (req, res) => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }

  const { storyId, title, description, dueDate, assignedTo } = parseResult.data;

  try {
    const story = db.prepare('SELECT id FROM stories WHERE id = ?').get(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Parent story not found' });
    }

    if (assignedTo) {
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(assignedTo);
      if (!user) {
        return res.status(404).json({ error: 'Assigned user not found' });
      }
    }

    const result = db.prepare(`
      INSERT INTO tasks (story_id, title, description, due_date, assigned_to)
      VALUES (?, ?, ?, ?, ?)
    `).run(storyId, title, description, dueDate || null, assignedTo || null);

    const newTask = db.prepare(`
      SELECT t.*, u.name as assignee_name 
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_to = u.id 
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task details or status
router.put('/:id', (req, res) => {
  const parseResult = updateTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }

  const taskId = req.params.id;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const title = parseResult.data.title ?? existing.title;
  const description = parseResult.data.description ?? existing.description;
  const status = parseResult.data.status ?? existing.status;
  const dueDate = parseResult.data.dueDate !== undefined ? parseResult.data.dueDate : existing.due_date;
  const assignedTo = parseResult.data.assignedTo !== undefined ? parseResult.data.assignedTo : existing.assigned_to;

  try {
    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, due_date = ?, assigned_to = ?
      WHERE id = ?
    `).run(title, description, status, dueDate, assignedTo, taskId);

    const updated = db.prepare(`
      SELECT t.*, u.name as assignee_name 
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_to = u.id 
      WHERE t.id = ?
    `).get(taskId);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;