// TaskFlow — REST + WebSocket client helpers

const API = {
  _storageKey: 'taskflow_token',
  token: null,

  init() {
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
  patch(url, body) { return this.request('PATCH', url, body); },
  del(url) { return this.request('DELETE', url); },
  upload(url, formData) { return this.request('POST', url, formData, true); },

  // ── Authentication & Profile ──
  signup(name, password) { return this.post('/api/auth/signup', { name, password }); },
  login(name, password) { return this.post('/api/auth/login', { name, password }); },
  logout() { return this.post('/api/auth/logout'); },
  me() { return this.get('/api/auth/me'); },
  
  // ── User Configs ──
  getTimeConfig() { return this.get('/api/users/me/time-config'); },
  saveTimeConfig(config) { return this.put('/api/users/me/time-config', config); },

  // ── API Keys ──
  getApiKeys() { return this.get('/api/auth/api-keys'); },
  createApiKey(name, allowedFlows, permissions) { return this.post('/api/auth/api-keys', { name, allowedFlows, permissions }); },
  revokeApiKey(keyId) { return this.del(`/api/auth/api-keys/${keyId}`); },

  // ── Avatar ──
  uploadAvatar(formData) { return this.upload('/api/users/me/avatar', formData); },
  getAvatarConfig() { return this.get('/api/users/me/avatar-config'); },
  saveAvatarConfig(config) { return this.put('/api/users/me/avatar-config', config); },

  // ── Flows ──
  getFlows() { return this.get('/api/flows'); },
  createFlow(name, icon) { return this.post('/api/flows', { name, icon }); },
  joinFlow(inviteCode) { return this.post('/api/flows/join', { inviteCode }); },
  getFlow(flowId) { return this.get(`/api/flows/${flowId}`); },
  updateFlow(flowId, data) { return this.put(`/api/flows/${flowId}`, data); },
  deleteFlow(flowId) { return this.del(`/api/flows/${flowId}`); },
  leaveFlow(flowId) { return this.post(`/api/flows/${flowId}/leave`); },
  regenerateInviteCode(flowId) { return this.post(`/api/flows/${flowId}/invite-code`); },

  // ── Flow Members ──
  getMembers(flowId) { return this.get(`/api/flows/${flowId}/members`); },
  getPresence(flowId) { return this.get(`/api/flows/${flowId}/presence`); },
  updateMember(flowId, userId, data) { return this.put(`/api/flows/${flowId}/members/${userId}`, data); },
  kickMember(flowId, userId) { return this.del(`/api/flows/${flowId}/members/${userId}`); },

  // ── Sub-Flows (Sections) ──
  getSubFlows(flowId) { return this.get(`/api/flows/${flowId}/subflows`); },
  createSubFlow(flowId, name, icon) { return this.post(`/api/flows/${flowId}/subflows`, { name, icon }); },
  updateSubFlow(flowId, subFlowId, data) { return this.patch(`/api/flows/${flowId}/subflows/${subFlowId}`, data); },
  deleteSubFlow(flowId, subFlowId) { return this.del(`/api/flows/${flowId}/subflows/${subFlowId}`); },

  // ── Tasks (flow-scoped) ──
  getTasks(flowId, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get(`/api/flows/${flowId}/tasks` + qs);
  },
  getArchivedTasks(flowId) { return this.getTasks(flowId, { archived: 'only' }); },
  getAllTasks(flowId) { return this.getTasks(flowId, { archived: 'include' }); },
  createTask(flowId, task) { return this.post(`/api/flows/${flowId}/tasks`, task); },
  updateTask(flowId, id, data) { return this.put(`/api/flows/${flowId}/tasks/${id}`, data); },
  unarchiveTask(flowId, id) { return this.post(`/api/flows/${flowId}/tasks/${id}/unarchive`); },
  deleteTask(flowId, id) { return this.del(`/api/flows/${flowId}/tasks/${id}`); },
  addNote(flowId, taskId, formData) { return this.upload(`/api/flows/${flowId}/tasks/${taskId}/notes`, formData); },
  uploadFiles(flowId, taskId, formData) { return this.upload(`/api/flows/${flowId}/tasks/${taskId}/files`, formData); },
  deleteFile(flowId, taskId, storedName) { return this.del(`/api/flows/${flowId}/tasks/${taskId}/files/${storedName}`); },

  // ── Categories (flow-scoped) ──
  getCategories(flowId) { return this.get(`/api/flows/${flowId}/categories`); },
  createCategory(flowId, name, color) { return this.post(`/api/flows/${flowId}/categories`, { name, color }); },

  // ── Templates (flow-scoped) ──
  getTemplates(flowId) { return this.get(`/api/flows/${flowId}/templates`); },
  createTemplate(flowId, data) { return this.post(`/api/flows/${flowId}/templates`, data); },
  updateTemplate(flowId, id, data) { return this.put(`/api/flows/${flowId}/templates/${id}`, data); },
  deleteTemplate(flowId, id) { return this.del(`/api/flows/${flowId}/templates/${id}`); },
  useTemplate(flowId, id, data) { return this.post(`/api/flows/${flowId}/templates/${id}/use`, data || {}); },

  // ── Chat (flow-scoped) ──
  getConversations(flowId) { return this.get(`/api/flows/${flowId}/chat/conversations`); },
  getMessages(flowId, userId, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get(`/api/flows/${flowId}/chat/${userId}` + qs);
  },
  sendMessage(flowId, userId, formData) { return this.upload(`/api/flows/${flowId}/chat/${userId}`, formData); },
  markRead(flowId, userId) { return this.put(`/api/flows/${flowId}/chat/${userId}/read`); },

  // ── Time Tracking ──
  clockIn(location) { return this.post('/api/time/clock-in', { location }); },
  clockOut() { return this.post('/api/time/clock-out'); },
  timerPlay(taskId) { return this.post('/api/time/play', { taskId }); },
  timerPause() { return this.post('/api/time/pause'); },
  updateTimeLocation(location) { return this.post('/api/time/location', { location }); },
  heartbeat() { return this.post('/api/time/heartbeat'); },
  getTimeStatus() { return this.get('/api/time/status'); },
  getTimeCatchUpStatus() { return this.get('/api/time/catch-up/status'); },
  catchUpTime(location) { return this.post('/api/time/catch-up', { location }); },
  getTimeSessions(params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get('/api/time/sessions' + qs);
  },

  // ── Admin ──
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
      this._emit('connected');
    };

    this.socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._emit(msg.type, msg);
      } catch {}
    };

    this.socket.onclose = () => {
      this._emit('disconnected');
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(token), 3000);
    };

    this.socket.onerror = () => {};
  },

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  },

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  },

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  },

  _emit(event, data) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  },

  send(data) {
    if (this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify(data));
    }
  }
};

if (typeof window !== 'undefined') {
  window.API = API;
  window.WS = WS;
}
