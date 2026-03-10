---
description: "Use when writing or editing server-side Node.js code: server.js, storage.js, route handlers, API endpoints, WebSocket logic, file upload handling, authentication, or middleware."
applyTo: "{server.js,storage.js}"
---
# Server-Side Code Standards

## Architecture
- `server.js` is the entry point — it creates the Express app, mounts routers, and starts the HTTP + WebSocket server
- `storage.js` is the centralized data access layer — all JSON read/write goes through it
- Route groups use Express Router: `authRouter`, `taskRouter`, `teamRouter`, `timeRouter`, `adminRouter`, `fileRouter`
- Each router is defined in `server.js` (no separate route files — keep it in one file but well-organized with clear section comments)

## Storage Module (`storage.js`)
- Exports: `read(filename)`, `write(filename, data)`, `getDataDir()`, `ensureDataDir()`
- Reads `DATA_DIR` from `process.env` (default: `./data`)
- Auto-creates the data directory and default JSON files on first run
- All writes are atomic: write to `{file}.tmp` then `fs.rename()` to prevent corruption
- Never import `fs` in route handlers — always go through storage.js

## API Conventions
- All routes under `/api/` return JSON
- Success: `{ data: ... }` or direct object — use 200/201
- Errors: `{ error: "Human-readable message" }` with proper status (400, 401, 403, 404, 500)
- Auth middleware checks `Authorization: Bearer <token>` header
- Admin routes check for admin token separately (env-based `ADMIN_PASSWORD`)
- Validate all user input at the handler level — never trust client data
- Use `crypto.randomUUID()` for all IDs

## WebSocket
- Single WebSocket server attached to the HTTP server
- Clients send `{ type, payload }` JSON messages
- Server broadcasts via `wss.clients.forEach()`
- Event types: `task:created`, `task:updated`, `task:deleted`, `note:added`, `time:status`, `team:invite`, `team:accepted`, `sync`
- On new connection, send full sync payload (tasks + team + time status)

## File Uploads
- Use `multer` with disk storage to `DATA_DIR/uploads/{taskId}/`
- Filename format: `{timestamp}-{originalFilename}`
- Max size from `MAX_FILE_SIZE_MB` env var (default 50)
- Serve files via `/api/files/:taskId/:filename` with proper Content-Type and Content-Disposition headers

## Security
- Hash all passwords with `bcryptjs` (salt rounds: 10)
- Never log or return password hashes in API responses
- Strip sensitive fields (`passwordHash`, `token`) from user objects before sending to clients
- Validate file types on upload — reject executable files
- Rate-limit auth endpoints if implementing (optional)
