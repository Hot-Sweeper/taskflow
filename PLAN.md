# Task Tracker — Comprehensive Plan (v2)

## Overview

## Current Sprint Backlog (2026-03-23)

Purpose: Track the new requested changes in implementation order so we can ship them in smaller, testable batches.

Status legend:
- `[ ]` not started
- `[~]` in progress
- `[x]` done

### Phase A — Quick UI Stabilization (Easiest Wins First)

1. `[x]` Archive shortcut fix + platform behavior
   - Goal: Fix broken archive icon render and show shortcut only on phone while desktop keeps archive in navigation tab.
   - Acceptance criteria:
     - No raw template text appears for icon.
     - Phone shows header archive shortcut; desktop hides it.
     - Archive tab remains accessible via desktop sidebar.

2. `[x]` Reply UX refactor (WhatsApp-like edge icon, no text button)
   - Goal: Remove inline "Reply/Antworten" text actions and use subtle edge-hover icon action.
   - Acceptance criteria:
     - Reply action appears as icon at message edge.
     - Reply quote readability is improved in sent and received bubbles.

3. `[x]` Task detail chat expanded/maximized rendering fix (PC + mobile)
   - Goal: Expanded chat must render correctly and stay usable in both viewport classes.
   - Scope:
     - Height calculation, scroll anchoring, input bar positioning, and message clipping.
   - Acceptance criteria:
     - No overlap/cutoff in expanded mode.
     - Messages and composer remain visible when keyboard opens on mobile.
     - Returning from expanded mode keeps stable layout state.

4. `[x]` Desktop quick-create layout improvement
   - Goal: On desktop, use horizontal space better in task creation area.
   - Scope:
     - Priority slider on left and Abteilungen/Subflow selector on right (same row where screen width allows).
     - Keep phone layout stacked (current mobile behavior).
   - Acceptance criteria:
     - Desktop/tablet wide viewport shows side-by-side layout.
     - Mobile remains unchanged and readable.

### Phase B — Task Board Ordering (Core UX Behavior)

5. `[x]` Default sort by priority (most important on top)
   - Goal: Use priority-first order by default wherever tasks are rendered.
   - Acceptance criteria:
     - High/urgent tasks appear above medium/low by default.
     - Manual drag order can override default position when user reorders.

6. `[x]` Vertical task reorder inside status columns (desktop + mobile)
   - Goal: Enable dragging tasks up/down within the same column, not just cross-column status moves.
   - Acceptance criteria:
     - Drop insertion point is visible while dragging.
     - Reordered position persists after refresh and real-time updates.

### Phase C — Routing + Task Creation + Notification Quality

7. `[x]` Invite link fallback behavior (used avatar/invite links)
   - Goal: If an invite/avatar link is opened by a user who already has an account (or is already logged in), the flow should gracefully route to normal auth/home instead of forcing invite-avatar onboarding.
   - Acceptance criteria:
     - Logged-in user opening an old invite/avatar link lands in app home/flow picker.
     - Logged-out user with existing account can use normal login path without broken invite flow.
     - Fresh user can still use valid invite links normally.

8. `[x]` Add deadline in quick task creation flow
   - Goal: User can set deadline while creating a task (not only after opening details).
   - Acceptance criteria:
     - Deadline input available in quick-add expanded section.
     - Created task persists selected deadline immediately.

9. `[x]` Notification scope hardening for task creation
   - Problem: Uninvolved users currently receive task-created notifications.
   - Goal: Only relevant users receive creation notifications.
   - Target recipients (to verify in code before finalizing):
     - Task creator (optional/self-notify off by default), assignees, operators, and possibly flow owner if required by policy.
   - Acceptance criteria:
     - Uninvolved members receive no task-created notification.

10. `[x]` Reduce status-change notification noise
   - Goal: Disable/limit status-change notifications to prevent overload.
   - Acceptance criteria:
     - Generic status-change notifications are no longer sent to all users.
     - Critical notifications (review requests/approvals, direct mentions) continue to work.

### Phase D — Mentions System

11. `[x]` `@mention` parsing in chats (flow chat + task chat)
   - Goal: Allow tagging members via `@name` (or stable internal token) in message text.
   - Scope:
     - Mention detection and user resolution.
     - Mention metadata persisted with message/note.
   - Acceptance criteria:
     - Mentioned user is reliably identified even with similar names.
     - Mention survives reload/history retrieval.

12. `[x]` Mention notifications in Benachrichtigungen
   - Goal: Mentioned users receive high-signal notifications.
   - Acceptance criteria:
     - Mentioned users receive one notification per message/note event.
     - Non-mentioned users do not receive mention notifications.
     - Notification click deep-links to relevant chat/task context.

### Phase E — Online Not Clocked-In Nudge + Catch-Up Time

13. `[x]` Online-but-not-clocked-in state UI
   - Goal: If user is online but not clocked in, show prominent "Clock in now" prompt.
   - Scope:
     - Big CTA in time area.
     - Gray running "unlogged online time" indicator.
   - Acceptance criteria:
     - Timer starts counting only while online and not clocked in.
     - Display is visually distinct (gray) and non-confusing.

14. `[x]` Catch-up button for unlogged online time
   - Goal: Allow adding accumulated online-not-clocked time into tracked work.
   - Rules:
     - Button appears only after > 1 minute accumulated.
     - Primary button label changes to "Clock in now" in this state.
   - Acceptance criteria:
     - Catch-up action adds expected amount accurately.
     - State resets correctly after catch-up or clock-in.
     - No double-counting.

## Delivery Strategy

Recommended implementation order (easiest and most convenient path):
1. Phase A (quick UI stabilization)
2. Phase B (task board ordering behavior)
3. Phase C (routing + task creation + notification cleanup)
4. Phase D (mentions end-to-end)
5. Phase E (time tracking nudge + catch-up)

## Immediate Continuation Plan (Fix Track)

Goal: Continue from completed fixes and finish the remaining UX tasks with low regression risk.

1. `[x]` Finish task chat expanded/maximized rendering fix
  - Implement final height/viewport behavior for desktop and mobile keyboard scenarios.
  - Add manual checks: open detail, expand chat, type multi-line, attach file, collapse/expand again.

2. `[x]` Finish desktop quick-create layout improvement
  - Move priority + subflow into a desktop-optimized row.
  - Keep current mobile stack unchanged.
  - Validate at 1024px, 1440px, and <=768px.

3. `[x]` Add reorder stability hardening
  - Add normalization helper for very dense orderIndex values after repeated drag operations.
  - Verify websocket updates keep local ordering stable for all connected clients.

4. `[x]` Regression pass for completed fixes
  - Archive shortcut: phone visible, desktop hidden, archive tab navigation intact.
  - Reply icon UX: visible on hover (desktop) and usable on touch (mobile).
  - Priority default sort + vertical reorder persisted after reload.

5. `[x]` Proceed to Phase C implementation block
  - Invite link fallback.
  - Quick-add deadline.
  - Notification scope + noise reduction.

Each phase should be shipped with:
- targeted manual test checklist (desktop + mobile)
- regression check for notifications and chat rendering
- small commit(s) per feature block

A **multi-user** task management system running on a **single domain** with three subpages: `/boss` for Managers, `/worker` for Workers, and `/admin` for system administration. One Node.js server, one deployment, three UIs under the same URL.

- **Manager Portal** (`/boss`): Ultra-fast, minimal, phone-first UI. Create tasks, track progress, respond to blockers — all in seconds from your phone.
- **Worker Portal** (`/worker`): Rich, detailed, innovative UI with categories, drag & drop Kanban, multiple view modes, deep task detail — a power-user workspace.
- **Admin Portal** (`/admin`): Full system control — manage users, export/import data, configure storage, monitor everything.

Both portals support **multiple managers and multiple workers**. Users identify themselves on first visit (name prompt) and all actions are attributed to them.

---

## Architecture

```
/server.js                 ← Express + WebSocket server (real-time sync)
/data/                     ← Configurable via DATA_DIR env var (Railway persistent volume)
  ├── users.json           ← User accounts (hashed passwords)
  ├── teams.json           ← Boss-worker connections & pending invites
  ├── tasks.json           ← Persistent task storage
  ├── timelog.json         ← Work sessions & time entries
  ├── categories.json      ← Custom categories
  ├── config.json          ← System config (admin settings)
  ├── requests.json        ← Worker → Boss requests
  ├── messages.json        ← Chat messages (boss ↔ worker)
  └── uploads/             ← Uploaded files (images, videos, docs)
      └── {taskId}/        ← Files organized per task

/public/
  ├── boss/
  │   └── index.html       ← Manager portal (landing + auth + dashboard)
  ├── worker/
  │   └── index.html       ← Worker portal (landing + auth + dashboard)
  ├── admin/
  │   └── index.html       ← Admin portal (system control panel)
  └── shared/
      ├── api.js            ← REST + WebSocket client shared by all portals
      ├── models.js         ← Task model, enums, helpers
      ├── i18n.js           ← Lightweight i18n module (language loader + t() function)
      └── i18n/             ← Translation files (one JSON per language)
          ├── en.json       ← English (default/fallback)
          └── de.json       ← German
```

### How It Works
- **Express server** serves all three portals and a REST API + file upload endpoints
- **WebSocket** pushes real-time updates — when a boss creates a task, workers see it instantly (and vice versa)
- **Configurable storage**: the `DATA_DIR` env var controls where all data is stored (default: `./data`). Change it to point to any mount, drive, or path
- **Railway persistent volume** at `/data` stores everything — survives redeploys
- All portals work on **desktop and mobile** (responsive)
- **File uploads** are stored in `DATA_DIR/uploads/`, served via `/api/files/:taskId/:filename`
- Locally: `localhost:3000/boss`, `/worker`, or `/admin`
- On Railway: `https://your-app.up.railway.app/boss`, `/worker`, or `/admin`

### Storage Layer
- **All data** goes through a centralized storage module (`storage.js`)
- The base path is read from `process.env.DATA_DIR` (defaults to `./data`)
- Every JSON file is auto-created on first run with empty defaults
- All writes are atomic (write to `.tmp` then rename) to prevent corruption
- Storage can be pointed to **any filesystem path** — local disk, NAS, mounted drive, Railway volume, S3-fuse, etc.
- Admin can see and configure the current storage path from the admin dashboard

---

---

## Admin Portal (`/admin`) — System Control Panel

> **Design philosophy**: Full control over the entire system. View everything, manage everyone, export anything. Simple, functional, data-focused.

### Authentication
- Admin account is created via env var `ADMIN_PASSWORD` (set on Railway or in `.env`)
- Login at `/admin` with username `admin` + the configured password
- Admin is a separate role — not a boss or worker account
- If `ADMIN_PASSWORD` is not set, admin portal is disabled (returns 403)

### Layout

