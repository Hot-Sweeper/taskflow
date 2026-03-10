const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const storage = require('./storage');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

// In-memory session store: token → { userId, role, name }
const sessions = new Map();
// Admin sessions: token → true
const adminSessions = new Map();

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(express.json());
app.use('/shared', express.static(path.join(__dirname, 'public', 'shared')));
app.use('/boss', express.static(path.join(__dirname, 'public', 'boss')));
app.use('/worker', express.static(path.join(__dirname, 'public', 'worker')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Auth middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = session;
  req.token = token;
  next();
}

// Admin auth middleware
function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  const token = header.slice(7);
  if (!adminSessions.has(token)) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
  next();
}

// File upload config
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskId = req.params.id || req.params.taskId || 'general';
    const dir = path.join(storage.getDataDir(), 'uploads', taskId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const chatUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(storage.getDataDir(), 'uploads', 'chat');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage: uploadStorage, limits: { fileSize: MAX_FILE_SIZE } });
const chatUpload = multer({ storage: chatUploadStorage, limits: { fileSize: MAX_FILE_SIZE } });

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════════

const wsClients = new Map(); // ws → { userId, role, name }

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'auth') {
        const session = sessions.get(msg.token);
        if (session) {
          wsClients.set(ws, session);
          // Send sync data on connect
          const [tasks, team, requests, timelog] = await Promise.all([
            storage.read('tasks.json'),
            storage.read('teams.json'),
            storage.read('requests.json'),
            storage.read('timelog.json')
          ]);
          // Filter data based on role
          const userId = session.userId;
          const role = session.role;
          let myTasks = tasks;
          let myTeam = team.filter(t =>
            t.bossId === userId || t.workerId === userId
          );
          let myRequests = requests.filter(r =>
            r.fromUserId === userId || r.toUserId === userId
          );

          // Get unread chat counts
          const messages = await storage.read('messages.json');
          const unreadCounts = {};
          for (const m of messages) {
            if (m.to === userId && !m.read) {
              unreadCounts[m.from] = (unreadCounts[m.from] || 0) + 1;
            }
          }

          ws.send(JSON.stringify({
            type: 'sync',
            payload: { tasks: myTasks, team: myTeam, requests: myRequests, unreadCounts }
          }));
        }
      } else if (msg.type === 'chat:typing') {
        const sender = wsClients.get(ws);
        if (sender) {
          broadcastToUser(msg.to, {
            type: 'chat:typing',
            from: sender.userId,
            conversationKey: [sender.userId, msg.to].sort().join(':')
          });
        }
      }
    } catch (err) {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

// Heartbeat to detect stale connections
const wsInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(wsInterval));

function broadcast(data, filterFn) {
  const msg = JSON.stringify(data);
  for (const [ws, client] of wsClients.entries()) {
    if (ws.readyState === 1 && (!filterFn || filterFn(client))) {
      ws.send(msg);
    }
  }
}

function broadcastToUser(userId, data) {
  const msg = JSON.stringify(data);
  for (const [ws, client] of wsClients.entries()) {
    if (ws.readyState === 1 && client.userId === userId) {
      ws.send(msg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, password, role } = req.body;
    if (!name || !password || !role) {
      return res.status(400).json({ error: 'Name, password, and role are required' });
    }
    if (!['boss', 'worker'].includes(role)) {
      return res.status(400).json({ error: 'Role must be boss or worker' });
    }
    if (name.length < 2 || name.length > 30) {
      return res.status(400).json({ error: 'Name must be 2-30 characters' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const config = await storage.readConfig();
    if (!config.allowSignup) {
      return res.status(403).json({ error: 'Signup is currently disabled' });
    }

    const users = await storage.read('users.json');
    if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      name,
      role,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await storage.write('users.json', users);

    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, role: user.role, name: user.name });

    res.status(201).json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const users = await storage.read('users.json');
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, role: user.role, name: user.name });

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  sessions.delete(req.token);
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.userId, name: req.user.name, role: req.user.role });
});

