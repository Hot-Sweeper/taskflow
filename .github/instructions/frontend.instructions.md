---
description: "Use when writing or editing frontend HTML/CSS/JS for the boss, worker, or admin portals. Covers UI patterns, theming, responsive design, and client-side conventions."
applyTo: "public/**/*.{html,js}"
---
# Frontend Code Standards

## File Structure
Each portal is a single self-contained `index.html` with inline `<style>` and `<script>` blocks.
Shared logic lives in `public/shared/api.js` and `public/shared/models.js`.

## Portal Design Philosophy
- **Boss (`/boss`)**: Phone-first, minimal, fast. Big touch targets, minimal text, swipe actions. Optimized for one-handed use.
- **Worker (`/worker`)**: Rich, power-user workspace. Kanban board, list view, category sidebar, drag & drop, detailed task panels.
- **Admin (`/admin`)**: Data-table focused, desktop-optimized. Clean admin panel with tables, filters, export/import buttons.

## Theming (Light/Dark Mode)
- Set `data-theme="dark"` or `data-theme="light"` on `<html>` element
- All colors via CSS custom properties: `var(--color-primary)`, `var(--bg-card)`, `var(--text-primary)`, etc.
- Define both themes in `:root` and `[data-theme="dark"]` selectors
- Toggle persisted in `localStorage`

## CSS Patterns
- CSS custom properties for the full design system (colors, spacing, radii, shadows)
- Glassmorphism: `backdrop-filter: blur(12px)` + `background: rgba(...)` on cards
- Spacing scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px
- Border radius: 8px (cards), 6px (inputs), 12px (modals)
- Transitions: 150-300ms on hover/focus/active states
- Breakpoints: 480px (phone), 768px (tablet), 1024px (desktop)
- Font: Inter from Google Fonts (`<link>` in `<head>`)

## JavaScript Patterns
- Use `fetch()` for API calls — always include auth token from `localStorage`
- Use native `WebSocket` — reconnect on close with exponential backoff
- DOM manipulation: `document.createElement()`, `element.innerHTML` for templates, `querySelector`
- Event delegation where practical
- No frameworks, no jQuery, no bundler

## API Client (`public/shared/api.js`)
- Exports helper functions: `api.get()`, `api.post()`, `api.put()`, `api.delete()`
- Automatically attaches `Authorization: Bearer <token>` header
- Handles JSON parsing and error extraction
- WebSocket connection helper with auto-reconnect

## Auth Flow
1. Landing page shows Sign Up / Log In forms
2. On success, store token in `localStorage`, switch to dashboard view
3. On page load, check `localStorage` for token → auto-login via `/api/auth/me`
4. Log out clears token and returns to landing page

## Icons
- Unicode emoji for status/action icons (📋, ✅, ⏸, 🏠, 🏢, etc.)
- Inline SVG for custom icons (copy SVG directly into HTML)
- No icon libraries (no Font Awesome, no Material Icons)

## Internationalization (i18n)
- Load `public/shared/i18n.js` in every portal
- Call `I18n.init()` on page load — it auto-detects language from `localStorage` or `navigator.language`
- **Static text**: use `data-i18n="key"` attribute — e.g., `<button data-i18n="task.create">New Task</button>`
- **Placeholders**: use `data-i18n-placeholder="key"` — e.g., `<input data-i18n-placeholder="common.search">`
- **Tooltips**: use `data-i18n-title="key"`
- **Dynamic text in JS**: use `I18n.t('key')` or `I18n.t('key', { var: value })` for interpolation
- **Never hardcode user-facing strings** — always use translation keys
- Keep the English text as the default `textContent` in HTML (for readability), it gets replaced on load
- Translation keys use dot-notation: `task.status.done`, `auth.login`, `common.save`
- Language switcher: small dropdown in every portal header (next to theme toggle)
- Adding a language: copy `en.json` → `{code}.json`, translate values, add `<option>` to switcher

## Accessibility Basics
- All interactive elements must be keyboard-accessible
- Use semantic HTML (`<button>`, `<input>`, `<label>`, `<nav>`, `<main>`)
- Color contrast: ensure text is readable in both themes
- Touch targets: minimum 44x44px on mobile
