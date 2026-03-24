// ══════════════════════════════════════════════════════════════
//  OfficeTilemap — Pixel-art tile system for the Office tab
//  Provides tile definitions, procedural office generator, and
//  canvas rendering. Used by public/app/index.html Office tab.
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const TILE_SIZE = 16;
  const TILES = {};
  let _ready = false;

  // ── Drawing helpers ──
  function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function line(ctx, x1, y1, x2, y2, c) {
    ctx.fillStyle = c;
    if (x1 === x2) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) ctx.fillRect(x1, y, 1, 1); }
    else { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) ctx.fillRect(x, y1, 1, 1); }
  }
  function def(id, fn) { TILES[id] = { id, draw: fn, canvas: null }; }

  // ═══════════════ FLOORS ═══════════════

  def('floor_wood', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#8B6914');
    for (let y = 0; y < 16; y += 4) { rect(ctx, 0, y, 16, 1, '#7A5C10'); rect(ctx, 0, y + 2, 16, 1, '#9B7924'); }
    line(ctx, 5, 0, 5, 3, '#6B4F0A'); line(ctx, 11, 4, 11, 7, '#6B4F0A');
    line(ctx, 3, 8, 3, 11, '#6B4F0A'); line(ctx, 9, 12, 9, 15, '#6B4F0A');
    px(ctx, 2, 1, '#6B4F0A'); px(ctx, 13, 6, '#6B4F0A'); px(ctx, 7, 10, '#6B4F0A');
  });

  def('floor_wood_dark', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#5C4033');
    for (let y = 0; y < 16; y += 4) { rect(ctx, 0, y, 16, 1, '#4A3228'); rect(ctx, 0, y + 2, 16, 1, '#6E5040'); }
    line(ctx, 7, 0, 7, 3, '#3E2A1E'); line(ctx, 13, 4, 13, 7, '#3E2A1E');
    line(ctx, 4, 8, 4, 11, '#3E2A1E'); line(ctx, 10, 12, 10, 15, '#3E2A1E');
  });

  def('floor_carpet_blue', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#2C4A7C');
    const nc = ['#2A4876', '#2E4C80', '#304E84'];
    for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) px(ctx, x + (y % 4 ? 1 : 0), y, nc[(x + y) % 3]);
  });

  def('floor_carpet_red', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#7C2C2C');
    const nc = ['#762A2A', '#802E2E', '#843030'];
    for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) px(ctx, x + (y % 4 ? 1 : 0), y, nc[(x + y) % 3]);
  });

  def('floor_carpet_green', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#2C5C3A');
    const nc = ['#2A5838', '#2E603C', '#306440'];
    for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) px(ctx, x + (y % 4 ? 1 : 0), y, nc[(x + y) % 3]);
  });

  def('floor_tile', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 0, 16, 1, '#B0A898'); rect(ctx, 0, 0, 1, 16, '#B0A898');
    rect(ctx, 8, 0, 1, 16, '#B8B0A0'); rect(ctx, 0, 8, 16, 1, '#B8B0A0');
    px(ctx, 3, 3, '#D0C8B8'); px(ctx, 12, 5, '#D0C8B8');
    px(ctx, 6, 11, '#BEB8A8'); px(ctx, 14, 13, '#BEB8A8');
  });

  def('floor_concrete', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#888888');
    const nc = ['#848484', '#8C8C8C', '#808080'];
    for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x += 3) px(ctx, x, y, nc[(x * y) % 3]);
    px(ctx, 5, 7, '#707070'); px(ctx, 11, 3, '#707070');
  });

  def('floor_checker', (ctx) => {
    for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8)
      rect(ctx, x, y, 8, 8, ((x + y) / 8) % 2 === 0 ? '#D0D0D0' : '#404040');
  });

  // ═══════════════ WALLS ═══════════════

  def('wall_top', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 0, 16, 6, '#505868'); rect(ctx, 0, 6, 16, 2, '#404850'); rect(ctx, 0, 0, 16, 1, '#606878');
    line(ctx, 0, 3, 15, 3, '#485060'); line(ctx, 4, 0, 4, 3, '#485060');
    line(ctx, 12, 0, 12, 3, '#485060'); line(ctx, 8, 3, 8, 6, '#485060');
  });

  def('wall_bottom', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 10, 16, 6, '#505868'); rect(ctx, 0, 10, 16, 1, '#606878');
    line(ctx, 0, 13, 15, 13, '#485060'); line(ctx, 4, 10, 4, 13, '#485060');
    line(ctx, 12, 10, 12, 13, '#485060'); line(ctx, 8, 13, 8, 15, '#485060');
  });

  def('wall_left', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 0, 4, 16, '#505868'); rect(ctx, 4, 0, 2, 16, '#404850'); rect(ctx, 0, 0, 1, 16, '#606878');
    line(ctx, 0, 4, 3, 4, '#485060'); line(ctx, 0, 8, 3, 8, '#485060'); line(ctx, 0, 12, 3, 12, '#485060');
  });

  def('wall_right', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 12, 0, 4, 16, '#505868'); rect(ctx, 10, 0, 2, 16, '#404850'); rect(ctx, 15, 0, 1, 16, '#606878');
    line(ctx, 12, 4, 15, 4, '#485060'); line(ctx, 12, 8, 15, 8, '#485060'); line(ctx, 12, 12, 15, 12, '#485060');
  });

  def('wall_corner_tl', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868');
    rect(ctx, 6, 8, 10, 8, '#C8C0B0');
    rect(ctx, 0, 0, 16, 1, '#606878'); rect(ctx, 0, 0, 1, 16, '#606878');
    rect(ctx, 4, 6, 2, 10, '#404850'); rect(ctx, 6, 6, 10, 2, '#404850');
  });

  def('wall_corner_tr', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868');
    rect(ctx, 0, 8, 10, 8, '#C8C0B0');
    rect(ctx, 0, 0, 16, 1, '#606878'); rect(ctx, 15, 0, 1, 16, '#606878');
    rect(ctx, 10, 6, 2, 10, '#404850'); rect(ctx, 0, 6, 10, 2, '#404850');
  });

  def('wall_corner_bl', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868');
    rect(ctx, 6, 0, 10, 8, '#C8C0B0');
    rect(ctx, 0, 15, 16, 1, '#606878'); rect(ctx, 0, 0, 1, 16, '#606878');
    rect(ctx, 4, 0, 2, 10, '#404850'); rect(ctx, 6, 8, 10, 2, '#404850');
  });

  def('wall_corner_br', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868');
    rect(ctx, 0, 0, 10, 8, '#C8C0B0');
    rect(ctx, 15, 0, 1, 16, '#606878'); rect(ctx, 0, 15, 16, 1, '#606878');
    rect(ctx, 10, 0, 2, 10, '#404850'); rect(ctx, 0, 8, 10, 2, '#404850');
  });

  def('wall_h', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868');
    rect(ctx, 0, 0, 16, 1, '#606878'); rect(ctx, 0, 15, 16, 1, '#404850');
    line(ctx, 0, 5, 15, 5, '#485060'); line(ctx, 0, 10, 15, 10, '#485060');
    line(ctx, 4, 0, 4, 5, '#485060'); line(ctx, 12, 5, 12, 10, '#485060'); line(ctx, 8, 10, 8, 15, '#485060');
  });

  def('wall_v', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868');
    rect(ctx, 0, 0, 1, 16, '#606878'); rect(ctx, 15, 0, 1, 16, '#404850');
    line(ctx, 0, 4, 15, 4, '#485060'); line(ctx, 0, 8, 15, 8, '#485060'); line(ctx, 0, 12, 15, 12, '#485060');
  });

  // ═══════════════ DOORS ═══════════════

  def('door_h', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 0, 16, 2, '#505868'); rect(ctx, 0, 6, 16, 2, '#404850');
    rect(ctx, 1, 2, 1, 4, '#6B4F0A'); rect(ctx, 14, 2, 1, 4, '#6B4F0A');
    rect(ctx, 2, 2, 12, 4, '#A0784C');
    rect(ctx, 3, 3, 4, 2, '#B08858'); rect(ctx, 9, 3, 4, 2, '#B08858');
    px(ctx, 8, 4, '#D4A84C');
  });

  def('door_v', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 0, 2, 16, '#505868'); rect(ctx, 6, 0, 2, 16, '#404850');
    rect(ctx, 2, 1, 4, 1, '#6B4F0A'); rect(ctx, 2, 14, 4, 1, '#6B4F0A');
    rect(ctx, 2, 2, 4, 12, '#A0784C');
    rect(ctx, 3, 3, 2, 4, '#B08858'); rect(ctx, 3, 9, 2, 4, '#B08858');
    px(ctx, 4, 8, '#D4A84C');
  });

  def('door_glass_h', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#C8C0B0');
    rect(ctx, 0, 0, 16, 2, '#505868'); rect(ctx, 0, 6, 16, 2, '#404850');
    rect(ctx, 1, 2, 1, 4, '#808890'); rect(ctx, 14, 2, 1, 4, '#808890');
    rect(ctx, 2, 2, 12, 4, 'rgba(120,180,220,0.6)');
    rect(ctx, 3, 3, 10, 2, 'rgba(160,210,240,0.5)');
    line(ctx, 4, 2, 6, 2, 'rgba(255,255,255,0.4)');
  });

  // ═══════════════ WINDOWS ═══════════════

  def('window_h', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#505868'); rect(ctx, 0, 0, 16, 1, '#606878');
    rect(ctx, 2, 3, 12, 8, '#78B8DC'); rect(ctx, 2, 3, 12, 1, '#A0D0E8');
    rect(ctx, 1, 2, 14, 1, '#808890'); rect(ctx, 1, 11, 14, 1, '#808890');
    rect(ctx, 1, 2, 1, 10, '#808890'); rect(ctx, 14, 2, 1, 10, '#808890');
    rect(ctx, 7, 2, 2, 10, '#808890'); rect(ctx, 1, 7, 14, 1, '#808890');
    line(ctx, 5, 5, 5, 6, '#A8D8F0'); line(ctx, 10, 4, 11, 4, '#A8D8F0');
  });

  // ═══════════════ FURNITURE ═══════════════

  def('desk_h', (ctx) => {
    rect(ctx, 0, 4, 16, 8, '#8B6914');
    rect(ctx, 0, 4, 16, 1, '#9B7924'); rect(ctx, 0, 11, 16, 1, '#7A5C10');
    rect(ctx, 1, 12, 2, 4, '#6B4F0A'); rect(ctx, 13, 12, 2, 4, '#6B4F0A');
    rect(ctx, 2, 12, 12, 1, 'rgba(0,0,0,0.15)'); rect(ctx, 7, 8, 2, 1, '#D4A84C');
  });

  def('desk_v', (ctx) => {
    rect(ctx, 4, 0, 8, 16, '#8B6914');
    rect(ctx, 4, 0, 1, 16, '#9B7924'); rect(ctx, 11, 0, 1, 16, '#7A5C10');
    rect(ctx, 12, 1, 4, 2, '#6B4F0A'); rect(ctx, 12, 13, 4, 2, '#6B4F0A');
    rect(ctx, 8, 7, 1, 2, '#D4A84C');
  });

  def('desk_corner', (ctx) => {
    rect(ctx, 0, 4, 16, 8, '#8B6914'); rect(ctx, 4, 0, 8, 4, '#8B6914');
    rect(ctx, 0, 4, 16, 1, '#9B7924'); rect(ctx, 4, 0, 1, 4, '#9B7924');
    rect(ctx, 0, 11, 16, 1, '#7A5C10'); rect(ctx, 11, 0, 1, 4, '#7A5C10');
    rect(ctx, 1, 12, 2, 4, '#6B4F0A'); rect(ctx, 13, 12, 2, 4, '#6B4F0A');
  });

  def('chair_down', (ctx) => {
    rect(ctx, 4, 6, 8, 7, '#333'); rect(ctx, 5, 7, 6, 5, '#444');
    rect(ctx, 4, 4, 8, 3, '#444'); rect(ctx, 5, 4, 6, 1, '#555');
    px(ctx, 4, 14, '#222'); px(ctx, 11, 14, '#222'); px(ctx, 7, 15, '#222');
    px(ctx, 3, 13, '#222'); px(ctx, 12, 13, '#222');
    rect(ctx, 7, 13, 2, 2, '#2A2A2A');
  });

  def('chair_up', (ctx) => {
    rect(ctx, 4, 4, 8, 7, '#333'); rect(ctx, 5, 5, 6, 5, '#444');
    rect(ctx, 4, 10, 8, 3, '#444'); rect(ctx, 5, 12, 6, 1, '#555');
    px(ctx, 4, 2, '#222'); px(ctx, 11, 2, '#222'); px(ctx, 7, 1, '#222');
    px(ctx, 3, 3, '#222'); px(ctx, 12, 3, '#222');
    rect(ctx, 7, 2, 2, 2, '#2A2A2A');
  });

  def('chair_left', (ctx) => {
    rect(ctx, 4, 4, 7, 8, '#333'); rect(ctx, 5, 5, 5, 6, '#444');
    rect(ctx, 2, 4, 3, 8, '#444'); rect(ctx, 2, 5, 1, 6, '#555');
    px(ctx, 12, 4, '#222'); px(ctx, 12, 11, '#222'); px(ctx, 13, 7, '#222');
    rect(ctx, 11, 7, 2, 2, '#2A2A2A');
  });

  // ═══════════════ TECH ═══════════════

  def('monitor', (ctx) => {
    rect(ctx, 2, 2, 12, 8, '#222');
    rect(ctx, 3, 3, 10, 6, '#4488AA');
    rect(ctx, 4, 4, 8, 1, '#88CCEE'); rect(ctx, 4, 6, 5, 1, '#66AACC'); rect(ctx, 4, 7, 7, 1, '#66AACC');
    rect(ctx, 6, 10, 4, 2, '#333'); rect(ctx, 5, 12, 6, 1, '#333');
    px(ctx, 7, 9, '#44FF44');
  });

  def('laptop', (ctx) => {
    rect(ctx, 2, 2, 12, 6, '#333');
    rect(ctx, 3, 3, 10, 4, '#4488AA');
    rect(ctx, 4, 4, 8, 1, '#88CCEE'); rect(ctx, 4, 5, 5, 1, '#66AACC');
    rect(ctx, 1, 8, 14, 6, '#555'); rect(ctx, 2, 9, 12, 4, '#444');
    for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 10; kx++) px(ctx, 3 + kx, 9 + ky, '#3A3A3A');
    rect(ctx, 6, 12, 4, 1, '#3A3A3A');
  });

  def('keyboard', (ctx) => {
    rect(ctx, 1, 5, 14, 6, '#555'); rect(ctx, 2, 6, 12, 4, '#444');
    for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 10; kx++) px(ctx, 3 + kx, 6 + ky, '#3A3A3A');
    rect(ctx, 5, 9, 6, 1, '#3A3A3A');
  });

  def('mouse', (ctx) => {
    rect(ctx, 6, 5, 4, 7, '#555');
    rect(ctx, 7, 4, 2, 1, '#555'); rect(ctx, 7, 12, 2, 1, '#555');
    rect(ctx, 6, 5, 2, 3, '#606060'); rect(ctx, 8, 5, 2, 3, '#505050');
    rect(ctx, 7, 6, 2, 1, '#444'); line(ctx, 7, 4, 7, 2, '#444');
  });

  def('printer', (ctx) => {
    rect(ctx, 1, 5, 14, 8, '#D8D8D8'); rect(ctx, 2, 6, 12, 6, '#E8E8E8');
    rect(ctx, 3, 3, 10, 3, '#F0F0F0'); rect(ctx, 4, 4, 8, 1, '#FFF');
    rect(ctx, 3, 10, 10, 2, '#CCC'); rect(ctx, 5, 11, 6, 1, '#FFF');
    px(ctx, 3, 7, '#44FF44'); px(ctx, 5, 7, '#FFAA00'); rect(ctx, 11, 7, 2, 2, '#AAA');
  });

  def('phone', (ctx) => {
    rect(ctx, 3, 6, 10, 7, '#333'); rect(ctx, 4, 7, 8, 5, '#444');
    for (let by = 0; by < 3; by++) for (let bx = 0; bx < 3; bx++) px(ctx, 5 + bx * 2, 8 + by * 2, '#888');
    rect(ctx, 2, 3, 4, 3, '#222'); rect(ctx, 10, 3, 4, 3, '#222');
    rect(ctx, 5, 2, 6, 2, '#222');
    rect(ctx, 3, 4, 1, 1, '#333'); rect(ctx, 12, 4, 1, 1, '#333');
    rect(ctx, 5, 7, 6, 1, '#446644');
  });

  // ═══════════════ STORAGE ═══════════════

  def('filing_cabinet', (ctx) => {
    rect(ctx, 2, 1, 12, 14, '#808890');
    rect(ctx, 3, 2, 10, 3, '#707880'); rect(ctx, 3, 6, 10, 3, '#707880'); rect(ctx, 3, 10, 10, 4, '#707880');
    rect(ctx, 7, 3, 2, 1, '#A0A8B0'); rect(ctx, 7, 7, 2, 1, '#A0A8B0'); rect(ctx, 7, 11, 2, 1, '#A0A8B0');
    rect(ctx, 2, 1, 12, 1, '#909AA0');
  });

  def('bookshelf', (ctx) => {
    rect(ctx, 1, 0, 14, 16, '#6B4F0A');
    rect(ctx, 1, 5, 14, 1, '#5C4008'); rect(ctx, 1, 10, 14, 1, '#5C4008');
    rect(ctx, 2, 1, 2, 4, '#CC3333'); rect(ctx, 4, 2, 2, 3, '#3366CC');
    rect(ctx, 6, 1, 1, 4, '#33AA55'); rect(ctx, 7, 2, 2, 3, '#DDAA33'); rect(ctx, 10, 1, 3, 4, '#8844AA');
    rect(ctx, 2, 6, 3, 4, '#DD6633'); rect(ctx, 5, 7, 2, 3, '#4488CC');
    rect(ctx, 8, 6, 2, 4, '#44AA88'); rect(ctx, 11, 7, 2, 3, '#AA3366');
    rect(ctx, 2, 11, 2, 4, '#6688AA'); rect(ctx, 5, 11, 3, 4, '#AA8844');
    rect(ctx, 9, 12, 2, 3, '#88AA44'); rect(ctx, 12, 11, 1, 4, '#CC6688');
  });

  def('locker', (ctx) => {
    rect(ctx, 2, 0, 12, 16, '#707880');
    rect(ctx, 2, 0, 6, 16, '#788088'); rect(ctx, 8, 0, 6, 16, '#687078');
    rect(ctx, 7, 0, 2, 16, '#606870');
    for (let i = 0; i < 3; i++) { rect(ctx, 3, 2 + i * 2, 3, 1, '#606870'); rect(ctx, 10, 2 + i * 2, 3, 1, '#586068'); }
    rect(ctx, 6, 8, 1, 2, '#A0A8B0'); rect(ctx, 9, 8, 1, 2, '#A0A8B0');
  });

  // ═══════════════ OFFICE ITEMS ═══════════════

  def('whiteboard', (ctx) => {
    rect(ctx, 1, 2, 14, 11, '#EEEEF0');
    rect(ctx, 1, 2, 14, 1, '#BBB'); rect(ctx, 1, 12, 14, 1, '#BBB');
    rect(ctx, 1, 2, 1, 11, '#BBB'); rect(ctx, 14, 2, 1, 11, '#BBB');
    line(ctx, 3, 5, 11, 5, '#3366CC'); line(ctx, 3, 7, 9, 7, '#CC3333'); line(ctx, 3, 9, 12, 9, '#33AA55');
    rect(ctx, 3, 13, 10, 1, '#CCC');
    rect(ctx, 4, 13, 2, 1, '#CC3333'); rect(ctx, 7, 13, 2, 1, '#3366CC');
  });

  def('plant_small', (ctx) => {
    rect(ctx, 5, 10, 6, 4, '#CC8844'); rect(ctx, 6, 14, 4, 2, '#BB7733'); rect(ctx, 5, 10, 6, 1, '#DDA055');
    rect(ctx, 6, 5, 4, 5, '#44AA44');
    rect(ctx, 4, 6, 2, 3, '#338833'); rect(ctx, 10, 6, 2, 3, '#338833');
    rect(ctx, 7, 3, 2, 2, '#55BB55');
    px(ctx, 5, 5, '#55BB55'); px(ctx, 10, 5, '#55BB55');
  });

  def('plant_tall', (ctx) => {
    rect(ctx, 4, 11, 8, 4, '#CC8844'); rect(ctx, 5, 15, 6, 1, '#BB7733'); rect(ctx, 4, 11, 8, 1, '#DDA055');
    rect(ctx, 7, 5, 2, 6, '#6B4F0A');
    rect(ctx, 4, 1, 8, 6, '#338833');
    rect(ctx, 3, 2, 2, 4, '#2A7728'); rect(ctx, 11, 2, 2, 4, '#2A7728');
    rect(ctx, 5, 0, 6, 2, '#44AA44');
    px(ctx, 6, 1, '#55BB55'); px(ctx, 9, 2, '#55BB55');
    px(ctx, 4, 4, '#55BB55'); px(ctx, 11, 3, '#55BB55');
  });

  def('water_cooler', (ctx) => {
    rect(ctx, 4, 12, 8, 4, '#888'); rect(ctx, 5, 13, 6, 2, '#999');
    rect(ctx, 5, 5, 6, 7, '#AAA'); rect(ctx, 5, 5, 6, 1, '#BBB');
    rect(ctx, 6, 0, 4, 5, '#88BBDD'); rect(ctx, 7, 0, 2, 1, '#6699BB'); rect(ctx, 6, 0, 4, 1, '#AAD4EC');
    px(ctx, 5, 8, '#C0C0C0'); px(ctx, 5, 9, '#4488FF');
  });

  def('coffee_machine', (ctx) => {
    rect(ctx, 3, 4, 10, 10, '#444'); rect(ctx, 3, 4, 10, 1, '#555');
    rect(ctx, 5, 1, 6, 3, '#333'); rect(ctx, 5, 1, 6, 1, '#444');
    rect(ctx, 5, 6, 4, 3, '#446644'); rect(ctx, 6, 7, 2, 1, '#66AA66');
    rect(ctx, 6, 10, 4, 1, '#555');
    rect(ctx, 6, 11, 4, 3, '#DDD'); rect(ctx, 7, 12, 2, 1, '#8B4513');
    px(ctx, 11, 6, '#FF4444'); px(ctx, 11, 8, '#44FF44');
  });

  def('trash_can', (ctx) => {
    rect(ctx, 4, 4, 8, 10, '#666'); rect(ctx, 5, 5, 6, 9, '#777');
    rect(ctx, 3, 3, 10, 2, '#777'); rect(ctx, 3, 3, 10, 1, '#888');
    line(ctx, 5, 7, 5, 12, '#606060'); line(ctx, 8, 7, 8, 12, '#606060'); line(ctx, 10, 7, 10, 12, '#606060');
  });

  def('clock', (ctx) => {
    rect(ctx, 4, 4, 8, 8, '#FFF');
    rect(ctx, 5, 3, 6, 1, '#FFF'); rect(ctx, 5, 12, 6, 1, '#FFF');
    rect(ctx, 3, 5, 1, 6, '#FFF'); rect(ctx, 12, 5, 1, 6, '#FFF');
    rect(ctx, 5, 3, 6, 1, '#222'); rect(ctx, 5, 12, 6, 1, '#222');
    rect(ctx, 3, 5, 1, 6, '#222'); rect(ctx, 12, 5, 1, 6, '#222');
    px(ctx, 4, 4, '#222'); px(ctx, 11, 4, '#222'); px(ctx, 4, 11, '#222'); px(ctx, 11, 11, '#222');
    rect(ctx, 5, 4, 6, 8, '#FFF'); rect(ctx, 4, 5, 8, 6, '#FFF');
    px(ctx, 8, 4, '#333'); px(ctx, 11, 8, '#333'); px(ctx, 8, 11, '#333'); px(ctx, 4, 8, '#333');
    line(ctx, 8, 8, 8, 5, '#222'); line(ctx, 8, 8, 10, 6, '#CC3333');
    px(ctx, 8, 8, '#222');
  });

  def('picture', (ctx) => {
    rect(ctx, 2, 3, 12, 10, '#6B4F0A'); rect(ctx, 3, 4, 10, 8, '#88AACC');
    rect(ctx, 3, 9, 10, 3, '#44AA44'); rect(ctx, 3, 8, 10, 2, '#78B8DC');
    rect(ctx, 10, 5, 2, 2, '#FFDD44');
    rect(ctx, 4, 7, 3, 2, '#338833'); rect(ctx, 8, 8, 4, 1, '#338833');
  });

  // ═══════════════ PARTITIONS ═══════════════

  def('cubicle_h', (ctx) => {
    rect(ctx, 0, 5, 16, 6, '#909098');
    rect(ctx, 0, 5, 16, 1, '#A0A0A8'); rect(ctx, 0, 10, 16, 1, '#808088');
    for (let x = 0; x < 16; x += 3) px(ctx, x, 7, '#888890');
    for (let x = 1; x < 16; x += 3) px(ctx, x, 8, '#989898');
  });

  def('cubicle_v', (ctx) => {
    rect(ctx, 5, 0, 6, 16, '#909098');
    rect(ctx, 5, 0, 1, 16, '#A0A0A8'); rect(ctx, 10, 0, 1, 16, '#808088');
    for (let y = 0; y < 16; y += 3) px(ctx, 7, y, '#888890');
    for (let y = 1; y < 16; y += 3) px(ctx, 8, y, '#989898');
  });

  def('cubicle_corner', (ctx) => {
    rect(ctx, 0, 5, 16, 6, '#909098'); rect(ctx, 5, 0, 6, 16, '#909098');
    rect(ctx, 0, 5, 16, 1, '#A0A0A8'); rect(ctx, 5, 0, 1, 16, '#A0A0A8');
    rect(ctx, 0, 10, 16, 1, '#808088'); rect(ctx, 10, 0, 1, 16, '#808088');
  });

  // ═══════════════ DECOR / MISC ═══════════════

  def('rug_center', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#7C3D3D'); rect(ctx, 1, 1, 14, 14, '#994444');
    rect(ctx, 2, 2, 12, 12, '#AA5555');
    rect(ctx, 4, 4, 8, 8, '#BB6666'); rect(ctx, 6, 6, 4, 4, '#994444');
  });

  def('elevator', (ctx) => {
    rect(ctx, 0, 0, 16, 16, '#606870');
    rect(ctx, 1, 1, 6, 14, '#808890'); rect(ctx, 9, 1, 6, 14, '#808890');
    rect(ctx, 7, 1, 2, 14, '#404850');
    rect(ctx, 6, 0, 4, 1, '#333'); px(ctx, 7, 0, '#44FF44');
    rect(ctx, 7, 15, 2, 1, '#333');
  });

  def('stairs', (ctx) => {
    for (let i = 0; i < 8; i++) {
      const s = 80 + i * 15;
      rect(ctx, 0, i * 2, 16, 2, `rgb(${s},${s},${s + 10})`);
      rect(ctx, 0, i * 2, 16, 1, `rgb(${s + 20},${s + 20},${s + 25})`);
    }
  });

  def('ac_vent', (ctx) => {
    rect(ctx, 2, 4, 12, 8, '#D0D0D0'); rect(ctx, 2, 4, 12, 1, '#E0E0E0');
    for (let i = 0; i < 5; i++) rect(ctx, 3, 5 + i * 2, 10, 1, '#BBB');
  });

  def('ceiling_light', (ctx) => {
    rect(ctx, 5, 5, 6, 6, 'rgba(255,255,200,0.3)');
    rect(ctx, 4, 4, 8, 8, 'rgba(255,255,200,0.15)');
    rect(ctx, 3, 3, 10, 10, 'rgba(255,255,200,0.08)');
    rect(ctx, 6, 6, 4, 4, '#FFFFF0'); rect(ctx, 7, 7, 2, 2, '#FFFFDD');
  });

  def('fire_extinguisher', (ctx) => {
    rect(ctx, 6, 3, 4, 10, '#CC2222'); rect(ctx, 6, 3, 4, 1, '#DD3333');
    rect(ctx, 7, 1, 2, 2, '#888'); rect(ctx, 5, 2, 2, 2, '#666');
    rect(ctx, 7, 13, 2, 2, '#222'); rect(ctx, 7, 6, 2, 3, '#FFF');
  });

  def('couch_top', (ctx) => {
    rect(ctx, 0, 3, 16, 10, '#4466AA'); rect(ctx, 0, 3, 16, 2, '#3355AA');
    rect(ctx, 1, 5, 14, 7, '#5577BB');
    rect(ctx, 0, 3, 2, 10, '#3355AA'); rect(ctx, 14, 3, 2, 10, '#3355AA');
    rect(ctx, 7, 5, 2, 7, '#4466AA');
  });

  def('table_round', (ctx) => {
    rect(ctx, 4, 4, 8, 8, '#8B6914');
    rect(ctx, 3, 5, 1, 6, '#8B6914'); rect(ctx, 12, 5, 1, 6, '#8B6914');
    rect(ctx, 5, 3, 6, 1, '#8B6914'); rect(ctx, 5, 12, 6, 1, '#8B6914');
    rect(ctx, 5, 4, 6, 8, '#9B7924'); rect(ctx, 4, 5, 8, 6, '#9B7924');
    rect(ctx, 6, 5, 4, 3, '#AB8934');
    px(ctx, 7, 13, '#6B4F0A'); px(ctx, 8, 13, '#6B4F0A');
  });

  def('meeting_table', (ctx) => {
    rect(ctx, 0, 2, 16, 12, '#6E5530');
    rect(ctx, 1, 3, 14, 10, '#8B6914'); rect(ctx, 1, 3, 14, 1, '#9B7924');
    rect(ctx, 0, 2, 16, 1, '#9B7924'); rect(ctx, 0, 13, 16, 1, '#5C4008');
    rect(ctx, 5, 6, 6, 4, '#9B7924');
  });

  // ══════════════════════════════════════════
  //  Init — pre-render every tile to its canvas
  // ══════════════════════════════════════════

  function initTiles() {
    if (_ready) return;
    for (const tile of Object.values(TILES)) {
      const c = document.createElement('canvas');
      c.width = TILE_SIZE;
      c.height = TILE_SIZE;
      tile.draw(c.getContext('2d'));
      tile.canvas = c;
    }
    _ready = true;
  }

  // ══════════════════════════════════════════
  //  PROCEDURAL OFFICE GENERATOR
  //  Returns { mapW, mapH, layers, zones }
  // ══════════════════════════════════════════

  function generate(numManagers, numWorkers) {
    const MGR_W = 5, MGR_H = 4, BREAK_W = 7, BREAK_H = 5, MEET_H = 5, LOBBY_H = 2;

    const maxPerRow = Math.max(3, Math.min(10, Math.ceil(Math.sqrt(numWorkers * 2))));
    const deskRowSets = Math.ceil(numWorkers / maxPerRow);
    const doubleRowSets = Math.ceil(deskRowSets / 2);
    const workerAreaH = doubleRowSets * 6 + 2;

    const leftColInner = MGR_W;
    const leftColW = leftColInner + 1;
    const mgrStackH = numManagers * (MGR_H + 1);
    const workerAreaW = maxPerRow * 2 + 3;
    const rightSideW = Math.max(workerAreaW, BREAK_W);

    const totalW = 1 + leftColW + rightSideW + 1 + 1;
    const contentH = LOBBY_H + Math.max(mgrStackH, workerAreaH) + 1;
    const bottomRowH = Math.max(BREAK_H, MEET_H) + 1;
    const totalH = 1 + contentH + bottomRowH + 1;

    const W = Math.max(20, totalW);
    const H = Math.max(14, totalH);

    const layers = [
      new Array(W * H).fill(null),
      new Array(W * H).fill(null),
      new Array(W * H).fill(null)
    ];

    const set = (l, x, y, t) => { if (x >= 0 && x < W && y >= 0 && y < H) layers[l][y * W + x] = t; };
    const get = (l, x, y) => (x >= 0 && x < W && y >= 0 && y < H) ? layers[l][y * W + x] : null;

    const mgrColRight = 1 + leftColW;
    const lobbyBottom = 1 + LOBBY_H;
    const midAreaTop = lobbyBottom + 1;
    const bottomDivider = H - 1 - BREAK_H - 1;
    const breakLeft = 1;
    const breakRight = mgrColRight;
    const meetLeft = mgrColRight + 1;

    // ── 1. FLOORS ──
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) set(0, x, y, 'floor_carpet_blue');
    for (let y = 1; y <= LOBBY_H; y++) for (let x = 1; x < W - 1; x++) set(0, x, y, 'floor_tile');
    for (let i = 0; i < numManagers; i++) {
      const oy = midAreaTop + i * (MGR_H + 1);
      for (let dy = 0; dy < MGR_H; dy++) for (let dx = 0; dx < MGR_W; dx++) set(0, 1 + dx, oy + dy, 'floor_wood');
    }
    for (let y = bottomDivider + 1; y < H - 1; y++) for (let x = breakLeft; x < breakRight; x++) set(0, x, y, 'floor_tile');
    for (let y = bottomDivider + 1; y < H - 1; y++) for (let x = meetLeft; x < W - 1; x++) set(0, x, y, 'floor_wood_dark');

    // ── 2. OUTER WALLS ──
    for (let x = 1; x < W - 1; x++) { set(1, x, 0, 'wall_top'); set(1, x, H - 1, 'wall_bottom'); }
    for (let y = 1; y < H - 1; y++) { set(1, 0, y, 'wall_left'); set(1, W - 1, y, 'wall_right'); }
    set(1, 0, 0, 'wall_corner_tl'); set(1, W - 1, 0, 'wall_corner_tr');
    set(1, 0, H - 1, 'wall_corner_bl'); set(1, W - 1, H - 1, 'wall_corner_br');

    // ── 3. LOBBY DIVIDER ──
    for (let x = 1; x < W - 1; x++) set(1, x, lobbyBottom, 'wall_top');
    const doorX = Math.floor(W / 2);
    set(1, doorX, 0, 'door_h');
    set(1, mgrColRight + Math.floor(rightSideW / 2), lobbyBottom, 'door_glass_h');
    set(1, Math.floor(mgrColRight / 2), lobbyBottom, 'door_h');

    // ── 4. MANAGER COLUMN ──
    for (let y = midAreaTop; y <= bottomDivider; y++) set(1, mgrColRight, y, 'wall_v');

    // ── 5. MANAGER OFFICES ──
    for (let i = 0; i < numManagers; i++) {
      const oy = midAreaTop + i * (MGR_H + 1);
      if (i > 0) { for (let x = 1; x < mgrColRight; x++) set(1, x, oy - 1, 'wall_top'); }
      set(1, mgrColRight, oy + Math.floor(MGR_H / 2), 'door_v');
    }

    // ── 6. BOTTOM SECTION ──
    for (let x = 1; x < W - 1; x++) set(1, x, bottomDivider, 'wall_top');
    for (let y = bottomDivider; y < H - 1; y++) set(1, mgrColRight, y, 'wall_v');
    set(1, Math.floor((breakLeft + breakRight) / 2), bottomDivider, 'door_h');
    set(1, Math.floor((meetLeft + W - 1) / 2), bottomDivider, 'door_h');

    // ── 7. WINDOWS ──
    const wSpac = Math.max(3, Math.floor((W - 4) / 4));
    for (let wx = 3; wx < W - 2; wx += wSpac) if (get(1, wx, 0) === 'wall_top') set(1, wx, 0, 'window_h');

    // ── 8. LOBBY ──
    set(1, 2, 1, 'plant_tall'); set(1, W - 3, 1, 'plant_tall');
    if (LOBBY_H >= 2) { set(1, doorX - 1, 1, 'rug_center'); set(1, doorX, 1, 'rug_center'); set(1, doorX + 1, 1, 'rug_center'); }
    const recpX = Math.max(4, doorX - 2);
    set(1, recpX, LOBBY_H, 'desk_h'); set(1, recpX + 1, LOBBY_H, 'desk_h');
    set(1, recpX, LOBBY_H - 1, 'monitor'); set(1, recpX + 1, LOBBY_H - 1, 'keyboard');

    // ── 9. MANAGER OFFICES FURNITURE ──
    for (let i = 0; i < numManagers; i++) {
      const oy = midAreaTop + i * (MGR_H + 1);
      const ox = 1;
      set(1, ox + 1, oy, 'desk_h'); set(1, ox + 2, oy, 'desk_h');
      set(1, ox + 1, oy + 1, 'monitor'); set(1, ox + 2, oy + 1, 'keyboard');
      set(1, ox + 2, oy + 2, 'chair_up');
      set(1, ox, oy + MGR_H - 1, 'bookshelf');
      set(1, ox, oy, 'filing_cabinet');
      set(1, ox + MGR_W - 1, oy + MGR_H - 1, 'plant_small');
      if (MGR_W >= 5) set(1, ox + 3, oy, 'picture');
      set(2, ox + 2, oy + 1, 'ceiling_light');
    }

    // ── 10. WORKER AREA ──
    const workStartX = mgrColRight + 2;
    const workEndX = W - 2;
    const workStartY = midAreaTop + 1;
    const desksPerRow = Math.min(maxPerRow, Math.floor((workEndX - workStartX) / 2));
    let placed = 0, rowSetY = workStartY;

    while (placed < numWorkers && rowSetY + 4 < bottomDivider) {
      for (let d = 0; d < desksPerRow && placed < numWorkers; d++) {
        const dx = workStartX + d * 2;
        if (dx >= workEndX) break;
        set(1, dx, rowSetY, 'monitor'); set(1, dx, rowSetY + 1, 'desk_h'); set(1, dx, rowSetY + 2, 'chair_down');
        placed++;
      }
      if (placed < numWorkers && rowSetY + 6 < bottomDivider) {
        const bot = rowSetY + 4;
        for (let d = 0; d < desksPerRow && placed < numWorkers; d++) {
          const dx = workStartX + d * 2;
          if (dx >= workEndX) break;
          set(1, dx, bot, 'chair_up'); set(1, dx, bot + 1, 'desk_h'); set(1, dx, bot + 2, 'monitor');
          placed++;
        }
        rowSetY = bot + 4;
      } else { rowSetY += 5; }
    }

    set(1, workStartX, midAreaTop, 'whiteboard');
    set(1, W - 2, midAreaTop, 'printer');
    if (bottomDivider - 1 > midAreaTop + 2) {
      set(1, W - 2, bottomDivider - 1, 'plant_small');
      set(1, workStartX, bottomDivider - 1, 'plant_tall');
    }
    for (let ly = workStartY + 1; ly < bottomDivider - 1; ly += 4)
      for (let lx = workStartX + 1; lx < W - 2; lx += 4) set(2, lx, ly, 'ceiling_light');

    // ── 11. BREAK ROOM ──
    const bry = bottomDivider + 1;
    set(1, breakLeft + 1, bry, 'coffee_machine'); set(1, breakLeft + 2, bry, 'water_cooler');
    set(1, breakLeft + 1, bry + 2, 'couch_top'); set(1, breakLeft + 2, bry + 2, 'couch_top');
    if (breakRight - breakLeft > 4) {
      set(1, breakLeft + 4, bry + 1, 'table_round');
      set(1, breakLeft + 4, bry + 3, 'chair_down');
      set(1, breakLeft + 3, bry + 1, 'chair_left');
    }
    set(1, breakRight - 2, bry, 'trash_can');
    set(1, breakRight - 2, bry + BREAK_H - 2, 'plant_small');
    set(2, breakLeft + 2, bry + 1, 'ceiling_light');

    // ── 12. MEETING ROOM ──
    const mry = bottomDivider + 1;
    const meetW = W - 1 - meetLeft;
    const tblX = meetLeft + Math.max(1, Math.floor((meetW - 4) / 2));
    const tblL = Math.min(4, meetW - 2);
    for (let t = 0; t < tblL; t++) {
      set(1, tblX + t, mry + Math.floor(MEET_H / 2), 'meeting_table');
      set(1, tblX + t, mry + Math.floor(MEET_H / 2) - 1, 'chair_down');
      if (mry + Math.floor(MEET_H / 2) + 1 < H - 1) set(1, tblX + t, mry + Math.floor(MEET_H / 2) + 1, 'chair_up');
    }
    set(1, meetLeft + 1, mry, 'whiteboard');
    set(1, meetLeft + Math.floor(meetW / 2), mry, 'monitor');
    set(2, meetLeft + Math.floor(meetW / 2), mry + 2, 'ceiling_light');

    // ── 13. CORRIDOR ──
    set(1, doorX + 2, 1, 'fire_extinguisher');
    set(1, W - 2, LOBBY_H, 'clock');

    // ── ZONE RECTS (percentages of map) ──
    const pct = (v, total) => (v / total) * 100;
    const wa_x = mgrColRight + 1;
    const wa_y = midAreaTop;
    const wa_w = W - 2 - wa_x;
    const wa_h = Math.max(1, bottomDivider - midAreaTop);
    const brH = Math.max(1, H - 2 - bottomDivider);

    const zones = {
      manager: { x: pct(1, W), y: pct(midAreaTop, H), w: pct(MGR_W, W), h: pct(Math.min(mgrStackH, wa_h), H) },
      desks:   { x: pct(wa_x + 1, W), y: pct(wa_y + 1, H), w: pct(Math.max(1, wa_w - 2), W), h: pct(Math.max(1, wa_h - 2), H) },
      review:  { x: pct(wa_x + wa_w * 0.55, W), y: pct(wa_y + 1, H), w: pct(wa_w * 0.4, W), h: pct(wa_h * 0.42, H) },
      research:{ x: pct(wa_x + wa_w * 0.55, W), y: pct(wa_y + wa_h * 0.52, H), w: pct(wa_w * 0.4, W), h: pct(wa_h * 0.42, H) },
      break:   { x: pct(breakLeft + 1, W), y: pct(bottomDivider + 1, H), w: pct(Math.max(1, breakRight - breakLeft - 2), W), h: pct(brH, H) },
      remote:  { x: pct(meetLeft + 1, W), y: pct(bottomDivider + 1, H), w: pct(Math.max(1, W - 2 - meetLeft - 1), W), h: pct(brH, H) },
      field:   { x: pct(Math.floor(W * 0.4), W), y: pct(1, H), w: pct(Math.floor(W * 0.3), W), h: pct(LOBBY_H, H) }
    };

    return { mapW: W, mapH: H, layers, zones };
  }

  // ══════════════════════════════════════════
  //  RENDER — draw tilemap onto a <canvas>
  // ══════════════════════════════════════════

  function render(canvas, data) {
    const { mapW, mapH, layers } = data;
    const pw = mapW * TILE_SIZE;
    const ph = mapH * TILE_SIZE;
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, pw, ph);

    for (let l = 0; l < 3; l++) {
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          const tid = layers[l][y * mapW + x];
          if (tid && TILES[tid] && TILES[tid].canvas) {
            ctx.drawImage(TILES[tid].canvas, x * TILE_SIZE, y * TILE_SIZE);
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════
  //  EXPORT
  // ══════════════════════════════════════════

  window.OfficeTilemap = { TILE_SIZE, TILES, initTiles, generate, render };
})();