// ═══════════════════════════════════════════════════════════════
// TASK ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    let filtered = tasks;
    if (req.query.assignedTo) {
      filtered = filtered.filter(t => t.assignedTo === req.query.assignedTo);
    }
    if (req.query.status) {
      filtered = filtered.filter(t => t.status === req.query.status);
    }
    if (req.query.category) {
      filtered = filtered.filter(t => t.category === req.query.category);
    }
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, deadline, assignedTo, category } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description || '',
      priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      status: 'todo',
      progress: 0,
      category: category || null,
      assignedTo: assignedTo || null,
      createdBy: req.user.userId,
      deadline: deadline || null,
      notes: [],
      files: [],
      timeEntries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tasks = await storage.read('tasks.json');
    tasks.push(task);
    await storage.write('tasks.json', tasks);

    broadcast({ type: 'task:created', payload: task });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const allowed = ['title', 'description', 'priority', 'status', 'progress',
      'category', 'assignedTo', 'deadline'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        tasks[idx][key] = req.body[key];
      }
    }
    if (req.body.progress !== undefined) {
      tasks[idx].progress = Math.max(0, Math.min(100, parseInt(req.body.progress, 10) || 0));
    }
    tasks[idx].updatedAt = new Date().toISOString();

    await storage.write('tasks.json', tasks);
    broadcast({ type: 'task:updated', payload: tasks[idx] });
    res.json(tasks[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    tasks.splice(idx, 1);
    await storage.write('tasks.json', tasks);
    broadcast({ type: 'task:deleted', payload: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks/:id/notes', authMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const text = req.body.text || '';
    if (!text.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Note text or files required' });
    }

    const noteFiles = (req.files || []).map(f => ({
      name: f.originalname,
      storedName: f.filename,
      size: f.size,
      type: f.mimetype
    }));

    const note = {
      id: crypto.randomUUID(),
      text: text.trim(),
      author: req.user.name,
      authorId: req.user.userId,
      files: noteFiles,
      createdAt: new Date().toISOString()
    };

    tasks[idx].notes.push(note);
    tasks[idx].files.push(...noteFiles);
    tasks[idx].updatedAt = new Date().toISOString();

    await storage.write('tasks.json', tasks);
    broadcast({ type: 'note:added', payload: { taskId: req.params.id, note } });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks/:id/files', authMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const newFiles = (req.files || []).map(f => ({
      name: f.originalname,
      storedName: f.filename,
      size: f.size,
      type: f.mimetype
    }));

    tasks[idx].files.push(...newFiles);
    tasks[idx].updatedAt = new Date().toISOString();

    await storage.write('tasks.json', tasks);
    res.json(newFiles);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/files/:taskId/:filename', authMiddleware, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(storage.getDataDir(), 'uploads', req.params.taskId, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath);
});