```
┌────────────────────────────────────────────────┐
│  🔧 TaskFlow Admin                              │
├────────────────────────────────────────────────┤
│                                                │
│  SYSTEM OVERVIEW                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐  │
│  │ 5 Bosses │ │ 12 Workers│ │48 Tasks  │ │ 2.3 GB│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────┘  │
│                                                │
│  [👥 Users] [📋 Tasks] [🔗 Teams] [⏱ Time]     │
│  [📦 Data] [⚙️ Settings]                       │
│                                                │
└────────────────────────────────────────────────┘
```

### Sections

#### 1. 👥 User Management
- **Table of all users**: name, role (boss/worker), created date, last active, status
- **Actions per user**:
  - Reset password
  - Delete account (with confirmation — warns about orphaned tasks)
  - Change role (boss ↔ worker) — rare but possible
  - View user's tasks / time log
- **Create user** manually (admin can pre-create accounts)
- **Search & filter** by role, name, active status

#### 2. 📋 Task Overview
- **All tasks** across all bosses and workers in one view
- Sortable table: ID, title, status, priority, assignee, boss, progress, deadline, created, updated
- **Filters**: by boss, by worker, by status, by priority, by date range
- **Bulk actions**: delete multiple, change status, reassign
- **Task detail**: click any task to see full detail (read-only, but can delete)
- **Stats**: total tasks by status (pie chart), tasks per boss, tasks per worker

#### 3. 🔗 Team Connections
- **All team connections**: which bosses are connected to which workers
- **Pending invites**: see all pending, can cancel or force-accept
- **Create connection**: admin can directly connect a boss and worker (no invite needed)
- **Remove connection**: admin can disconnect any boss-worker pair

#### 4. ⏱ Time Tracking Overview
- **All workers' time logs** in one place
- **Currently active**: who's working, paused, offline right now
- **Monthly summaries per worker**: total hours, avg hours, office/home split
- **Download PDF report** for any worker for any month
- **Edit time entries**: admin can correct any time entry

#### 5. 📦 Data Management (Export / Import / Backup)

This is the core admin power feature:

```
┌────────────────────────────────────────────────┐
│  📦 DATA MANAGEMENT                             │
├────────────────────────────────────────────────┤
│                                                │
│  EXPORT                                        │
│  ┌──────────────────────────────────────────┐  │
│  │ [⬇ Download Everything]  ← full backup    │  │
│  │   taskflow-backup-2026-03-10.zip           │  │
│  │   Includes: all JSON + all uploaded files   │  │
│  │                                            │  │
│  │ Or download individually:                   │  │
│  │ [⬇ users.json]  [⬇ tasks.json]             │  │
│  │ [⬇ teams.json]  [⬇ timelog.json]            │  │
│  │ [⬇ categories.json]  [⬇ config.json]       │  │
│  │ [⬇ All uploads (ZIP)]                      │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  IMPORT                                        │
│  ┌──────────────────────────────────────────┐  │
│  │ [⬆ Import Backup ZIP]  ← restore all      │  │
│  │   Restores: users, tasks, teams, timelog,   │  │
│  │   categories, config, and uploaded files     │  │
│  │                                            │  │
│  │ Or import individually:                     │  │
│  │ [⬆ Import users.json]  (merge or replace)   │  │
│  │ [⬆ Import tasks.json]  (merge or replace)   │  │
│  │ [⬆ Import timelog.json]                     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  STORAGE INFO                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ Data directory:  /data                      │  │
│  │ Total size:      2.3 GB                     │  │
│  │ JSON files:      148 KB                     │  │
│  │ Uploads:         2.3 GB (347 files)          │  │
│  │ Last backup:     Mar 8, 2026 at 15:30       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

**Export formats:**
- **Full backup ZIP**: `taskflow-backup-YYYY-MM-DD.zip` containing all JSON files + all uploads in their folder structure
- **Individual JSON files**: download any single data file
- **Uploads ZIP**: all uploaded files in a ZIP
- All exports are **raw JSON** — easy to import into any database, parse with scripts, or migrate to another system

**Import options:**
- **Full restore**: upload a backup ZIP → replaces everything (with confirmation warning)
- **Individual import**: upload a single JSON file → choose **merge** (add to existing) or **replace** (overwrite)
- **Merge logic**: matching IDs update, new IDs insert, nothing is deleted
- Import validates JSON structure before applying

**Data portability:**
- Export JSON → import into MongoDB, PostgreSQL, SQLite, or any other system
- JSON structure is flat and well-documented — easy to write migration scripts
- Uploaded files maintain their folder structure in the ZIP

#### 6. ⚙️ System Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Storage path | Where data is stored (`DATA_DIR`) | `/data` or `./data` |
| Max file size | Max upload size per file | 50 MB |
| Max total storage | Alert threshold for total storage used | 10 GB |
| Allow signups | Enable/disable new account creation | `true` |
| Allow boss signups | Can new bosses register themselves? | `true` |
| Allow worker signups | Can new workers register themselves? | `true` |
| Maintenance mode | Disable all portals except admin | `false` |
| App name | Shown in headers of all portals | "TaskFlow" |

- Settings are stored in `/data/config.json`
- Changes take effect immediately (no restart needed)
- Admin can toggle signup on/off (e.g., after all users are created, disable signups)
- Maintenance mode shows "System under maintenance" on boss/worker portals

#### 7. System Health
- **Server uptime**: how long since last restart
- **Active WebSocket connections**: how many users currently connected
- **Storage usage**: breakdown by JSON files vs uploads
- **Recent activity log**: last 50 actions across the system (task created, user signed up, file uploaded, etc.)
- **Error log**: any server errors (stored in memory, last 100)

### Admin UI Design
- Clean, functional, data-table focused — think simple admin panel
- Dark/light mode toggle (same as other portals)
- Responsive but desktop-optimized (admin tasks are usually done on a computer)
- Color scheme: neutral gray tones with blue accent
- Tables use alternating row colors for readability
- All destructive actions require confirmation modals

---

## Authentication & Accounts

### How It Works
- Each portal (`/boss` and `/worker`) has a **landing page** with Sign Up / Log In
- Accounts are stored server-side in `/data/users.json` with **hashed passwords** (bcrypt)
- On login, server returns a **session token** (stored in `localStorage`) — used for all API calls
- Users stay logged in until they explicitly log out
- Password is the only auth — no email required, keep it simple

### User Object

```json
{
  "id": "uuid",
  "name": "Alex",
  "role": "worker" | "manager",
  "passwordHash": "$2b$10$...",
  "createdAt": "2026-03-10T...",
  "token": "random-session-token"
}
```

### Boss Landing Page (`/boss`)

```
┌─────────────────────────────────┐
│                                 │
│     🏢 TaskFlow                  │
│                                 │
│   Manage your team.             │
│   Track progress.               │
│   Stay in control.              │
│                                 │
│   ┌───────────────────────┐   │
│   │   Your Name            │   │
│   └───────────────────────┘   │
│   ┌───────────────────────┐   │
│   │   Password              │   │
│   └───────────────────────┘   │
│                                 │
│   [ ███ Create Account ███ ]    │
│                                 │
│   Already have an account?      │
│   [ Log In ]                    │
│                                 │
└─────────────────────────────────┘
```

- Dark navy theme matching the manager dashboard
- Clean, minimal — just name + password + button
- Tagline: "Manage your team. Track progress. Stay in control."
- After sign up/login → redirects to the manager dashboard
- Names must be unique per role

### Worker Landing Page (`/worker`)

```
┌─────────────────────────────────┐
│                                 │
│     ⚡ TaskFlow                  │
│                                 │
│   Get stuff done.               │
│   Track your progress.          │
│   Own your workflow.            │
│                                 │
│   ┌───────────────────────┐   │
│   │   Your Name            │   │
│   └───────────────────────┘   │
│   ┌───────────────────────┐   │
│   │   Password              │   │
│   └───────────────────────┘   │
│                                 │
│   [ ███ Join TaskFlow ███ ]     │
│                                 │
│   Already have an account?      │
│   [ Log In ]                    │
│                                 │
└─────────────────────────────────┘
```

- Light modern theme matching the worker dashboard
- Tagline: "Get stuff done. Track your progress. Own your workflow."
- After sign up/login → redirects to the worker dashboard
- If the worker has pending **Team Invites**, they see a notification badge immediately after login

---

## Team System (Boss ↔ Worker Connections)

### How It Works
- A **boss** and **worker** must be connected before the boss can assign tasks to that worker
- Boss sends a **"Team Invite"** to a worker by searching their name
- Worker sees the invite and can **Accept** or **Decline**
- Once accepted, they're on the same team — boss sees the worker in their team, can assign tasks, see time tracking, etc.
- A boss can have **multiple workers** on their team
- A worker can be on **multiple bosses' teams** (e.g., different project managers)

### Team Invite Flow

```
  BOSS                              WORKER
  ────                              ──────
  1. Go to Team page
  2. Search worker by name
  3. Send Team Invite ─────────▶  4. Sees notification: "🔔 Sarah
                                       invited you to their team"
                                    5. Accept ✅ or Decline ❌
  6. Worker appears in team list  ◀─ (if accepted)
  7. Can now assign tasks to them
