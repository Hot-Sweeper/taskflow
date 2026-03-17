# TaskFlow QoL and Calendar Expansion Roadmap

## Goal
Build a high-clarity planning and execution system with:
- Faster task operations
- Better visibility for availability and deadlines
- Strong daily activity intelligence
- Better reminders and accountability

## Confirmed Scope

### QoL Features
- [x] Bulk actions
- [x] Task templates
- [x] Recurring tasks
- [x] Review inbox

### Calendar and Activity Features
- [x] Deadline layer
- [x] Calendar modes (month/week/day/year)
- [x] Calendar filters and saved views
- [ ] Drag to reschedule
- [x] Blackout and availability days
- [ ] Milestones and checkpoints
- [x] Day detail timeline and work log
- [x] Daily progress delta summary
- [x] Reminders
- [x] Stale task detection and escalation

## Feature Specs


### 2) Bulk Actions
- [x] Multi-select in board and list, then batch operations:
  - [x] Status
  - [x] Priority
  - [x] Assignee
  - [x] Department (Abteilung)
  - [x] Deadline
  - [x] Request review
  - [x] Add shared bulk note

### 3) Task Templates
- [x] Reusable task definitions:
  - [x] Title pattern
  - [x] Description
  - [x] Default assignees/operators
  - [x] Priority
  - [x] Department
  - [ ] Reminders
  - [x] Optional checklist

### 4) Recurring Tasks
- [x] Rules:
  - [x] Daily, weekdays, weekly, monthly, custom interval
- [x] Series controls:
  - [x] End never/date/count
  - [ ] Skip occurrence
  - [ ] Edit one occurrence vs entire series

### 5) Review Inbox
- [x] Dedicated queue for decision tasks:
  - [x] Needs approval
  - [x] Needs revision
  - [x] Needs info
- [x] Quick actions:
  - [x] Approve
  - [x] Request revision
  - [ ] Ask for info
- [ ] Age/urgency badges and lightweight context panel

### 6) Deadline Layer on Calendar
- [x] Render task deadlines directly in cells
- [x] Color by priority/status
- [x] Overdue carry-over marker on current day
- [x] Day summary counts

### 7) Calendar Modes
- [x] Month: planning (default/existing)
- [x] Week: balancing workload
- [x] Day: execution timeline
- [x] Year: overview with mini-month grids

### 8) Calendar Filters
- [x] Assignee filter
- [ ] Department filter
- [x] Priority filter
- [x] Status filter
- [x] Stale only toggle
- [ ] Review needed only
- [ ] Recurring only
- [ ] Saved filter presets

### 9) Drag to Reschedule
- [ ] Single task move between days
- [ ] Multi-task move (after bulk select)
- [ ] Overload/conflict warning

### 10) Blackout and Availability Days
- [x] Users can mark inactive days/blocks (vacation, training, personal, other)
- [x] Boss sees all team blackout days (flow-wide availability API)
- [x] Blackout day markers on calendar (striped overlay + 🚫 icon)
- [x] Show user avatar/head on blackout days
- [ ] Optional recurring blackout blocks for standard off-days

### 11) Milestones and Checkpoints
- [ ] Add milestone entities and link tasks
- [ ] Milestone calendar markers
- [ ] Progress computed from linked tasks
- [ ] Milestone drilldown

### 12) Day Detail Timeline and Work Log
- [x] Click a day to view detailed timeline modal
- [x] Time worked per task display
- [x] Task event history for that day (created/updated/notes)
- [ ] Started working on task event
- [ ] Resumed task event
- [ ] Moved to review event
- [ ] Completed task event

### 13) Daily Progress Delta Summary
- [x] Per day, list touched tasks with progress change
- [x] Before → after value
- [x] Increase in green / decrease in red
- [x] Net daily progress score
- [x] Tabbed day detail: My Summary / Others
- [x] Shared calendar: team avatars on day cells
- [x] Click avatar to view user's daily summary modal

### 14) Reminders
- [x] Deadline reminders (24h and 48h before deadline)
- [ ] Review reminders
- [x] Stale reminders (periodic stale task notifications)
- [ ] Custom reminders
- [ ] Quiet hours
- [ ] Frequency options
- [ ] In-app first (email/push optional later)

## Stale Task Logic
- [x] Task becomes stale when no meaningful activity for threshold duration
- [x] Meaningful activity tracking:
  - [x] Progress change
  - [x] Status change
  - [x] Comment or chat note
  - [ ] Review action
  - [x] Assignment change
- [x] Thresholds configurable per status (config.staleThresholds)
- [ ] Escalation path:
  - [x] Assignee reminder
  - [ ] Operator reminder
  - [ ] Boss reminder

## Data Model Additions

### Task
- [x] lastActivityAt
- [ ] staleAt
- [x] isStale (computed at query time)
- [x] recurrenceRule
- [x] recurrenceSeriesId
- [ ] milestoneId

### User
- [x] availabilityBlocks

### Calendar Event
- [ ] type
- [ ] taskId
- [ ] userId
- [ ] timestamp
- [ ] meta

### Day Summary
- [ ] date
- [ ] tasksTouched
- [ ] progressDeltaItems
- [ ] totalWorkedMinutes
- [ ] reviewActions

## Rollout Plan

### Phase 1 ✅
- [x] Stale engine (detection + badge + notifications)
- [x] Calendar deadline layer
- [x] Calendar filters
- [x] Blackout day visibility
- [x] Basic reminders
- [x] Day detail timeline (read-only)

### Phase 2 ✅
- [x] Bulk actions
- [x] Templates
- [x] Recurring tasks
- [x] Review inbox

### Phase 3
- [ ] Drag reschedule
- [ ] Milestones
- [ ] Advanced stale escalation rules
- [ ] Daily progress delta analytics

## i18n
- [x] All Phase 1 keys added to en.json
- [x] All Phase 1 keys added to de.json
- [x] All Phase 2 keys added to en.json
- [x] All Phase 2 keys added to de.json

## Success Metrics
- [ ] Reduced overdue task rate
- [ ] Reduced stale task count
- [ ] Faster review turnaround
- [ ] Better assignment quality around blackout days
- [ ] Lower clicks per common operation

## Implementation Notes
- [x] Keep all user-facing text in i18n keys
- [x] Reuse existing websocket event pattern `{entity}:{action}`
- [x] Persist via `storage.js` with atomic write flow
- [x] Preserve existing permissions model for creator/operator/assignee roles