app.get('/api/files/:taskId', authMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const task = tasks.find(t => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task.files || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/files/:taskId/download-all', authMiddleware, async (req, res) => {
  try {
    const uploadDir = path.join(storage.getDataDir(), 'uploads', req.params.taskId);
    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: 'No files found' });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="task-files.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(uploadDir, false);
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CATEGORY ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/categories', authMiddleware, async (req, res) => {
  try {
    const categories = await storage.read('categories.json');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/categories', authMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const categories = await storage.read('categories.json');
    const category = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color || '#6366f1',
      createdBy: req.user.userId,
      createdAt: new Date().toISOString()
    };
    categories.push(category);
    await storage.write('categories.json', categories);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TEAM ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/workers', authMiddleware, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const workers = users
      .filter(u => u.role === 'worker')
      .map(u => ({ id: u.id, name: u.name }));
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/team', authMiddleware, async (req, res) => {
  try {
    const teams = await storage.read('teams.json');
    const myTeam = teams.filter(t =>
      t.bossId === req.user.userId || t.workerId === req.user.userId
    );
    // Augment with names
    const users = await storage.read('users.json');
    const result = myTeam.map(t => ({
      ...t,
      bossName: users.find(u => u.id === t.bossId)?.name || 'Unknown',
      workerName: users.find(u => u.id === t.workerId)?.name || 'Unknown'
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/team/invite', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'boss') {
      return res.status(403).json({ error: 'Only managers can send invites' });
    }
    const { workerName } = req.body;
    if (!workerName) {
      return res.status(400).json({ error: 'Worker name is required' });
    }

    const users = await storage.read('users.json');
    const worker = users.find(u => u.name.toLowerCase() === workerName.toLowerCase() && u.role === 'worker');
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const teams = await storage.read('teams.json');
    const existing = teams.find(t =>
      t.bossId === req.user.userId && t.workerId === worker.id &&
      (t.status === 'active' || t.status === 'pending')
    );
    if (existing) {
      return res.status(409).json({ error: 'Invite already exists or worker already in team' });
    }

    const invite = {
      id: crypto.randomUUID(),
      bossId: req.user.userId,
      workerId: worker.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    teams.push(invite);
    await storage.write('teams.json', teams);

    broadcastToUser(worker.id, {
      type: 'team:invite',
      from: req.user.name,
      inviteId: invite.id
    });

    res.status(201).json(invite);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/team/respond', authMiddleware, async (req, res) => {
  try {
    const { inviteId, accept } = req.body;
    if (!inviteId || accept === undefined) {
      return res.status(400).json({ error: 'inviteId and accept are required' });
    }

    const teams = await storage.read('teams.json');
    const idx = teams.findIndex(t => t.id === inviteId && t.workerId === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'Invite not found' });
    if (teams[idx].status !== 'pending') {
      return res.status(400).json({ error: 'Invite already responded to' });
    }

    if (accept) {
      teams[idx].status = 'active';
      teams[idx].acceptedAt = new Date().toISOString();
      broadcastToUser(teams[idx].bossId, {
        type: 'team:accepted',
        worker: req.user.name,
        connectionId: teams[idx].id
      });
    } else {
      teams[idx].status = 'declined';
      broadcastToUser(teams[idx].bossId, {
        type: 'team:declined',
        worker: req.user.name,
        inviteId: teams[idx].id
      });
    }

    await storage.write('teams.json', teams);
    res.json(teams[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/team/:connectionId', authMiddleware, async (req, res) => {
  try {
    const teams = await storage.read('teams.json');
    const idx = teams.findIndex(t => t.id === req.params.connectionId);
    if (idx === -1) return res.status(404).json({ error: 'Connection not found' });

    teams.splice(idx, 1);
    await storage.write('teams.json', teams);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/team/invites', authMiddleware, async (req, res) => {
  try {
    const teams = await storage.read('teams.json');
    const users = await storage.read('users.json');
    const pending = teams
      .filter(t => t.workerId === req.user.userId && t.status === 'pending')
      .map(t => ({
        ...t,
        bossName: users.find(u => u.id === t.bossId)?.name || 'Unknown'
      }));
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TIME TRACKING ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/time/clock-in', authMiddleware, async (req, res) => {
  try {
    const { location } = req.body;
    const timelog = await storage.read('timelog.json');

    // Check if already clocked in today
    const today = new Date().toISOString().slice(0, 10);
    const activeSession = timelog.find(t =>
      t.userId === req.user.userId && t.date === today && !t.clockOut
    );
    if (activeSession) {
      return res.status(400).json({ error: 'Already clocked in today' });
    }

    const session = {
      id: crypto.randomUUID(),
      userId: req.user.userId,
      userName: req.user.name,
      date: today,
      clockIn: new Date().toISOString(),
      clockOut: null,
      location: location || 'office',
      status: 'working',
      currentTask: null,
      breaks: [],
      totalWorked: 0,
      lastHeartbeat: new Date().toISOString()
    };
    timelog.push(session);
    await storage.write('timelog.json', timelog);

    broadcast({
      type: 'time:clockin',
      worker: req.user.name,
      workerId: req.user.userId,
      location: session.location,
      time: session.clockIn
    }, c => c.role === 'boss');

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/time/clock-out', authMiddleware, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    const today = new Date().toISOString().slice(0, 10);
    const idx = timelog.findIndex(t =>
      t.userId === req.user.userId && t.date === today && !t.clockOut
    );
    if (idx === -1) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    timelog[idx].clockOut = new Date().toISOString();
    timelog[idx].status = 'offline';
    // Calculate total worked
    const clockIn = new Date(timelog[idx].clockIn).getTime();
    const clockOut = new Date(timelog[idx].clockOut).getTime();
    let breakTime = 0;
    for (const b of timelog[idx].breaks) {
      if (b.end) {
        breakTime += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
    }
    timelog[idx].totalWorked = Math.round((clockOut - clockIn - breakTime) / 60000);

    await storage.write('timelog.json', timelog);

    broadcast({
      type: 'time:clockout',
      worker: req.user.name,
      workerId: req.user.userId,
      totalToday: timelog[idx].totalWorked,
      time: timelog[idx].clockOut
    }, c => c.role === 'boss');

    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/time/play', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.body;
    const timelog = await storage.read('timelog.json');
    const today = new Date().toISOString().slice(0, 10);
    const idx = timelog.findIndex(t =>
      t.userId === req.user.userId && t.date === today && !t.clockOut
    );
    if (idx === -1) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    // End any active break
    const activeBreak = timelog[idx].breaks.find(b => !b.end);
    if (activeBreak) {
      activeBreak.end = new Date().toISOString();
    }

    timelog[idx].status = 'working';
    timelog[idx].currentTask = taskId || null;
    timelog[idx].lastHeartbeat = new Date().toISOString();

    await storage.write('timelog.json', timelog);

    broadcast({
      type: 'time:status',
      worker: req.user.name,
      workerId: req.user.userId,
      status: 'working',
      task: timelog[idx].currentTask,
      location: timelog[idx].location
    }, c => c.role === 'boss');

    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/time/pause', authMiddleware, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    const today = new Date().toISOString().slice(0, 10);
    const idx = timelog.findIndex(t =>
      t.userId === req.user.userId && t.date === today && !t.clockOut
    );
    if (idx === -1) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    timelog[idx].status = 'break';
    timelog[idx].breaks.push({ start: new Date().toISOString(), end: null });

    await storage.write('timelog.json', timelog);

    broadcast({
      type: 'time:status',
      worker: req.user.name,
      workerId: req.user.userId,
      status: 'break',
      location: timelog[idx].location
    }, c => c.role === 'boss');

    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/time/heartbeat', authMiddleware, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    const today = new Date().toISOString().slice(0, 10);
    const idx = timelog.findIndex(t =>
      t.userId === req.user.userId && t.date === today && !t.clockOut
    );
    if (idx === -1) return res.json({ active: false });

    timelog[idx].lastHeartbeat = new Date().toISOString();
    await storage.write('timelog.json', timelog);
    res.json({ active: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/time/status', authMiddleware, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    const today = new Date().toISOString().slice(0, 10);
    const active = timelog.filter(t => t.date === today && !t.clockOut);
    res.json(active);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/time/sessions', authMiddleware, async (req, res) => {
  try {
    const { worker, month, year } = req.query;
    const timelog = await storage.read('timelog.json');
    let filtered = timelog;
    if (worker) filtered = filtered.filter(t => t.userId === worker);
    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.date.startsWith(prefix));
    }
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/time/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    const idx = timelog.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Session not found' });

    const allowed = ['clockIn', 'clockOut', 'location', 'totalWorked'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) timelog[idx][key] = req.body[key];
    }

    await storage.write('timelog.json', timelog);
    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/time/report', authMiddleware, async (req, res) => {
  try {
    const { worker, month, year } = req.query;
    if (!worker || !month || !year) {
      return res.status(400).json({ error: 'worker, month and year are required' });
    }

    const users = await storage.read('users.json');
    const workerUser = users.find(u => u.id === worker);
    const workerName = workerUser ? workerUser.name : 'Unknown';

    const timelog = await storage.read('timelog.json');
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const sessions = timelog.filter(t => t.userId === worker && t.date.startsWith(prefix));

    const tasks = await storage.read('tasks.json');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${workerName}-${year}-${String(month).padStart(2, '0')}-Report.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('MONTHLY WORK REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Employee: ${workerName}`);
    doc.text(`Period: ${year}-${String(month).padStart(2, '0')}`);
    doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();

    // Summary
    const totalMinutes = sessions.reduce((s, t) => s + (t.totalWorked || 0), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;
    const officeDays = sessions.filter(s => s.location === 'office').length;
    const homeDays = sessions.filter(s => s.location === 'home').length;

    doc.fontSize(14).text('Summary');
    doc.fontSize(10);
    doc.text(`Total Days Worked: ${sessions.length}`);
    doc.text(`Total Hours: ${totalHours}h ${totalMins}m`);
    doc.text(`Average Hours/Day: ${sessions.length ? Math.round(totalMinutes / sessions.length / 60 * 10) / 10 : 0}h`);
    doc.text(`Office Days: ${officeDays}`);
    doc.text(`Home Office Days: ${homeDays}`);
    doc.moveDown();

    // Daily breakdown
    doc.fontSize(14).text('Daily Breakdown');
    doc.fontSize(9);
    for (const s of sessions) {
      const clockIn = s.clockIn ? new Date(s.clockIn).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '-';
      const clockOut = s.clockOut ? new Date(s.clockOut).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '-';
      const hrs = Math.floor((s.totalWorked || 0) / 60);
      const mins = (s.totalWorked || 0) % 60;
      const loc = s.location === 'office' ? 'Office' : 'Home';
      doc.text(`${s.date}  ${clockIn} – ${clockOut}  ${hrs}h${mins}m  ${loc}`);
    }

    doc.moveDown();
    doc.fontSize(8).text('Generated by TaskFlow', { align: 'center' });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// REQUEST ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await storage.read('requests.json');
    const myRequests = requests.filter(r =>
      r.fromUserId === req.user.userId || r.toUserId === req.user.userId
    );
    res.json(myRequests);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { type, title, description, toUserId, taskId } = req.body;
    if (!title || !toUserId) {
      return res.status(400).json({ error: 'Title and toUserId are required' });
    }

    const request = {
      id: crypto.randomUUID(),
      type: type || 'general',
      title: title.trim(),
      description: description || '',
      taskId: taskId || null,
      fromUserId: req.user.userId,
      fromUserName: req.user.name,
      toUserId,
      status: 'pending',
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const requests = await storage.read('requests.json');
    requests.push(request);
    await storage.write('requests.json', requests);

    broadcastToUser(toUserId, { type: 'request:created', payload: request });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const requests = await storage.read('requests.json');
    const idx = requests.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Request not found' });

    const allowed = ['status', 'title', 'description'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) requests[idx][key] = req.body[key];
    }
    requests[idx].updatedAt = new Date().toISOString();

    await storage.write('requests.json', requests);

    // Notify both parties
    broadcastToUser(requests[idx].fromUserId, { type: 'request:updated', payload: requests[idx] });
    broadcastToUser(requests[idx].toUserId, { type: 'request:updated', payload: requests[idx] });

    res.json(requests[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const requests = await storage.read('requests.json');
    const idx = requests.findIndex(r => r.id === req.params.id && r.fromUserId === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'Request not found or not authorized' });

    requests.splice(idx, 1);
    await storage.write('requests.json', requests);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/requests/:id/notes', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    const requests = await storage.read('requests.json');
    const idx = requests.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Request not found' });

    const text = req.body.text || '';
    const noteFiles = (req.files || []).map(f => ({
      name: f.originalname,
      storedName: f.filename,
      size: f.size,
      type: f.mimetype
    }));

    const note = {
      id: crypto.randomUUID(),
      text: text.trim(),
      author: req.user.name,
      authorId: req.user.userId,
      files: noteFiles,
      createdAt: new Date().toISOString()
    };

    requests[idx].notes.push(note);
    requests[idx].updatedAt = new Date().toISOString();
    await storage.write('requests.json', requests);

    broadcastToUser(requests[idx].fromUserId, { type: 'request:note', payload: { requestId: req.params.id, note } });
    broadcastToUser(requests[idx].toUserId, { type: 'request:note', payload: { requestId: req.params.id, note } });

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CHAT ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/chat/conversations', authMiddleware, async (req, res) => {
  try {
    const messages = await storage.read('messages.json');
    const users = await storage.read('users.json');
    const convMap = {};

    for (const m of messages) {
      if (m.from !== req.user.userId && m.to !== req.user.userId) continue;
      const otherId = m.from === req.user.userId ? m.to : m.from;
      if (!convMap[otherId] || new Date(m.createdAt) > new Date(convMap[otherId].lastMessage.createdAt)) {
        if (!convMap[otherId]) convMap[otherId] = { unread: 0 };
        convMap[otherId].lastMessage = m;
        convMap[otherId].userId = otherId;
        convMap[otherId].userName = users.find(u => u.id === otherId)?.name || 'Unknown';
      }
      if (m.to === req.user.userId && !m.read) {
        convMap[otherId].unread = (convMap[otherId].unread || 0) + 1;
      }
    }

    res.json(Object.values(convMap));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/:userId', authMiddleware, async (req, res) => {
  try {
    const messages = await storage.read('messages.json');
    const otherId = req.params.userId;
    let convo = messages.filter(m =>
      (m.from === req.user.userId && m.to === otherId) ||
      (m.from === otherId && m.to === req.user.userId)
    );
    // Sort oldest first
    convo.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Pagination
    const before = req.query.before;
    const limit = parseInt(req.query.limit || '50', 10);
    if (before) {
      convo = convo.filter(m => new Date(m.createdAt) < new Date(before));
    }
    convo = convo.slice(-limit);

    res.json(convo);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/:userId', authMiddleware, chatUpload.array('files', 5), async (req, res) => {
  try {
    const text = req.body.text || '';
    const chatFiles = (req.files || []).map(f => ({
      name: f.originalname,
      storedName: f.filename,
      size: f.size,
      type: f.mimetype
    }));

    if (!text.trim() && chatFiles.length === 0) {
      return res.status(400).json({ error: 'Message text or files required' });
    }

    const message = {
      id: crypto.randomUUID(),
      from: req.user.userId,
      fromName: req.user.name,
      to: req.params.userId,
      text: text.trim(),
      files: chatFiles,
      read: false,
      createdAt: new Date().toISOString()
    };

    const messages = await storage.read('messages.json');
    messages.push(message);
    await storage.write('messages.json', messages);

    const conversationKey = [req.user.userId, req.params.userId].sort().join(':');
    broadcastToUser(req.params.userId, {
      type: 'chat:message',
      conversationKey,
      message
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/chat/:userId/read', authMiddleware, async (req, res) => {
  try {
    const messages = await storage.read('messages.json');
    let updated = false;
    for (const m of messages) {
      if (m.from === req.params.userId && m.to === req.user.userId && !m.read) {
        m.read = true;
        m.readAt = new Date().toISOString();
        updated = true;
      }
    }
    if (updated) {
      await storage.write('messages.json', messages);
      const conversationKey = [req.user.userId, req.params.userId].sort().join(':');
      broadcastToUser(req.params.userId, {
        type: 'chat:read',
        conversationKey,
        readBy: req.user.userId,
        readAt: new Date().toISOString()
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/files/:filename', authMiddleware, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(storage.getDataDir(), 'uploads', 'chat', safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath);
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  const token = crypto.randomUUID();
  adminSessions.set(token, true);
  res.json({ token });
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    res.json(users.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt })));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { name, password, role } = req.body;
    if (!name || !password || !role) {
      return res.status(400).json({ error: 'Name, password, and role are required' });
    }
    const users = await storage.read('users.json');
    if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      name, role,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await storage.write('users.json', users);
    res.status(201).json({ id: user.id, name: user.name, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    if (req.body.name) users[idx].name = req.body.name;
    if (req.body.role) users[idx].role = req.body.role;
    if (req.body.password) {
      users[idx].password = await bcrypt.hash(req.body.password, 10);
    }

    await storage.write('users.json', users);
    res.json({ id: users[idx].id, name: users[idx].name, role: users[idx].role });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(idx, 1);
    await storage.write('users.json', users);
    // Also invalidate any sessions for this user
    for (const [token, session] of sessions.entries()) {
      if (session.userId === req.params.id) sessions.delete(token);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/tasks', adminAuth, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/tasks/:id', adminAuth, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });
    tasks.splice(idx, 1);
    await storage.write('tasks.json', tasks);
    broadcast({ type: 'task:deleted', payload: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/teams', adminAuth, async (req, res) => {
  try {
    const teams = await storage.read('teams.json');
    const users = await storage.read('users.json');
    const result = teams.map(t => ({
      ...t,
      bossName: users.find(u => u.id === t.bossId)?.name || 'Unknown',
      workerName: users.find(u => u.id === t.workerId)?.name || 'Unknown'
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/teams', adminAuth, async (req, res) => {
  try {
    const { bossId, workerId } = req.body;
    if (!bossId || !workerId) {
      return res.status(400).json({ error: 'bossId and workerId required' });
    }
    const teams = await storage.read('teams.json');
    const connection = {
      id: crypto.randomUUID(),
      bossId, workerId,
      status: 'active',
      createdAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString()
    };
    teams.push(connection);
    await storage.write('teams.json', teams);
    res.status(201).json(connection);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/teams/:id', adminAuth, async (req, res) => {
  try {
    const teams = await storage.read('teams.json');
    const idx = teams.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Connection not found' });
    teams.splice(idx, 1);
    await storage.write('teams.json', teams);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/timelog', adminAuth, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    res.json(timelog);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/timelog/:id', adminAuth, async (req, res) => {
  try {
    const timelog = await storage.read('timelog.json');
    const idx = timelog.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
    const allowed = ['clockIn', 'clockOut', 'location', 'totalWorked'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) timelog[idx][key] = req.body[key];
    }
    await storage.write('timelog.json', timelog);
    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/export/all', adminAuth, async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="taskflow-backup.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    const dataDir = storage.getDataDir();
    const files = ['users.json', 'tasks.json', 'teams.json', 'timelog.json',
      'categories.json', 'config.json', 'requests.json', 'messages.json'];
    for (const f of files) {
      const fp = path.join(dataDir, f);
      if (fs.existsSync(fp)) archive.file(fp, { name: f });
    }
    // Include uploads
    const uploadsDir = path.join(dataDir, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/export/:file', adminAuth, async (req, res) => {
  try {
    const allowed = ['users.json', 'tasks.json', 'teams.json', 'timelog.json',
      'categories.json', 'config.json', 'requests.json', 'messages.json'];
    const filename = req.params.file;
    if (!allowed.includes(filename)) {
      return res.status(400).json({ error: 'Invalid file' });
    }
    const data = await storage.read(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/export/uploads', adminAuth, async (req, res) => {
  try {
    const uploadsDir = path.join(storage.getDataDir(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      return res.status(404).json({ error: 'No uploads found' });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="uploads.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(uploadsDir, 'uploads');
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/import/all', adminAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ZIP file required' });
    // For simplicity, we'll handle individual JSON imports
    res.json({ success: true, message: 'Use individual file import endpoints' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/import/:file', adminAuth, async (req, res) => {
  try {
    const allowed = ['users.json', 'tasks.json', 'teams.json', 'timelog.json',
      'categories.json', 'config.json', 'requests.json', 'messages.json'];
    const filename = req.params.file;
    if (!allowed.includes(filename)) {
      return res.status(400).json({ error: 'Invalid file' });
    }
    const data = req.body;
    if (!Array.isArray(data) && typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    await storage.write(filename, data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/config', adminAuth, async (req, res) => {
  try {
    const config = await storage.readConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/config', adminAuth, async (req, res) => {
  try {
    const config = await storage.readConfig();
    const allowed = ['maxFileSize', 'allowSignup', 'maintenanceMode'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) config[key] = req.body[key];
    }
    await storage.write('config.json', config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/health', adminAuth, async (req, res) => {
  try {
    const dataDir = storage.getDataDir();
    const files = ['users.json', 'tasks.json', 'teams.json', 'timelog.json',
      'categories.json', 'config.json', 'requests.json', 'messages.json'];
    const sizes = {};
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(dataDir, f));
        sizes[f] = stat.size;
      } catch { sizes[f] = 0; }
    }
    res.json({
      uptime: process.uptime(),
      wsConnections: wss.clients.size,
      activeSessions: sessions.size,
      adminSessions: adminSessions.size,
      dataDir,
      fileSizes: sizes,
      memoryUsage: process.memoryUsage()
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/activity', adminAuth, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const recent = [];
    for (const task of tasks) {
      recent.push({ type: 'task', action: 'created', id: task.id, title: task.title, at: task.createdAt });
      for (const note of (task.notes || [])) {
        recent.push({ type: 'note', action: 'added', taskId: task.id, taskTitle: task.title, author: note.author, at: note.createdAt });
      }
    }
    recent.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json(recent.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROOT REDIRECTS
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

async function start() {
  await storage.ensureDataDir();
  server.listen(PORT, () => {
    console.log(`TaskFlow running on port ${PORT}`);
    console.log(`  Boss portal:   http://localhost:${PORT}/boss`);
    console.log(`  Worker portal: http://localhost:${PORT}/worker`);
    console.log(`  Admin panel:   http://localhost:${PORT}/admin`);
  });
}

start();