```

### Team Data Model

Stored in `/data/teams.json`:

```json
{
  "teams": [
    {
      "id": "uuid",
      "managerId": "uuid-sarah",
      "managerName": "Sarah",
      "workerId": "uuid-alex",
      "workerName": "Alex",
      "status": "active",
      "connectedAt": "2026-03-10T..."
    }
  ],
  "invites": [
    {
      "id": "uuid",
      "fromId": "uuid-sarah",
      "fromName": "Sarah",
      "toId": "uuid-jordan",
      "toName": "Jordan",
      "status": "pending" | "accepted" | "declined",
      "sentAt": "2026-03-10T...",
      "respondedAt": null
    }
  ]
}
```

### Boss → Team Management UI

Accessible from a **👥 Team** tab/section in the manager dashboard:

```
┌─────────────────────────────────┐
│  👥 My Team                       │
├─────────────────────────────────┤
│                                 │
│  🟢 Alex · Working · 5h 23m     │
│  🟡 Jordan · Paused · 4h 10m   │
│  ⚫ Sam · Offline                │
│                                 │
│  Pending Invites:               │
│  ⏳ Chris · Sent 2h ago          │
│                                 │
│  ┌───────────────────────┐   │
│  │ 🔍 Search worker name...│   │
│  └───────────────────────┘   │
│  [ ➕ Send Team Invite ]        │
│                                 │
└─────────────────────────────────┘
```

- Search for workers by name → results show matching accounts
- Tap "➕ Send Team Invite" → invite sent, appears as pending
- Connected workers show their live status (working/paused/offline)
- Boss can **remove** a worker from their team (right-swipe or long-press → remove)

### Worker → Team Invites UI

Workers see invites in a **🔔 notification bell** in their header:

```
┌─────────────────────────────────┐
│  🔔 Team Invites                  │
├─────────────────────────────────┤
│                                 │
│  Sarah wants you on their team  │
│  Sent 5 min ago                 │
│  [ ✅ Accept ]  [ ❌ Decline ]  │
│                                 │
│  ─────────────────────────   │
│  My Managers:                   │
│  👤 Sarah · Connected Mar 10     │
│  👤 Mike · Connected Feb 28      │
│                                 │
└─────────────────────────────────┘
```

- 🔔 badge with count on header (e.g., "🔔¹")
- Tap opens invite panel — shows pending invites with Accept/Decline
- Also shows list of managers they're currently connected to
- Real-time: invite appears instantly via WebSocket when boss sends it

### Permissions After Connection

| Action | Before connected | After connected |
|--------|-----------------|----------------|
| Boss assigns task to worker | ❌ | ✅ |
| Boss sees worker's time tracking | ❌ | ✅ |
| Boss downloads worker's PDF report | ❌ | ✅ |
| Worker sees boss's tasks | ❌ | ✅ (only tasks from connected bosses) |
| Worker's timer visible to boss | ❌ | ✅ |

### Scoping

- **Boss only sees**: tasks they created, workers on their team
- **Worker only sees**: tasks assigned to them by connected bosses + unassigned tasks from connected bosses
- This means multiple boss-worker setups can run independently on the same instance

---

## Multi-User Model

### User Identity

On first visit to `/boss` or `/worker`, the user sees a **landing page** with:
- **Sign Up**: name + password → creates account, logs in, redirects to dashboard
- **Log In**: name + password → authenticates, redirects to dashboard
- Session token stored in `localStorage` — stays logged in across visits
- Role is locked at signup (`/boss` = manager, `/worker` = worker)

### Data Attribution

```json
{
  "createdBy": "Sarah (Manager)",
  "assignedTo": "Alex",
  "notes": [
    { "author": "Sarah", "role": "manager", "text": "..." },
    { "author": "Alex", "role": "worker", "text": "..." }
  ]
}
```

- Managers see **all tasks** they or other managers created
- Workers see **all tasks** (so they can pick up unassigned work) but their personal dashboard highlights tasks assigned to them
- A manager can **assign a task to a specific worker** or leave it unassigned

---

## Data Model

### Task Object

```json
{
  "id": "uuid-v4",
  "title": "Task title",
  "description": "Detailed task description (supports markdown)",
  "category": "Frontend" | "Backend" | "Design" | "Bug" | custom string,
  "priority": "high" | "medium" | "low",
  "status": "todo" | "in-progress" | "on-hold" | "needs-info" | "in-review" | "done",
  "progress": 0-100,
  "deadline": "2026-03-15T00:00:00Z",
  "createdAt": "2026-03-10T...",
  "updatedAt": "2026-03-10T...",
  "completedAt": null | "2026-03-14T...",
  "createdBy": "Sarah",
  "assignedTo": "Alex" | null,

  "notes": [
    {
      "id": "uuid",
      "author": "Sarah",
      "role": "manager",
      "text": "Here's the Figma link and the mockup screenshots",
      "type": "info" | "update" | "info-request" | "completion-report",
      "timestamp": "2026-03-10T...",
      "attachments": [
        { "label": "Figma Design", "url": "https://..." }
      ],
      "files": [
        {
          "id": "uuid",
          "originalName": "dashboard-mockup.png",
          "storedName": "1710000000000-dashboard-mockup.png",
          "mimeType": "image/png",
          "size": 245000,
          "url": "/api/files/{taskId}/1710000000000-dashboard-mockup.png"
        }
      ]
    }
  ],

  "statusNote": "Waiting for design assets for the mobile breakpoint",

  "timeEntries": [
    {
      "id": "uuid",
      "worker": "Alex",
      "start": "2026-03-10T09:15:00Z",
      "end": "2026-03-10T12:30:00Z",
      "duration": 11700,
      "taskId": "uuid-of-this-task"
    }
  ]
}
```

### Time Tracking / Work Session Object

Stored separately in `/data/timelog.json` — one big array of all sessions:

```json
{
  "sessions": [
    {
      "id": "uuid",
      "worker": "Alex",
      "date": "2026-03-10",
      "status": "working" | "paused" | "offline",
      "location": "office" | "home" | "other",
      "locationNote": "Coffee shop downtown",
      "entries": [
        {
          "start": "2026-03-10T09:00:00Z",
          "end": "2026-03-10T12:30:00Z",
          "taskId": "uuid" | null,
          "taskTitle": "Build dashboard",
          "type": "work"
        },
        {
          "start": "2026-03-10T12:30:00Z",
          "end": "2026-03-10T13:00:00Z",
          "taskId": null,
          "taskTitle": null,
          "type": "break"
        },
        {
          "start": "2026-03-10T13:00:00Z",
          "end": null,
          "taskId": "uuid-2",
          "taskTitle": "Fix login bug",
          "type": "work"
        }
      ],
      "totalWorked": 25200,
      "totalBreak": 1800,
      "clockIn": "2026-03-10T09:00:00Z",
      "clockOut": null
    }
  ],

  "liveStatus": {
    "Alex": {
      "status": "working",
      "currentTask": "Build dashboard",
      "since": "2026-03-10T13:00:00Z",
      "location": "home",
      "todayTotal": "5h 23m"
    },
    "Jordan": {
      "status": "paused",
      "currentTask": null,
      "since": "2026-03-10T14:15:00Z",
      "location": "office",
      "todayTotal": "4h 10m"
    }
  }
}
```

### Categories (Worker-Managed)

Workers can organize tasks into **custom categories**:
- Pre-built defaults: `Frontend`, `Backend`, `Design`, `Bug`, `DevOps`, `Research`
- Workers can **create new categories** on the fly (e.g., "Q2 Launch", "Client X")
- Categories have customizable **color tags**
- Managers can optionally set a category when creating a task, or workers can categorize later

### Priority Levels (with colored flags)

| Priority | Flag | Color | Badge |
|----------|------|-------|-------|
| **High** | 🚩 | `#EF4444` (Red) | Red pulsing dot |
| **Medium** | 🟧 | `#F59E0B` (Amber/Orange) | Orange dot |
| **Low** | 🔵 | `#3B82F6` (Blue) | Blue dot |

### Status Flow

```
[todo] → [in-progress] → [in-review] → [done]
               ↕               ↕
          [on-hold]        [needs-info]
```

| Status | Set By | Meaning |
|--------|--------|---------|
| `todo` | Auto | Newly created, not started |
| `in-progress` | Worker | Actively being worked on |
| `on-hold` | Worker | Paused (external dependency, lower priority) |
| `needs-info` | Worker | Blocked — worker needs manager input |
| `in-review` | Worker | Work done, waiting for manager review |
| `done` | Worker/Manager | Accepted and complete |

### Worker Request Object

Stored in `/data/requests.json`. Workers can send requests to their boss for things only the boss can handle (approvals, resources, decisions, access, etc.).

```json
{
  "id": "uuid-v4",
  "title": "Need access to staging server",
  "description": "I need SSH credentials for the staging environment to deploy the latest build and run integration tests.",
  "priority": "high" | "medium" | "low",
  "status": "open" | "in-progress" | "resolved" | "declined",
  "deadline": "2026-03-12T00:00:00Z" | null,
  "relatedTaskId": "uuid-of-task" | null,
  "createdBy": "Alex",
  "assignedTo": "Sarah",
  "createdAt": "2026-03-10T14:00:00Z",
  "updatedAt": "2026-03-10T14:00:00Z",
  "resolvedAt": null,
  "notes": [
    {
      "id": "uuid",
      "author": "Alex",
      "role": "worker",
      "text": "This is blocking the deployment task",
      "timestamp": "2026-03-10T14:00:00Z",
      "files": []
    },
    {
      "id": "uuid",
      "author": "Sarah",
      "role": "manager",
      "text": "Credentials sent to your email. Let me know if you need anything else.",
      "timestamp": "2026-03-10T15:30:00Z",
      "files": []
    }
  ]
}
```

**Request Status Flow:**
```
[open] → [in-progress] → [resolved]
              ↓
          [declined]
```

| Status | Set By | Meaning |
|--------|--------|---------|
| `open` | Auto | Newly created, boss hasn't acted yet |
| `in-progress` | Boss | Boss acknowledged and is working on it |
| `resolved` | Boss | Request fulfilled |
| `declined` | Boss | Request denied (with reason in notes) |

### Chat Message Object

Stored in `/data/messages.json`. Real-time 1-on-1 chat between connected boss-worker pairs.

```json
{
  "conversations": {
    "boss-uuid::worker-uuid": {
      "participants": ["Sarah", "Alex"],
      "messages": [
        {
          "id": "uuid",
          "from": "Alex",
          "text": "Hey, I pushed the dashboard changes. Can you check when you get a chance?",
          "timestamp": "2026-03-10T15:30:00Z",
          "read": true,
          "files": []
        },
        {
          "id": "uuid",
          "from": "Sarah",
          "text": "Looks great! One small thing — see screenshot",
          "timestamp": "2026-03-10T15:45:00Z",
          "read": false,
          "files": [
            {
              "originalName": "feedback.png",
              "storedName": "1710000000000-feedback.png",
              "mimeType": "image/png",
              "size": 85000,
              "url": "/api/chat/files/1710000000000-feedback.png"
            }
          ]
        }
      ],
      "lastMessage": {
        "text": "Looks great! One small thing...",
        "from": "Sarah",
        "timestamp": "2026-03-10T15:45:00Z"
      }
    }
  }
}
```

**Key design decisions:**
- Conversation key is `bossId::workerId` — one conversation per boss-worker pair
- Messages are stored as a flat array per conversation (simple, efficient for small-medium teams)
- Files attached to messages are stored in `DATA_DIR/uploads/chat/` (separate from task files)
- `read` flag per message — enables unread badges
- `lastMessage` cached for quick conversation list rendering

---

## Manager Portal — Fast, Minimal, Phone-First

> **Design philosophy**: A manager should be able to create a task in under 15 seconds from their phone. No clutter, no learning curve. Everything is one tap away.

### UI Design Principles
- **Mobile-first**: Designed for 375px screens, scales up gracefully
- **Large touch targets**: All buttons min 48px, generous spacing
- **Minimal chrome**: No sidebar, no complex navigation — single scrollable page with sections
- **Bottom action bar** on mobile: sticky bar with "➕ New Task" always visible
- **Speed**: No animations that slow things down, instant feedback, skeleton loading
- **Dark theme by default**: Professional dark UI (`#0F172A` navy background) — easy on eyes, looks great on OLED phones
- **Light/Dark toggle**: ☀️/🌙 switch in header — preference saved in localStorage

### Layout: Single-Page Dashboard

