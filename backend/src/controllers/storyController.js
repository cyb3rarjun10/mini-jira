const express = require('express');
const { z } = require('zod');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const createStorySchema = z.object({
  projectId: z.number().int().positive('Valid project ID required'),
  title: z.string().min(1, 'Story title is required').max(150),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium')
});

const updateStorySchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

// GET /api/stories/project/:projectId - Get all stories for a specific project
router.get('/project/:projectId', (req, res) => {
  try {
    const stories = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM tasks WHERE story_id = s.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE story_id = s.id AND status = 'done') as completed_task_count
      FROM stories s
      WHERE s.project_id = ?
      ORDER BY s.created_at DESC
    `).all(req.params.projectId);

    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stories' });
  }
});

// GET /api/stories/:id - Get single story details
router.get('/:id', (req, res) => {
  try {
    const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json(story);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve story' });
  }
});

// POST /api/stories - Create a story under a project
router.post('/', (req, res) => {
  const parseResult = createStorySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }

  const { projectId, title, description, priority } = parseResult.data;

  try {
    // Verify project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Parent project not found' });
    }

    const result = db.prepare(
      'INSERT INTO stories (project_id, title, description, priority) VALUES (?, ?, ?, ?)'
    ).run(projectId, title, description, priority);

    const newStory = db.prepare('SELECT * FROM stories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newStory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// PUT /api/stories/:id - Update story details/status/priority
router.put('/:id', (req, res) => {
  const parseResult = updateStorySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }

  const storyId = req.params.id;
  const existing = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyId);
  if (!existing) {
    return res.status(404).json({ error: 'Story not found' });
  }

  const title = parseResult.data.title ?? existing.title;
  const description = parseResult.data.description ?? existing.description;
  const status = parseResult.data.status ?? existing.status;
  const priority = parseResult.data.priority ?? existing.priority;

  try {
    db.prepare(`
      UPDATE stories
      SET title = ?, description = ?, status = ?, priority = ?
      WHERE id = ?
    `).run(title, description, status, priority, storyId);

    const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyId);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// DELETE /api/stories/:id - Delete story (cascades to tasks)
router.delete('/:id', (req, res) => {
  try {
    const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    db.prepare('DELETE FROM stories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Story and nested tasks deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;