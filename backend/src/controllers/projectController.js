const express = require('express');
const { z } = require('zod');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all project endpoints
router.use(authenticateToken);

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required').max(100),
  description: z.string().optional().default('')
});

// GET /api/projects - List all projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM stories WHERE project_id = p.id) as story_count
      FROM projects p
      JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all();

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// GET /api/projects/:id - Get single project details
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(`
      SELECT p.*, u.name as creator_name
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve project' });
  }
});

// POST /api/projects - Create a new project
router.post('/', (req, res) => {
  const parseResult = projectSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }

  const { title, description } = parseResult.data;

  try {
    const result = db.prepare(
      'INSERT INTO projects (title, description, created_by) VALUES (?, ?, ?)'
    ).run(title, description, req.user.id);

    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update a project
router.put('/:id', (req, res) => {
  const parseResult = projectSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }

  const { title, description } = parseResult.data;

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    db.prepare('UPDATE projects SET title = ?, description = ? WHERE id = ?').run(
      title,
      description,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete a project (cascades to stories and tasks)
router.delete('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project and all related stories/tasks deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;