```
┌─────────────────────────────────┐
│  🏢 TaskFlow — Manager          │  Header with user name
├─────────────────────────────────┤
│  ⚠️ 2 tasks need your input     │  Alert banner (tap to jump)
├─────────────────────────────────┤
│  [3 Active] [1 Blocked] [5 Done]│  Stat pills (filterable taps)
├─────────────────────────────────┤
│                                 │
│  🚩 Build dashboard      75% ██│  Task cards — compact,
│     Alex · Due in 2 days       │  scannable, tappable
│  ─────────────────────────────  │
│  🟧 Fix login bug        30% █ │
│     Unassigned · Due tomorrow  │
│  ─────────────────────────────  │
│  ❓ API integration       50% ██│  ← needs-info highlighted
│     Alex · BLOCKED             │
│                                 │
├─────────────────────────────────┤
│         [ ➕ New Task ]          │  Sticky bottom button
└─────────────────────────────────┘
```

### Features

#### 1. Quick Task Creation (Bottom Sheet / Modal)
- Slides up from bottom on mobile
- **Title** — auto-focused text input (just start typing)
- **Priority** — 3 big colored buttons: 🚩 🟧 🔵 (tap one, default Medium)
- **Deadline** — native date picker
- **Assign to** — dropdown of known workers (optional)
- **Notes** — expandable textarea (collapsed by default to keep it minimal)
- **📎 Attach Files** — tap to upload images, videos, PDFs, any files (multi-select)
  - Shows thumbnail previews for images/videos
  - Supports camera capture on mobile ("Take Photo" option)
  - Progress bar during upload
- **"Create" button** — one tap, done, sheet closes, task appears in list

#### 2. Task Cards (List View)
- Each card shows: priority flag, title, assignee, progress bar, deadline
- **Swipe right** → Quick-add note
- **Swipe left** → Change priority
- **Tap** → Opens detail view
- Color-coded left border by priority
- Cards with `needs-info` status get a **pulsing amber border** + ❓ icon

#### 3. Task Detail (Slide-in Panel)
- Opens as a full-screen slide-in on mobile
- Shows: title (editable inline), description, priority, deadline, assignee
- **Worker's status note** in a prominent card (highlighted if `needs-info`)
- **Progress bar** (read-only, set by worker)
- **📎 Attachments Gallery**: grid of all uploaded files for this task
  - Images show as thumbnails (tap to view full-size)
  - Videos show as thumbnails with ▶ play button (tap to play inline)
  - Other files show as download cards with icon + filename + size
  - **"+ Add Files" button** — upload more files anytime after task creation
- **Activity feed**: all notes chronologically, manager's in blue bubbles, worker's in gray
  - Notes with attached files show inline previews (image thumbnails, video players)
- **Reply box** at bottom: type a note + 📎 button to attach files → send
- **Quick actions** at top: Edit | Change Priority | Extend Deadline | Archive

#### 4. Filters & Search
- **Stat pills** at top act as filters: tap "Blocked" to see only blocked tasks
- **Pull-down search**: pull down on the list to reveal a search bar
- Filters: by worker, by priority, by status, by overdue

#### 5. Worker Live Status Panel
Visible at the top of the manager dashboard — shows who's working right now:

```
┌─────────────────────────────────┐
│  👥 TEAM STATUS                 │
├─────────────────────────────────┤
│  🟢 Alex · Working · 5h 23m    │  ← green = active
│     📍 Home · "Build dashboard" │
│  🟡 Jordan · Paused · 4h 10m   │  ← yellow = paused
│     📍 Office                   │
│  ⚫ Sam · Offline               │  ← gray = not clocked in
└─────────────────────────────────┘
```

- **Real-time** via WebSocket — status updates instantly when worker plays/pauses
- Green dot = working, Yellow dot = paused/break, Gray = offline/not clocked in
- Shows current task being worked on, location (Home/Office), and total hours today
- Tap a worker → see their full work calendar for the month

#### 6. Work Hours Calendar (Manager View)
Accessible by tapping a worker's name in the status panel:

```
┌─────────────────────────────────┐
│  📅 Alex — March 2026           │
│  ◀ Feb                   Apr ▶ │
├──┬──┬──┬──┬──┬──┬──────────────┤
│Mo│Tu│We│Th│Fr│Sa│Su             │
├──┼──┼──┼──┼──┼──┼──────────────┤
│  │  │  │  │  │ 1│ 2             │
│ 3│ 4│ 5│ 6│ 7│ 8│ 9             │
│8h│7h│8h│6h│8h│  │               │
│🏠│🏢│🏢│🏠│🏢│  │               │
│──│──│──│──│──│──│───────────────│
│10│11│...                        │
└─────────────────────────────────┘
│  Monthly Summary:               │
│  Total: 142h 30m                │
│  Office: 18 days (98h)          │
│  Home: 4 days (44h 30m)         │
│  Avg/day: 6h 29m                │
│                                 │
│  [📄 Download PDF Report]       │
└─────────────────────────────────┘
```

- **Calendar grid** showing hours worked per day + location icon (🏠/🏢)
- Color-coded days: green = 8h+, amber = 4-8h, red = <4h, gray = no work
- Tap any day → see detailed breakdown (clock in/out, tasks worked on, breaks)
- **Monthly summary** at bottom: total hours, office vs home split, average per day
- **"📄 Download PDF Report"** button — generates a professional PDF with:
  - Worker name, month, year
  - Day-by-day table: date, clock in, clock out, total hours, location, tasks worked on
  - Monthly totals: total hours, office days, home days, average hours
  - Ready for HR/payroll

#### 7. Manager-Specific Touches
- **Badge count** on browser tab: "(3) TaskFlow" — shows tasks needing attention
- **Subtle haptic-style feedback** on actions (CSS micro-animations)
- **Empty states**: Friendly messages like "All clear! No blocked tasks 🎉"

#### 8. Worker Requests Inbox
Workers can send requests to their boss (things only the boss can handle: approvals, resources, access, decisions).

```
┌─────────────────────────────────┐
│  📨 REQUESTS (3 open)            │
├─────────────────────────────────┤
│  🚩 Need staging SSH keys       │  ← High priority
│     Alex · 2h ago · Due Mar 12  │
│     🔗 Related: Deploy v2.1     │
│  ─────────────────────────────  │
│  🟧 Budget approval for plugin  │  ← Medium
│     Jordan · 1d ago             │
│  ─────────────────────────────  │
│  🔵 Office key for weekend work │  ← Low
│     Sam · 3d ago                │
└─────────────────────────────────┘
```

- **Alert banner** at top: "📨 3 new requests from workers" (like the blocked tasks banner)
- **Compact request cards** showing: priority flag, title, worker name, time ago, deadline (if set), related task link
- **Tap a request** → opens detail with description, notes thread, and action buttons
- **Quick actions**: Mark In Progress | Resolve | Decline (with note)
- **Reply** to a request adds a note (with optional file attachments)
- Resolved/declined requests move to a separate "Handled" section (collapsible)
- Boss gets **real-time notification** via WebSocket when a new request arrives

#### 9. Chat (Real-Time Messaging)
Direct messages between boss and connected workers — real-time via WebSocket.

```
┌─────────────────────────────────┐
│  💬 MESSAGES                     │
├─────────────────────────────────┤
│  🟢 Alex           · 2m ago     │
│  "Pushed the dashboard changes" │
│  ─────────────────────────────  │
│  🟡 Jordan         · 1h ago     │
│  "Can we sync tomorrow?"        │
│  ─────────────────────────────  │
│  ⚫ Sam             · 2d ago     │
│  "Thanks for the VPN access"    │
└─────────────────────────────────┘
```

- **Conversation list**: shows all connected workers with online status dot, last message preview, and unread badge
- **Tap a conversation** → opens chat thread (full-screen on mobile, slide-out panel on desktop)
- **Message input**: text field + 📎 attach files + Send button
- **File sharing**: drag & drop or click to attach images, docs, videos — shows inline previews
- **Real-time delivery**: messages appear instantly via WebSocket (no polling)
- **Unread badges**: red dot with count on conversation list and in the nav
- **Read receipts**: subtle checkmarks (✓ sent, ✓✓ read)
- **Typing indicator**: "Alex is typing..." shown in real-time
- Boss can chat with any connected worker; workers can chat with their connected boss(es)

---

## Worker Portal — Rich, Detailed, Innovative UI

> **Design philosophy**: A power workspace. The worker lives in this tool all day. It should feel as good as Notion or Linear — with Kanban boards, detailed views, drag & drop, smooth animations, and everything visible at a glance.

### UI Design Principles
- **Information-dense but organized**: Show everything, but use visual hierarchy so nothing feels cluttered
- **Multiple view modes**: Switch between Kanban, List, and Calendar
- **Drag & drop everywhere**: Reorder tasks, move between columns/categories, feels tactile
- **Smooth animations**: CSS transitions on every state change, cards slide/fade, progress bars animate
- **Responsive**: Full experience on desktop, adapted layout on mobile with swipe gestures
- **Light theme by default** with dark mode toggle (☀️/🌙 in header)
- **Glassmorphism / modern design**: Subtle blur effects, rounded cards, soft shadows

### Layout: Multi-Panel Workspace

```
┌──────────┬──────────────────────────────────────────────┐
│          │  🔍 Search...            [Kanban|List|Cal]   │
│ SIDEBAR  │─────────────────────────────────────────────│
│          │                                              │
│ 📋 All   │  TODO          IN PROGRESS      IN REVIEW   │
│ 📂 Frontend│ ┌──────────┐ ┌──────────┐   ┌──────────┐  │
│ 📂 Backend │ │🚩Fix auth │ │🟧Dashboard│   │🔵Footer  │  │
│ 📂 Design  │ │  Due 3d  │ │  65% ████│   │ 100% ████│  │
│ 📂 Bugs    │ │  Sarah   │ │  Due 5d  │   │  Due tom │  │
│ ── ── ──   │ └──────────┘ └──────────┘   └──────────┘  │
│ + New Cat  │              ┌──────────┐                  │
│            │              │❓API keys │ ← pulsing border│
│ ── ── ──   │              │  50% ██  │                  │
│ 📊 Stats   │              │  BLOCKED │                  │
│ ⚙️ Settings│              └──────────┘                  │
│            │                                            │
│ 👤 Alex    │  ON HOLD         DONE                      │
│            │ ┌──────────┐  ┌──────────┐                 │
│            │ │🟧Mobile  │  │✅ Login  │                  │
│            │ │  ⏸ Wait  │  │ Mar 8    │                  │
│            │ └──────────┘  └──────────┘                  │
└──────────┴──────────────────────────────────────────────┘
```

### Features

#### 1. Kanban Board (Default View)
- **Columns**: Todo | In Progress | On Hold | Needs Info | In Review | Done
- **Drag & drop** cards between columns → auto-updates task status
- **Drag to reorder** within a column (manual priority ordering)
- Cards show: priority flag, title, progress bar, deadline countdown, assignee avatar/initial, category tag
- **Column counts** in headers: "In Progress (4)"
- **Collapse columns**: click column header to collapse (useful on mobile)
- **Swimlanes** (optional toggle): group rows by category or by priority
- **Done column** auto-collapses old tasks (shows last 5, "Show all" link)

#### 2. List View (Toggle)
- Dense table view for scanning many tasks:
  - Checkbox | Priority | Title | Category | Status | Progress | Deadline | Assigned | Updated
