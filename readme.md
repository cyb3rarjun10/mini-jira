# ⚡ AgileTracker (Mini-Jira for Small Teams)

A full-stack, hierarchical agile work-tracking system designed for small teams (3–10 members). Built with Node.js, Express, SQLite, and React, following strict separation of concerns, relational data integrity, and resilient asynchronous background processing.

---

## 🏗️ Architecture & Hierarchy

The application strictly models and enforces the 3-level Agile work breakdown structure:

- **Projects**: High-level initiative or product scope, owned by a team member.
- **User Stories**: Functional feature units carrying workflow status (`todo`, `in_progress`, `done`) and business priority (`low`, `medium`, `high`).
- **Tasks**: Granular execution items belonging to a story, tracking completion status, assignees, and due dates.

---

## 💻 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite via `better-sqlite3` (synchronous C-binding, zero network overhead, file-based persistence)
- **Validation & Auth**: Zod (schema parsing & request sanitization), `bcryptjs` (salted hashing), JSON Web Tokens (`jsonwebtoken`)
- **Testing**: Node.js native test runner (`node:test`) and strict assertions (`node:assert/strict`)
- **Frontend**: React 18, Vite, Native modern CSS
- **Async Worker**: Polling Queue / Transactional Outbox pattern with automated retries and dead-letter failure states

---

## 📁 Repository Structure

```text
agile-tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # DB connection & table migrations
│   │   ├── controllers/     # Modular route handlers (Auth, Projects, Stories, Tasks, Jobs)
│   │   ├── middleware/      # Bearer token JWT authentication guard
│   │   ├── jobs/            # Background worker for due-date alerts with retries
│   │   └── app.js           # Server application configuration
│   ├── tests/               # End-to-end integration tests (Auth, Projects, Hierarchy, Security)
│   ├── server.js            # Express server entry point & worker bootstrap
│   ├── package.json
│   └── .env                 # Environment config
├── frontend/
│   ├── src/
│   │   ├── api.js           # Centralized HTTP request client with auth token injection
│   │   ├── App.jsx          # 3-column interactive hierarchy board & worker feed
│   │   └── index.css        # Clean UI styling
│   └── package.json
└── README.md

🚀 Quickstart Guide
Prerequisites
Node.js (v18.x or later)

npm

1. Backend Setup
Bash
cd backend
npm install
npm run dev
The backend server starts on http://localhost:5000. Database tables and initial schemas are auto-migrated on first boot into agile_tracker.db.

2. Frontend Setup
In a new terminal window:

Bash
cd frontend
npm install
npm run dev
Open http://localhost:5173 to access the application.

3. Run Automated Tests
With the backend server running, run:

Bash
cd backend
npm test

🗄️ Database Schema
Foreign key enforcement is enabled on connection via PRAGMA foreign_keys = ON;.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Job ID |
| `job_type` | TEXT | NOT NULL | Type identifier (e.g. `task_due_reminder`) |
| `payload` | TEXT | NOT NULL | Serialized JSON execution context |
| `status` | TEXT | CHECK IN ('pending', 'processing', 'completed', 'failed') | Queue state |
| `retry_count` | INTEGER | DEFAULT 0 | Count of failed attempts |
| `max_retries` | INTEGER | DEFAULT 3 | Upper threshold before moving to failed |
| `error_message` | TEXT | NULLABLE | Last captured execution failure reason |
| `last_run_at` | DATETIME | NULLABLE | Last worker execution attempt |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Enqueue timestamp |

📡 API Documentation
All secured endpoints require the header: Authorization: Bearer <jwt_token>.

Authentication
POST /api/auth/register — Register a new account (email, password, name).

POST /api/auth/login — Authenticate and receive a JWT (email, password).

Projects
GET /api/projects — Fetch all projects (includes creator name and child story count).

GET /api/projects/:id — Fetch single project.

POST /api/projects — Create project (title, description).

PUT /api/projects/:id — Update project.

DELETE /api/projects/:id — Delete project (cascades to all child stories and tasks).

User Stories
GET /api/stories/project/:projectId — Fetch all stories for a project (aggregates total and completed task counts).

GET /api/stories/:id — Fetch single story.

POST /api/stories — Create story (projectId, title, description, priority).

PUT /api/stories/:id — Update story (title, description, status, priority).

DELETE /api/stories/:id — Delete story (cascades to child tasks).

Tasks
GET /api/tasks/story/:storyId — Fetch all tasks for a story (includes assignee metadata).

POST /api/tasks — Create task (storyId, title, description, dueDate, assignedTo).

PUT /api/tasks/:id — Update task status or fields (title, status, dueDate, assignedTo).

DELETE /api/tasks/:id — Delete task.

Background Queue Monitoring
GET /api/jobs — Inspect the queue status, payloads, and retry history.

⚙️ Asynchronous Workflow & Failure Handling
Design
The application runs an outbox-style worker (backend/src/jobs/taskAlertWorker.js) decoupled from user HTTP requests:

Detection & Deduplication: The worker periodically scans for tasks where due_date <= CURRENT_DATE and status != 'done'. A SQL json_extract subquery ensures an active or completed job is not re-queued for the same task.

Execution: The worker picks up batches of pending or retry-eligible failed jobs and transitions them to processing.

Resilience & Retries:

Outbound notifications simulate network flakiness.

If a job succeeds, it transitions to completed.

If a job fails, retry_count increments. If retry_count < max_retries (3), status resets to pending with the error captured.

If retry_count >= max_retries, the job is marked failed (dead-letter state) to prevent queue poisoning.

🔒 Security Considerations
Password Security: Passwords are never stored in plaintext; hashed with bcryptjs using 10 salt rounds.

SQL Injection Prevention: All SQL statements use parameterized queries via better-sqlite3 prepared statements (db.prepare('... WHERE id = ?').get(id)).

Input Sanitization: All endpoint inputs are strictly validated and coerced using zod schemas before touching database queries.

Resource Ownership: Created items inherit user identity from the verified JWT claims (req.user.id) rather than untrusted request bodies.

Environment Isolation: Secret keys and ports are managed via .env variables and kept out of version control.

⚖️ Design Decisions & Trade-Offs
SQLite over PostgreSQL/MySQL:

Decision: Adopted SQLite via better-sqlite3.

Trade-off: Eliminates heavy Docker or local database setups for reviewers, providing zero-configuration evaluation while retaining full SQL relational constraints. In a high-concurrency multi-tenant deployment, migrating to PostgreSQL with a connection pooler (e.g., PgBouncer) would be preferred.

Polling Worker over Redis/BullMQ:

Decision: Database-backed job queue table over external infrastructure like Redis.

Trade-off: Zero external dependencies required to run background processing, keeping setup trivial while accurately demonstrating asynchronous state machines, deduplication, and retries.

Optimistic Hierarchy UI:

Decision: 3-panel split view displaying Projects, Stories, and Tasks side-by-side.

Trade-off: Provides immediate visual clarity of the hierarchy without nested routing complexity.

 🤖 AI Usage Note:

AI was utilized as an architectural thinking partner and mentor to rapidly validate schema relationships, verify API response structures, and scaffold standard boilerplate. System design decisions, cascade policies, retry loops, and integration testing were systematically reviewed, typed, and verified step-by-step.

