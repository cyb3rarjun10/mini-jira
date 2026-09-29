Database Schema:

users: (id, email, password, name, created_at)

projects: (id, title, description, created_by, created_at)

stories: (id, project_id, title, description, status, priority, created_at)

tasks: (id, story_id, title, description, status, due_date, assigned_to, created_at)

background_jobs: (id, job_type, payload, status, retry_count, max_retries, error_message, last_run_at, created_at)

Design Decision: Enforced cascade deletes (ON DELETE CASCADE) to preserve referential integrity when deleting a project or story.

Endpoints:

POST /api/auth/register (body: email, password, name) -> returns { token, user }

POST /api/auth/login (body: email, password) -> returns { token, user }

Security Decisions:

Passwords hashed with bcryptjs (salt rounds: 10).

Stateles authorization via signed JWTs (expiresIn: 8h).

Request body validated via zod before DB operations.

API Endpoints:

GET /api/projects — List all projects with creator name and child story count.

GET /api/projects/:id — Single project details.

POST /api/projects — Create project (title, description).

PUT /api/projects/:id — Update project.

DELETE /api/projects/:id — Delete project (cascades down to child stories and tasks).

Design Tradeoff: We attach the authenticated req.user.id automatically as created_by, eliminating client spoofing.

API Endpoints:

GET /api/stories/project/:projectId — List stories under a project (aggregates total task count & completed tasks).

POST /api/stories — Create story under project (projectId, title, description, priority).

PUT /api/stories/:id — Update story attributes (title, description, status, priority).

DELETE /api/stories/:id — Delete story (cascades delete to all child tasks).

Design Decision: Stories calculate progress directly in the query using SQL subqueries for task_count and completed_task_count, minimizing round-trips

API Endpoints:

GET /api/tasks/story/:storyId — List all tasks for a story with assignee information.

POST /api/tasks — Create a task (storyId, title, description, dueDate, assignedTo).

PUT /api/tasks/:id — Update task fields or workflow state (status: todo, in_progress, done).

DELETE /api/tasks/:id — Delete task.

Relational Integrity:

assigned_to uses ON DELETE SET NULL so deleting a user does not delete their assigned tasks.

story_id uses ON DELETE CASCADE so deleting a story cleans up all related tasks.

Async Workflow Architecture:

Pattern: Transactional Outbox / Polling Job Queue implemented directly on SQLite via background_jobs table.

Deduplication: SQL subquery checks JSON payload to prevent queuing multiple reminders for the same task.

Failure & Retry Policy:

Jobs record attempts in retry_count.

If processing throws an error, status resets to pending with retry_count + 1.

After reaching max_retries (3), the job transitions permanently to failed with logged error_message.

Monitoring Endpoint: GET /api/jobs allows inspection of all queued, processed, and failed background events.

Testing Approach:

Leverages Node 18+ native test runner (node:test) and native fetch — no heavyweight test framework overhead.

Covers end-to-end user registration, hierarchical CRUD creation (Project -> Story -> Task), and 401 unauthenticated protection.

Frontend Architecture:

Built with Vite + React.

Centralized HTTP client pattern (api.js) handles JWT injection and unified error unwrapping.

State persisted via browser localStorage for session continuity across reloads.