- **Sortable columns**: click any header to sort
- **Bulk actions**: select multiple → change status, change category, etc.
- **Inline editing**: click progress to edit, click status to toggle dropdown
- **Row grouping**: group by category, by priority, by deadline (this week / next week / later)

#### 3. Calendar View (Toggle)
- Monthly calendar with task deadlines shown as colored dots/pills
- Click a day → see tasks due that day
- Drag tasks to reschedule (if the worker has reschedule permission — optional)

#### 4. Category Sidebar
- Left sidebar with collapsible category tree
- **"All Tasks"** at top (default)
- Each category shows count of active tasks
- **"+ New Category"** button at bottom
- **Drag tasks onto categories** in sidebar to re-categorize
- Categories are **color-coded** (customizable color picker)
- Edit/delete categories via right-click context menu
- Categories persist per worker in their localStorage

#### 5. Task Detail (Slide-Out Panel)
Opens as a wide slide-out panel from the right (doesn't navigate away from the board):

```
┌─────────────────────────────────────┐
│ ← Back                    🚩 HIGH  │
│                                     │
│ Build User Dashboard                │
│ Created by Sarah · Mar 10           │
│ Deadline: Mar 15 (5 days left)      │
│ Category: [Frontend ▼]             │
│                                     │
│ ┌─ PROGRESS ──────────────────────┐ │
│ │ [===========........] 65%       │ │  ← draggable slider
│ │ ◀ ━━━━━━━━━━━━━━━━●━━━━ ▶      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ STATUS ────────────────────────┐ │
│ │ ◉ In Progress                   │ │  ← segmented control
│ │ ○Todo ○Hold ○NeedInfo ○Review ○Done│
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ STATUS NOTE ───────────────────┐ │
│ │ Working on responsive layout,   │ │  ← always visible
│ │ header and sidebar complete.    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ DESCRIPTION ───────────────────┐ │
│ │ Build the main user dashboard   │ │
│ │ following the Figma designs...  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ── ACTIVITY ──────────────────────  │
│ 💬 Sarah (Manager) · 2h ago        │
│   "Use the new color palette from   │
│    the brand guide. Link: [...]"    │
│                                     │
│ 💬 You · 1h ago                     │
│   "Started with the layout. Need   │
│    clarification on sidebar width." │
│                                     │
│ ┌─ ATTACHMENTS ────────────────────┐ │
│ │ [img1.png] [video.mp4] [spec.pdf]│ │  ← thumbnail grid
│ │  ⬇ Download All (3 files, 12MB)  │ │  ← one-click download
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ ADD NOTE ──────────────────────┐ │
│ │ [Update ▼] [                  ] │ │
│ │ [  Type your note here...     ] │ │
│ │      [📎 Attach] [🔗 Link] [Send]│ │
│ └─────────────────────────────────┘ │
│                                     │
│ Note types:                         │
│  📝 Progress Update                 │
│  ❓ Request Info (→ sets needs-info)│
│  ✅ Completion Report (→ in-review) │
└─────────────────────────────────────┘
```

#### 6. Drag & Drop Interactions
- **Kanban**: drag cards between status columns
- **Categories**: drag cards to sidebar categories
- **Reorder**: drag cards within a column to set personal priority order
- **Mobile**: long-press to pick up, drag to move (with haptic-style feedback)
- **Visual feedback**: ghost card follows cursor/finger, drop zones highlight, smooth snap animation

#### 7. Time Tracker (Always Visible)

A persistent **floating timer bar** at the top of the worker portal — always visible, never hidden:

```
┌──────────────────────────────────────────────────────┐
│  ▶  05:23:41  │ 🏠 Home │ 📋 Build dashboard │ ⏸  ⏹ │
└──────────────────────────────────────────────────────┘
```

**Controls:**
- **▶ Play** — Start/resume working. Timer counts up. Status goes to `working`
- **⏸ Pause** — Pause for a break. Timer pauses. Status goes to `paused`
- **⏹ Stop / Clock Out** — End the work day. Status goes to `offline`
- **Location toggle**: tap to switch between 🏠 Home / 🏢 Office / 📍 Other
  - "Other" lets you type a short note (e.g., "Client site", "Coffee shop")
- **Task selector**: dropdown showing your current assigned tasks
  - Select which task you're working on — time gets logged to that task
  - Can switch tasks without stopping the timer (auto-creates new time entry)
  - "General / No task" option for meetings, admin work, etc.

**Visual States:**
- **Working**: green pulsing border, green ▶ icon, timer counting
- **Paused**: amber border, amber ⏸ icon, timer frozen, subtle pulse animation
- **Offline**: gray, collapsed to just "Clock In" button

**Auto-behaviors:**
- If browser/tab is closed while timer is running → auto-pause (prevents phantom hours)
- Heartbeat ping every 30s to server — if no ping for 2min, auto-set to `offline`
- Resuming after auto-pause shows a confirmation: "You were paused at 2:30 PM. Resume?"

**On Clock In (start of day):**
- Prompt: "Where are you working today?" → 🏠 Home / 🏢 Office / 📍 Other
- Timer starts, day entry created

**On Clock Out (end of day):**
- Shows day summary: "Today: 7h 45m worked · 45m breaks · 3 tasks"
- Confirm → status goes offline, boss sees updated hours

#### 8. Work Calendar (Worker View)

Accessible from sidebar → 📅 Calendar:

```
┌──────────────────────────────────────────────┐
│  📅 My Work Calendar — March 2026            │
│  ◀ Feb                              Apr ▶  │
├────┬────┬────┬────┬────┬────┬────────────────┤
│ Mo │ Tu │ We │ Th │ Fr │ Sa │ Su             │
├────┼────┼────┼────┼────┼────┼────────────────┤
│    │    │    │    │    │  1 │  2             │
│  3 │  4 │  5 │  6 │  7 │  8 │  9             │
│ 8h │7.5h│ 8h │ 6h │ 8h │    │                │
│ 🏠 │ 🏢 │ 🏢 │ 🏠 │ 🏢 │    │                │
│ ██ │ ██ │ ██ │ █▒ │ ██ │    │                │
├────┴────┴────┴────┴────┴────┴────────────────┤
│ Today: Mon, Mar 10                           │
│ ┌──────────────────────────────────────────┐ │
│ │ 09:00 ──── 12:30  Build dashboard  3.5h │ │
│ │ 12:30 ──── 13:00  ☕ Break          0.5h │ │
│ │ 13:00 ──── 15:23  Fix login bug    2.4h │ │
│ │ 15:23 ──── now    ▶ Working...          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ This week: 37h 30m / 40h                     │
│ This month: 142h 30m                         │
│ 🏠 Home: 8 days  │  🏢 Office: 14 days       │
└──────────────────────────────────────────────┘
```

**Features:**
- **Monthly calendar** with hours per day, location icons, and fill bars
- **Tap any day** → detailed breakdown: every time entry, task worked on, breaks
- **Color coding**: green = 8h+, amber = 4-8h, red = <4h, gray = weekend/no work
- **Week & month totals** always shown below
- **Edit past entries**: click a time entry to adjust start/end (typo correction)
  - Edited entries get a small "edited" badge
- **Location summary**: how many days home vs office this month
- **Streaks**: "🔥 5-day streak" for consecutive full work days

#### 9. Worker Dashboard (Stats Panel)
Accessible from sidebar, shows:
- **My stats this week**: tasks completed, avg completion time, tasks overdue
- **Time stats**: hours this week vs target (40h), daily average, overtime
- **Progress overview**: stacked bar chart of all task statuses
- **Category breakdown**: pie/donut chart of tasks by category
- **Velocity**: tasks completed per week trend (simple line chart)

#### 10. Worker Requests (to Boss)
Workers can make requests to their boss for things they can't handle themselves:

```
┌──────────┬──────────────────────────────────────────────┐
│          │  📨 MY REQUESTS                              │
│ SIDEBAR  │──────────────────────────────────────────────│
│          │                                              │
│ ...      │  OPEN              IN PROGRESS   RESOLVED    │
│ 📨 Requests│ ┌──────────┐   ┌──────────┐   ┌──────────┐│
│          │ │🚩Need SSH│   │🟧Budget  │   │✅ VPN    ││
│          │ │  keys    │   │  approval│   │  access  ││
│          │ │  Due 3/12│   │  Sarah ↻ │   │  Mar 5   ││
│          │ │🔗Deploy  │   └──────────┘   └──────────┘│
│          │ └──────────┘                               │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Creating a Request:**
- **"📨 New Request"** button in sidebar or top bar
- Opens a form:
  - **Title** — short summary (required)
  - **Description** — detailed explanation (textarea, supports markdown)
  - **Priority** — 🚩 High / 🟧 Medium / 🔵 Low (colored buttons, like task creation)
  - **Deadline** — optional date picker ("when do you need this by?")
  - **Related Task** — optional dropdown of current tasks (auto-links request to task)
  - **📎 Attach Files** — optional file uploads (screenshots, documents, etc.)
  - **"Send Request" button** → creates request, boss gets notified instantly via WebSocket

**Request Features:**
- Sent to the worker's connected boss(es)
- Real-time updates: boss replies/resolves → worker sees it instantly
- Related task link: clicking it opens the linked task detail
- Notes thread: back-and-forth conversation (same as task notes — supports files)
- Requests show a badge count in the sidebar: "📨 Requests (2 open)"
- **Status tracking**: worker can see if boss has acknowledged (in-progress) or not (open)
- Resolved/declined requests stay visible with boss's response
- **Request types** (common use cases):
  - Need access/credentials
  - Need approval (budget, time off, tool purchase)
  - Need a decision (design choice, priority call)
  - Need resources (files, documentation, accounts)
  - General help request

#### 11. Chat (Real-Time Messaging)
Direct messaging with connected boss(es) — accessible from sidebar.

```
┌──────────┬──────────────────────────────────────────────┐
│          │  💬 Chat with Sarah                          │
│ SIDEBAR  │──────────────────────────────────────────────│
│          │                                              │
│ ...      │  ┌────────────────────────────────────────┐  │
│ 📨 Requests│  │  Sarah (Manager) · 3:30 PM              │  │
│ 💬 Chat ●2│  │  Can you update the footer styles too? │  │
│          │  │  [feedback.png]                         │  │
│          │  └────────────────────────────────────────┘  │
│          │                   ┌─────────────────────┐  │
│          │                   │  Sure, I'll handle  │  │
│          │                   │  that now! ✓✓         │  │
│          │                   └─────────────────────┘  │
│          │                                              │
│          │  Sarah is typing...                          │
│          │  ┌────────────────────────────────────────┐  │
│          │  │ Type a message...        [📎] [Send]  │  │
│          │  └────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────┘
```

**Chat features:**
- **💬 Chat** in sidebar with unread badge count (red dot)
- Click → conversation list (if multiple bosses) or direct to chat thread
- **Message bubbles**: left-aligned (boss), right-aligned (you) with timestamps
- **File sharing**: 📎 button to attach images, documents, videos — inline preview in chat
- **Drag & drop** files directly into chat window
- **Image previews**: thumbnails inline, click to view full-size
- **Read receipts**: ✓ sent, ✓✓ read (subtle, below message)
- **Typing indicator**: "Sarah is typing..." — real-time via WebSocket
- **Unread count** in sidebar badge + browser tab title: "(2) TaskFlow"
- Messages persist across sessions (stored server-side in `messages.json`)
- Accessible from mobile: full-screen chat view with native keyboard behavior

#### 12. Mobile Layout (Worker)
On screens < 768px:
- **Bottom tab bar**: Kanban | List | Timer | Calendar | Stats
- **Timer bar** remains floating at top even on mobile
- **Kanban becomes horizontal scroll**: swipe between columns
- **Sidebar becomes a hamburger drawer**: slide from left
- **Cards are full-width**: optimized for thumb reach
- **Swipe gestures on cards**: swipe right = in-progress, swipe left = on-hold
- **Pull-to-refresh**: sync latest data from server

---

## Design System & Visual Style

### Theme Engine
- Both portals use **CSS custom properties** (`--var`) for all colors
- A single `[data-theme="dark"]` / `[data-theme="light"]` attribute on `<html>` switches everything
- Toggle is a **☀️/🌙 icon button** in the header — smooth cross-fade transition (200ms)
- Preference saved in `localStorage`, respected on reload
- Respects `prefers-color-scheme` on first visit (uses OS setting as default)

### Color Palette — Manager Portal

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--bg-primary` | `#0F172A` (deep navy) | `#F8FAFC` (soft white) |
| `--bg-secondary` | `#1E293B` (slate 800) | `#FFFFFF` |
| `--bg-card` | `#1E293B` | `#FFFFFF` |
| `--bg-hover` | `#334155` | `#F1F5F9` |
| `--text-primary` | `#F1F5F9` | `#0F172A` |
| `--text-secondary` | `#94A3B8` | `#64748B` |
| `--text-muted` | `#64748B` | `#94A3B8` |
| `--border` | `#334155` | `#E2E8F0` |
| `--accent` | `#3B82F6` (blue 500) | `#2563EB` (blue 600) |
| `--accent-hover` | `#2563EB` | `#1D4ED8` |
| `--success` | `#10B981` | `#059669` |
| `--warning` | `#F59E0B` | `#D97706` |
| `--danger` | `#EF4444` | `#DC2626` |
| `--shadow` | `0 4px 6px rgba(0,0,0,0.4)` | `0 4px 6px rgba(0,0,0,0.07)` |

### Color Palette — Worker Portal

| Token | Light Mode | Dark Mode |
|-------|------------|------------|
| `--bg-primary` | `#F9FAFB` (warm gray 50) | `#111827` (gray 900) |
| `--bg-secondary` | `#FFFFFF` | `#1F2937` (gray 800) |
| `--bg-card` | `#FFFFFF` | `#1F2937` |
| `--bg-hover` | `#F3F4F6` | `#374151` |
| `--bg-kanban` | `#F3F4F6` (column bg) | `#1F2937` |
| `--text-primary` | `#111827` | `#F9FAFB` |
| `--text-secondary` | `#6B7280` | `#9CA3AF` |
| `--border` | `#E5E7EB` | `#374151` |
| `--accent` | `#6366F1` (indigo 500) | `#818CF8` (indigo 400) |
| `--accent-hover` | `#4F46E5` | `#6366F1` |
| `--success` | `#10B981` | `#34D399` |
| `--warning` | `#F59E0B` | `#FBBF24` |
| `--danger` | `#EF4444` | `#F87171` |
| `--glass-bg` | `rgba(255,255,255,0.7)` | `rgba(31,41,55,0.7)` |
| `--glass-border` | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.05)` |
| `--shadow` | `0 4px 6px rgba(0,0,0,0.05)` | `0 4px 6px rgba(0,0,0,0.4)` |

### Typography
- **Font stack**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  - Loaded via Google Fonts CDN (`<link>` tag)
  - Fallback to system fonts if offline
- **Scale**:
  - Page title: `24px / 700 weight`
  - Section title: `18px / 600`
  - Card title: `15px / 600`
  - Body text: `14px / 400`
  - Small/meta: `12px / 400`
  - Timer display: `32px / 700 / tabular-nums` (monospace digits)
- **Line height**: `1.5` body, `1.2` headings
- **Letter spacing**: `-0.01em` headings, `0` body

### Card Style
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}
```
- **Priority left border**: 3px solid colored border on left edge
- **Rounded corners**: 12px cards, 8px buttons, 6px inputs
- **Hover lift**: subtle translateY(-2px) + shadow increase

