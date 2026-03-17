// TaskFlow — REST + WebSocket client helpers

const API = {
  _storageKey: 'taskflow_token',
  token: null,

  init(portal) {
    if (portal) this._storageKey = `taskflow_${portal}_token`;
    this.token = localStorage.getItem(this._storageKey);
  },

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem(this._storageKey, token);
    else localStorage.removeItem(this._storageKey);
  },

  async request(method, url, body, isFormData) {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(url, opts);
    if (res.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new Event('auth:expired'));
      throw new Error('Authentication expired');
    }
    const data = res.headers.get('content-type')?.includes('json')
      ? await res.json()
      : await res.text();
    if (!res.ok) throw new Error(data.error || data || 'Request failed');
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); },
  upload(url, formData) { return this.request('POST', url, formData, true); },

  // Auth
  signup(name, password, role) { return this.post('/api/auth/signup', { name, password, role }); },
  login(name, password) { return this.post('/api/auth/login', { name, password }); },
  logout() { return this.post('/api/auth/logout'); },
  me() { return this.get('/api/auth/me'); },
  uploadAvatar(formData) { return this.upload('/api/users/me/avatar', formData); },

  // Tasks
  getTasks(params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get('/api/tasks' + qs);
  },
  createTask(task) { return this.post('/api/tasks', task); },
  updateTask(id, data) { return this.put(`/api/tasks/${id}`, data); },
  deleteTask(id) { return this.del(`/api/tasks/${id}`); },
  addNote(taskId, formData) { return this.upload(`/api/tasks/${taskId}/notes`, formData); },
  uploadFiles(taskId, formData) { return this.upload(`/api/tasks/${taskId}/files`, formData); },

  // Categories
  getCategories() { return this.get('/api/categories'); },
  createCategory(name, color) { return this.post('/api/categories', { name, color }); },

  // Team
  getWorkers() { return this.get('/api/workers'); },
  getTeam() { return this.get('/api/team'); },
  sendInvite(workerName) { return this.post('/api/team/invite', { workerName }); },
  respondInvite(inviteId, accept) { return this.post('/api/team/respond', { inviteId, accept }); },
  removeTeamMember(connectionId) { return this.del(`/api/team/${connectionId}`); },
  getInvites() { return this.get('/api/team/invites'); },

  // Time
  clockIn(location) { return this.post('/api/time/clock-in', { location }); },
  clockOut() { return this.post('/api/time/clock-out'); },
  timerPlay(taskId) { return this.post('/api/time/play', { taskId }); },
  timerPause() { return this.post('/api/time/pause'); },
  updateTimeLocation(location) { return this.post('/api/time/location', { location }); },
  heartbeat() { return this.post('/api/time/heartbeat'); },
  getTimeStatus() { return this.get('/api/time/status'); },
  getTimeSessions(params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get('/api/time/sessions' + qs);
  },

  // Requests
  getRequests() { return this.get('/api/requests'); },
  createRequest(data) { return this.post('/api/requests', data); },
  updateRequest(id, data) { return this.put(`/api/requests/${id}`, data); },
  deleteRequest(id) { return this.del(`/api/requests/${id}`); },

  // Avatar
  getAvatarConfig() { return this.get('/api/users/me/avatar-config'); },
  saveAvatarConfig(config) { return this.put('/api/users/me/avatar-config', config); },

  // Chat
  getConversations() { return this.get('/api/chat/conversations'); },
  getMessages(userId, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get(`/api/chat/${userId}` + qs);
  },
  sendMessage(userId, formData) { return this.upload(`/api/chat/${userId}`, formData); },
  markRead(userId) { return this.put(`/api/chat/${userId}/read`); },

  // Admin
  adminLogin(password) { return this.post('/api/admin/login', { password }); },
};

// WebSocket helper
const WS = {
  socket: null,
  listeners: new Map(),
  reconnectTimer: null,

  connect(token) {
    if (this.socket) this.socket.close();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.host}/ws`);

    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: 'auth', token }));
      this.emit('connected');
    };

    this.socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.emit(data.type, data);
      } catch {}
    };

    this.socket.onclose = () => {
      this.emit('disconnected');
      this.reconnectTimer = setTimeout(() => this.connect(token), 3000);
    };

    this.socket.onerror = () => {};
  },

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.socket) this.socket.close();
    this.socket = null;
  },

  send(data) {
    if (this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify(data));
    }
  },

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  },

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  },

  emit(event, data) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
};

if (typeof window !== 'undefined') {
  window.API = API;
  window.WS = WS;
}
