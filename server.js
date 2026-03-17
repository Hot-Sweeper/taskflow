const express = require('express');
const https = require('https');
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

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Persistent session store: token → { userId, name }
let sessions = new Map();
// Admin sessions: token → true
const adminSessions = new Map();

// Load sessions from disk, prune orphans
async function loadSessions() {
  try {
    const data = await storage.read('sessions.json');
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      sessions = new Map(Object.entries(data));
    }
  } catch (err) {
    sessions = new Map();
  }
  const users = await storage.read('users.json');
  const validIds = new Set(users.map(u => u.id));
  let pruned = false;
  for (const [token, session] of sessions.entries()) {
    if (!validIds.has(session.userId)) {
      sessions.delete(token);
      pruned = true;
    }
  }
  if (pruned) await saveSessions();
}
async function saveSessions() {
  const obj = Object.fromEntries(sessions);
  await storage.write('sessions.json', obj);
}

// Generate a short invite code (6 chars, uppercase alphanumeric)
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(express.json());
app.use('/shared', express.static(path.join(__dirname, 'public', 'shared')));
app.use('/app', express.static(path.join(__dirname, 'public', 'app')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/avatar', express.static(path.join(__dirname, 'public', 'avatar')));
// Keep legacy portal routes for backwards compatibility during transition
app.use('/boss', express.static(path.join(__dirname, 'public', 'boss')));
app.use('/worker', express.static(path.join(__dirname, 'public', 'worker')));
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

// Flow membership middleware — checks user is a member of req.params.flowId
async function flowMemberMiddleware(req, res, next) {
  const flowId = req.params.flowId;
  if (!flowId) return res.status(400).json({ error: 'Flow ID required' });
  const memberships = await storage.read('memberships.json');
  const membership = memberships.find(m => m.flowId === flowId && m.userId === req.user.userId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this flow' });
  }
  req.membership = membership;
  next();
}

// Flow owner middleware — checks user is the owner
async function flowOwnerMiddleware(req, res, next) {
  const flowId = req.params.flowId;
  if (!flowId) return res.status(400).json({ error: 'Flow ID required' });
  const memberships = await storage.read('memberships.json');
  const membership = memberships.find(m => m.flowId === flowId && m.userId === req.user.userId);
  if (!membership || !membership.isOwner) {
    return res.status(403).json({ error: 'Only the flow owner can do this' });
  }
  req.membership = membership;
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

const avatarUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(storage.getDataDir(), 'uploads', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `${req.user.userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage: uploadStorage, limits: { fileSize: MAX_FILE_SIZE } });
const chatUpload = multer({ storage: chatUploadStorage, limits: { fileSize: MAX_FILE_SIZE } });
const avatarUpload = multer({
  storage: avatarUploadStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

// Valid DiceBear Adventurer options for avatar config validation
const AVATAR_OPTIONS = {
  hair: [...Array(26)].map((_,i) => `long${String(i+1).padStart(2,'0')}`).concat([...Array(19)].map((_,i) => `short${String(i+1).padStart(2,'0')}`)),
  hairColor: ['0e0e0e','3eac2c','6a4e35','85c2c6','796a45','562306','592454','ab2a18','ac6511','afafaf','b9a05f','cb6820','dba3be','e5d7a3'],
  eyes: [...Array(26)].map((_,i) => `variant${String(i+1).padStart(2,'0')}`),
  eyebrows: [...Array(15)].map((_,i) => `variant${String(i+1).padStart(2,'0')}`),
  mouth: [...Array(30)].map((_,i) => `variant${String(i+1).padStart(2,'0')}`),
  skinColor: ['9e5622','763900','ecad80','f2d3b1'],
  earrings: [null,...[...Array(6)].map((_,i) => `variant${String(i+1).padStart(2,'0')}`)],
  glasses: [null,...[...Array(5)].map((_,i) => `variant${String(i+1).padStart(2,'0')}`)],
  features: [null,'birthmark','blush','freckles','mustache'],
  backgroundColor: null
};

function buildDiceBearUrl(config) {
  if (!config) return null;
  const params = new URLSearchParams();
  if (config.skinColor) params.set('skinColor', config.skinColor);
  if (config.hair) params.set('hair', config.hair);
  params.set('hairProbability', '100');
  if (config.hairColor) params.set('hairColor', config.hairColor);
  if (config.eyes) params.set('eyes', config.eyes);
  if (config.eyebrows) params.set('eyebrows', config.eyebrows);
  if (config.mouth) params.set('mouth', config.mouth);
  if (config.earrings) {
    params.set('earrings', config.earrings);
    params.set('earringsProbability', '100');
  } else {
    params.set('earringsProbability', '0');
  }
  if (config.glasses) {
    params.set('glasses', config.glasses);
    params.set('glassesProbability', '100');
  } else {
    params.set('glassesProbability', '0');
  }
  if (config.features) {
    params.set('features', config.features);
    params.set('featuresProbability', '100');
  } else {
    params.set('featuresProbability', '0');
  }
  if (config.backgroundColor) params.set('backgroundColor', config.backgroundColor);
  params.set('randomizeIds', 'true');
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

function avatarUrlFromUser(user) {
  if (!user) return null;
  if (user.avatarConfig) return buildDiceBearUrl(user.avatarConfig);
  if (user.avatar) return `/api/avatars/${user.avatar}`;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════════

const wsClients = new Map(); // ws → { userId, name }

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
          // Broadcast online presence
          broadcast({ type: 'presence:online', userId: session.userId });
          // Send initial sync — user's flows and memberships
          const [memberships, flows, users] = await Promise.all([
            storage.read('memberships.json'),
            storage.read('flows.json'),
            storage.read('users.json')
          ]);
          const myMemberships = memberships.filter(m => m.userId === session.userId);
          const myFlowIds = new Set(myMemberships.map(m => m.flowId));
          const myFlows = flows.filter(f => myFlowIds.has(f.id));

          ws.send(JSON.stringify({
            type: 'sync',
            payload: { flows: myFlows, memberships: myMemberships }
          }));
        }
      } else if (msg.type === 'chat:typing') {
        const sender = wsClients.get(ws);
        if (sender) {
          broadcastToUser(msg.to, {
            type: 'chat:typing',
            from: sender.userId,
            flowId: msg.flowId
          });
        }
      }
    } catch (err) {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    const leaving = wsClients.get(ws);
    wsClients.delete(ws);
    // Broadcast offline if no other connections for this user
    if (leaving && !getOnlineUserIds().has(leaving.userId)) {
      broadcast({ type: 'presence:offline', userId: leaving.userId });
    }
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

function getOnlineUserIds() {
  const ids = new Set();
  for (const [ws, client] of wsClients.entries()) {
    if (ws.readyState === 1) ids.add(client.userId);
  }
  return ids;
}

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

// Broadcast to all members of a flow
async function broadcastToFlow(flowId, data, excludeUserId) {
  const memberships = await storage.read('memberships.json');
  const memberIds = new Set(memberships.filter(m => m.flowId === flowId).map(m => m.userId));
  if (excludeUserId) memberIds.delete(excludeUserId);
  const msg = JSON.stringify(data);
  for (const [ws, client] of wsClients.entries()) {
    if (ws.readyState === 1 && memberIds.has(client.userId)) {
      ws.send(msg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
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
      avatar: null,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await storage.write('users.json', users);

    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, name: user.name });
    await saveSessions();

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, avatarUrl: avatarUrlFromUser(user) }
    });
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
    sessions.set(token, { userId: user.id, name: user.name });
    await saveSessions();

    res.json({
      token,
      user: { id: user.id, name: user.name, avatarUrl: avatarUrlFromUser(user) }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  sessions.delete(req.token);
  await saveSessions();
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const user = users.find(u => u.id === req.user.userId);
    if (!user) {
      sessions.delete(req.token);
      await saveSessions();
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    res.json({ id: user.id, name: user.name, avatarUrl: avatarUrlFromUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// INVITE LINK ROUTES (public, no auth required)
// ═══════════════════════════════════════════════════════════════

// Get flow info by invite code (public preview)
app.get('/api/invite/:inviteCode', async (req, res) => {
  try {
    const flows = await storage.read('flows.json');
    const flow = flows.find(f => f.inviteCode === req.params.inviteCode.toUpperCase());
    if (!flow) return res.status(404).json({ error: 'Invalid invite code' });

    const memberships = await storage.read('memberships.json');
    const memberCount = memberships.filter(m => m.flowId === flow.id).length;

    res.json({
      flowId: flow.id,
      name: flow.name,
      icon: flow.icon,
      memberCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register a new account via invite link + join the flow
app.post('/api/invite/:inviteCode/register', avatarUpload.single('avatar'), async (req, res) => {
  try {
    const { name, password, avatarConfig } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }
    if (name.length < 2 || name.length > 30) {
      return res.status(400).json({ error: 'Name must be 2-30 characters' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const flows = await storage.read('flows.json');
    const flow = flows.find(f => f.inviteCode === req.params.inviteCode.toUpperCase());
    if (!flow) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const users = await storage.read('users.json');
    if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      name,
      avatar: req.file ? req.file.filename : null,
      avatarConfig: avatarConfig ? JSON.parse(avatarConfig) : null,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await storage.write('users.json', users);

    // Auto-join the flow
    const memberships = await storage.read('memberships.json');
    const membership = {
      id: crypto.randomUUID(),
      flowId: flow.id,
      userId: user.id,
      role: 'Member',
      isOwner: false,
      joinedAt: new Date().toISOString()
    };
    memberships.push(membership);
    await storage.write('memberships.json', memberships);

    // Create session
    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, name: user.name });
    await saveSessions();

    // Broadcast to flow members
    await broadcastToFlow(flow.id, {
      type: 'flow:memberJoined',
      flowId: flow.id,
      userId: user.id,
      userName: user.name
    }, user.id);

    createNotification({ flowId: flow.id, type: 'member_joined', title: `${user.name} joined`, body: 'New member joined via invite link', targetUserId: null, actorId: user.id, actorName: user.name }).catch(() => {});

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, avatarUrl: avatarUrlFromUser(user) },
      flow: { id: flow.id, name: flow.name, icon: flow.icon }
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login an existing user via invite link + join the flow
app.post('/api/invite/:inviteCode/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const flows = await storage.read('flows.json');
    const flow = flows.find(f => f.inviteCode === req.params.inviteCode.toUpperCase());
    if (!flow) return res.status(404).json({ error: 'Invalid invite code' });

    const users = await storage.read('users.json');
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Check if already a member
    const memberships = await storage.read('memberships.json');
    const existing = memberships.find(m => m.flowId === flow.id && m.userId === user.id);
    if (!existing) {
      const membership = {
        id: crypto.randomUUID(),
        flowId: flow.id,
        userId: user.id,
        role: 'Member',
        isOwner: false,
        joinedAt: new Date().toISOString()
      };
      memberships.push(membership);
      await storage.write('memberships.json', memberships);

      await broadcastToFlow(flow.id, {
        type: 'flow:memberJoined',
        flowId: flow.id,
        userId: user.id,
        userName: user.name
      }, user.id);

      createNotification({ flowId: flow.id, type: 'member_joined', title: `${user.name} joined`, body: 'New member joined via invite link', targetUserId: null, actorId: user.id, actorName: user.name }).catch(() => {});
    }

    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, name: user.name });
    await saveSessions();

    res.json({
      token,
      user: { id: user.id, name: user.name, avatarUrl: avatarUrlFromUser(user) },
      flow: { id: flow.id, name: flow.name, icon: flow.icon },
      alreadyMember: !!existing
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve invite page
app.use('/invite', express.static(path.join(__dirname, 'public', 'invite')));

// ═══════════════════════════════════════════════════════════════
// AVATAR ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/users/me/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Avatar image is required' });
    }

    const users = await storage.read('users.json');
    const idx = users.findIndex(u => u.id === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const oldAvatar = users[idx].avatar;
    users[idx].avatar = req.file.filename;
    await storage.write('users.json', users);

    if (oldAvatar && oldAvatar !== req.file.filename) {
      const oldPath = path.join(storage.getDataDir(), 'uploads', 'avatars', oldAvatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    res.json({ avatarUrl: avatarUrlFromUser(users[idx]) });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/avatars/:filename', authMiddleware, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(storage.getDataDir(), 'uploads', 'avatars', safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Avatar not found' });
  }
  res.sendFile(filePath);
});

app.get('/api/users/me/avatar-config', authMiddleware, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const user = users.find(u => u.id === req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ avatarConfig: user.avatarConfig || null, avatarUrl: avatarUrlFromUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/me/avatar-config', authMiddleware, async (req, res) => {
  try {
    const config = req.body;
    const required = ['hair','hairColor','eyes','eyebrows','mouth','skinColor'];
    for (const key of required) {
      if (!config[key]) return res.status(400).json({ error: `Missing required field: ${key}` });
      if (AVATAR_OPTIONS[key] && !AVATAR_OPTIONS[key].includes(config[key])) {
        return res.status(400).json({ error: `Invalid value for ${key}` });
      }
    }
    for (const key of ['earrings','glasses','features']) {
      if (config[key] !== null && config[key] !== undefined && config[key] !== '') {
        if (!AVATAR_OPTIONS[key].includes(config[key])) {
          return res.status(400).json({ error: `Invalid value for ${key}` });
        }
      }
    }
    if (config.backgroundColor && !/^[a-fA-F0-9]{6}$/.test(config.backgroundColor)) {
      return res.status(400).json({ error: 'Invalid background color' });
    }

    const avatarConfig = {
      hair: config.hair,
      hairColor: config.hairColor,
      eyes: config.eyes,
      eyebrows: config.eyebrows,
      mouth: config.mouth,
      skinColor: config.skinColor,
      earrings: config.earrings || null,
      glasses: config.glasses || null,
      features: config.features || null,
      backgroundColor: config.backgroundColor || 'b6e3f4'
    };

    const users = await storage.read('users.json');
    const idx = users.findIndex(u => u.id === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    users[idx].avatarConfig = avatarConfig;
    await storage.write('users.json', users);

    const avatarUrl = buildDiceBearUrl(avatarConfig);

    broadcast({
      type: 'avatar:updated',
      userId: req.user.userId,
      userName: req.user.name,
      avatarUrl
    });

    res.json({ avatarConfig, avatarUrl });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/avatar-options', (req, res) => {
  res.json(AVATAR_OPTIONS);
});

// ═══════════════════════════════════════════════════════════════
// AVAILABILITY / BLACKOUT ROUTES
// ═══════════════════════════════════════════════════════════════

// Get current user's availability blocks
app.get('/api/users/me/availability', authMiddleware, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const user = users.find(u => u.id === req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.availabilityBlocks || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add availability block
app.post('/api/users/me/availability', authMiddleware, async (req, res) => {
  try {
    const { from, to, reason, type } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'From and to dates are required' });
    if (new Date(from) > new Date(to)) return res.status(400).json({ error: 'From must be before to' });
    const validTypes = ['vacation', 'training', 'personal', 'other'];
    const blockType = validTypes.includes(type) ? type : 'other';

    const block = {
      id: crypto.randomUUID(),
      from: from.slice(0, 10),
      to: to.slice(0, 10),
      reason: (reason || '').slice(0, 200),
      type: blockType,
      createdAt: new Date().toISOString()
    };

    const users = await storage.read('users.json');
    const idx = users.findIndex(u => u.id === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    if (!users[idx].availabilityBlocks) users[idx].availabilityBlocks = [];
    users[idx].availabilityBlocks.push(block);
    await storage.write('users.json', users);

    res.status(201).json(block);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete availability block
app.delete('/api/users/me/availability/:blockId', authMiddleware, async (req, res) => {
  try {
    const users = await storage.read('users.json');
    const idx = users.findIndex(u => u.id === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const blocks = users[idx].availabilityBlocks || [];
    const blockIdx = blocks.findIndex(b => b.id === req.params.blockId);
    if (blockIdx === -1) return res.status(404).json({ error: 'Block not found' });

    blocks.splice(blockIdx, 1);
    users[idx].availabilityBlocks = blocks;
    await storage.write('users.json', users);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get availability blocks for flow members (boss/team view)
app.get('/api/flows/:flowId/availability', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const memberships = await storage.read('memberships.json');
    const flowMemberIds = memberships.filter(m => m.flowId === req.params.flowId).map(m => m.userId);
    const users = await storage.read('users.json');

    const result = [];
    for (const uid of flowMemberIds) {
      const user = users.find(u => u.id === uid);
      if (!user) continue;
      const blocks = user.availabilityBlocks || [];
      if (blocks.length > 0) {
        result.push({
          userId: uid,
          userName: user.name,
          avatarUrl: avatarUrlFromUser(user),
          blocks
        });
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DAILY SUMMARY & SHARED CALENDAR
// ═══════════════════════════════════════════════════════════════

// Get daily summary for a specific user on a specific date
app.get('/api/flows/:flowId/daily-summary', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { date, userId } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
    }
    const targetUserId = userId || req.user.userId;

    const [tasks, timelog, users, memberships] = await Promise.all([
      storage.read('tasks.json'),
      storage.read('timelog.json'),
      storage.read('users.json'),
      storage.read('memberships.json')
    ]);

    // Verify target user is a flow member
    const isMember = memberships.some(m => m.flowId === req.params.flowId && m.userId === targetUserId);
    if (!isMember) return res.status(404).json({ error: 'User not found in this flow' });

    const user = users.find(u => u.id === targetUserId);
    const flowTasks = tasks.filter(t => t.flowId === req.params.flowId);

    // Progress deltas: tasks touched by this user on this date
    const progressDeltas = [];
    for (const t of flowTasks) {
      const dayProgressLogs = (t.progressLog || []).filter(p => p.at && p.at.slice(0, 10) === date && p.by === targetUserId);
      const dayStatusLogs = (t.statusLog || []).filter(s => s.at && s.at.slice(0, 10) === date && s.by === targetUserId);
      const dayNotes = (t.notes || []).filter(n => n.createdAt && n.createdAt.slice(0, 10) === date && n.by === targetUserId);
      const wasCreated = t.createdAt && t.createdAt.slice(0, 10) === date && t.createdBy === targetUserId;

      if (dayProgressLogs.length > 0 || dayStatusLogs.length > 0 || dayNotes.length > 0 || wasCreated) {
        // Compute net progress delta for the day
        let progressFrom = null;
        let progressTo = null;
        if (dayProgressLogs.length > 0) {
          progressFrom = dayProgressLogs[0].from;
          progressTo = dayProgressLogs[dayProgressLogs.length - 1].to;
        }

        progressDeltas.push({
          taskId: t.id,
          taskTitle: t.title,
          priority: t.priority,
          status: t.status,
          progressFrom,
          progressTo,
          progressDelta: progressFrom !== null ? progressTo - progressFrom : null,
          statusChanges: dayStatusLogs.map(s => ({ from: s.from, to: s.to, at: s.at })),
          notesCount: dayNotes.length,
          wasCreated
        });
      }
    }

    // Tasks assigned to this user that were touched by others on this date
    const assignedTaskUpdates = [];
    for (const t of flowTasks) {
      const assigneeIds = t.assignedToList?.length ? t.assignedToList : (t.assignedTo ? [t.assignedTo] : []);
      const operatorIds = t.operators || [];
      const isAssignedOrOperator = assigneeIds.includes(targetUserId) || operatorIds.includes(targetUserId) || t.createdBy === targetUserId;
      if (!isAssignedOrOperator) continue;

      const otherProgressLogs = (t.progressLog || []).filter(p => p.at && p.at.slice(0, 10) === date && p.by !== targetUserId);
      const otherStatusLogs = (t.statusLog || []).filter(s => s.at && s.at.slice(0, 10) === date && s.by !== targetUserId);
      const otherNotes = (t.notes || []).filter(n => n.createdAt && n.createdAt.slice(0, 10) === date && n.by !== targetUserId);

      if (otherProgressLogs.length > 0 || otherStatusLogs.length > 0 || otherNotes.length > 0) {
        const actorIds = new Set([
          ...otherProgressLogs.map(p => p.by),
          ...otherStatusLogs.map(s => s.by),
          ...otherNotes.map(n => n.by)
        ]);
        const actors = [...actorIds].map(uid => {
          const u = users.find(x => x.id === uid);
          return { userId: uid, name: u?.name || 'Unknown', avatarUrl: avatarUrlFromUser(u) };
        });

        let progressFrom = null;
        let progressTo = null;
        if (otherProgressLogs.length > 0) {
          progressFrom = otherProgressLogs[0].from;
          progressTo = otherProgressLogs[otherProgressLogs.length - 1].to;
        }

        assignedTaskUpdates.push({
          taskId: t.id,
          taskTitle: t.title,
          priority: t.priority,
          status: t.status,
          progressFrom,
          progressTo,
          progressDelta: progressFrom !== null ? progressTo - progressFrom : null,
          statusChanges: otherStatusLogs.map(s => ({ from: s.from, to: s.to, at: s.at })),
          notesCount: otherNotes.length,
          actors
        });
      }
    }

    // Time worked on this date
    const daySessions = timelog.filter(t => t.userId === targetUserId && t.date === date);
    let totalWorkedMinutes = 0;
    for (const s of daySessions) {
      if (s.totalWorked) {
        totalWorkedMinutes += s.totalWorked;
      } else if (s.clockIn && s.clockOut) {
        const ms = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime();
        const breakMs = (s.breaks || []).reduce((sum, b) => {
          const end = b.end ? new Date(b.end).getTime() : 0;
          return sum + (end - new Date(b.start).getTime());
        }, 0);
        totalWorkedMinutes += Math.floor((ms - breakMs) / 60000);
      }
    }

    // Net daily progress score
    const netProgressScore = progressDeltas.reduce((sum, d) => sum + (d.progressDelta || 0), 0);

    res.json({
      date,
      userId: targetUserId,
      userName: user?.name || 'Unknown',
      avatarUrl: avatarUrlFromUser(user),
      totalWorkedMinutes,
      netProgressScore,
      progressDeltas,
      assignedTaskUpdates,
      sessions: daySessions.map(s => ({
        clockIn: s.clockIn,
        clockOut: s.clockOut,
        location: s.location,
        status: s.status,
        totalWorked: s.totalWorked
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get time sessions for all flow members (for shared calendar view)
app.get('/api/flows/:flowId/time-sessions', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    const [memberships, timelog, users] = await Promise.all([
      storage.read('memberships.json'),
      storage.read('timelog.json'),
      storage.read('users.json')
    ]);
    const flowMemberIds = memberships.filter(m => m.flowId === req.params.flowId).map(m => m.userId);

    let filtered = timelog.filter(t => flowMemberIds.includes(t.userId));
    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.date && t.date.startsWith(prefix));
    }

    // Group by user with avatar info
    const byUser = {};
    for (const s of filtered) {
      if (!byUser[s.userId]) {
        const user = users.find(u => u.id === s.userId);
        byUser[s.userId] = {
          userId: s.userId,
          userName: user?.name || 'Unknown',
          avatarUrl: avatarUrlFromUser(user),
          sessions: []
        };
      }
      byUser[s.userId].sessions.push({
        date: s.date,
        clockIn: s.clockIn,
        clockOut: s.clockOut,
        location: s.location,
        status: s.status,
        totalWorked: s.totalWorked
      });
    }

    res.json(Object.values(byUser));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FLOW ROUTES
// ═══════════════════════════════════════════════════════════════

// Get all flows the user belongs to
app.get('/api/flows', authMiddleware, async (req, res) => {
  try {
    const [memberships, flows, users] = await Promise.all([
      storage.read('memberships.json'),
      storage.read('flows.json'),
      storage.read('users.json')
    ]);
    const myMemberships = memberships.filter(m => m.userId === req.user.userId);
    const myFlowIds = new Set(myMemberships.map(m => m.flowId));

    // Get parent flows (no parentFlowId) that user is member of
    const parentFlows = flows.filter(f => !f.parentFlowId && myFlowIds.has(f.id));

    const myFlows = parentFlows.map(f => {
      const mem = myMemberships.find(m => m.flowId === f.id);
      const memberCount = memberships.filter(m => m.flowId === f.id).length;
      // Get sub-flows for this parent
      const subFlows = flows
        .filter(sf => sf.parentFlowId === f.id)
        .map(sf => ({ ...sf, memberCount }));
      return {
        ...f,
        myRole: mem?.role || '',
        isOwner: mem?.isOwner || false,
        memberCount,
        subFlows
      };
    });
    res.json(myFlows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new flow
app.post('/api/flows', authMiddleware, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Flow name is required' });
    }
    if (name.trim().length > 50) {
      return res.status(400).json({ error: 'Flow name must be under 50 characters' });
    }

    const flows = await storage.read('flows.json');

    // Generate unique invite code
    let inviteCode;
    const existingCodes = new Set(flows.map(f => f.inviteCode));
    do {
      inviteCode = generateInviteCode();
    } while (existingCodes.has(inviteCode));

    const flow = {
      id: crypto.randomUUID(),
      name: name.trim(),
      icon: icon || '🏢',
      ownerId: req.user.userId,
      inviteCode,
      createdAt: new Date().toISOString()
    };

    flows.push(flow);
    await storage.write('flows.json', flows);

    // Auto-add creator as owner member
    const memberships = await storage.read('memberships.json');
    const membership = {
      id: crypto.randomUUID(),
      flowId: flow.id,
      userId: req.user.userId,
      role: 'Owner',
      isOwner: true,
      joinedAt: new Date().toISOString()
    };
    memberships.push(membership);
    await storage.write('memberships.json', memberships);

    res.status(201).json({ ...flow, myRole: 'Owner', isOwner: true, memberCount: 1 });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join a flow via invite code
app.post('/api/flows/join', authMiddleware, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const flows = await storage.read('flows.json');
    const flow = flows.find(f => f.inviteCode === inviteCode.trim().toUpperCase());
    if (!flow) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const memberships = await storage.read('memberships.json');
    const existing = memberships.find(m => m.flowId === flow.id && m.userId === req.user.userId);
    if (existing) {
      return res.status(409).json({ error: 'Already a member of this flow' });
    }

    const membership = {
      id: crypto.randomUUID(),
      flowId: flow.id,
      userId: req.user.userId,
      role: 'Member',
      isOwner: false,
      joinedAt: new Date().toISOString()
    };
    memberships.push(membership);
    await storage.write('memberships.json', memberships);

    const memberCount = memberships.filter(m => m.flowId === flow.id).length;

    // Broadcast to flow members that someone joined
    await broadcastToFlow(flow.id, {
      type: 'flow:memberJoined',
      flowId: flow.id,
      userId: req.user.userId,
      userName: req.user.name
    }, req.user.userId);

    // Notify flow about new member
    createNotification({ flowId: flow.id, type: 'member_joined', title: `${req.user.name} joined`, body: 'New member joined the flow', targetUserId: null, actorId: req.user.userId, actorName: req.user.name }).catch(() => {});

    res.status(201).json({ ...flow, myRole: 'Member', isOwner: false, memberCount });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get flow details
app.get('/api/flows/:flowId', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const flows = await storage.read('flows.json');
    const flow = flows.find(f => f.id === req.params.flowId);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    const memberships = await storage.read('memberships.json');
    const memberCount = memberships.filter(m => m.flowId === flow.id).length;

    res.json({
      ...flow,
      myRole: req.membership.role,
      isOwner: req.membership.isOwner,
      memberCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update flow (owner only)
app.put('/api/flows/:flowId', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    const flows = await storage.read('flows.json');
    const idx = flows.findIndex(f => f.id === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });

    if (req.body.name !== undefined) {
      if (!req.body.name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      flows[idx].name = req.body.name.trim();
    }
    if (req.body.icon !== undefined) flows[idx].icon = req.body.icon;

    await storage.write('flows.json', flows);

    await broadcastToFlow(req.params.flowId, {
      type: 'flow:updated',
      flowId: req.params.flowId,
      flow: flows[idx]
    });

    res.json(flows[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Regenerate invite code (owner only)
app.post('/api/flows/:flowId/invite-code', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    const flows = await storage.read('flows.json');
    const idx = flows.findIndex(f => f.id === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });

    const existingCodes = new Set(flows.map(f => f.inviteCode));
    let inviteCode;
    do {
      inviteCode = generateInviteCode();
    } while (existingCodes.has(inviteCode));

    flows[idx].inviteCode = inviteCode;
    await storage.write('flows.json', flows);
    res.json({ inviteCode });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete flow (owner only)
app.delete('/api/flows/:flowId', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    const flowId = req.params.flowId;

    // Remove flow and any sub-flows
    const flows = await storage.read('flows.json');
    const idx = flows.findIndex(f => f.id === flowId);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });
    
    // Get all sub-flow IDs to also delete their tasks
    const subFlowIds = flows.filter(f => f.parentFlowId === flowId).map(f => f.id);
    const allFlowIds = [flowId, ...subFlowIds];
    
    // Remove parent flow and all sub-flows
    const remainingFlows = flows.filter(f => f.id !== flowId && f.parentFlowId !== flowId);
    await storage.write('flows.json', remainingFlows);

    // Remove all memberships for this flow
    const memberships = await storage.read('memberships.json');
    const remaining = memberships.filter(m => m.flowId !== flowId);
    await storage.write('memberships.json', remaining);

    // Remove all tasks for this flow and its sub-flows
    const tasks = await storage.read('tasks.json');
    const remainingTasks = tasks.filter(t => !allFlowIds.includes(t.flowId) && !subFlowIds.includes(t.subFlowId));
    await storage.write('tasks.json', remainingTasks);

    await broadcastToFlow(flowId, { type: 'flow:deleted', flowId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave a flow (non-owners)
app.post('/api/flows/:flowId/leave', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    if (req.membership.isOwner) {
      return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the flow.' });
    }

    const memberships = await storage.read('memberships.json');
    const remaining = memberships.filter(m => !(m.flowId === req.params.flowId && m.userId === req.user.userId));
    await storage.write('memberships.json', remaining);

    await broadcastToFlow(req.params.flowId, {
      type: 'flow:memberLeft',
      flowId: req.params.flowId,
      userId: req.user.userId,
      userName: req.user.name
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SUB-FLOW ROUTES
// ═══════════════════════════════════════════════════════════════

// Get sub-flows of a flow
app.get('/api/flows/:flowId/subflows', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const flows = await storage.read('flows.json');
    const subFlows = flows.filter(f => f.parentFlowId === req.params.flowId);
    res.json(subFlows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a sub-flow (owner only)
app.post('/api/flows/:flowId/subflows', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const flows = await storage.read('flows.json');
    const parentFlow = flows.find(f => f.id === req.params.flowId);
    if (!parentFlow) {
      return res.status(404).json({ error: 'Parent flow not found' });
    }
    // Don't allow nested sub-flows (only one level)
    if (parentFlow.parentFlowId) {
      return res.status(400).json({ error: 'Cannot create sub-flow of a sub-flow' });
    }

    const subFlow = {
      id: crypto.randomUUID(),
      name: name.trim(),
      icon: icon || 'folder',
      parentFlowId: req.params.flowId,
      ownerId: parentFlow.ownerId,
      createdAt: new Date().toISOString()
    };

    flows.push(subFlow);
    await storage.write('flows.json', flows);

    await broadcastToFlow(req.params.flowId, {
      type: 'subflow:created',
      flowId: req.params.flowId,
      subFlow
    });

    res.status(201).json(subFlow);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a sub-flow (owner only)
app.patch('/api/flows/:flowId/subflows/:subFlowId', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    const { name, icon } = req.body;
    const flows = await storage.read('flows.json');
    const idx = flows.findIndex(f => f.id === req.params.subFlowId && f.parentFlowId === req.params.flowId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sub-flow not found' });
    }

    if (name !== undefined) flows[idx].name = name.trim();
    if (icon !== undefined) flows[idx].icon = icon;

    await storage.write('flows.json', flows);

    await broadcastToFlow(req.params.flowId, {
      type: 'subflow:updated',
      flowId: req.params.flowId,
      subFlow: flows[idx]
    });

    res.json(flows[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a sub-flow (owner only)
app.delete('/api/flows/:flowId/subflows/:subFlowId', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    const [flows, tasks] = await Promise.all([
      storage.read('flows.json'),
      storage.read('tasks.json')
    ]);

    const subFlow = flows.find(f => f.id === req.params.subFlowId && f.parentFlowId === req.params.flowId);
    if (!subFlow) {
      return res.status(404).json({ error: 'Sub-flow not found' });
    }

    // Remove subFlowId from tasks (move them back to parent flow)
    const updatedTasks = tasks.map(t => {
      if (t.subFlowId === req.params.subFlowId) {
        const { subFlowId, ...rest } = t;
        return rest;
      }
      return t;
    });

    const remainingFlows = flows.filter(f => f.id !== req.params.subFlowId);

    await Promise.all([
      storage.write('flows.json', remainingFlows),
      storage.write('tasks.json', updatedTasks)
    ]);

    await broadcastToFlow(req.params.flowId, {
      type: 'subflow:deleted',
      flowId: req.params.flowId,
      subFlowId: req.params.subFlowId
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FLOW MEMBER ROUTES
// ═══════════════════════════════════════════════════════════════

// Get all members of a flow
app.get('/api/flows/:flowId/members', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const [memberships, users] = await Promise.all([
      storage.read('memberships.json'),
      storage.read('users.json')
    ]);
    const flowMembers = memberships
      .filter(m => m.flowId === req.params.flowId)
      .map(m => {
        const user = users.find(u => u.id === m.userId);
        return {
          ...m,
          userName: user?.name || 'Unknown',
          avatarUrl: avatarUrlFromUser(user)
        };
      });
    res.json(flowMembers);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get presence/status for all flow members
app.get('/api/flows/:flowId/presence', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const [memberships, timelog] = await Promise.all([
      storage.read('memberships.json'),
      storage.read('timelog.json')
    ]);
    const flowMemberIds = memberships
      .filter(m => m.flowId === req.params.flowId)
      .map(m => m.userId);
    const onlineIds = getOnlineUserIds();
    const today = new Date().toISOString().slice(0, 10);

    const presence = flowMemberIds.map(userId => {
      const online = onlineIds.has(userId);
      const session = timelog.find(t => t.userId === userId && t.date === today && !t.clockOut);
      let workDuration = 0;
      if (session) {
        const clockIn = new Date(session.clockIn).getTime();
        const now = Date.now();
        const totalMs = now - clockIn;
        const breakMs = (session.breaks || []).reduce((sum, b) => {
          const end = b.end ? new Date(b.end).getTime() : now;
          return sum + (end - new Date(b.start).getTime());
        }, 0);
        workDuration = Math.floor((totalMs - breakMs) / 60000);
      }
      return {
        userId,
        online,
        status: session ? session.status : 'offline',
        location: session ? session.location : null,
        workDuration,
        currentTask: session?.currentTask || null
      };
    });
    res.json(presence);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a member's role (owner only, or self for role title only)
app.put('/api/flows/:flowId/members/:userId', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const memberships = await storage.read('memberships.json');
    const idx = memberships.findIndex(m => m.flowId === req.params.flowId && m.userId === req.params.userId);
    if (idx === -1) return res.status(404).json({ error: 'Member not found' });

    const isSelf = req.params.userId === req.user.userId;
    if (!req.membership.isOwner && !isSelf) {
      return res.status(403).json({ error: 'Only the flow owner or the member themselves can update roles' });
    }

    // Only owner can change isOwner (transfer ownership)
    if (req.body.isOwner !== undefined && req.membership.isOwner) {
      if (req.body.isOwner === true) {
        // Transfer ownership: make target owner, remove from current
        memberships[idx].isOwner = true;
        memberships[idx].role = 'Owner';
        const myIdx = memberships.findIndex(m => m.flowId === req.params.flowId && m.userId === req.user.userId);
        if (myIdx !== -1 && myIdx !== idx) {
          memberships[myIdx].isOwner = false;
          memberships[myIdx].role = 'Member';
        }
        // Update flow.ownerId too
        const flows = await storage.read('flows.json');
        const flowIdx = flows.findIndex(f => f.id === req.params.flowId);
        if (flowIdx !== -1) {
          flows[flowIdx].ownerId = req.params.userId;
          await storage.write('flows.json', flows);
        }
      }
    } else if (req.body.isOwner !== undefined && !req.membership.isOwner) {
      return res.status(403).json({ error: 'Only the owner can transfer ownership' });
    }

    if (req.body.role !== undefined) {
      // Non-owners can only change their own role title
      if (!req.membership.isOwner && !isSelf) {
        return res.status(403).json({ error: 'Only the owner can change other members\' roles' });
      }
      if (typeof req.body.role !== 'string' || req.body.role.length > 30) {
        return res.status(400).json({ error: 'Role must be a string under 30 characters' });
      }
      memberships[idx].role = req.body.role.trim();
    }

    await storage.write('memberships.json', memberships);

    const users = await storage.read('users.json');
    const user = users.find(u => u.id === req.params.userId);
    await broadcastToFlow(req.params.flowId, {
      type: 'flow:memberUpdated',
      flowId: req.params.flowId,
      membership: { ...memberships[idx], userName: user?.name, avatarUrl: avatarUrlFromUser(user) }
    });

    res.json(memberships[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kick a member (owner only)
app.delete('/api/flows/:flowId/members/:userId', authMiddleware, flowOwnerMiddleware, async (req, res) => {
  try {
    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot kick yourself. Use leave or delete the flow.' });
    }

    const memberships = await storage.read('memberships.json');
    const remaining = memberships.filter(m => !(m.flowId === req.params.flowId && m.userId === req.params.userId));
    if (remaining.length === memberships.length) {
      return res.status(404).json({ error: 'Member not found' });
    }
    await storage.write('memberships.json', remaining);

    // Notify the kicked user
    broadcastToUser(req.params.userId, {
      type: 'flow:kicked',
      flowId: req.params.flowId
    });

    await broadcastToFlow(req.params.flowId, {
      type: 'flow:memberLeft',
      flowId: req.params.flowId,
      userId: req.params.userId
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TASK ROUTES (flow-scoped)
// ═══════════════════════════════════════════════════════════════

function normalizeUserIdArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
}

function getTaskAssigneeIds(task) {
  if (Array.isArray(task.assignedToList) && task.assignedToList.length) {
    return normalizeUserIdArray(task.assignedToList);
  }
  return task.assignedTo ? [task.assignedTo] : [];
}

function getTaskOperatorIds(task) {
  return normalizeUserIdArray(task.operators);
}

function canUserReviewTask(task, userId) {
  if (!task || !userId) return false;
  return task.createdBy === userId || getTaskOperatorIds(task).includes(userId);
}

// ═══════════════════════════════════════════════════════════════
// STALE TASK DETECTION
// ═══════════════════════════════════════════════════════════════

const DEFAULT_STALE_THRESHOLDS = {
  'todo': 4320,
  'in-progress': 2880,
  'on-hold': 10080,
  'needs-info': 1440,
  'in-review': 2880
};

function computeStaleStatus(task, thresholds) {
  if (task.status === 'done') return { isStale: false, staleSince: null };
  const t = thresholds || DEFAULT_STALE_THRESHOLDS;
  const thresholdMinutes = t[task.status];
  if (!thresholdMinutes) return { isStale: false, staleSince: null };
  const lastActivity = task.lastActivityAt || task.updatedAt || task.createdAt;
  if (!lastActivity) return { isStale: false, staleSince: null };
  const lastMs = new Date(lastActivity).getTime();
  const staleAfterMs = lastMs + thresholdMinutes * 60000;
  const now = Date.now();
  if (now >= staleAfterMs) {
    return { isStale: true, staleSince: new Date(staleAfterMs).toISOString() };
  }
  return { isStale: false, staleSince: null };
}

function enrichTasksWithStale(tasks, thresholds) {
  return tasks.map(t => {
    const { isStale, staleSince } = computeStaleStatus(t, thresholds);
    return { ...t, isStale, staleSince };
  });
}

// Get tasks for a flow
app.get('/api/flows/:flowId/tasks', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    let filtered = tasks.filter(t => t.flowId === req.params.flowId);
    if (req.query.assignedTo) {
      filtered = filtered.filter(t => getTaskAssigneeIds(t).includes(req.query.assignedTo));
    }
    if (req.query.status) {
      filtered = filtered.filter(t => t.status === req.query.status);
    }
    if (req.query.category) {
      filtered = filtered.filter(t => t.category === req.query.category);
    }
    // Compute stale status for each task
    const config = await storage.readConfig();
    const thresholds = config.staleThresholds || DEFAULT_STALE_THRESHOLDS;
    res.json(enrichTasksWithStale(filtered, thresholds));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a task in a flow
app.post('/api/flows/:flowId/tasks', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { title, description, priority, deadline, assignedTo, assignedToList, operators, category, subFlowId, recurrenceRule } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Validate subFlowId if provided
    if (subFlowId) {
      const flows = await storage.read('flows.json');
      const subFlow = flows.find(f => f.id === subFlowId && f.parentFlowId === req.params.flowId);
      if (!subFlow) {
        return res.status(400).json({ error: 'Invalid sub-flow' });
      }
    }

    const assigneeIds = normalizeUserIdArray(
      Array.isArray(assignedToList)
        ? assignedToList
        : assignedTo
          ? [assignedTo]
          : []
    );
    if (assigneeIds.length === 0) {
      return res.status(400).json({ error: 'At least one assignee is required' });
    }
    const operatorIds = normalizeUserIdArray(operators);
    if (!operatorIds.includes(req.user.userId)) operatorIds.push(req.user.userId);

    const memberships = await storage.read('memberships.json');
    const flowMemberIds = new Set(memberships.filter(m => m.flowId === req.params.flowId).map(m => m.userId));

    for (const uid of assigneeIds) {
      if (!flowMemberIds.has(uid)) {
        return res.status(400).json({ error: 'Assignee is not a member of this flow' });
      }
    }
    for (const uid of operatorIds) {
      if (!flowMemberIds.has(uid)) {
        return res.status(400).json({ error: 'Operator is not a member of this flow' });
      }
    }

    const task = {
      id: crypto.randomUUID(),
      flowId: req.params.flowId,
      subFlowId: subFlowId || null,
      title: title.trim(),
      description: description || '',
      priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      status: 'todo',
      progress: 0,
      category: category || null,
      assignedTo: assigneeIds[0] || null,
      assignedToList: assigneeIds,
      operators: operatorIds,
      revisionRequested: false,
      createdBy: req.user.userId,
      deadline: deadline || null,
      notes: [],
      files: [],
      recurrenceRule: recurrenceRule || null,
      recurrenceSeriesId: recurrenceRule ? crypto.randomUUID() : null,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tasks = await storage.read('tasks.json');
    tasks.push(task);
    await storage.write('tasks.json', tasks);

    await broadcastToFlow(req.params.flowId, { type: 'task:created', payload: task });

    // Notify assignees (if assigned to someone else)
    for (const uid of getTaskAssigneeIds(task)) {
      if (uid && uid !== req.user.userId) {
        createNotification({ flowId: req.params.flowId, type: 'task_assigned', title: task.title, body: `${req.user.name} assigned you a task`, targetUserId: uid, actorId: req.user.userId, actorName: req.user.name, refId: task.id, refType: 'task' }).catch(() => {});
      }
    }
    // Notify flow about new task
    createNotification({ flowId: req.params.flowId, type: 'task_created', title: task.title, body: `${req.user.name} created a task`, targetUserId: null, actorId: req.user.userId, actorName: req.user.name, refId: task.id, refType: 'task' }).catch(() => {});

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a task
app.put('/api/flows/:flowId/tasks/:id', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id && t.flowId === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const task = tasks[idx];
    const oldStatus = tasks[idx].status;
    const oldAssignees = getTaskAssigneeIds(tasks[idx]);
    const allowed = ['title', 'description', 'priority', 'status',
      'category', 'assignedTo', 'deadline', 'subFlowId', 'recurrenceRule'];
    
    // Validate subFlowId if provided
    if (req.body.subFlowId !== undefined) {
      if (req.body.subFlowId !== null) {
        const flows = await storage.read('flows.json');
        const subFlow = flows.find(f => f.id === req.body.subFlowId && f.parentFlowId === req.params.flowId);
        if (!subFlow) {
          return res.status(400).json({ error: 'Invalid sub-flow' });
        }
      }
    }
    
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        tasks[idx][key] = req.body[key];
      }
    }
    // Single timestamp for all log entries in this request
    const _now = new Date().toISOString();
    // Log status transitions
    if (req.body.status !== undefined && req.body.status !== oldStatus) {
      if (!Array.isArray(tasks[idx].statusLog)) tasks[idx].statusLog = [];
      tasks[idx].statusLog.push({ from: oldStatus, to: req.body.status, at: _now, by: req.user.userId });
    }
    if (req.body.progress !== undefined) {
      const newProgress = Math.max(0, Math.min(100, parseInt(req.body.progress, 10) || 0));
      const serverOldProgress = task.progress ?? 0;
      // Trust the client's reported previous value when provided (covers cases where
      // the server already has the updated value from a prior request but never logged it).
      const fromProgress = req.body.fromProgress !== undefined
        ? Math.max(0, Math.min(100, parseInt(req.body.fromProgress, 10) || 0))
        : serverOldProgress;
      tasks[idx].progress = newProgress;
      if (fromProgress !== newProgress) {
        if (!Array.isArray(tasks[idx].progressLog)) tasks[idx].progressLog = [];
        tasks[idx].progressLog.push({ from: fromProgress, to: newProgress, at: _now, by: req.user.userId });
      }
    }

    // Multi-assignee / operator support (backward-compatible with assignedTo)
    if (req.body.assignedToList !== undefined || req.body.assignedTo !== undefined) {
      const nextAssignees = normalizeUserIdArray(
        req.body.assignedToList !== undefined
          ? req.body.assignedToList
          : (req.body.assignedTo ? [req.body.assignedTo] : [])
      );
      const memberships = await storage.read('memberships.json');
      const flowMemberIds = new Set(memberships.filter(m => m.flowId === req.params.flowId).map(m => m.userId));
      for (const uid of nextAssignees) {
        if (!flowMemberIds.has(uid)) {
          return res.status(400).json({ error: 'Assignee is not a member of this flow' });
        }
      }
      tasks[idx].assignedToList = nextAssignees;
      tasks[idx].assignedTo = nextAssignees[0] || null;
    }

    if (req.body.operators !== undefined) {
      const nextOperators = normalizeUserIdArray(req.body.operators);
      if (!nextOperators.includes(tasks[idx].createdBy)) nextOperators.push(tasks[idx].createdBy);
      const memberships = await storage.read('memberships.json');
      const flowMemberIds = new Set(memberships.filter(m => m.flowId === req.params.flowId).map(m => m.userId));
      for (const uid of nextOperators) {
        if (!flowMemberIds.has(uid)) {
          return res.status(400).json({ error: 'Operator is not a member of this flow' });
        }
      }
      tasks[idx].operators = nextOperators;
    }

    // Review workflow guardrails:
    // - Task creator and selected operators can approve/revise in review state.
    if (req.body.status !== undefined && req.body.status !== oldStatus) {
      const nextStatus = tasks[idx].status;
      if (oldStatus === 'in-review' && nextStatus === 'done' && !canUserReviewTask(tasks[idx], req.user.userId)) {
        return res.status(403).json({ error: 'Only task creator or operators can approve review' });
      }
      if (oldStatus === 'in-review' && nextStatus === 'todo' && !canUserReviewTask(tasks[idx], req.user.userId)) {
        return res.status(403).json({ error: 'Only task creator or operators can request revision' });
      }

      // Mark explicit revision request when reviewer sends review back to todo.
      if (oldStatus === 'in-review' && nextStatus === 'todo' && canUserReviewTask(tasks[idx], req.user.userId)) {
        tasks[idx].revisionRequested = true;
      }

      // Clear revision marker once task leaves todo or is done.
      if (nextStatus !== 'todo' || oldStatus === 'done') {
        tasks[idx].revisionRequested = false;
      }
    }

    tasks[idx].updatedAt = _now;

    // Update lastActivityAt on meaningful changes (status, progress, assignment, review)
    const meaningfulKeys = ['status', 'progress', 'assignedTo', 'assignedToList', 'operators'];
    if (meaningfulKeys.some(k => req.body[k] !== undefined)) {
      tasks[idx].lastActivityAt = tasks[idx].updatedAt;
    }

    await storage.write('tasks.json', tasks);
    await broadcastToFlow(req.params.flowId, { type: 'task:updated', payload: tasks[idx] });

    // Notify on status change
    const updTask = tasks[idx];
    if (req.body.status && req.body.status !== oldStatus) {
      const notifTargets = new Set([...getTaskAssigneeIds(updTask), updTask.createdBy].filter(id => id));
      for (const uid of notifTargets) {
        createNotification({ flowId: req.params.flowId, type: 'task_updated', title: updTask.title, body: `${req.user.name} changed status to ${req.body.status}`, targetUserId: uid, actorId: req.user.userId, actorName: req.user.name, refId: updTask.id, refType: 'task' }).catch(() => {});
      }

      if (req.body.status === 'needs-info' && updTask.createdBy && updTask.createdBy !== req.user.userId) {
        createNotification({ flowId: req.params.flowId, type: 'task_needs_info', title: updTask.title, body: `${req.user.name} needs more information`, targetUserId: updTask.createdBy, actorId: req.user.userId, actorName: req.user.name, refId: updTask.id, refType: 'task' }).catch(() => {});
      }
      if (req.body.status === 'in-review' && updTask.createdBy && updTask.createdBy !== req.user.userId) {
        createNotification({ flowId: req.params.flowId, type: 'task_review_pending', title: updTask.title, body: `${req.user.name} submitted this task for review`, targetUserId: updTask.createdBy, actorId: req.user.userId, actorName: req.user.name, refId: updTask.id, refType: 'task' }).catch(() => {});
      }
      if (oldStatus === 'in-review' && req.body.status === 'todo' && canUserReviewTask(updTask, req.user.userId)) {
        const decisionTargets = new Set([
          ...getTaskAssigneeIds(updTask),
          updTask.createdBy,
          ...getTaskOperatorIds(updTask),
          req.user.userId
        ].filter(id => id));
        for (const uid of decisionTargets) {
          createNotification({ flowId: req.params.flowId, type: 'task_revision_requested', title: updTask.title, body: `${req.user.name} requested a revision`, targetUserId: uid, actorId: req.user.userId, actorName: req.user.name, refId: updTask.id, refType: 'task' }).catch(() => {});
        }
      }
      if (oldStatus === 'in-review' && req.body.status === 'done' && canUserReviewTask(updTask, req.user.userId)) {
        const decisionTargets = new Set([
          ...getTaskAssigneeIds(updTask),
          updTask.createdBy,
          ...getTaskOperatorIds(updTask),
          req.user.userId
        ].filter(id => id));
        for (const uid of decisionTargets) {
          createNotification({ flowId: req.params.flowId, type: 'task_approved', title: updTask.title, body: `${req.user.name} approved this task`, targetUserId: uid, actorId: req.user.userId, actorName: req.user.name, refId: updTask.id, refType: 'task' }).catch(() => {});
        }
      }
    }
    // Notify on reassignment (new assignees only)
    if (req.body.assignedTo !== undefined || req.body.assignedToList !== undefined) {
      const newAssignees = new Set(getTaskAssigneeIds(updTask));
      for (const uid of newAssignees) {
        if (!oldAssignees.includes(uid) && uid !== req.user.userId) {
          createNotification({ flowId: req.params.flowId, type: 'task_assigned', title: updTask.title, body: `${req.user.name} assigned you this task`, targetUserId: uid, actorId: req.user.userId, actorName: req.user.name, refId: updTask.id, refType: 'task' }).catch(() => {});
        }
      }
    }

    res.json(tasks[idx]);
  } catch (err) {
    console.error('Task update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk update tasks
app.post('/api/flows/:flowId/tasks/bulk', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { taskIds, updates, addAssignee } = req.body;
    if (!Array.isArray(taskIds) || !taskIds.length) return res.status(400).json({ error: 'taskIds required' });
    if (taskIds.length > 100) return res.status(400).json({ error: 'Max 100 tasks per bulk operation' });

    const allowedFields = ['status', 'priority', 'category', 'deadline'];
    const tasks = await storage.read('tasks.json');
    const flowTasks = tasks.filter(t => t.flowId === req.params.flowId);
    const updated = [];

    for (const taskId of taskIds) {
      const idx = tasks.findIndex(t => t.id === taskId && t.flowId === req.params.flowId);
      if (idx === -1) continue;

      if (updates) {
        for (const key of allowedFields) {
          if (updates[key] !== undefined) {
            tasks[idx][key] = updates[key];
          }
        }
        // Review workflow: status changes
        if (updates.status !== undefined) {
          const oldStatus = tasks[idx].status;
          if (updates.status !== 'todo' || oldStatus === 'done') tasks[idx].revisionRequested = false;
          tasks[idx].lastActivityAt = new Date().toISOString();
        }
      }

      if (addAssignee) {
        const list = Array.isArray(tasks[idx].assignedToList) ? [...tasks[idx].assignedToList] : [];
        if (!list.includes(addAssignee)) {
          list.push(addAssignee);
          tasks[idx].assignedToList = list;
          tasks[idx].assignedTo = list[0] || null;
          tasks[idx].lastActivityAt = new Date().toISOString();
        }
      }

      tasks[idx].updatedAt = new Date().toISOString();
      updated.push(tasks[idx]);
    }

    await storage.write('tasks.json', tasks);

    // Broadcast each updated task
    for (const t of updated) {
      broadcastToFlow(req.params.flowId, { type: 'task:updated', payload: t }).catch(() => {});
    }

    res.json({ updated });
  } catch (err) {
    console.error('Bulk update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task
app.delete('/api/flows/:flowId/tasks/:id', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id && t.flowId === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    tasks.splice(idx, 1);
    await storage.write('tasks.json', tasks);
    await broadcastToFlow(req.params.flowId, { type: 'task:deleted', payload: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add note to a task
app.post('/api/flows/:flowId/tasks/:id/notes', authMiddleware, flowMemberMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id && t.flowId === req.params.flowId);
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
    tasks[idx].lastActivityAt = tasks[idx].updatedAt;

    await storage.write('tasks.json', tasks);
    await broadcastToFlow(req.params.flowId, { type: 'note:added', payload: { taskId: req.params.id, note } }, req.user.userId);

    // Notify task assignee/creator about the note
    const taskForNote = tasks[idx];
    const noteTargets = new Set([...getTaskAssigneeIds(taskForNote), taskForNote.createdBy].filter(id => id && id !== req.user.userId));
    for (const uid of noteTargets) {
      createNotification({ flowId: req.params.flowId, type: 'note_added', title: taskForNote.title, body: `${req.user.name} added a note`, targetUserId: uid, actorId: req.user.userId, actorName: req.user.name, refId: taskForNote.id, refType: 'task' }).catch(() => {});
    }

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload files to a task
app.post('/api/flows/:flowId/tasks/:id/files', authMiddleware, flowMemberMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.id && t.flowId === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const newFiles = (req.files || []).map(f => ({
      name: f.originalname,
      storedName: f.filename,
      size: f.size,
      type: f.mimetype
    }));

    if (!Array.isArray(tasks[idx].files)) tasks[idx].files = [];
    tasks[idx].files.push(...newFiles);
    tasks[idx].updatedAt = new Date().toISOString();

    await storage.write('tasks.json', tasks);
    await broadcastToFlow(req.params.flowId, { type: 'task:updated', payload: tasks[idx] });
    res.json(newFiles);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task file
app.delete('/api/flows/:flowId/tasks/:taskId/files/:storedName', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    const idx = tasks.findIndex(t => t.id === req.params.taskId && t.flowId === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });

    const fileIdx = (tasks[idx].files || []).findIndex(f => f.storedName === req.params.storedName);
    if (fileIdx === -1) return res.status(404).json({ error: 'File not found' });

    // Remove from task data
    const [removed] = tasks[idx].files.splice(fileIdx, 1);
    tasks[idx].updatedAt = new Date().toISOString();
    await storage.write('tasks.json', tasks);

    // Delete physical file
    const filePath = path.join(storage.getDataDir(), 'uploads', req.params.taskId, path.basename(removed.storedName));
    fs.unlink(filePath, () => {}); // best-effort delete

    await broadcastToFlow(req.params.flowId, { type: 'task:updated', payload: tasks[idx] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve task files (supports ?token= for img/a tags that can't send headers)
app.get('/api/files/:taskId/:filename', (req, res) => {
  // Accept auth from header OR query param
  const headerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = headerToken || req.query.token;
  if (!token || !sessions.get(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(storage.getDataDir(), 'uploads', req.params.taskId, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
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
// NOTIFICATION ROUTES (flow-scoped)
// ═══════════════════════════════════════════════════════════════

async function readArraySafe(filename) {
  try {
    const data = await storage.read(filename);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Helper: create and broadcast a notification
async function createNotification({ flowId, type, title, body, targetUserId, actorId, actorName, refId, refType }) {
  const notifications = await readArraySafe('notifications.json');

  // Prevent duplicates: if same type+refId+targetUserId exists and is unread, skip
  if (refId) {
    const existing = notifications.find(n =>
      n && !n.read && n.type === type && n.refId === refId &&
      n.targetUserId === targetUserId && n.flowId === flowId
    );
    if (existing) return existing;
  }

  const notif = {
    id: crypto.randomUUID(),
    flowId,
    type,           // 'task_created','task_updated','task_assigned','note_added','member_joined','member_left','info_request'
    title,
    body: body || '',
    targetUserId,   // who receives this (null = all flow members)
    actorId,
    actorName,
    refId: refId || null,   // e.g. task id
    refType: refType || null, // e.g. 'task'
    read: false,
    createdAt: new Date().toISOString()
  };
  notifications.push(notif);
  await storage.write('notifications.json', notifications);

  // Send via WS
  if (targetUserId) {
    broadcastToUser(targetUserId, { type: 'notification:new', payload: notif });
  } else {
    await broadcastToFlow(flowId, { type: 'notification:new', payload: notif }, actorId);
  }
  return notif;
}

// Get notifications for current user in a flow
app.get('/api/flows/:flowId/notifications', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const notifications = await readArraySafe('notifications.json');
    const mine = notifications
      .filter(n => n && typeof n === 'object')
      .filter(n => n.flowId === req.params.flowId && (n.targetUserId === req.user.userId || n.targetUserId === null))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Persistent creator alerts for unresolved "needs info" and "in review" tasks.
    // These should remain visible until creator responds by changing status.
    const tasks = await readArraySafe('tasks.json');
    const sticky = tasks
      .filter(t =>
        t.flowId === req.params.flowId &&
        t.createdBy === req.user.userId &&
        (t.status === 'needs-info' || t.status === 'in-review')
      )
      .map(t => ({
        id: `sticky:${t.status}:${t.id}`,
        flowId: req.params.flowId,
        type: t.status === 'needs-info' ? 'task_needs_info' : 'task_review_pending',
        title: t.title,
        body: t.status === 'needs-info' ? 'Needs more information' : 'Waiting for your review',
        targetUserId: req.user.userId,
        actorId: t.assignedTo,
        actorName: null,
        refId: t.id,
        refType: 'task',
        read: false,
        sticky: true,
        createdAt: t.updatedAt || t.createdAt || new Date().toISOString()
      }));

    const merged = [...sticky, ...mine]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    if (String(req.params.id).startsWith('sticky:')) {
      return res.json({ success: true, sticky: true });
    }
    const notifications = await readArraySafe('notifications.json');
    const notif = notifications.find(n => n && typeof n === 'object' && n.id === req.params.id && (n.targetUserId === req.user.userId || n.targetUserId === null));
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    notif.read = true;
    await storage.write('notifications.json', notifications);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read for user in a flow
app.put('/api/flows/:flowId/notifications/read-all', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const notifications = await readArraySafe('notifications.json');
    let count = 0;
    for (const n of notifications) {
      if (!n || typeof n !== 'object') continue;
      if (n.flowId === req.params.flowId && (n.targetUserId === req.user.userId || n.targetUserId === null) && !n.read) {
        n.read = true;
        count++;
      }
    }
    await storage.write('notifications.json', notifications);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CATEGORY ROUTES (flow-scoped)
// ═══════════════════════════════════════════════════════════════

app.get('/api/flows/:flowId/categories', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const categories = await storage.read('categories.json');
    const flowCats = categories.filter(c => c.flowId === req.params.flowId);
    res.json(flowCats);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/flows/:flowId/categories', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const categories = await storage.read('categories.json');
    const category = {
      id: crypto.randomUUID(),
      flowId: req.params.flowId,
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
// TASK TEMPLATES (flow-scoped)
// ═══════════════════════════════════════════════════════════════

// List templates
app.get('/api/flows/:flowId/templates', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const templates = await storage.read('templates.json');
    res.json(templates.filter(t => t.flowId === req.params.flowId));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create template
app.post('/api/flows/:flowId/templates', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { name, title, description, priority, category, assignedToList, operators, checklist } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Template name required' });
    const templates = await storage.read('templates.json');
    const template = {
      id: crypto.randomUUID(),
      flowId: req.params.flowId,
      name: name.trim(),
      title: (title || '').trim(),
      description: (description || '').trim(),
      priority: priority || 'medium',
      category: category || null,
      assignedToList: Array.isArray(assignedToList) ? assignedToList : [],
      operators: Array.isArray(operators) ? operators : [],
      checklist: Array.isArray(checklist) ? checklist.map(c => String(c).trim()).filter(Boolean) : [],
      createdBy: req.user.userId,
      createdAt: new Date().toISOString()
    };
    templates.push(template);
    await storage.write('templates.json', templates);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update template
app.put('/api/flows/:flowId/templates/:id', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const templates = await storage.read('templates.json');
    const idx = templates.findIndex(t => t.id === req.params.id && t.flowId === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Template not found' });
    const allowed = ['name', 'title', 'description', 'priority', 'category', 'assignedToList', 'operators', 'checklist'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) templates[idx][key] = req.body[key];
    }
    templates[idx].updatedAt = new Date().toISOString();
    await storage.write('templates.json', templates);
    res.json(templates[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete template
app.delete('/api/flows/:flowId/templates/:id', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const templates = await storage.read('templates.json');
    const idx = templates.findIndex(t => t.id === req.params.id && t.flowId === req.params.flowId);
    if (idx === -1) return res.status(404).json({ error: 'Template not found' });
    templates.splice(idx, 1);
    await storage.write('templates.json', templates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task from template
app.post('/api/flows/:flowId/templates/:id/use', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const templates = await storage.read('templates.json');
    const tpl = templates.find(t => t.id === req.params.id && t.flowId === req.params.flowId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const tasks = await storage.read('tasks.json');
    const title = (req.body.title || tpl.title || tpl.name).trim();
    if (!title) return res.status(400).json({ error: 'Task title required' });

    const assigneeList = req.body.assignedToList || tpl.assignedToList || [];
    const operatorList = req.body.operators || tpl.operators || [];
    // Ensure creator is always an operator
    if (!operatorList.includes(req.user.userId)) operatorList.push(req.user.userId);

    const task = {
      id: crypto.randomUUID(),
      flowId: req.params.flowId,
      subFlowId: req.body.subFlowId || null,
      title,
      description: req.body.description || tpl.description || '',
      priority: req.body.priority || tpl.priority || 'medium',
      status: 'todo',
      progress: 0,
      category: tpl.category || null,
      assignedTo: assigneeList[0] || null,
      assignedToList: assigneeList,
      operators: operatorList,
      revisionRequested: false,
      createdBy: req.user.userId,
      deadline: req.body.deadline || null,
      notes: [],
      files: [],
      templateId: tpl.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    // If template has checklist, add as first note
    if (tpl.checklist && tpl.checklist.length) {
      const checklistText = tpl.checklist.map(item => `- [ ] ${item}`).join('\n');
      task.notes.push({
        id: crypto.randomUUID(),
        text: checklistText,
        userId: req.user.userId,
        userName: req.user.name,
        files: [],
        createdAt: new Date().toISOString()
      });
    }
    tasks.push(task);
    await storage.write('tasks.json', tasks);
    await broadcastToFlow(req.params.flowId, { type: 'task:created', payload: task });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CHAT ROUTES (flow-scoped)
// ═══════════════════════════════════════════════════════════════

// Get conversations within a flow
app.get('/api/flows/:flowId/chat/conversations', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const [messages, users, memberships] = await Promise.all([
      storage.read('messages.json'),
      storage.read('users.json'),
      storage.read('memberships.json')
    ]);

    const userMap = new Map(users.map(u => [u.id, u]));
    const convMap = {};

    // Seed all flow members as potential conversations
    const flowMembers = memberships.filter(m => m.flowId === req.params.flowId && m.userId !== req.user.userId);
    for (const fm of flowMembers) {
      const user = userMap.get(fm.userId);
      if (!user) continue;
      convMap[fm.userId] = {
        userId: fm.userId,
        userName: user.name,
        userRole: fm.role,
        userAvatarUrl: avatarUrlFromUser(user),
        unread: 0,
        lastMessage: null
      };
    }

    // Count messages and unread within this flow
    for (const m of messages) {
      if (m.flowId !== req.params.flowId) continue;
      if (m.from !== req.user.userId && m.to !== req.user.userId) continue;
      const otherId = m.from === req.user.userId ? m.to : m.from;
      if (!convMap[otherId]) continue;
      if (!convMap[otherId].lastMessage || new Date(m.createdAt) > new Date(convMap[otherId].lastMessage.createdAt)) {
        convMap[otherId].lastMessage = m;
      }
      if (m.to === req.user.userId && !m.read) {
        convMap[otherId].unread = (convMap[otherId].unread || 0) + 1;
      }
    }

    const conversations = Object.values(convMap).sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (bt !== at) return bt - at;
      return (a.userName || '').localeCompare(b.userName || '');
    });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages with a user in a flow
app.get('/api/flows/:flowId/chat/:userId', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    // Verify the other user is also in the flow
    const memberships = await storage.read('memberships.json');
    const otherMember = memberships.find(m => m.flowId === req.params.flowId && m.userId === req.params.userId);
    if (!otherMember) {
      return res.status(403).json({ error: 'User is not in this flow' });
    }

    const messages = await storage.read('messages.json');
    const otherId = req.params.userId;
    let convo = messages.filter(m =>
      m.flowId === req.params.flowId && (
        (m.from === req.user.userId && m.to === otherId) ||
        (m.from === otherId && m.to === req.user.userId)
      )
    );
    convo.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

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

// Send a message in a flow
app.post('/api/flows/:flowId/chat/:userId', authMiddleware, flowMemberMiddleware, chatUpload.array('files', 5), async (req, res) => {
  try {
    // Verify the other user is also in the flow
    const memberships = await storage.read('memberships.json');
    const otherMember = memberships.find(m => m.flowId === req.params.flowId && m.userId === req.params.userId);
    if (!otherMember) {
      return res.status(403).json({ error: 'User is not in this flow' });
    }

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
      flowId: req.params.flowId,
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

    broadcastToUser(req.params.userId, {
      type: 'chat:message',
      flowId: req.params.flowId,
      message
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark messages as read
app.put('/api/flows/:flowId/chat/:userId/read', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const messages = await storage.read('messages.json');
    let updated = false;
    for (const m of messages) {
      if (m.flowId === req.params.flowId && m.from === req.params.userId && m.to === req.user.userId && !m.read) {
        m.read = true;
        m.readAt = new Date().toISOString();
        updated = true;
      }
    }
    if (updated) {
      await storage.write('messages.json', messages);
      broadcastToUser(req.params.userId, {
        type: 'chat:read',
        flowId: req.params.flowId,
        readBy: req.user.userId,
        readAt: new Date().toISOString()
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve chat files (supports ?token= for img/video tags that can't send headers)
app.get('/api/chat/files/:filename', (req, res) => {
  const headerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = headerToken || req.query.token;
  if (!token || !sessions.get(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(storage.getDataDir(), 'uploads', 'chat', safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(path.resolve(filePath));
});

// ═══════════════════════════════════════════════════════════════
// TIME TRACKING ROUTES
// ═══════════════════════════════════════════════════════════════

function broadcastTimeStatus(userId, session) {
  broadcast({
    type: 'time:status',
    userId,
    payload: session || null,
    at: new Date().toISOString()
  });
}

function normalizeTimeLocation(location) {
  if (location === null || location === undefined) return null;
  const raw = String(location).trim().toLowerCase();
  const folded = raw
    // Keep german umlauts predictable before stripping diacritics.
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Remove any remaining accents/diacritics.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove punctuation and separators.
    .replace(/[^a-z0-9]+/g, '');

  if (!folded) return null;

  // Office aliases
  if (folded === 'office' || folded === 'buero' || folded === 'buro' || folded.includes('office') || folded.includes('buro') || folded.includes('buero')) {
    return 'office';
  }

  // Home aliases
  if (folded === 'home' || folded === 'homeoffice' || folded.includes('home')) {
    return 'home';
  }

  // Field / on-the-go aliases (including Außeneinsatz variants)
  if (
    folded === 'field' ||
    folded === 'onthego' ||
    folded.includes('field') ||
    folded.includes('einsatz') ||
    folded.includes('aussen') ||
    folded.includes('ausen') ||
    folded.includes('onthego') ||
    folded.includes('driv')
  ) {
    return 'field';
  }

  return null;
}

app.post('/api/time/clock-in', authMiddleware, async (req, res) => {
  try {
    const normalizedLocation = normalizeTimeLocation(req.body?.location) || 'office';
    const timelog = await storage.read('timelog.json');
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
      location: normalizedLocation,
      status: 'working',
      currentTask: null,
      breaks: [],
      totalWorked: 0,
      lastHeartbeat: new Date().toISOString()
    };
    timelog.push(session);
    await storage.write('timelog.json', timelog);

    broadcastTimeStatus(req.user.userId, session);

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
    broadcastTimeStatus(req.user.userId, timelog[idx]);
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

    const activeBreak = timelog[idx].breaks.find(b => !b.end);
    if (activeBreak) {
      activeBreak.end = new Date().toISOString();
    }

    timelog[idx].status = 'working';
    timelog[idx].currentTask = taskId || null;
    timelog[idx].lastHeartbeat = new Date().toISOString();

    await storage.write('timelog.json', timelog);
    broadcastTimeStatus(req.user.userId, timelog[idx]);
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
    broadcastTimeStatus(req.user.userId, timelog[idx]);
    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/time/location', authMiddleware, async (req, res) => {
  try {
    const normalizedLocation = normalizeTimeLocation(req.body?.location);
    if (!normalizedLocation) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    const timelog = await storage.read('timelog.json');
    const today = new Date().toISOString().slice(0, 10);
    const idx = timelog.findIndex(t =>
      t.userId === req.user.userId && t.date === today && !t.clockOut
    );
    if (idx === -1) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    timelog[idx].location = normalizedLocation;
    timelog[idx].lastHeartbeat = new Date().toISOString();
    await storage.write('timelog.json', timelog);
    broadcastTimeStatus(req.user.userId, timelog[idx]);
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
    const mySession = timelog.find(t => t.userId === req.user.userId && t.date === today && !t.clockOut);
    res.json(mySession || null);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/time/sessions', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    const timelog = await storage.read('timelog.json');
    let filtered = timelog.filter(t => t.userId === req.user.userId);
    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.date.startsWith(prefix));
    }
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/time/report', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const month = Math.max(1, Math.min(12, parseInt(req.query.month || String(now.getMonth() + 1), 10)));
    const year = Math.max(2000, Math.min(2100, parseInt(req.query.year || String(now.getFullYear()), 10)));
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    // ── Load all data ──
    const [timelog, allTasks, allUsers, teams] = await Promise.all([
      storage.read('timelog.json'),
      storage.read('tasks.json'),
      storage.read('users.json'),
      storage.read('teams.json'),
    ]);

    const userId = req.user.userId;
    const user = allUsers.find(u => u.id === userId);

    const sessions = timelog
      .filter(t => t.userId === userId && typeof t.date === 'string' && t.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));

    // All sessions for the month (all users) for contribution %
    const allMonthSessions = timelog
      .filter(t => typeof t.date === 'string' && t.date.startsWith(prefix));

    const locationLabel = (loc) => {
      if (loc === 'home') return 'Home Office';
      if (loc === 'field') return 'On The Go';
      return 'Office';
    };

    const calcBreakMinutes = (session) => {
      const breaks = Array.isArray(session.breaks) ? session.breaks : [];
      const nowMs = Date.now();
      return Math.max(0, Math.round(breaks.reduce((sum, b) => {
        if (!b || !b.start) return sum;
        const startMs = new Date(b.start).getTime();
        const endMs = b.end ? new Date(b.end).getTime() : nowMs;
        if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return sum;
        return sum + (endMs - startMs);
      }, 0) / 60000));
    };

    const calcWorkedMinutes = (session) => {
      if (typeof session.totalWorked === 'number' && session.totalWorked >= 0) return Math.round(session.totalWorked);
      if (!session.clockIn) return 0;
      const inMs = new Date(session.clockIn).getTime();
      const outMs = session.clockOut ? new Date(session.clockOut).getTime() : Date.now();
      if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs < inMs) return 0;
      return Math.max(0, Math.round((outMs - inMs) / 60000) - calcBreakMinutes(session));
    };

    // ── Compute statistics ──
    const totalWorkedMinutes = sessions.reduce((sum, s) => sum + calcWorkedMinutes(s), 0);
    const totalBreakMinutes = sessions.reduce((sum, s) => sum + calcBreakMinutes(s), 0);
    const totalHours = (totalWorkedMinutes / 60).toFixed(1);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[month - 1];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const uniqueDays = new Set(sessions.map(s => s.date)).size;
    const avgPerDay = uniqueDays > 0 ? Math.round(totalWorkedMinutes / uniqueDays) : 0;

    // Team contribution %
    const totalTeamMinutes = allMonthSessions.reduce((sum, s) => sum + calcWorkedMinutes(s), 0);
    const contributionPct = totalTeamMinutes > 0 ? Math.round((totalWorkedMinutes / totalTeamMinutes) * 100) : 0;

    // Task statistics
    const myTasks = allTasks.filter(t =>
      t.assignedTo === userId || (Array.isArray(t.assignedToList) && t.assignedToList.includes(userId))
    );
    const completedTasks = myTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = myTasks.filter(t => t.status === 'in-progress').length;
    const inReviewTasks = myTasks.filter(t => t.status === 'in-review').length;
    const totalTasks = myTasks.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Location breakdown
    const locCounts = { office: 0, home: 0, field: 0 };
    const locMinutes = { office: 0, home: 0, field: 0 };
    for (const s of sessions) {
      const loc = s.location || 'office';
      locCounts[loc] = (locCounts[loc] || 0) + 1;
      locMinutes[loc] = (locMinutes[loc] || 0) + calcWorkedMinutes(s);
    }

    // Earliest clock-in & latest clock-out
    let earliestIn = null, latestOut = null;
    for (const s of sessions) {
      if (s.clockIn) {
        const h = new Date(s.clockIn).getHours() + new Date(s.clockIn).getMinutes() / 60;
        if (earliestIn === null || h < earliestIn) earliestIn = h;
      }
      if (s.clockOut) {
        const h = new Date(s.clockOut).getHours() + new Date(s.clockOut).getMinutes() / 60;
        if (latestOut === null || h > latestOut) latestOut = h;
      }
    }
    const fmtHourDec = (h) => {
      if (h === null) return '—';
      const hr = Math.floor(h);
      const mn = Math.round((h - hr) * 60);
      return `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    };

    // Longest session
    let longestSessionMins = 0;
    for (const s of sessions) {
      const w = calcWorkedMinutes(s);
      if (w > longestSessionMins) longestSessionMins = w;
    }

    // User initials for avatar
    const initials = (req.user.name || '??').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarBgColor = user && user.avatarConfig && user.avatarConfig.backgroundColor
      ? `#${user.avatarConfig.backgroundColor}` : '#A29BFE';

    // Fetch DiceBear avatar as PNG for embedding
    let avatarBuffer = null;
    const avatarUrl = user ? avatarUrlFromUser(user) : null;
    if (avatarUrl && avatarUrl.startsWith('https://')) {
      const pngUrl = avatarUrl.replace('/adventurer/svg?', '/adventurer/png?') + '&size=120';
      try {
        avatarBuffer = await new Promise((resolve, reject) => {
          const req = https.get(pngUrl, { timeout: 4000 }, (resp) => {
            if (resp.statusCode !== 200) return resolve(null);
            const chunks = [];
            resp.on('data', c => chunks.push(c));
            resp.on('end', () => resolve(Buffer.concat(chunks)));
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
        });
      } catch { avatarBuffer = null; }
    }

    const filename = `worktime-${req.user.name}-${year}-${String(month).padStart(2, '0')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // ── Brand Colors ──
    const C = {
      primary: '#6C5CE7', primaryDark: '#5A4BD1', primaryLight: '#A29BFE', primaryBg: '#F0EEFF',
      dark: '#1A1A2E', text: '#2D3436', textSecondary: '#636E72', textLight: '#B2BEC3',
      border: '#DFE6E9', white: '#FFFFFF', bg: '#FAFBFC',
      green: '#00B894', greenBg: '#E8F8F5', greenDark: '#00997A',
      orange: '#FDCB6E', orangeBg: '#FFF8E1',
      blue: '#0984E3', blueBg: '#E8F4FD',
      red: '#D63031', redBg: '#FDECEA',
      cyan: '#00CEC9', teal: '#00B894',
    };

    const PAGE_W = 595.28; // A4
    const PAGE_H = 841.89;
    const M = { top: 0, right: 40, bottom: 50, left: 40 };
    const CONTENT_W = PAGE_W - M.left - M.right;

    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    doc.pipe(res);

    // ── Helpers ──
    const fmtTime = (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const fmtDuration = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    const fmtDate = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00');
      return `${dayNames[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}`;
    };
    const roundedRect = (x, y, w, h, r, color) => {
      doc.save(); doc.roundedRect(x, y, w, h, r).fill(color); doc.restore();
    };
    const drawLine = (x1, y1, x2, y2, color, width) => {
      doc.save(); doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(width || 0.5).stroke(); doc.restore();
    };

    // ── Draw arc segment for donut chart ──
    const drawArc = (cx, cy, r, startAngle, endAngle, color, lineWidth) => {
      doc.save();
      const step = 0.02;
      doc.lineWidth(lineWidth || 8).strokeColor(color);
      doc.path(`M ${cx + r * Math.cos(startAngle)} ${cy + r * Math.sin(startAngle)}`);
      let p = `M ${cx + r * Math.cos(startAngle)} ${cy + r * Math.sin(startAngle)} `;
      for (let a = startAngle + step; a <= endAngle; a += step) {
        p += `L ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
      }
      p += `L ${cx + r * Math.cos(endAngle)} ${cy + r * Math.sin(endAngle)}`;
      doc.path(p).stroke();
      doc.restore();
    };

    // ── Small stat card ──
    const drawStatCard = (x, y, w, h, label, value, accent, bg) => {
      roundedRect(x, y, w, h, 6, bg);
      roundedRect(x, y, 3, h, 2, accent);
      doc.fontSize(6.5).fillColor(C.textSecondary).text(label.toUpperCase(), x + 12, y + 7, { width: w - 20 });
      doc.fontSize(13).fillColor(C.dark).text(value, x + 12, y + 19, { width: w - 20 });
    };

    // ══════════════════════════════════════════════════════════════
    // HEADER — compact with avatar
    // ══════════════════════════════════════════════════════════════
    const HEADER_H = 100;
    const drawPageHeader = (isFirst) => {
      // Dark gradient header
      doc.save();
      doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.dark);
      doc.rect(0, HEADER_H - 3, PAGE_W, 3).fill(C.primary);
      // Subtle pattern dots
      doc.opacity(0.03);
      for (let px = 0; px < PAGE_W; px += 20) {
        for (let py = 0; py < HEADER_H; py += 20) {
          doc.circle(px, py, 1).fill(C.white);
        }
      }
      doc.opacity(1);
      doc.restore();

      if (isFirst) {
        // Avatar circle (top-right)
        const avatarR = 28;
        const avatarX = PAGE_W - M.right - avatarR - 8;
        const avatarY = 40;
        doc.save();
        doc.circle(avatarX, avatarY, avatarR + 2).fill(C.primary);
        if (avatarBuffer && avatarBuffer.length > 100) {
          // Clip to circle and embed the actual avatar image
          doc.circle(avatarX, avatarY, avatarR).clip();
          doc.image(avatarBuffer, avatarX - avatarR, avatarY - avatarR, {
            width: avatarR * 2, height: avatarR * 2,
          });
        } else {
          // Fallback: colored circle with initials
          doc.circle(avatarX, avatarY, avatarR).fill(avatarBgColor);
          doc.fontSize(18).fillColor(C.dark)
            .text(initials, avatarX - avatarR, avatarY - 10, { width: avatarR * 2, align: 'center' });
        }
        doc.restore();

        // User name centered under avatar
        const nameW = 120;
        doc.fontSize(10).fillColor(C.white)
          .text(req.user.name, avatarX - nameW / 2, avatarY + avatarR + 5, { width: nameW, align: 'center' });

        // Logo + title
        doc.fontSize(7).fillColor(C.primaryLight).opacity(0.6)
          .text('T A S K F L O W', M.left, 14, { characterSpacing: 2 });
        doc.opacity(1);
        doc.fontSize(18).fillColor(C.white)
          .text('Performance Report', M.left, 28);
        doc.fontSize(11).fillColor(C.textLight)
          .text(`${monthName} ${year}`, M.left, 52);
        doc.fontSize(7).fillColor(C.textLight).opacity(0.5)
          .text(`Generated ${new Date().toISOString().slice(0, 10)}`, M.left, 68);
        doc.opacity(1);
      } else {
        doc.fontSize(7).fillColor(C.primaryLight).opacity(0.6)
          .text('T A S K F L O W', M.left, 20, { characterSpacing: 2 });
        doc.opacity(1);
        doc.fontSize(12).fillColor(C.white)
          .text(`${req.user.name} — ${monthName} ${year}`, M.left, 38);
        doc.fontSize(8).fillColor(C.textLight)
          .text('Performance Report (continued)', M.left, 56);
      }
    };

    // ══════════════════════════════════════════════════════════════
    // FOOTER
    // ══════════════════════════════════════════════════════════════
    const drawFooter = (pageNum, totalPages) => {
      const fy = PAGE_H - 32;
      drawLine(M.left, fy, PAGE_W - M.right, fy, C.border, 0.5);
      doc.fontSize(6.5).fillColor(C.textLight)
        .text('TaskFlow — Confidential', M.left, fy + 6);
      doc.fontSize(6.5).fillColor(C.textLight)
        .text(`Page ${pageNum} of ${totalPages}`, 0, fy + 6, { width: PAGE_W - M.right, align: 'right' });
    };

    // ══════════════════════════════════════════════════════════════
    // PAGE 1 — Statistics Dashboard
    // ══════════════════════════════════════════════════════════════
    drawPageHeader(true);
    let y = HEADER_H + 16;

    // ── Section: Key Metrics (6 cards in 2 rows of 3) ──
    doc.fontSize(8).fillColor(C.primary).text('KEY METRICS', M.left, y, { characterSpacing: 1.5 });
    y += 14;
    drawLine(M.left, y, M.left + 60, y, C.primary, 1.5);
    y += 8;

    const cW = (CONTENT_W - 16) / 3;
    const cH = 40;
    drawStatCard(M.left, y, cW, cH, 'Total Hours', `${totalHours}h`, C.primary, C.primaryBg);
    drawStatCard(M.left + cW + 8, y, cW, cH, 'Sessions', `${sessions.length}`, C.green, C.greenBg);
    drawStatCard(M.left + (cW + 8) * 2, y, cW, cH, 'Days Worked', `${uniqueDays}`, C.blue, C.blueBg);
    y += cH + 8;

    drawStatCard(M.left, y, cW, cH, 'Avg / Day', fmtDuration(avgPerDay), C.cyan, C.blueBg);
    drawStatCard(M.left + cW + 8, y, cW, cH, 'Total Breaks', fmtDuration(totalBreakMinutes), C.orange, C.orangeBg);
    drawStatCard(M.left + (cW + 8) * 2, y, cW, cH, 'Longest Session', fmtDuration(longestSessionMins), C.red, C.redBg);
    y += cH + 16;

    // ── Section: Performance & Contribution ──
    doc.fontSize(8).fillColor(C.primary).text('PERFORMANCE & CONTRIBUTION', M.left, y, { characterSpacing: 1.5 });
    y += 14;
    drawLine(M.left, y, M.left + 120, y, C.primary, 1.5);
    y += 10;

    // Left: contribution donut + stats
    const panelW = (CONTENT_W - 12) / 2;
    roundedRect(M.left, y, panelW, 110, 6, C.bg);
    // Donut chart for contribution
    const donutCx = M.left + 55;
    const donutCy = y + 55;
    const donutR = 32;
    // Background ring
    doc.save();
    doc.circle(donutCx, donutCy, donutR).lineWidth(10).strokeColor(C.border).stroke();
    doc.restore();
    // Filled arc
    if (contributionPct > 0) {
      const endAngle = -Math.PI / 2 + (contributionPct / 100) * Math.PI * 2;
      drawArc(donutCx, donutCy, donutR, -Math.PI / 2, endAngle, C.primary, 10);
    }
    // Center text
    doc.fontSize(16).fillColor(C.dark)
      .text(`${contributionPct}%`, donutCx - 22, donutCy - 10, { width: 44, align: 'center' });
    doc.fontSize(6).fillColor(C.textSecondary)
      .text('CONTRIB.', donutCx - 22, donutCy + 8, { width: 44, align: 'center' });

    // Stats next to donut
    const sx = M.left + 110;
    doc.fontSize(7).fillColor(C.textSecondary).text('SCHEDULE', sx, y + 14);
    doc.fontSize(8.5).fillColor(C.dark).text(`Earliest In: ${fmtHourDec(earliestIn)}`, sx, y + 26);
    doc.fontSize(8.5).fillColor(C.dark).text(`Latest Out: ${fmtHourDec(latestOut)}`, sx, y + 40);
    doc.fontSize(7).fillColor(C.textSecondary).text('EFFICIENCY', sx, y + 60);
    const netEfficiency = totalWorkedMinutes + totalBreakMinutes > 0
      ? Math.round((totalWorkedMinutes / (totalWorkedMinutes + totalBreakMinutes)) * 100) : 0;
    doc.fontSize(8.5).fillColor(C.dark).text(`Net Efficiency: ${netEfficiency}%`, sx, y + 72);
    doc.fontSize(8.5).fillColor(C.dark).text(`Break Ratio: ${100 - netEfficiency}%`, sx, y + 86);

    // Right: task stats panel
    roundedRect(M.left + panelW + 12, y, panelW, 110, 6, C.bg);
    const tx = M.left + panelW + 24;
    doc.fontSize(7).fillColor(C.textSecondary).text('TASK OVERVIEW', tx, y + 14);

    // Task progress bar
    const barX = tx;
    const barY = y + 30;
    const barW = panelW - 28;
    const barH = 10;
    roundedRect(barX, barY, barW, barH, 4, C.border);
    if (totalTasks > 0) {
      const doneW = Math.max(0, (completedTasks / totalTasks) * barW);
      const ipW = Math.max(0, (inProgressTasks / totalTasks) * barW);
      const irW = Math.max(0, (inReviewTasks / totalTasks) * barW);
      if (doneW > 0) roundedRect(barX, barY, Math.min(doneW, barW), barH, 4, C.green);
      if (ipW > 0) doc.save(), doc.rect(barX + doneW, barY, ipW, barH).fill(C.blue), doc.restore();
      if (irW > 0) doc.save(), doc.rect(barX + doneW + ipW, barY, irW, barH).fill(C.orange), doc.restore();
    }

    doc.fontSize(8.5).fillColor(C.dark).text(`Total Tasks: ${totalTasks}`, tx, barY + 16);
    doc.fontSize(8).fillColor(C.green).text(`${completedTasks} Done`, tx, barY + 30);
    doc.fontSize(8).fillColor(C.blue).text(`${inProgressTasks} In Progress`, tx + 55, barY + 30);
    doc.fontSize(8).fillColor(C.orange).text(`${inReviewTasks} Review`, tx + 130, barY + 30);
    doc.fontSize(8.5).fillColor(C.dark).text(`Completion Rate: ${taskCompletionRate}%`, tx, barY + 48);
    // Small completion indicator
    roundedRect(tx + 120, barY + 46, 40, 12, 4, taskCompletionRate >= 75 ? C.greenBg : taskCompletionRate >= 50 ? C.orangeBg : C.redBg);
    doc.fontSize(7).fillColor(taskCompletionRate >= 75 ? C.green : taskCompletionRate >= 50 ? C.orange : C.red)
      .text(taskCompletionRate >= 75 ? 'GREAT' : taskCompletionRate >= 50 ? 'OK' : 'LOW',
        tx + 120, barY + 48, { width: 40, align: 'center' });

    y += 120;

    // ── Section: Location Breakdown ──
    doc.fontSize(8).fillColor(C.primary).text('LOCATION BREAKDOWN', M.left, y, { characterSpacing: 1.5 });
    y += 14;
    drawLine(M.left, y, M.left + 90, y, C.primary, 1.5);
    y += 8;

    const locData = [
      { key: 'office', label: 'Office', color: C.blue, bg: C.blueBg, count: locCounts.office, mins: locMinutes.office },
      { key: 'home', label: 'Home Office', color: C.green, bg: C.greenBg, count: locCounts.home, mins: locMinutes.home },
      { key: 'field', label: 'On The Go', color: C.orange, bg: C.orangeBg, count: locCounts.field, mins: locMinutes.field },
    ];
    const locBarW = CONTENT_W;
    for (const loc of locData) {
      const pct = sessions.length > 0 ? Math.round((loc.count / sessions.length) * 100) : 0;
      roundedRect(M.left, y, locBarW, 22, 4, loc.bg);
      roundedRect(M.left, y, 3, 22, 2, loc.color);
      doc.fontSize(7.5).fillColor(C.dark).text(loc.label, M.left + 12, y + 6);
      doc.fontSize(7).fillColor(C.textSecondary).text(`${loc.count} sessions`, M.left + 100, y + 7);
      doc.fontSize(7).fillColor(C.textSecondary).text(fmtDuration(loc.mins), M.left + 180, y + 7);
      // Mini bar
      const miniBarW = 150;
      const miniBarX = M.left + locBarW - miniBarW - 50;
      roundedRect(miniBarX, y + 7, miniBarW, 8, 3, C.border);
      if (pct > 0) roundedRect(miniBarX, y + 7, Math.max(4, (pct / 100) * miniBarW), 8, 3, loc.color);
      doc.fontSize(7).fillColor(loc.color).text(`${pct}%`, M.left + locBarW - 42, y + 6, { width: 34, align: 'right' });
      y += 26;
    }
    y += 8;

    // ── Section: Daily Hours Bar Chart ──
    if (sessions.length > 0) {
      doc.fontSize(8).fillColor(C.primary).text('DAILY HOURS', M.left, y, { characterSpacing: 1.5 });
      y += 14;
      drawLine(M.left, y, M.left + 60, y, C.primary, 1.5);
      y += 8;

      const daysMap = new Map();
      for (const s of sessions) {
        const prev = daysMap.get(s.date) || 0;
        daysMap.set(s.date, prev + calcWorkedMinutes(s));
      }
      const maxMins = Math.max(...daysMap.values(), 1);
      const chartBarMaxW = CONTENT_W - 100;

      for (const [dateStr, mins] of daysMap) {
        if (y + 16 > PAGE_H - M.bottom - 20) break; // Don't overflow page 1
        const barW = Math.max(3, (mins / maxMins) * chartBarMaxW);
        const d = new Date(dateStr + 'T00:00:00');
        const dayLabel = `${dayNames[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;

        doc.fontSize(7).fillColor(C.textSecondary)
          .text(dayLabel, M.left, y + 2, { width: 40, align: 'right' });
        roundedRect(M.left + 50, y, barW, 12, 3, C.primary);
        doc.fontSize(6.5).fillColor(barW > 50 ? C.white : C.text)
          .text(fmtDuration(mins), barW > 50 ? M.left + 54 : M.left + 54 + barW + 4, y + 2, { width: 50 });
        y += 16;
      }
      y += 8;
    }

    // ══════════════════════════════════════════════════════════════
    // PAGE 2 — Session Log Table (if sessions exist)
    // ══════════════════════════════════════════════════════════════
    if (sessions.length > 0) {
      doc.addPage();
      drawPageHeader(false);
      y = HEADER_H + 16;

      doc.fontSize(8).fillColor(C.primary).text('SESSION LOG', M.left, y, { characterSpacing: 1.5 });
      y += 14;
      drawLine(M.left, y, M.left + 60, y, C.primary, 1.5);
      y += 8;

      // Table columns
      const colX = {
        date: M.left,
        location: M.left + 110,
        clockIn: M.left + 210,
        clockOut: M.left + 275,
        worked: M.left + 345,
        breaks: M.left + 415,
        pct: M.left + 465,
      };
      const rowH = 22;

      const drawTableHeader = () => {
        roundedRect(M.left, y, CONTENT_W, 20, 4, C.dark);
        doc.fontSize(6.5).fillColor(C.white);
        doc.text('DATE', colX.date + 8, y + 6, { width: 100 });
        doc.text('LOCATION', colX.location + 4, y + 6, { width: 96 });
        doc.text('IN', colX.clockIn + 4, y + 6, { width: 60 });
        doc.text('OUT', colX.clockOut + 4, y + 6, { width: 65 });
        doc.text('WORKED', colX.worked + 4, y + 6, { width: 66 });
        doc.text('BREAKS', colX.breaks + 4, y + 6, { width: 46 });
        doc.text('%', colX.pct + 4, y + 6, { width: 30 });
        y += 22;
      };

      drawTableHeader();

      for (let i = 0; i < sessions.length; i++) {
        if (y + rowH > PAGE_H - M.bottom - 10) {
          doc.addPage();
          drawPageHeader(false);
          y = HEADER_H + 16;
          doc.fontSize(7).fillColor(C.textSecondary).text('SESSION LOG (continued)', M.left, y);
          y += 14;
          drawTableHeader();
        }

        const s = sessions[i];
        const worked = calcWorkedMinutes(s);
        const brk = calcBreakMinutes(s);
        const sessionPct = totalWorkedMinutes > 0 ? Math.round((worked / totalWorkedMinutes) * 100) : 0;
        const isEven = i % 2 === 0;

        if (isEven) roundedRect(M.left, y, CONTENT_W, rowH, 2, C.bg);

        const ty = y + 6;
        doc.fontSize(7.5).fillColor(C.dark).text(fmtDate(s.date), colX.date + 8, ty, { width: 100 });
        doc.fontSize(7).fillColor(C.textSecondary).text(locationLabel(s.location), colX.location + 4, ty, { width: 96 });
        doc.fontSize(7.5).fillColor(C.dark).text(fmtTime(s.clockIn), colX.clockIn + 4, ty, { width: 60 });
        const isActive = !s.clockOut;
        doc.fontSize(7.5).fillColor(isActive ? C.green : C.dark)
          .text(isActive ? 'Active' : fmtTime(s.clockOut), colX.clockOut + 4, ty, { width: 65 });
        doc.fontSize(7.5).fillColor(C.primary).text(fmtDuration(worked), colX.worked + 4, ty, { width: 66 });
        doc.fontSize(7).fillColor(brk > 0 ? C.orange : C.textLight)
          .text(brk > 0 ? fmtDuration(brk) : '—', colX.breaks + 4, ty, { width: 46 });
        doc.fontSize(7).fillColor(C.textSecondary).text(`${sessionPct}%`, colX.pct + 4, ty, { width: 30 });

        y += rowH;
      }

      // Totals row
      y += 4;
      roundedRect(M.left, y, CONTENT_W, 24, 4, C.primaryBg);
      roundedRect(M.left, y, 3, 24, 2, C.primary);
      doc.fontSize(7.5).fillColor(C.textSecondary).text('TOTALS', colX.date + 10, y + 7);
      doc.fontSize(8).fillColor(C.primary).text(fmtDuration(totalWorkedMinutes), colX.worked + 4, y + 7, { width: 66 });
      doc.fontSize(7.5).fillColor(C.orange).text(fmtDuration(totalBreakMinutes), colX.breaks + 4, y + 7, { width: 46 });
      doc.fontSize(7.5).fillColor(C.textSecondary).text('100%', colX.pct + 4, y + 7, { width: 30 });
    }

    // ── Add footers to all pages ──
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(i + 1, totalPages);
    }

    doc.end();
  } catch (err) {
    console.error('PDF report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    res.json(users.map(u => ({ id: u.id, name: u.name, createdAt: u.createdAt })));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }
    const users = await storage.read('users.json');
    if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await storage.write('users.json', users);
    res.status(201).json({ id: user.id, name: user.name, createdAt: user.createdAt });
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
    if (req.body.password) {
      users[idx].password = await bcrypt.hash(req.body.password, 10);
    }

    await storage.write('users.json', users);
    res.json({ id: users[idx].id, name: users[idx].name });
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
    for (const [token, session] of sessions.entries()) {
      if (session.userId === req.params.id) sessions.delete(token);
    }
    await saveSessions();
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
    const flowId = tasks[idx].flowId;
    tasks.splice(idx, 1);
    await storage.write('tasks.json', tasks);
    if (flowId) {
      await broadcastToFlow(flowId, { type: 'task:deleted', payload: { id: req.params.id } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/flows', adminAuth, async (req, res) => {
  try {
    const [flows, memberships] = await Promise.all([
      storage.read('flows.json'),
      storage.read('memberships.json')
    ]);
    const result = flows.map(f => ({
      ...f,
      memberCount: memberships.filter(m => m.flowId === f.id).length
    }));
    res.json(result);
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

app.get('/api/admin/export/all', adminAuth, async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="taskflow-backup.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    const dataDir = storage.getDataDir();
    const files = ['users.json', 'tasks.json', 'flows.json', 'memberships.json',
      'timelog.json', 'categories.json', 'config.json', 'messages.json'];
    for (const f of files) {
      const fp = path.join(dataDir, f);
      if (fs.existsSync(fp)) archive.file(fp, { name: f });
    }
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
    const allowed = ['users.json', 'tasks.json', 'flows.json', 'memberships.json',
      'timelog.json', 'categories.json', 'config.json', 'messages.json'];
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

app.post('/api/admin/import/:file', adminAuth, async (req, res) => {
  try {
    const allowed = ['users.json', 'tasks.json', 'flows.json', 'memberships.json',
      'timelog.json', 'categories.json', 'config.json', 'messages.json'];
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
    const files = ['users.json', 'tasks.json', 'flows.json', 'memberships.json',
      'timelog.json', 'categories.json', 'config.json', 'messages.json'];
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

// Wipe all data
app.delete('/api/admin/wipe', adminAuth, async (req, res) => {
  try {
    const dataFiles = ['users.json', 'tasks.json', 'flows.json', 'memberships.json',
      'timelog.json', 'categories.json', 'messages.json', 'notifications.json',
      'sessions.json', 'teams.json', 'requests.json'];
    for (const f of dataFiles) {
      await storage.write(f, []);
    }
    await storage.write('config.json', { allowSignup: true, maintenanceMode: false, maxFileSize: 10 });
    // Clear uploads directory
    const uploadsDir = path.join(storage.getDataDir(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // Clear in-memory sessions
    sessions.clear();
    adminSessions.clear();
    res.json({ success: true });
  } catch (err) {
    console.error('Wipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROOT REDIRECTS
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.redirect('/app');
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════
// PERIODIC STALE TASK CHECKER
// ═══════════════════════════════════════════════════════════════

async function checkStaleTasks() {
  try {
    const config = await storage.readConfig();
    const thresholds = config.staleThresholds || DEFAULT_STALE_THRESHOLDS;
    const tasks = await storage.read('tasks.json');
    const notifications = await readArraySafe('notifications.json');

    for (const task of tasks) {
      if (task.status === 'done') continue;
      const { isStale } = computeStaleStatus(task, thresholds);
      if (!isStale) continue;

      // Check if we already sent a stale notification for this task (unread)
      const alreadyNotified = notifications.find(n =>
        n && !n.read && n.type === 'task_stale' && n.refId === task.id
      );
      if (alreadyNotified) continue;

      // Send stale notification to all assignees and creator
      const targets = new Set([
        ...getTaskAssigneeIds(task),
        task.createdBy
      ].filter(Boolean));

      for (const uid of targets) {
        createNotification({
          flowId: task.flowId,
          type: 'task_stale',
          title: task.title,
          body: 'This task has had no activity and may need attention',
          targetUserId: uid,
          actorId: null,
          actorName: 'System',
          refId: task.id,
          refType: 'task'
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Stale check error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// PERIODIC DEADLINE REMINDER CHECKER
// ═══════════════════════════════════════════════════════════════

const DEFAULT_REMINDER_HOURS = [24, 48]; // remind 24h and 48h before deadline

async function checkDeadlineReminders() {
  try {
    const config = await storage.readConfig();
    const reminderHours = config.reminderHours || DEFAULT_REMINDER_HOURS;
    const tasks = await storage.read('tasks.json');
    const notifications = await readArraySafe('notifications.json');
    const now = Date.now();

    for (const task of tasks) {
      if (task.status === 'done' || !task.deadline) continue;

      const deadlineMs = new Date(task.deadline).getTime();
      if (deadlineMs <= now) continue; // already past

      const hoursUntil = (deadlineMs - now) / (1000 * 60 * 60);

      for (const threshold of reminderHours) {
        if (hoursUntil > threshold) continue;

        // Check if we already sent this reminder threshold
        const reminderId = `deadline_${task.id}_${threshold}h`;
        const alreadyNotified = notifications.find(n =>
          n && n.type === 'deadline_reminder' && n.refId === task.id &&
          n.body && n.body.includes(`${threshold}h`)
        );
        if (alreadyNotified) continue;

        const targets = new Set([
          ...getTaskAssigneeIds(task),
          task.createdBy
        ].filter(Boolean));

        for (const uid of targets) {
          createNotification({
            flowId: task.flowId,
            type: 'deadline_reminder',
            title: task.title,
            body: `Deadline in ${threshold}h — ${task.deadline.slice(0, 10)}`,
            targetUserId: uid,
            actorId: null,
            actorName: 'System',
            refId: task.id,
            refType: 'task'
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Deadline reminder check error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// RECURRING TASKS
// ═══════════════════════════════════════════════════════════════

function computeNextOccurrence(rule, fromDateStr) {
  const from = new Date(fromDateStr);
  const type = rule.type; // daily, weekdays, weekly, monthly, custom
  const interval = rule.interval || 1;
  const next = new Date(from);

  switch (type) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekdays': {
      let added = 0;
      while (added < interval) {
        next.setDate(next.getDate() + 1);
        const dow = next.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      break;
    }
    case 'weekly':
      next.setDate(next.getDate() + 7 * interval);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'custom':
      next.setDate(next.getDate() + (rule.customDays || 7));
      break;
    default:
      return null;
  }
  return next;
}

function shouldCreateOccurrence(rule, task) {
  // Only recurring tasks in done status trigger next occurrence
  if (task.status !== 'done') return false;
  if (!rule) return false;
  // Check end condition
  if (rule.endDate && new Date() > new Date(rule.endDate)) return false;
  if (rule.endCount !== undefined && rule.endCount !== null) {
    // Count based on recurrenceSeriesId
    return true; // count check done in scheduler
  }
  return true;
}

async function checkRecurringTasks() {
  try {
    const tasks = await storage.read('tasks.json');
    const newTasks = [];

    for (const task of tasks) {
      if (!task.recurrenceRule || task.status !== 'done') continue;
      if (task._recurrenceSpawned) continue; // already spawned next

      const rule = task.recurrenceRule;
      if (!shouldCreateOccurrence(rule, task)) continue;

      // Count check
      if (rule.endCount !== undefined && rule.endCount !== null) {
        const seriesCount = tasks.filter(t => t.recurrenceSeriesId === task.recurrenceSeriesId).length;
        if (seriesCount >= rule.endCount) continue;
      }

      // Compute next deadline
      const baseDate = task.deadline || task.updatedAt || task.createdAt;
      const nextDate = computeNextOccurrence(rule, baseDate);
      if (!nextDate) continue;

      // Create the next task
      const newTask = {
        id: crypto.randomUUID(),
        flowId: task.flowId,
        subFlowId: task.subFlowId || null,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: 'todo',
        progress: 0,
        category: task.category || null,
        assignedTo: task.assignedTo,
        assignedToList: task.assignedToList || [],
        operators: task.operators || [],
        revisionRequested: false,
        createdBy: task.createdBy,
        deadline: nextDate.toISOString(),
        notes: [],
        files: [],
        recurrenceRule: rule,
        recurrenceSeriesId: task.recurrenceSeriesId,
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      newTasks.push(newTask);
      task._recurrenceSpawned = true; // Mark to avoid duplicates
    }

    if (newTasks.length > 0) {
      tasks.push(...newTasks);
      await storage.write('tasks.json', tasks);
      for (const t of newTasks) {
        broadcastToFlow(t.flowId, { type: 'task:created', payload: t }).catch(() => {});
      }
      console.log(`[Recurrence] Created ${newTasks.length} recurring task(s)`);
    }
  } catch (err) {
    console.error('Recurring task check error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════

async function start() {
  const dataDir = storage.getDataDir();
  console.log(`[Startup] DATA_DIR = ${dataDir}`);
  console.log(`[Startup] DATA_DIR env = ${process.env.DATA_DIR || '(not set, using default ./data)'}`);

  await storage.ensureDataDir();

  // Check if data files exist (persistence verification)
  const dataFiles = ['users.json', 'tasks.json', 'teams.json', 'sessions.json'];
  for (const f of dataFiles) {
    const fp = path.join(dataDir, f);
    try {
      const stat = fs.statSync(fp);
      console.log(`[Startup] ${f}: ${stat.size} bytes`);
    } catch {
      console.log(`[Startup] ${f}: not found (will be created on first use)`);
    }
  }

  await loadSessions();

  // Run stale task check every 5 minutes
  setInterval(checkStaleTasks, 5 * 60 * 1000);
  // Run deadline reminder check every 15 minutes
  setInterval(checkDeadlineReminders, 15 * 60 * 1000);
  // Run recurring task check every 10 minutes
  setInterval(checkRecurringTasks, 10 * 60 * 1000);
  // Initial checks after 30 seconds (let server stabilize first)
  setTimeout(checkStaleTasks, 30000);
  setTimeout(checkDeadlineReminders, 35000);
  setTimeout(checkRecurringTasks, 40000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TaskFlow running on port ${PORT}`);
    console.log(`  Data:   ${dataDir}`);
    console.log(`  App:    http://localhost:${PORT}/app`);
    console.log(`  Admin:  http://localhost:${PORT}/admin`);
    console.log(`  Sessions loaded: ${sessions.size}`);
  });
}

// Graceful shutdown for Railway deployments
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    // Close all WebSocket connections
    wss.clients.forEach(client => client.close());
    // Save sessions to disk before exit
    try { await saveSessions(); } catch (e) { /* best effort */ }
    console.log('Cleanup complete. Exiting.');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