### Glassmorphism (Worker Portal)
```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
}
```
- Used for: slide-out detail panel, floating timer bar, modal overlays
- Gives depth without feeling heavy
- Falls back to solid color on browsers without backdrop-filter

### Buttons
| Type | Style |
|------|-------|
| Primary | Solid `--accent` bg, white text, 8px radius, 48px min height |
| Secondary | Transparent bg, `--accent` text + border, 8px radius |
| Ghost | Transparent bg, `--text-secondary` text, no border |
| Danger | Solid `--danger` bg, white text |
| Icon | 40px circle, transparent bg, hover: `--bg-hover` |

- All buttons: `transition: all 0.15s ease`
- Hover: darken 10%, subtle scale(1.02)
- Active: scale(0.98) for tactile press feel
- Focus: 2px ring in `--accent` with 2px offset (accessibility)

### Inputs
```css
input, textarea, select {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.15s;
}
input:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
```

### Animations & Transitions
| Element | Animation |
|---------|-----------|
| Theme switch | 200ms cross-fade on all colors |
| Cards appearing | `fadeInUp` (translate 10px + opacity, 200ms) |
| Card drag | Ghost at 0.7 opacity, drop zone highlight |
| Progress bar fill | 500ms ease-out width transition |
| Modals/panels | 250ms slide-in from right (worker) / bottom (boss) |
| Status badges | Color transition 200ms |
| Pulsing (needs-info) | `pulse` keyframe, 2s infinite |
| Toast notifications | Slide down 300ms, auto-dismiss fade 300ms |
| Timer digits | Tabular nums, no layout shift on tick |
| Hover lift | 150ms translateY + shadow |
| Button press | 100ms scale(0.98) |

### Spacing System
Based on **4px grid**:
- `4px` (xs) → `8px` (sm) → `12px` (md) → `16px` (lg) → `24px` (xl) → `32px` (2xl) → `48px` (3xl)
- Cards: `16px` padding
- Card gap: `12px`
- Section gap: `24px`
- Page padding: `16px` mobile, `24px` tablet, `32px` desktop

### Responsive Breakpoints
| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single column, bottom nav, full-width cards |
| Tablet | 640-1024px | Sidebar collapses, 2-column kanban |
| Desktop | > 1024px | Full sidebar, multi-column kanban, split panels |

### Landing Pages Visual Style
- **Boss**: Deep navy gradient (`#0F172A` → `#1E293B`), centered content, large bold headline, subtle animated dots/grid pattern in background, accent blue CTA button
- **Worker**: Light gradient (`#F9FAFB` → `#EEF2FF`), centered content, indigo accent, subtle floating shapes animation in background, warm and inviting feel
- Dark mode versions: Boss stays dark, Worker switches to `#111827` → `#1E1B4B` gradient
- Both: minimal — just logo, tagline, form, button. No distractions.

---

## Shared UI Components

### Progress Bar
```
[████████████░░░░░░░░] 60%
```
- **Green** fill for on-track
- **Amber** if past 80% of deadline time but < 80% progress
- **Red** if overdue
- **Animated fill**: smooth CSS transition when progress changes

### Priority Flags
- 🚩 **High** — Red flag icon, red left border on card, red pulsing dot
- 🟧 **Medium** — Orange flag icon, orange left border, orange dot
- 🔵 **Low** — Blue flag icon, blue left border, blue dot

### Status Badges
| Status | Color | Icon | Card Effect |
|--------|-------|------|-------------|
| Todo | Gray `#9CA3AF` | ○ | Muted card |
| In Progress | Blue `#3B82F6` | ◉ | Normal card |
| On Hold | Amber `#F59E0B` | ⏸ | Amber left accent |
| Needs Info | Red `#EF4444` | ❓ | Pulsing amber border |
| In Review | Purple `#8B5CF6` | 👁 | Purple glow |
| Done | Green `#10B981` | ✅ | Faded/muted card |

### Deadline Display
- **> 3 days away**: Normal gray text, "5 days left"
- **1–3 days away**: Amber text + ⚠️ icon, "2 days left"
- **Today**: Bold amber, "Due today"
- **Overdue**: Red text + 🔴 "X days overdue", card gets red top border

### Timestamps
- Relative time: "5 min ago", "2 hours ago", "Yesterday", "Mar 8"

### Toast Notifications
- Slide-in from top-right (desktop) or top-center (mobile)
- "✅ Task created" / "📝 Note added" / "⚠️ New blocked task"
- Auto-dismiss after 3 seconds

---

## Workflow Examples

### Scenario 1: Normal Task Flow
1. **Manager Sarah** opens `/boss` on her phone, taps ➕
2. Types "Build user dashboard", taps 🚩 High, sets deadline Mar 15, assigns to Alex → Create
3. Taps the new task card, adds a note: "Use the Figma design: [link]"
4. **Worker Alex** opens `/worker`, sees the new task in the "Todo" Kanban column
5. Drags it to "In Progress", sets progress to 10%, categorizes it as "Frontend"
6. Adds progress update: "Started with the layout skeleton"
7. Over the next days, drags the progress slider up: 45%... 65%... 80%
8. Adds completion report: "Done. Test at `/dashboard`. All 12 tests pass."
9. Card auto-moves to "In Review" column
10. **Sarah** sees it on her phone, reads the report, taps ✅ to mark Done

### Scenario 2: Blocked / Needs Info
1. **Alex** hits a blocker, adds info request: "API returns 403. Need updated key."
2. Task auto-moves to "Needs Info" column with pulsing border
3. **Sarah** sees ⚠️ on her phone: "1 task needs your input"
4. Opens task, types reply: "Updated key: sk-xxx. Try again."
5. **Alex** sees the note, drags task back to "In Progress", continues

### Scenario 3: Multiple Workers
1. **Sarah** creates 3 tasks: assigns 2 to Alex, 1 to Jordan
2. **Alex** sees his 2 assigned tasks highlighted in his dashboard
3. **Jordan** sees her 1 assigned task
4. Both can also see unassigned tasks and self-assign if needed

