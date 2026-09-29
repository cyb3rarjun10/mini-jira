import React, { useState, useEffect } from 'react';
import { request, setToken, getToken } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');

  // Dashboard State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [stories, setStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [jobs, setJobs] = useState([]);

  // Forms
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      loadProjects();
    }
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setError('');
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(authForm)
      });
      setToken(res.token);
      setUser(res.user);
      loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setSelectedProject(null);
    setSelectedStory(null);
    setProjects([]);
  }

  async function loadProjects() {
    try {
      const data = await request('/projects');
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        selectProject(data[0]);
      }
      loadJobs();
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectProject(proj) {
    setSelectedProject(proj);
    setSelectedStory(null);
    setTasks([]);
    try {
      const storiesData = await request(`/stories/project/${proj.id}`);
      setStories(storiesData);
      if (storiesData.length > 0) {
        selectStory(storiesData[0]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectStory(story) {
    setSelectedStory(story);
    try {
      const tasksData = await request(`/tasks/story/${story.id}`);
      setTasks(tasksData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadJobs() {
    try {
      const data = await request('/jobs');
      setJobs(data);
    } catch (err) {
      // background jobs inspection is non-blocking
    }
  }

  async function createProject(e) {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    try {
      const created = await request('/projects', {
        method: 'POST',
        body: JSON.stringify({ title: newProjectTitle })
      });
      setProjects([created, ...projects]);
      setNewProjectTitle('');
      selectProject(created);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createStory(e) {
    e.preventDefault();
    if (!newStoryTitle.trim() || !selectedProject) return;
    try {
      const created = await request('/stories', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProject.id, title: newStoryTitle })
      });
      setStories([created, ...stories]);
      setNewStoryTitle('');
      selectStory(created);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createTask(e) {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedStory) return;
    try {
      const created = await request('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          storyId: selectedStory.id,
          title: newTaskTitle,
          dueDate: newTaskDueDate || null
        })
      });
      setTasks([...tasks, created]);
      setNewTaskTitle('');
      setNewTaskDueDate('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleTaskStatus(task) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const updated = await request(`/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      setTasks(tasks.map(t => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError(err.message);
    }
  }

  // --- Auth View ---
  if (!getToken()) {
    return (
      <div style={{ maxWidth: '380px', margin: '80px auto', padding: '24px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0 }}>{authMode === 'login' ? 'Sign In to AgileTracker' : 'Create Account'}</h2>
        {error && <p style={{ color: '#de350b', fontSize: '13px' }}>{error}</p>}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {authMode === 'register' && (
            <input
              type="text"
              placeholder="Full Name"
              required
              value={authForm.name}
              onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
            />
          )}
          <input
            type="email"
            placeholder="Email Address"
            required
            value={authForm.email}
            onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            required
            value={authForm.password}
            onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
          />
          <button type="submit" className="btn-primary" style={{ padding: '10px' }}>
            {authMode === 'login' ? 'Sign In' : 'Register'}
          </button>
        </form>
        <p style={{ fontSize: '13px', marginTop: '16px', textAlign: 'center' }}>
          {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <span
            style={{ color: '#0052cc', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {authMode === 'login' ? 'Register' : 'Sign In'}
          </span>
        </p>
      </div>
    );
  }

  // --- Main Agile Dashboard View ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Navbar */}
      <header style={{ background: '#0747a6', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>⚡ AgileTracker</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={loadJobs} className="btn-secondary" style={{ fontSize: '12px' }}>Sync Worker</button>
          <button onClick={handleLogout} className="btn-danger" style={{ fontSize: '12px' }}>Log Out</button>
        </div>
      </header>

      {error && (
        <div style={{ background: '#ffebe6', color: '#bf2600', padding: '8px 24px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Main 3-Column Hierarchy Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Level 1: Projects Panel */}
        <section style={{ width: '280px', borderRight: '1px solid #dfe1e6', background: '#fafbfc', padding: '16px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#5e6c84' }}>1. Projects</h3>
          <form onSubmit={createProject} style={{ marginBottom: '16px', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="+ New Project"
              value={newProjectTitle}
              onChange={e => setNewProjectTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary">Add</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => selectProject(p)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: selectedProject?.id === p.id ? '#ebf2ff' : '#fff',
                  border: selectedProject?.id === p.id ? '1px solid #4c9aff' : '1px solid #dfe1e6',
                  fontWeight: selectedProject?.id === p.id ? 'bold' : 'normal'
                }}
              >
                {p.title}
              </div>
            ))}
          </div>
        </section>

        {/* Level 2: User Stories Panel */}
        <section style={{ width: '320px', borderRight: '1px solid #dfe1e6', background: '#fff', padding: '16px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#5e6c84' }}>
            2. User Stories {selectedProject ? `(${selectedProject.title})` : ''}
          </h3>
          {selectedProject ? (
            <>
              <form onSubmit={createStory} style={{ marginBottom: '16px', display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="+ New Story"
                  value={newStoryTitle}
                  onChange={e => setNewStoryTitle(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary">Add</button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stories.map(s => (
                  <div
                    key={s.id}
                    onClick={() => selectStory(s)}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: selectedStory?.id === s.id ? '#f4f5f7' : '#fff',
                      border: selectedStory?.id === s.id ? '2px solid #0052cc' : '1px solid #dfe1e6'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.title}</div>
                    <div style={{ fontSize: '12px', color: '#6b778c', marginTop: '4px' }}>
                      Status: {s.status} | Priority: {s.priority}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#6b778c', fontSize: '13px' }}>Select a project first.</p>
          )}
        </section>

        {/* Level 3: Tasks & Async Monitor Panel */}
        <section style={{ flex: 1, background: '#fafbfc', padding: '16px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#5e6c84' }}>
            3. Tasks {selectedStory ? `(${selectedStory.title})` : ''}
          </h3>
          {selectedStory ? (
            <>
              <form onSubmit={createTask} style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  style={{ flex: 2 }}
                />
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={e => setNewTaskDueDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary">Add Task</button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      background: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #dfe1e6'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={() => toggleTaskStatus(t)}
                    />
                    <div style={{ flex: 1, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                      <span style={{ fontWeight: 500 }}>{t.title}</span>
                      {t.due_date && (
                        <span style={{ marginLeft: '10px', fontSize: '12px', color: '#de350b' }}>
                          Due: {t.due_date}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b778c' }}>{t.status}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#6b778c', fontSize: '13px' }}>Select a story to view its tasks.</p>
          )}

          {/* Background Worker Feed */}
          <div style={{ marginTop: '36px', borderTop: '1px solid #dfe1e6', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#6b778c' }}>
              Background Alert Worker Feed (Live Polling & Retries)
            </h4>
            <div style={{ background: '#fff', border: '1px solid #dfe1e6', borderRadius: '6px', padding: '8px', maxHeight: '140px', overflowY: 'auto' }}>
              {jobs.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#6b778c' }}>No queued alert jobs currently.</div>
              ) : (
                jobs.map(j => (
                  <div key={j.id} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f4f5f7' }}>
                    <strong>Job #{j.id}</strong>: {j.job_type} | Status: <span style={{ color: j.status === 'completed' ? '#00875a' : '#de350b' }}>{j.status}</span> | Retries: {j.retry_count}/{j.max_retries}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}