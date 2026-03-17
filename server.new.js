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
    const myFlows = flows.filter(f => myFlowIds.has(f.id)).map(f => {
      const mem = myMemberships.find(m => m.flowId === f.id);
      const memberCount = memberships.filter(m => m.flowId === f.id).length;
      return {
        ...f,
        myRole: mem?.role || '',
        isOwner: mem?.isOwner || false,
        memberCount
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

    // Remove flow
    const flows = await storage.read('flows.json');
    const idx = flows.findIndex(f => f.id === flowId);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });
    flows.splice(idx, 1);
    await storage.write('flows.json', flows);

    // Remove all memberships for this flow
    const memberships = await storage.read('memberships.json');
    const remaining = memberships.filter(m => m.flowId !== flowId);
    await storage.write('memberships.json', remaining);

    // Remove all tasks for this flow
    const tasks = await storage.read('tasks.json');
    const remainingTasks = tasks.filter(t => t.flowId !== flowId);
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

// Update a member's role (owner only, or self)
app.put('/api/flows/:flowId/members/:userId', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const memberships = await storage.read('memberships.json');
    const idx = memberships.findIndex(m => m.flowId === req.params.flowId && m.userId === req.params.userId);
    if (idx === -1) return res.status(404).json({ error: 'Member not found' });

    // Only owner or self can update role
    const isSelf = req.params.userId === req.user.userId;
    if (!req.membership.isOwner && !isSelf) {
      return res.status(403).json({ error: 'Only the flow owner or the member themselves can update roles' });
    }

    if (req.body.role !== undefined) {
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

// Get tasks for a flow
app.get('/api/flows/:flowId/tasks', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const tasks = await storage.read('tasks.json');
    let filtered = tasks.filter(t => t.flowId === req.params.flowId);
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

// Create a task in a flow
app.post('/api/flows/:flowId/tasks', authMiddleware, flowMemberMiddleware, async (req, res) => {
  try {
    const { title, description, priority, deadline, assignedTo, category } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // If assigning to someone, verify they're in the flow
    if (assignedTo) {
      const memberships = await storage.read('memberships.json');
      const isMember = memberships.some(m => m.flowId === req.params.flowId && m.userId === assignedTo);
      if (!isMember) {
        return res.status(400).json({ error: 'Assignee is not a member of this flow' });
      }
    }

    const task = {
      id: crypto.randomUUID(),
      flowId: req.params.flowId,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tasks = await storage.read('tasks.json');
    tasks.push(task);
    await storage.write('tasks.json', tasks);

    await broadcastToFlow(req.params.flowId, { type: 'task:created', payload: task });
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
    await broadcastToFlow(req.params.flowId, { type: 'task:updated', payload: tasks[idx] });
    res.json(tasks[idx]);
  } catch (err) {
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

    await storage.write('tasks.json', tasks);
    await broadcastToFlow(req.params.flowId, { type: 'note:added', payload: { taskId: req.params.id, note } });
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

    tasks[idx].files.push(...newFiles);
    tasks[idx].updatedAt = new Date().toISOString();

    await storage.write('tasks.json', tasks);
    res.json(newFiles);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve task files
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

app.get('/api/chat/files/:filename', authMiddleware, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(storage.getDataDir(), 'uploads', 'chat', safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath);
});

// ═══════════════════════════════════════════════════════════════
// TIME TRACKING ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/time/clock-in', authMiddleware, async (req, res) => {
  try {
    const { location } = req.body;
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
      location: location || 'office',
      status: 'working',
      currentTask: null,
      breaks: [],
      totalWorked: 0,
      lastHeartbeat: new Date().toISOString()
    };
    timelog.push(session);
    await storage.write('timelog.json', timelog);

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
    res.json(timelog[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/time/location', authMiddleware, async (req, res) => {
  try {
    const { location } = req.body;
    if (!['office', 'home'].includes(location)) {
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

    timelog[idx].location = location;
    timelog[idx].lastHeartbeat = new Date().toISOString();
    await storage.write('timelog.json', timelog);
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

// ═══════════════════════════════════════════════════════════════
// ROOT REDIRECTS
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.redirect('/app');
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

async function start() {
  await storage.ensureDataDir();
  await loadSessions();
  server.listen(PORT, () => {
    console.log(`TaskFlow running on port ${PORT}`);
    console.log(`  App:    http://localhost:${PORT}/app`);
    console.log(`  Admin:  http://localhost:${PORT}/admin`);
    console.log(`  Sessions loaded: ${sessions.size}`);
  });
}

start();
