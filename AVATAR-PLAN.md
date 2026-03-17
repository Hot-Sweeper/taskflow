# Avatar System — DiceBear Integration Plan

## Overview
Replace basic online/offline status indicators with a full avatar system powered by [DiceBear Adventurer](https://www.dicebear.com/styles/adventurer/) avatars. Users (both bosses and workers) create their own custom character via a rich creator page. Avatars are displayed with CSS animations that reflect the worker's current status (working, paused, home office, offline).

---

## Phase 1: Avatar Creator Page

### 1.1 New page: `/avatar` → `public/avatar/index.html`
- Full-page character creator accessible from both boss and worker portals
- Requires authentication (redirect to portal if not logged in)
- Self-contained HTML file with inline CSS/JS (project convention)

### 1.2 DiceBear Adventurer — Customizable Options
All options use the HTTP API: `https://api.dicebear.com/9.x/adventurer/svg?params`

| Category       | Option Key          | Variants                                                |
|----------------|---------------------|---------------------------------------------------------|
| **Skin**       | `skinColor`         | `9e5622`, `763900`, `ecad80`, `f2d3b1`                  |
| **Hair Style** | `hair`              | `long01`–`long26`, `short01`–`short19` (45 total)       |
| **Hair Color** | `hairColor`         | `0e0e0e`, `3eac2c`, `6a4e35`, `85c2c6`, `796a45`, `562306`, `592454`, `ab2a18`, `ac6511`, `afafaf`, `b9a05f`, `cb6820`, `dba3be`, `e5d7a3` |
| **Eyes**       | `eyes`              | `variant01`–`variant26`                                 |
| **Eyebrows**   | `eyebrows`          | `variant01`–`variant15`                                 |
| **Mouth**      | `mouth`             | `variant01`–`variant30`                                 |
| **Earrings**   | `earrings`          | `variant01`–`variant06` + toggle (earringsProbability)  |
| **Glasses**    | `glasses`           | `variant01`–`variant05` + toggle (glassesProbability)   |
| **Features**   | `features`          | `birthmark`, `blush`, `freckles`, `mustache` + toggle   |
| **Background** | `backgroundColor`   | Color picker (hex)                                      |

### 1.3 Creator UI Design
```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Portal              🎨 Create Your Avatar     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│    ┌──────────────────────┐    ┌────────────────────┐    │
│    │                      │    │  Category Tabs:    │    │
│    │   LIVE AVATAR        │    │  👤 Skin           │    │
│    │   PREVIEW            │    │  💇 Hair           │    │
│    │   (256x256)          │    │  👁 Eyes           │    │
│    │                      │    │  😊 Mouth          │    │
│    │   with current       │    │  ✨ Eyebrows       │    │
│    │   animation          │    │  👓 Accessories    │    │
│    │                      │    │  🎨 Background     │    │
│    └──────────────────────┘    │                    │    │
│                                │  ┌──┐ ┌──┐ ┌──┐   │    │
│    🔀 Randomize                │  │  │ │  │ │  │   │    │
│                                │  └──┘ └──┘ └──┘   │    │
│                                │  Visual grid of    │    │
│                                │  option previews   │    │
│                                │  (small avatars    │    │
│                                │  showing each      │    │
│                                │  variant)          │    │
│                                └────────────────────┘    │
│                                                          │
│              [ 💾 Save Avatar ]                          │
└──────────────────────────────────────────────────────────┘
```

**Key UI Decisions:**
- NO stock dropdowns — visual grid preview for every option
- Each variant shown as a small DiceBear preview thumbnail (the actual avatar with that option applied)
- Selected option highlighted with a glowing border
- Skin & hair colors shown as styled color circles (not native color pickers)
- Real-time preview updates on every click
- 🔀 Randomize button for quick generation
- Smooth transitions when switching between options
- Dark theme matching the worker portal aesthetic

### 1.4 Data Storage
Avatar config saved in `users.json` on the user object:
```json
{
  "id": "uuid",
  "name": "worker1",
  "role": "worker",
  "avatar": {
    "hair": "short05",
    "hairColor": "562306",
    "eyes": "variant12",
    "eyebrows": "variant03",
    "mouth": "variant15",
    "skinColor": "f2d3b1",
    "earrings": null,
    "glasses": null,
    "features": null,
    "backgroundColor": "b6e3f4"
  }
}
```

---

## Phase 2: Animation System

### 2.1 Animation States
CSS-only animations applied to the avatar container. The DiceBear SVG is wrapped in a scene container that provides context.

| State           | Animation Name       | Description                                                         |
|-----------------|---------------------|---------------------------------------------------------------------|
| **Working**     | `avatar-working`    | Avatar sits at a desk with a monitor. Subtle typing motion (hands bounce), monitor screen glows/flickers, small code particles float up |
| **Paused**      | `avatar-paused`     | Avatar holds a coffee cup. Steam particles rise and fade. Cup bobs gently. Eyes half-closed/relaxed |
| **Home Office** | `avatar-home`       | Avatar in a cozy scene with a house silhouette behind. Cat walks across. Plant sways. Warm lamp glow |
| **Offline**     | `avatar-offline`    | Avatar greyed out with a "zzz" sleep bubble. Gentle breathing scale animation. Moon and stars twinkle |

### 2.2 Scene Composition (CSS + inline SVG)
Each animation state is a **scene** built with:
1. **Background layer** — CSS gradient + decorative SVG elements (desk, house, moon)
2. **Avatar layer** — The DiceBear SVG (centered)
3. **Foreground layer** — Animated particles (steam, sparkles, zzz) via CSS `::before`/`::after` and small SVG elements
4. **Motion** — CSS `@keyframes` applied to the avatar container (gentle bob, tilt, breathing)

### 2.3 Animation Details

#### Working (Office)
```
┌─────────────────────┐
│  ╔═══╗  ·  ·        │  <- floating code particles
│  ║ ░ ║  ·           │  <- monitor with screen glow
│  ╚═══╝              │
│  [AVATAR]           │  <- subtle typing bob
│ ═══════════         │  <- desk
└─────────────────────┘
```
- Avatar bobs up/down 2px every 0.5s (typing rhythm)
- Monitor SVG behind avatar with pulsing screen glow
- Small dot particles float upward and fade (code/data)
- Desk line below avatar

#### Paused (Coffee Break)
```
┌─────────────────────┐
│      ~ ~ ~          │  <- steam rising
│     ~   ~           │
│  [AVATAR]  ☕        │  <- relaxed, cup bobs
│                     │
└─────────────────────┘
```
- Avatar gentle side-to-side sway (relaxed)
- Coffee cup SVG beside avatar
- Steam particles: 3 wavy lines rising, fading, looping
- Warm orange/brown ambient glow

#### Home Office
```
┌─────────────────────┐
│    🏠               │  <- house silhouette
│  ╔═══╗  🌿          │  <- monitor + plant sway
│  ║ ░ ║   )          │
│  [AVATAR]           │
│ ───────── 🐱        │  <- desk + cat walks
└─────────────────────┘
```
- Similar to working but with house/cozy elements
- Plant SVG gently swaying
- Small cat silhouette walks across bottom
- Warm-toned background gradient
- Lamp glow effect (radial gradient pulse)

#### Offline / Sleeping
```
┌─────────────────────┐
│  ★    ☽    ★        │  <- moon and twinkling stars
│       z z z         │  <- floating zzz
│  [AVATAR]           │  <- breathing animation (scale)
│  ═══════            │  <- pillow/bed hint
└─────────────────────┘
```
- Avatar slow breathing: scale 1.0 → 1.02 → 1.0 (3s loop)
- Greyscale filter on avatar
- ZZZ text floats up diagonally and fades
- Moon and stars with twinkle animation
- Dark blue/purple background

---

## Phase 3: Integration

### 3.1 API Endpoints
```
GET  /api/users/me/avatar-config    → return current user's avatar config
PUT  /api/users/me/avatar-config    → save avatar config (validate options)
GET  /api/users/:id/avatar-url      → return constructed DiceBear URL for a user
```

### 3.2 Boss Portal Integration
- Team member list shows animated avatar scenes instead of green/red dots
- Each worker card has a small (80x80) avatar scene
- Animation state driven by real-time `time:status` WebSocket events
- Clicking a worker's avatar opens their profile/chat

### 3.3 Worker Portal Integration
- Header shows own avatar (small, 40x40)
- Timer bar shows status-appropriate micro-animation
- "Edit Avatar" link goes to `/avatar`

### 3.4 WebSocket Integration
- When avatar config changes → broadcast `avatar:updated` event
- Boss portal listens and re-renders affected worker avatar

---

## Phase 4: Polish (Future)

- [ ] More hair styles / accessories
- [ ] Seasonal themes (Santa hat in December, etc.)
- [ ] Avatar reactions (thumbs up when task completed)
- [ ] Custom background scenes
- [ ] Achievement badges on avatar frame

---

## Implementation Order (TODO)

### Step 1: Backend — Avatar API
- [ ] Add `avatar` field to user model in storage
- [ ] `PUT /api/users/me/avatar-config` — validate & save avatar options
- [ ] `GET /api/users/me/avatar-config` — return stored config
- [ ] Helper function: `buildAvatarUrl(avatarConfig)` — constructs DiceBear URL
- [ ] Broadcast `avatar:updated` WebSocket event on save

### Step 2: Avatar Creator Page
- [ ] Create `public/avatar/index.html`
- [ ] Serve static `/avatar` route in Express
- [ ] Build category tab navigation (Skin, Hair, Eyes, Mouth, Eyebrows, Accessories, Background)
- [ ] Build visual option grid (small preview thumbnails for each variant)
- [ ] Build live preview panel with large avatar
- [ ] Implement randomize button
- [ ] Implement save functionality (API call + redirect back)
- [ ] Mobile-responsive layout

### Step 3: CSS Animation System
- [ ] Create animation scenes in a reusable pattern (function that returns scene HTML)
- [ ] Implement `avatar-working` animation (desk + monitor + typing bob + particles)
- [ ] Implement `avatar-paused` animation (coffee + steam + sway)
- [ ] Implement `avatar-home` animation (house + plant + cat + warm glow)
- [ ] Implement `avatar-offline` animation (zzz + moon + stars + breathing)
- [ ] Test all animations at 80x80 and 256x256 sizes

### Step 4: Boss Portal Integration
- [ ] Replace online/offline dots with avatar scenes in team member list
- [ ] Map `time:status` events to animation states
- [ ] Add "Edit Avatar" button to profile section

### Step 5: Worker Portal Integration
- [ ] Show own avatar in header
- [ ] Link to avatar creator from profile/settings
- [ ] Show micro-animation in timer bar area
