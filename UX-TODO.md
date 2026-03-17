# UX Improvements — TaskFlow App

## Quick Wins (CSS/HTML only)
- [x] Add `loading="lazy"` to all avatar images
- [x] Add ESC key to close modals/panels/detail
- [x] Add kanban bottom padding so last column isn't hidden behind mobile nav
- [x] Add column header hover state (background highlight)
- [x] Cap textarea max-height in chat input (120px, then scroll)
- [x] Increase bottom nav touch targets (min-height 56px, label 11px)
- [x] Add `aria-label` to all icon-only buttons

## Medium (JS logic changes)
- [x] Fix back button: close detail panel first, then exit flow
- [x] Add disabled/loading state to submit buttons during async ops
- [x] Add deadline "due soon" warning color (amber for 3 days out)
- [x] Make revision request tag more prominent (color, emoji, bold)
- [x] Scroll chat input into view on mobile keyboard open
- [x] Add skeleton loading placeholders when entering a flow
- [ ] Trap focus inside open modals (Tab can't escape)
- [x] Add undo toast on task status change (with rollback)
- [ ] Add drag & drop files into chats (flow chat + task chat)
- [ ] Add loading spinner overlay for async actions

## Larger Features
- [ ] Add chat delivery indicators (✓ sent, ✓✓ delivered, blue ✓✓ read)
- [ ] Add file upload progress bar
- [ ] Add typing indicator to task chat (already works in flow chat)
- [ ] Optimize kanban: only re-render affected columns on drag
- [x] Add Ctrl+K / ⌘+K search shortcut
- [x] Implement task search overlay (filter by title, assignee, status)
- [x] Add deep linking — shareable URLs per task (`#task/uuid`)
- [ ] Add chat message search
- [ ] Add bulk task actions (multi-select → move/delete/reassign)
- [ ] Add input character counters (e.g. 45/200)
- [ ] Add swipe gesture to toggle Board ↔ List on mobile
- [ ] Add pin/mute for chat conversations
- [ ] Add "new messages" badge when scrolled up in chat
- [ ] Add color-blind safe status indicators (patterns/icons, not just color)
