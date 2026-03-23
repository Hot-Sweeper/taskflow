#!/usr/bin/env node
// TaskFlow MCP Server — Lets AI agents act as a user via their API key
// Usage: node mcp-server.js --url https://your-taskflow.railway.app --key tfk_...
// Protocol: MCP (Model Context Protocol) over stdio (JSON-RPC 2.0)

const http = require('http');
const https = require('https');
const readline = require('readline');

// ── Parse CLI args ──
const args = process.argv.slice(2);
let baseUrl = '';
let apiKey = '';
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--url' || args[i] === '-u') && args[i + 1]) baseUrl = args[++i];
  if ((args[i] === '--key' || args[i] === '-k') && args[i + 1]) apiKey = args[++i];
}
// Also check env vars
baseUrl = baseUrl || process.env.TASKFLOW_URL || '';
apiKey = apiKey || process.env.TASKFLOW_API_KEY || '';

if (!baseUrl || !apiKey) {
  process.stderr.write('Usage: node mcp-server.js --url <taskflow-url> --key <api-key>\n');
  process.stderr.write('  Or set TASKFLOW_URL and TASKFLOW_API_KEY env vars\n');
  process.exit(1);
}

// Strip trailing slash
baseUrl = baseUrl.replace(/\/+$/, '');

// ── HTTP client ──
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = mod.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Tool definitions ──
// Each tool maps directly to a TaskFlow API endpoint with the same permissions as the user
const tools = [
  // Auth
  {
    name: 'get_current_user',
    description: 'Get info about the authenticated user (you)',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => apiRequest('GET', '/api/auth/me')
  },

  // Flows
  {
    name: 'list_flows',
    description: 'List all flows/workspaces you are a member of',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => apiRequest('GET', '/api/flows')
  },
  {
    name: 'get_flow',
    description: 'Get details of a specific flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}`)
  },
  {
    name: 'create_flow',
    description: 'Create a new flow/workspace',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Flow name' },
        icon: { type: 'string', description: 'Icon name (optional)' }
      },
      required: ['name']
    },
    handler: ({ name, icon }) => apiRequest('POST', '/api/flows', { name, icon })
  },

  // Members
  {
    name: 'list_members',
    description: 'List all members of a flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/members`)
  },
  {
    name: 'get_presence',
    description: 'Get online/offline status of flow members',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/presence`)
  },

  // Tasks
  {
    name: 'list_tasks',
    description: 'List tasks in a flow. Optionally filter by status, assignee, priority, category.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        status: { type: 'string', description: 'Filter by status (todo, in-progress, in-review, done, etc.)' },
        assignedTo: { type: 'string', description: 'Filter by assigned user ID' },
        priority: { type: 'string', description: 'Filter by priority (low, medium, high)' },
        category: { type: 'string', description: 'Filter by category name' }
      },
      required: ['flowId']
    },
    handler: ({ flowId, ...params }) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) { if (v) qs.set(k, v); }
      const q = qs.toString();
      return apiRequest('GET', `/api/flows/${flowId}/tasks${q ? '?' + q : ''}`);
    }
  },
  {
    name: 'create_task',
    description: 'Create a new task in a flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
        category: { type: 'string', description: 'Category name (optional)' },
        assignedTo: { type: 'string', description: 'User ID to assign to (optional)' },
        assignedToList: { type: 'array', items: { type: 'string' }, description: 'List of user IDs to assign (optional)' },
        operators: { type: 'array', items: { type: 'string' }, description: 'List of operator user IDs (optional)' },
        deadline: { type: 'string', description: 'Deadline ISO date (optional)' },
        subFlowId: { type: 'string', description: 'Sub-flow/section ID (optional)' }
      },
      required: ['flowId', 'title']
    },
    handler: ({ flowId, ...task }) => apiRequest('POST', `/api/flows/${flowId}/tasks`, task)
  },
  {
    name: 'update_task',
    description: 'Update an existing task (status, title, priority, assignees, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        taskId: { type: 'string', description: 'Task ID' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'on-hold', 'needs-info', 'in-review', 'done'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        category: { type: 'string' },
        assignedTo: { type: 'string' },
        assignedToList: { type: 'array', items: { type: 'string' } },
        operators: { type: 'array', items: { type: 'string' } },
        deadline: { type: 'string' },
        progress: { type: 'number', minimum: 0, maximum: 100 }
      },
      required: ['flowId', 'taskId']
    },
    handler: ({ flowId, taskId, ...data }) => apiRequest('PUT', `/api/flows/${flowId}/tasks/${taskId}`, data)
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        taskId: { type: 'string', description: 'Task ID' }
      },
      required: ['flowId', 'taskId']
    },
    handler: ({ flowId, taskId }) => apiRequest('DELETE', `/api/flows/${flowId}/tasks/${taskId}`)
  },
  {
    name: 'add_task_note',
    description: 'Add a text note/comment to a task',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        taskId: { type: 'string', description: 'Task ID' },
        text: { type: 'string', description: 'Note text' }
      },
      required: ['flowId', 'taskId', 'text']
    },
    handler: ({ flowId, taskId, text }) => {
      // Notes endpoint expects multipart but we can send JSON with text field
      return apiRequest('POST', `/api/flows/${flowId}/tasks/${taskId}/notes`, { text });
    }
  },

  // Categories
  {
    name: 'list_categories',
    description: 'List task categories in a flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/categories`)
  },
  {
    name: 'create_category',
    description: 'Create a new task category',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        name: { type: 'string', description: 'Category name' },
        color: { type: 'string', description: 'Color hex code (optional)' }
      },
      required: ['flowId', 'name']
    },
    handler: ({ flowId, name, color }) => apiRequest('POST', `/api/flows/${flowId}/categories`, { name, color })
  },

  // Chat
  {
    name: 'list_conversations',
    description: 'List chat conversations in a flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/chat/conversations`)
  },
  {
    name: 'get_messages',
    description: 'Get chat messages with a specific user in a flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        userId: { type: 'string', description: 'User ID of the chat partner' },
        before: { type: 'string', description: 'Pagination cursor — get messages before this ID (optional)' }
      },
      required: ['flowId', 'userId']
    },
    handler: ({ flowId, userId, before }) => {
      const qs = before ? `?before=${before}` : '';
      return apiRequest('GET', `/api/flows/${flowId}/chat/${userId}${qs}`);
    }
  },
  {
    name: 'send_message',
    description: 'Send a chat message to a user in a flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        userId: { type: 'string', description: 'Recipient user ID' },
        text: { type: 'string', description: 'Message text' }
      },
      required: ['flowId', 'userId', 'text']
    },
    handler: ({ flowId, userId, text }) => apiRequest('POST', `/api/flows/${flowId}/chat/${userId}`, { text })
  },

  // Time tracking
  {
    name: 'get_time_status',
    description: 'Get your current time tracking status (clocked in/out, active task, etc.)',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => apiRequest('GET', '/api/time/status')
  },
  {
    name: 'clock_in',
    description: 'Clock in to start your work day',
    inputSchema: {
      type: 'object',
      properties: { location: { type: 'string', description: 'Work location (optional)' } },
      required: []
    },
    handler: ({ location }) => apiRequest('POST', '/api/time/clock-in', { location })
  },
  {
    name: 'clock_out',
    description: 'Clock out to end your work day',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => apiRequest('POST', '/api/time/clock-out')
  },
  {
    name: 'timer_play',
    description: 'Start/resume the timer on a specific task',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID to work on' } },
      required: ['taskId']
    },
    handler: ({ taskId }) => apiRequest('POST', '/api/time/play', { taskId })
  },
  {
    name: 'timer_pause',
    description: 'Pause the current task timer',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => apiRequest('POST', '/api/time/pause')
  },
  {
    name: 'get_time_sessions',
    description: 'Get time tracking sessions/history',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date ISO (optional)' },
        to: { type: 'string', description: 'End date ISO (optional)' }
      },
      required: []
    },
    handler: ({ from, to }) => {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const q = qs.toString();
      return apiRequest('GET', `/api/time/sessions${q ? '?' + q : ''}`);
    }
  },

  // Daily summary & calendar
  {
    name: 'get_daily_summary',
    description: 'Get daily summary for flow members (tasks completed, time worked, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (optional, defaults to today)' }
      },
      required: ['flowId']
    },
    handler: ({ flowId, date }) => {
      const qs = date ? `?date=${date}` : '';
      return apiRequest('GET', `/api/flows/${flowId}/daily-summary${qs}`);
    }
  },

  // Templates
  {
    name: 'list_templates',
    description: 'List task templates in a flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/templates`)
  },
  {
    name: 'use_template',
    description: 'Create a task from a template',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        templateId: { type: 'string', description: 'Template ID' },
        assignedToList: { type: 'array', items: { type: 'string' }, description: 'User IDs to assign (optional)' }
      },
      required: ['flowId', 'templateId']
    },
    handler: ({ flowId, templateId, ...data }) => apiRequest('POST', `/api/flows/${flowId}/templates/${templateId}/use`, data)
  },

  // Notifications
  {
    name: 'list_notifications',
    description: 'List your notifications in a flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/notifications`)
  },

  // Sub-flows
  {
    name: 'list_subflows',
    description: 'List sections/sub-flows in a flow',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string', description: 'Flow ID' } },
      required: ['flowId']
    },
    handler: ({ flowId }) => apiRequest('GET', `/api/flows/${flowId}/subflows`)
  },

  // Availability
  {
    name: 'get_my_availability',
    description: 'Get your availability/blackout blocks',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => apiRequest('GET', '/api/users/me/availability')
  },
  {
    name: 'set_availability_block',
    description: 'Add a availability/blackout block (vacation, training, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to: { type: 'string', description: 'End date YYYY-MM-DD' },
        reason: { type: 'string', description: 'Reason text' },
        type: { type: 'string', enum: ['vacation', 'training', 'personal', 'other'], description: 'Block type' }
      },
      required: ['from', 'to', 'reason', 'type']
    },
    handler: (data) => apiRequest('POST', '/api/users/me/availability', data)
  },

  // Bulk operations
  {
    name: 'bulk_update_tasks',
    description: 'Update multiple tasks at once (change status, priority, category, deadline)',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow ID' },
        taskIds: { type: 'array', items: { type: 'string' }, description: 'List of task IDs to update' },
        field: { type: 'string', enum: ['status', 'priority', 'category', 'deadline'], description: 'Field to update' },
        value: { description: 'New value for the field' }
      },
      required: ['flowId', 'taskIds', 'field', 'value']
    },
    handler: ({ flowId, taskIds, field, value }) =>
      apiRequest('POST', `/api/flows/${flowId}/tasks/bulk`, { taskIds, field, value })
  }
];

// ── MCP Protocol Handler ──
const toolMap = new Map(tools.map(t => [t.name, t]));

function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'taskflow-mcp', version: '1.0.0' }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0', id,
        result: {
          tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        }
      };

    case 'tools/call':
      return null; // handled async

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
  }
}

async function handleToolCall(msg) {
  const { id, params } = msg;
  const { name, arguments: args } = params || {};
  const tool = toolMap.get(name);

  if (!tool) {
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
  }

  try {
    const result = await tool.handler(args || {});
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
  } catch (err) {
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } };
  }
}

// ── Stdio transport ──
const rl = readline.createInterface({ input: process.stdin, terminal: false });
let buffer = '';

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', async (line) => {
  try {
    const msg = JSON.parse(line);

    // Notifications (no id) — just acknowledge
    if (!msg.id && msg.method === 'notifications/initialized') return;
    if (!msg.id) return;

    if (msg.method === 'tools/call') {
      const response = await handleToolCall(msg);
      send(response);
    } else {
      const response = handleRequest(msg);
      if (response) send(response);
    }
  } catch (err) {
    process.stderr.write(`Parse error: ${err.message}\n`);
  }
});

process.stderr.write(`TaskFlow MCP Server started — connected to ${baseUrl}\n`);