### Scenario 4: Categories
1. **Alex** creates category "Q2 Launch" with purple color
2. Drags 5 related tasks into the "Q2 Launch" category
3. Clicks "Q2 Launch" in sidebar → sees only those 5 tasks on the Kanban board
4. Uses this to focus and track a specific initiative across multiple tasks

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML + CSS + JavaScript (no frameworks) |
| Backend | Node.js + Express (lightweight API server) |
| Real-time | WebSocket (native `ws` library) |
| Storage | JSON files on configurable path (`DATA_DIR` env var, default `./data`) |
| File Uploads | `multer` (multipart form data) → saved to `DATA_DIR/uploads/` |
| PDF Reports | `pdfkit` (server-side PDF generation for monthly work reports) |
| Data Export | `archiver` (ZIP generation for full backups and bulk downloads) |
| Styling | Custom CSS with CSS variables, glassmorphism, transitions, light/dark mode |
| Drag & Drop | Native HTML5 Drag & Drop API + touch event polyfill |
| Icons | Unicode emoji + inline SVG |
| ID Generation | `crypto.randomUUID()` |
| Mobile | Responsive CSS + touch events + viewport meta |
| Deployment | Railway (with persistent volume mounted at `/data`) |

### Why This Stack?
- **Minimal dependencies**: `express`, `ws`, `multer`, `pdfkit`, `bcryptjs`, and `archiver` — that's it
- **No build step**: just `node server.js` and go
- **Multi-device**: any browser on any device, anywhere
- **Real-time**: WebSocket means both portals stay in sync without refreshing
- **Persistent storage**: Railway volume survives redeploys — files and data are safe
- **Easy to deploy**: `railway up` and it's live

---

## File Structure (Final)

```
/TO DO/
├── PLAN.md                    ← This file
├── package.json               ← npm project (express + ws + multer + pdfkit + bcrypt + archiver)
├── server.js                  ← Express server + WebSocket + REST API + auth + file upload + time tracking + admin
├── .gitignore                 ← Ignores data/, node_modules/
├── railway.json               ← Railway deployment config (volume mount)
├── data/                      ← Configurable via DATA_DIR env var (gitignored)
│   ├── users.json             ← User accounts with hashed passwords
│   ├── teams.json             ← Boss-worker connections & invites
│   ├── tasks.json             ← Persistent task storage (auto-created)
│   ├── timelog.json           ← Work sessions & time entries (auto-created)
│   ├── categories.json        ← Custom categories (auto-created)
│   ├── config.json            ← System config / admin settings
│   ├── requests.json          ← Worker requests to bosses (auto-created)
│   ├── messages.json          ← Chat messages between boss-worker pairs
│   └── uploads/               ← Uploaded files organized by task
│       └── {taskId}/
│           ├── 17100...-mockup.png
│           └── 17100...-demo.mp4
├── public/
│   ├── boss/
│   │   └── index.html         ← Manager portal (self-contained HTML/CSS/JS)
│   ├── worker/
│   │   └── index.html         ← Worker portal (self-contained HTML/CSS/JS)
│   ├── admin/
│   │   └── index.html         ← Admin portal (system control panel)
│   └── shared/
│       ├── api.js             ← REST + WebSocket client helpers
│       ├── models.js          ← Task model, enums, category defaults
│       ├── i18n.js            ← Lightweight i18n module
│       └── i18n/              ← Translation JSON files
│           ├── en.json        ← English (default fallback)
│           └── de.json        ← German
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | Get all tasks (supports `?assignedTo=`, `?status=`, `?category=`) |
| `POST` | `/api/tasks` | Create a new task |
| `PUT` | `/api/tasks/:id` | Update a task (progress, status, category, etc.) |
| `DELETE` | `/api/tasks/:id` | Archive/delete a task |
| `POST` | `/api/tasks/:id/notes` | Add a note to a task (supports multipart with files) |
| `POST` | `/api/tasks/:id/files` | Upload files to a task (multipart, multiple files) |
| `GET` | `/api/files/:taskId/:filename` | Download/view a specific file |
| `GET` | `/api/files/:taskId` | List all files for a task |
| `GET` | `/api/files/:taskId/download-all` | Download all files as ZIP |
| `GET` | `/api/workers` | Get list of known workers (for search/invite) |
| `GET` | `/api/categories` | Get all categories |
| `POST` | `/api/categories` | Create a new category |
| `POST` | `/api/auth/signup` | Create account (name + password + role) |
| `POST` | `/api/auth/login` | Log in (name + password) → returns session token |
| `POST` | `/api/auth/logout` | Log out (invalidate token) |
| `GET` | `/api/auth/me` | Get current user info from token |
| `GET` | `/api/team` | Get team members + pending invites |
| `POST` | `/api/team/invite` | Send team invite to a worker (by name) |
| `POST` | `/api/team/respond` | Accept or decline an invite |
| `DELETE` | `/api/team/:connectionId` | Remove a worker from team |
| `GET` | `/api/team/invites` | Get pending invites for current user |
| `POST` | `/api/time/clock-in` | Clock in (start day, set location) |
| `POST` | `/api/time/clock-out` | Clock out (end day) |
| `POST` | `/api/time/play` | Start/resume timer (set current task) |
| `POST` | `/api/time/pause` | Pause timer (break) |
| `POST` | `/api/time/heartbeat` | Heartbeat ping (every 30s while working) |
| `GET` | `/api/time/status` | Get live status of all workers |
| `GET` | `/api/time/sessions?worker=&month=&year=` | Get work sessions for a worker/month |
| `PUT` | `/api/time/sessions/:id` | Edit a past time entry (fix typos) |
| `GET` | `/api/time/report?worker=&month=&year=` | Generate monthly PDF report |
| `GET` | `/api/requests` | Get requests (worker: own requests, boss: requests from team) |
| `POST` | `/api/requests` | Create a new request (worker → boss) |
| `PUT` | `/api/requests/:id` | Update request (status, add note) |
| `DELETE` | `/api/requests/:id` | Delete a request (creator only) |
| `POST` | `/api/requests/:id/notes` | Add a note to a request (supports file attachments) |
| `GET` | `/api/chat/conversations` | Get conversation list (last message, unread count per conversation) |
| `GET` | `/api/chat/:userId` | Get messages with a specific user (paginated, `?before=&limit=`) |
| `POST` | `/api/chat/:userId` | Send a message (supports multipart for file attachments) |
| `PUT` | `/api/chat/:userId/read` | Mark conversation as read |
| `GET` | `/api/chat/files/:filename` | Download a file shared in chat |
| `POST` | `/api/admin/login` | Admin login (username `admin` + env password) |
| `GET` | `/api/admin/users` | List all users |
| `PUT` | `/api/admin/users/:id` | Edit user (reset password, change role) |
| `DELETE` | `/api/admin/users/:id` | Delete user account |
| `POST` | `/api/admin/users` | Create user manually |
| `GET` | `/api/admin/tasks` | List all tasks (unscoped) |
| `DELETE` | `/api/admin/tasks/:id` | Force-delete any task |
| `GET` | `/api/admin/teams` | List all team connections + invites |
| `POST` | `/api/admin/teams` | Force-create a boss-worker connection |
| `DELETE` | `/api/admin/teams/:id` | Force-remove a connection |
| `GET` | `/api/admin/timelog` | All time entries (filterable) |
| `PUT` | `/api/admin/timelog/:id` | Edit any time entry |
| `GET` | `/api/admin/export/all` | Download full backup as ZIP |
| `GET` | `/api/admin/export/:file` | Download individual JSON file |
| `GET` | `/api/admin/export/uploads` | Download all uploads as ZIP |
| `POST` | `/api/admin/import/all` | Restore from backup ZIP |
| `POST` | `/api/admin/import/:file` | Import individual JSON (merge/replace) |
| `GET` | `/api/admin/config` | Get system settings |
| `PUT` | `/api/admin/config` | Update system settings |
| `GET` | `/api/admin/health` | System health info (uptime, connections, storage) |
| `GET` | `/api/admin/activity` | Recent activity log |
| `WS` | `/ws` | WebSocket for real-time updates |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `task:created` | Server → All | Full task object |
| `task:updated` | Server → All | Updated task object |
| `task:deleted` | Server → All | `{ id }` |
| `note:added` | Server → All | `{ taskId, note }` |
| `time:status` | Server → Managers | `{ worker, status, task, location, todayTotal }` |
| `time:clockin` | Server → Managers | `{ worker, location, time }` |
| `time:clockout` | Server → Managers | `{ worker, totalToday, time }` |
| `team:invite` | Server → Worker | `{ from, inviteId }` |
| `team:accepted` | Server → Manager | `{ worker, connectionId }` |
| `team:declined` | Server → Manager | `{ worker, inviteId }` |
| `request:created` | Server → Manager | Full request object |
| `request:updated` | Server → Worker + Manager | Updated request object |
| `request:note` | Server → Worker + Manager | `{ requestId, note }` |
| `chat:message` | Server → Recipient | `{ conversationKey, message }` |
| `chat:typing` | Server → Recipient | `{ from, conversationKey }` |
| `chat:read` | Server → Sender | `{ conversationKey, readBy, readAt }` |
| `sync` | Server → Client | Full task list + live statuses + team + requests + unread counts (on connect) |

---

## File Upload Details

### Manager Upload UX (Simple)
- **On task creation**: "📎 Attach" button opens file picker (multi-select)
  - On mobile: offers "Camera", "Photo Library", "Files" options natively
  - Shows upload progress per file
  - Thumbnails appear inline once uploaded
- **On existing tasks**: "+ Add Files" button in the attachments section
- **In notes**: 📎 button in the reply box to attach files with a note
- **Supported types**: Images (jpg, png, gif, webp), Videos (mp4, mov, webm), Documents (pdf, doc, docx, xls, xlsx, txt), Archives (zip, rar)
- **Max file size**: 50MB per file (configurable via env var)
- **No limit** on number of files per task

### Worker Download UX (Straightforward)
- **Attachments section** in task detail shows all files as a clean grid:
  - **Images**: thumbnail previews — click to view full-size in a lightbox
  - **Videos**: thumbnail with ▶ overlay — click to play inline in a modal player
  - **Documents**: icon + filename + size — click to download
- **"⬇ Download" button on each file** — one click, starts download immediately
- **"⬇ Download All" button** — zips all task files and downloads as `{task-title}-files.zip`
- **Right-click → Save As** works too (files served with correct Content-Disposition headers)
- **Mobile**: tap to preview, long-press for download options
- Files in activity timeline notes also show inline previews with download buttons

### Storage (Railway Persistent Volume)
- Files stored at `/data/uploads/{taskId}/{timestamp}-{originalFilename}`
- Timestamp prefix prevents naming collisions
- Per-task folders keep things organized
- The `/data` directory is mounted as a Railway persistent volume
- Survives redeploys, scales with Railway's volume size (default 10GB, expandable)

---

## Railway Deployment

### Monthly PDF Report

Generated server-side via `pdfkit` when manager clicks "📄 Download PDF Report":

```
┌────────────────────────────────────────────┐
│                                            │
│  MONTHLY WORK REPORT                       │
│  ============================               │
│  Employee: Alex                             │
│  Period: March 2026                         │
│  Generated: March 10, 2026                  │
│                                            │
│  SUMMARY                                   │
│  ──────────────────────────────────       │
│  Total Days Worked:     22                  │
│  Total Hours:           168h 30m            │
│  Average Hours/Day:     7h 39m              │
│  Office Days:           14  (112h)          │
│  Home Office Days:      8   (56h 30m)       │
│  Tasks Completed:       12                  │
│                                            │
│  DAILY BREAKDOWN                           │
│  ──────────────────────────────────       │
│  Date    In     Out    Hours  Loc  Tasks   │
│  Mar 2   09:00  17:15  7h45m  🏢   3       │
│  Mar 3   08:30  17:00  8h00m  🏠   2       │
│  Mar 4   09:15  18:00  8h15m  🏢   4       │
│  Mar 5   09:00  16:30  7h00m  🏢   2       │
│  ...                                       │
│                                            │
│  TASKS WORKED ON                           │
│  ──────────────────────────────────       │
│  Build Dashboard         32h  ✅ Done       │
│  Fix Login Bug           8h   ✅ Done       │
│  API Integration         24h  ▶ In Progress│
│  Mobile Responsive       12h  ▶ In Progress│
│  ...                                       │
│                                            │
└────────────────────────────────────────────┘
```

**PDF Contents:**
- **Header**: Company name placeholder, report title, worker name, period
- **Summary box**: total days, total hours, avg hours/day, office vs home split, tasks completed
- **Daily table**: date, clock in, clock out, total hours (minus breaks), location, number of tasks
- **Task table**: each task worked on, total hours spent, current status
- **Footer**: "Generated by TaskFlow" + timestamp
- Downloads as `Alex-March-2026-Work-Report.pdf`

---

### Configuration

**`railway.json`**:
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Environment Variables** (set in Railway dashboard):
| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | Auto-set by Railway | Server port |
| `DATA_DIR` | `/data` | Persistent volume mount path (configurable — change to point anywhere) |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size in MB |
| `ADMIN_PASSWORD` | (set your own) | Password for admin dashboard login |

**Persistent Volume**:
- Create via Railway dashboard → Service → Volumes → Add
- Mount path: `/data`
- This stores `tasks.json` and all uploaded files
- Start with 1GB, expand as needed

### Deploy Steps
1. Push code to GitHub repo
2. Connect repo to Railway
3. Add persistent volume mounted at `/data`
4. Deploy — Railway auto-detects Node.js, runs `node server.js`
5. Access at `https://your-app.up.railway.app/boss` or `/worker`

