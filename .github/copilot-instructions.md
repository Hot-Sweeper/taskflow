# TaskFlow — Project Guidelines

## Project Overview
TaskFlow is a multi-user task management system with three portals on one Express server:
- `/boss` — Manager portal (phone-first, minimal)
- `/worker` — Worker portal (rich Kanban, power-user)
- `/admin` — Admin panel (system control, data export)

See [PLAN.md](../PLAN.md) for the full specification.

## Architecture
- **Backend**: Single `server.js` — Express + WebSocket (`ws`) + REST API + file uploads (`multer`)
- **Frontend**: Self-contained HTML files in `public/{boss,worker,admin}/index.html` — vanilla HTML/CSS/JS, no frameworks, no build step
- **Shared code**: `public/shared/api.js` (REST + WebSocket client) and `public/shared/models.js` (data models, enums)
- **Storage**: JSON files on disk via a centralized `storage.js` module. Path configured by `DATA_DIR` env var (default `./data`)
- **Real-time**: WebSocket broadcasts task/team/time events to all connected clients

## Code Style

### JavaScript (Server — Node.js)
- Use `const` and `let`, never `var`
- Use async/await, not raw Promises or callbacks
- Use `crypto.randomUUID()` for all ID generation
- Descriptive function and variable names (e.g., `getTasksByAssignee`, not `getTasks2`)
- Group related routes with Express Router: `authRouter`, `taskRouter`, `teamRouter`, `timeRouter`, `adminRouter`, `fileRouter`
- All file I/O goes through `storage.js` — never read/write JSON files directly in route handlers
- Atomic writes: write to `.tmp` file then `fs.rename()` to prevent corruption
- All passwords hashed with `bcryptjs` — never store plaintext
- Validate all inputs at API boundaries — reject bad data early with proper HTTP status codes

### JavaScript (Frontend — Vanilla)
- Each portal is a single `index.html` with inline `<style>` and `<script>` blocks
- Use CSS custom properties (`var(--color-primary)`) for all colors — enables light/dark mode
- Use `[data-theme="dark"]` / `[data-theme="light"]` attribute on `<html>` for theme switching
- Font: Inter from Google Fonts
- Icons: Unicode emoji + inline SVG only — no icon libraries
- Native HTML5 Drag & Drop API for Kanban board (with touch polyfill)
- Use `fetch()` for REST calls, native `WebSocket` for real-time
- Store auth token in `localStorage`
- Mobile-first responsive design with CSS media queries

### CSS
- Use CSS custom properties for the full design system (colors, spacing, radii, shadows)
- Glassmorphism cards: `backdrop-filter: blur()` + semi-transparent backgrounds
- Smooth transitions on interactive elements (150-300ms)
- Consistent spacing scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px
- Border radius: 8px for cards, 6px for inputs, 12px for modals
- Responsive breakpoints: 480px (phone), 768px (tablet), 1024px (desktop)

## File Organization
```
server.js          — Main server entry point (mounts all routers)
storage.js         — Centralized JSON file read/write with atomic saves
public/
  boss/index.html  — Manager portal (landing + auth + dashboard)
  worker/index.html — Worker portal (landing + auth + Kanban + timer)
  admin/index.html — Admin portal (data tables + export/import)
  shared/
    api.js         — REST client + WebSocket connection helper
    models.js      — Task model, status/priority enums, helpers
    i18n.js        — Lightweight i18n module (t() function, DOM translation)
    i18n/
      en.json      — English translations (source of truth / fallback)
      de.json      — German translations
```

## Dependencies (Keep Minimal)
`express`, `ws`, `multer`, `pdfkit`, `bcryptjs`, `archiver` — nothing else.
No TypeScript, no bundler, no framework. Just `node server.js`.

## Data Files (in DATA_DIR)
- `users.json` — user accounts (hashed passwords)
- `teams.json` — boss-worker connections and pending invites
- `tasks.json` — all tasks
- `timelog.json` — work sessions and time entries
- `categories.json` — custom task categories
- `config.json` — admin-configurable system settings
- `requests.json` — worker-to-boss requests (approvals, resources, decisions)
- `messages.json` — real-time chat messages between boss-worker pairs
- `uploads/` — uploaded files organized by `{taskId}/{timestamp}-{filename}`

## Conventions
- API routes: `/api/{resource}` — RESTful, JSON request/response
- Admin routes: `/api/admin/{resource}` — separate auth (env-based password)
- Auth: session token in `Authorization: Bearer <token>` header
- WebSocket events: `{entity}:{action}` format (e.g., `task:created`, `time:status`, `request:created`, `chat:message`)
- HTTP errors: return `{ error: "message" }` with appropriate status code
- All dates as ISO 8601 strings
- IDs are UUIDs via `crypto.randomUUID()`
- All user-facing text must use `data-i18n` attributes or `I18n.t('key')` — never hardcode strings
- Translation keys use dot-notation namespaces: `task.create`, `common.save`, `auth.login`
- English is the fallback — if a key is missing from a language, `en.json` is used

## Deployment
- Target: Railway with persistent volume at `/data`
- Builder: RAILPACK (set in `railway.json`)
- Start command: `node server.js`
- Key env vars: `PORT`, `DATA_DIR`, `MAX_FILE_SIZE_MB`, `ADMIN_PASSWORD`
