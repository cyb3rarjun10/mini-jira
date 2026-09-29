const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let projectId = null;
let storyId = null;

test('1. Auth: Register a new user', async () => {
  const email = `tester_${Date.now()}@example.com`;
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', name: 'Test Runner' })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.token);
  authToken = data.token;
});

test('2. Projects: Create and fetch project', async () => {
  const res = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ title: 'Test Automation Project', description: 'Testing pipeline' })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  projectId = data.id;
  assert.equal(data.title, 'Test Automation Project');
});

test('3. Hierarchy: Create Story nested under Project', async () => {
  const res = await fetch(`${BASE_URL}/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      projectId,
      title: 'Story 1: Automated Testing',
      priority: 'high'
    })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  storyId = data.id;
  assert.equal(data.project_id, projectId);
});

test('4. Hierarchy: Create Task nested under Story', async () => {
  const res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      storyId,
      title: 'Task 1.1: Verify assertion rules',
      dueDate: '2026-09-28'
    })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.story_id, storyId);
  assert.equal(data.status, 'todo');
});

test('5. Security: Deny unauthenticated request to projects', async () => {
  const res = await fetch(`${BASE_URL}/projects`);
  assert.equal(res.status, 401);
});