### `.gitignore`
```
node_modules/
data/
```

---

## Implementation Order

1. **Server** — Express + WebSocket + JSON file storage + file upload (multer) + time tracking + admin API + REST API
2. **Shared** — API client helpers, data model, i18n module + translation files (en + de)
3. **Admin Portal** — System control, user management, data export/import, settings
4. **Manager Portal** — Minimal phone-first UI with file upload + worker live status + work calendar + PDF export
5. **Worker Portal** — Rich Kanban + List views, drag & drop, categories, file preview/download + timer + calendar
6. **Polish** — Animations, mobile gestures, lightbox, video player, download-all ZIP, PDF reports, language switcher
7. **Deploy** — Railway config, persistent volume, git repo

---

---

## Internationalization (i18n)

> **No extra npm dependencies.** A lightweight custom solution (~50 lines) that's simple, extensible, and fits the vanilla JS stack.

### Why Not a Library?
- `i18next` and similar libraries are powerful but add unnecessary weight for this project
- The project's constraint is 6 npm deps total — i18n doesn't justify a 7th
- A custom approach is ~50 lines, zero overhead, and fully controllable
- Translation files are plain JSON — any translator or AI can edit them

### Supported Languages
| Code | Language | Status |
|------|----------|--------|
| `en` | English | Default / fallback |
| `de` | German (Deutsch) | Supported |
| `..` | More to come | Just add `{code}.json` to `public/shared/i18n/` |

### Architecture

```
public/shared/
  ├── i18n.js              ← The i18n module (loaded by all portals)
  └── i18n/
      ├── en.json          ← English translations (complete — this is the source of truth)
      └── de.json          ← German translations (mirrors en.json keys)
```

### Translation File Format

Flat key-value JSON with dot-notation namespacing:

```json
// en.json
{
  "app.name": "TaskFlow",
  "nav.tasks": "Tasks",
  "nav.team": "Team",
  "nav.time": "Time Tracking",
  "nav.settings": "Settings",
  "auth.login": "Log In",
  "auth.signup": "Sign Up",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.logout": "Log Out",
  "task.create": "New Task",
  "task.title": "Title",
  "task.description": "Description",
  "task.priority.high": "High",
  "task.priority.medium": "Medium",
  "task.priority.low": "Low",
  "task.status.todo": "To Do",
  "task.status.progress": "In Progress",
  "task.status.review": "In Review",
  "task.status.done": "Done",
  "task.deadline": "Deadline",
  "task.assignee": "Assigned to",
  "task.progress": "Progress",
  "task.notes": "Notes",
  "task.files": "Attachments",
  "time.clockin": "Clock In",
  "time.clockout": "Clock Out",
  "time.play": "Start",
  "time.pause": "Pause",
  "time.office": "Office",
  "time.home": "Home Office",
  "team.invite": "Send Invite",
  "team.accept": "Accept",
  "team.decline": "Decline",
  "admin.users": "Users",
  "admin.export": "Export Data",
  "admin.import": "Import Data",
  "admin.settings": "Settings",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.loading": "Loading...",
  "common.confirm": "Are you sure?"
}
```

```json
// de.json
{
  "app.name": "TaskFlow",
  "nav.tasks": "Aufgaben",
  "nav.team": "Team",
  "nav.time": "Zeiterfassung",
  "nav.settings": "Einstellungen",
  "auth.login": "Anmelden",
  "auth.signup": "Registrieren",
  "auth.username": "Benutzername",
  "auth.password": "Passwort",
  "auth.logout": "Abmelden",
  "task.create": "Neue Aufgabe",
  "task.title": "Titel",
  "task.description": "Beschreibung",
  "task.priority.high": "Hoch",
  "task.priority.medium": "Mittel",
  "task.priority.low": "Niedrig",
  "task.status.todo": "Zu erledigen",
  "task.status.progress": "In Bearbeitung",
  "task.status.review": "In Überprüfung",
  "task.status.done": "Erledigt",
  "task.deadline": "Frist",
  "task.assignee": "Zugewiesen an",
  "task.progress": "Fortschritt",
  "task.notes": "Notizen",
  "task.files": "Anhänge",
  "time.clockin": "Einstempeln",
  "time.clockout": "Ausstempeln",
  "time.play": "Starten",
  "time.pause": "Pausieren",
  "time.office": "Büro",
  "time.home": "Homeoffice",
  "team.invite": "Einladung senden",
  "team.accept": "Annehmen",
  "team.decline": "Ablehnen",
  "admin.users": "Benutzer",
  "admin.export": "Daten exportieren",
  "admin.import": "Daten importieren",
  "admin.settings": "Einstellungen",
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.delete": "Löschen",
  "common.edit": "Bearbeiten",
  "common.search": "Suchen",
  "common.filter": "Filtern",
  "common.loading": "Laden...",
  "common.confirm": "Bist du sicher?"
}
```

### The i18n Module (`public/shared/i18n.js`)

```javascript
// Lightweight i18n — no dependencies
const I18n = {
  lang: 'en',
  translations: {},
  fallback: {},

  // Initialize: detect language, load translations, translate DOM
  async init() {
    this.lang = localStorage.getItem('lang')
      || navigator.language.split('-')[0]  // browser language
      || 'en';

    // Load fallback (English) + selected language in parallel
    const [fallback, translations] = await Promise.all([
      fetch('/shared/i18n/en.json').then(r => r.json()),
      this.lang !== 'en'
        ? fetch(`/shared/i18n/${this.lang}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}))
        : Promise.resolve({})
    ]);

    this.fallback = fallback;
    this.translations = translations;
    this.translateDOM();
  },

  // Get translation by key — falls back to English, then to the key itself
  t(key, vars = {}) {
    let text = this.translations[key] || this.fallback[key] || key;
    // Simple variable interpolation: t('greeting', { name: 'Alex' }) → "Hello, Alex"
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  },

  // Auto-translate all elements with data-i18n attribute
  translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.dataset.i18nTitle);
    });
  },

  // Switch language at runtime
  async setLang(code) {
    localStorage.setItem('lang', code);
    this.lang = code;
    if (code !== 'en') {
      const res = await fetch(`/shared/i18n/${code}.json`);
      this.translations = res.ok ? await res.json() : {};
    } else {
      this.translations = {};
    }
    this.translateDOM();
  }
};
```

### How to Use in HTML

**Static text** — use `data-i18n` attribute:
```html
<button data-i18n="task.create">New Task</button>
<h2 data-i18n="nav.tasks">Tasks</h2>
<input data-i18n-placeholder="common.search" placeholder="Search">
```

**Dynamic text** — use `t()` function in JS:
```javascript
const label = I18n.t('task.status.progress');  // "In Progress" or "In Bearbeitung"
const greeting = I18n.t('greeting', { name: user.name });  // Variable interpolation
```

**Language switcher** — simple dropdown in every portal header:
```html
<select id="langSwitcher" onchange="I18n.setLang(this.value)">
  <option value="en">EN</option>
  <option value="de">DE</option>
</select>
```

### Language Switcher UI
- Small dropdown in the top-right corner of every portal (next to dark/light mode toggle)
- Shows language code: `EN` / `DE`
- Switching instantly re-translates the entire page (no reload)
- Preference saved in `localStorage` — persists across sessions
- On first visit: auto-detects from `navigator.language` (e.g., German browser → German UI)

### Adding a New Language
1. Copy `public/shared/i18n/en.json` → `public/shared/i18n/{code}.json` (e.g., `fr.json`)
2. Translate all values
3. Add `<option value="fr">FR</option>` to the language switcher in each portal
4. Done — no code changes needed, no rebuild, no restart

### Key Namespaces
| Prefix | Scope |
|--------|-------|
| `app.*` | App-wide labels (name, tagline) |
| `nav.*` | Navigation items |
| `auth.*` | Login/signup forms |
| `task.*` | Task-related labels and statuses |
| `time.*` | Time tracking labels |
| `team.*` | Team/invite labels |
| `admin.*` | Admin panel labels |
| `common.*` | Reusable buttons and phrases |
| `boss.*` | Boss-portal-specific labels |
| `worker.*` | Worker-portal-specific labels |
| `error.*` | Error messages |

### Server-Side Translations (PDF Reports)
- The PDF report generator reads the user's language preference (stored in user profile)
- Server loads the matching JSON translation file from `public/shared/i18n/`
- Report headings, labels, and footer text are translated
- Fallback: English if the translation file doesn't exist

---

*Review this updated plan and let me know when you're ready to build.*
