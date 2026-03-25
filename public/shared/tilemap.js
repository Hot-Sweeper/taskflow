// ══════════════════════════════════════════════════════════════
//  OfficeTilemap — Pixel-art tile system for the Office tab
//  Provides tile definitions, procedural office generator, and
//  canvas rendering. Used by public/app/index.html Office tab.
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const TILE_SIZE = 16;
  const TILE_ART_SCALE = 3;
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
  function rr(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function circle(ctx, x, y, r, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function grad(ctx, x0, y0, x1, y1, stops) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const stop of stops) gradient.addColorStop(stop[0], stop[1]);
    return gradient;
  }

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

  // ═══════════════ ILLUSTRATED RESTYLE OVERRIDES ═══════════════

  def('floor_wood', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.5, grad(ctx, 0, 0, 16, 16, [[0, '#c99064'], [1, '#a86f45']]));
    ctx.strokeStyle = 'rgba(111, 67, 39, 0.55)';
    ctx.lineWidth = 0.75;
    [4, 8, 12].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(16, y); ctx.stroke(); });
    [2.5, 9.5].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 4); ctx.stroke(); });
    [6.5, 13.5].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 8); ctx.stroke(); });
    [3.5, 11.5].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 12); ctx.stroke(); });
    [7.5, 14.5].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 16); ctx.stroke(); });
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(15, 2); ctx.stroke();
  });

  def('floor_wood_dark', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.5, grad(ctx, 0, 0, 16, 16, [[0, '#7f5b4d'], [1, '#5f3f33']]));
    ctx.strokeStyle = 'rgba(51, 30, 24, 0.55)';
    ctx.lineWidth = 0.75;
    [4, 8, 12].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(16, y); ctx.stroke(); });
    [3, 10].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 4); ctx.stroke(); });
    [5, 13].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 8); ctx.stroke(); });
    [2, 9].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 12); ctx.stroke(); });
    [6, 12].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 16); ctx.stroke(); });
  });

  def('floor_carpet_blue', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.5, grad(ctx, 0, 0, 16, 16, [[0, '#4d77b3'], [1, '#2f4f85']]));
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let x = -8; x < 18; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x + 8, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(12, 30, 64, 0.16)';
    for (let x = -6; x < 20; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 8, 16);
      ctx.stroke();
    }
  });

  def('floor_carpet_red', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.5, grad(ctx, 0, 0, 16, 16, [[0, '#b04f57'], [1, '#873940']]));
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.5;
    for (let x = -8; x < 18; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x + 8, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(79, 18, 25, 0.16)';
    for (let x = -6; x < 20; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 8, 16);
      ctx.stroke();
    }
  });

  def('floor_tile', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.5, '#eee7db');
    ctx.strokeStyle = '#d4c9ba';
    ctx.lineWidth = 0.7;
    [0.5, 8].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 16); ctx.stroke(); });
    [0.5, 8].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(16, y); ctx.stroke(); });
    circle(ctx, 4, 4, 0.7, 'rgba(255,255,255,0.45)');
    circle(ctx, 12, 11, 0.7, 'rgba(205,194,176,0.55)');
  });

  def('wall_top', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 16, 4.5, 2.2, grad(ctx, 0, 0, 0, 5, [[0, '#5a6678'], [1, '#455161']]));
    rr(ctx, 0, 4, 16, 1.2, 0.6, 'rgba(30,40,54,0.35)');
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.6;
    [3, 7.5, 12].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0.8); ctx.lineTo(x, 4); ctx.stroke(); });
  });

  def('wall_bottom', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 11.5, 16, 4.5, 2.2, grad(ctx, 0, 11, 0, 16, [[0, '#5a6678'], [1, '#455161']]));
    rr(ctx, 0, 11, 16, 1.2, 0.6, 'rgba(255,255,255,0.12)');
    ctx.strokeStyle = 'rgba(30,40,54,0.26)';
    ctx.lineWidth = 0.6;
    [3, 7.5, 12].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 15.2); ctx.stroke(); });
  });

  def('wall_left', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 4.5, 16, 2.2, grad(ctx, 0, 0, 5, 0, [[0, '#5a6678'], [1, '#455161']]));
    rr(ctx, 4, 0, 1.2, 16, 0.6, 'rgba(30,40,54,0.25)');
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.6;
    [3, 7.5, 12].forEach((y) => { ctx.beginPath(); ctx.moveTo(0.8, y); ctx.lineTo(4, y); ctx.stroke(); });
  });

  def('wall_right', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 11.5, 0, 4.5, 16, 2.2, grad(ctx, 11, 0, 16, 0, [[0, '#455161'], [1, '#5a6678']]));
    rr(ctx, 10.8, 0, 1.2, 16, 0.6, 'rgba(255,255,255,0.12)');
    ctx.strokeStyle = 'rgba(30,40,54,0.24)';
    ctx.lineWidth = 0.6;
    [3, 7.5, 12].forEach((y) => { ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(15.2, y); ctx.stroke(); });
  });

  def('wall_corner_tl', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 16, 4.5, 2.2, '#4b5667');
    rr(ctx, 0, 0, 4.5, 16, 2.2, '#566173');
    rr(ctx, 4, 4, 2, 2, 0.8, '#3e4754');
  });

  def('wall_corner_tr', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 16, 4.5, 2.2, '#4b5667');
    rr(ctx, 11.5, 0, 4.5, 16, 2.2, '#566173');
    rr(ctx, 10, 4, 2, 2, 0.8, '#3e4754');
  });

  def('wall_corner_bl', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 11.5, 16, 4.5, 2.2, '#4b5667');
    rr(ctx, 0, 0, 4.5, 16, 2.2, '#566173');
    rr(ctx, 4, 10, 2, 2, 0.8, '#3e4754');
  });

  def('wall_corner_br', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 11.5, 16, 4.5, 2.2, '#4b5667');
    rr(ctx, 11.5, 0, 4.5, 16, 2.2, '#566173');
    rr(ctx, 10, 10, 2, 2, 0.8, '#3e4754');
  });

  def('wall_h', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2, grad(ctx, 0, 0, 0, 16, [[0, '#617083'], [1, '#44505f']]));
    rr(ctx, 0, 2, 16, 1, 0.4, 'rgba(255,255,255,0.16)');
    rr(ctx, 0, 13, 16, 1, 0.4, 'rgba(20,25,32,0.22)');
  });

  def('wall_v', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2, grad(ctx, 0, 0, 16, 0, [[0, '#566173'], [0.5, '#465260'], [1, '#566173']]));
    rr(ctx, 2, 0, 1, 16, 0.4, 'rgba(255,255,255,0.1)');
    rr(ctx, 13, 0, 1, 16, 0.4, 'rgba(20,25,32,0.18)');
  });

  def('door_h', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 16, 4.2, 2.2, '#4b5667');
    rr(ctx, 2.2, 3.5, 11.6, 7.8, 1.4, grad(ctx, 0, 3.5, 0, 11, [[0, '#c79269'], [1, '#a8714f']]), '#8d5e40', 0.7);
    rr(ctx, 5, 5.1, 6, 2.1, 0.8, 'rgba(255,255,255,0.15)');
    circle(ctx, 11.8, 7.6, 0.55, '#e8d7a8');
  });

  def('door_v', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 4.2, 16, 2.2, '#4b5667');
    rr(ctx, 3.5, 2.2, 7.8, 11.6, 1.4, grad(ctx, 3.5, 0, 11, 0, [[0, '#c79269'], [1, '#a8714f']]), '#8d5e40', 0.7);
    rr(ctx, 5.1, 5, 2.1, 6, 0.8, 'rgba(255,255,255,0.15)');
    circle(ctx, 8, 11.8, 0.55, '#e8d7a8');
  });

  def('door_glass_h', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#efe7da');
    rr(ctx, 0, 0, 16, 4.2, 2.2, '#4b5667');
    rr(ctx, 2.1, 3.5, 11.8, 7.8, 1.5, grad(ctx, 0, 3.5, 0, 11, [[0, '#bfd6e3'], [1, '#95b5ca']]), '#72889a', 0.7);
    rr(ctx, 3.3, 4.5, 9.4, 5.2, 1, 'rgba(255,255,255,0.34)');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(4, 5.5); ctx.lineTo(8.5, 5.5); ctx.stroke();
  });

  def('window_h', (ctx) => {
    rr(ctx, 0, 0, 16, 16, 2.2, '#4f5968');
    rr(ctx, 2, 2.5, 12, 8.6, 1.6, grad(ctx, 2, 2.5, 2, 11, [[0, '#dff0f8'], [1, '#9fc7dc']]), '#7c93a1', 0.8);
    rr(ctx, 7.4, 2.5, 1.2, 8.6, 0.4, '#7c93a1');
    rr(ctx, 2, 6.2, 12, 1.1, 0.4, '#7c93a1');
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(3.5, 4.1); ctx.lineTo(6.3, 4.1); ctx.stroke();
  });

  def('desk_h', (ctx) => {
    rr(ctx, 1, 1, 14, 4.2, 1.4, grad(ctx, 1, 1, 1, 5, [[0, '#d7a06d'], [1, '#bd7d4f']]), '#8d5d3d', 0.7);
    rr(ctx, 1.6, 4.7, 1.8, 9.5, 0.8, '#7e573e');
    rr(ctx, 12.6, 4.7, 1.8, 9.5, 0.8, '#7e573e');
    rr(ctx, 4.8, 2.3, 6.4, 0.8, 0.4, 'rgba(255,255,255,0.18)');
    rr(ctx, 2.6, 14, 10.8, 0.9, 0.4, 'rgba(53,32,19,0.22)');
  });

  def('desk_v', (ctx) => {
    rr(ctx, 1, 1, 4.2, 14, 1.4, grad(ctx, 1, 1, 5, 1, [[0, '#d7a06d'], [1, '#bd7d4f']]), '#8d5d3d', 0.7);
    rr(ctx, 4.7, 1.6, 9.5, 1.8, 0.8, '#7e573e');
    rr(ctx, 4.7, 12.6, 9.5, 1.8, 0.8, '#7e573e');
    rr(ctx, 2.3, 4.8, 0.8, 6.4, 0.4, 'rgba(255,255,255,0.18)');
  });

  def('desk_corner', (ctx) => {
    rr(ctx, 1, 1, 14, 4, 1.3, '#cc8d5f', '#8d5d3d', 0.7);
    rr(ctx, 1, 1, 4, 14, 1.3, '#c17f52', '#8d5d3d', 0.7);
    rr(ctx, 1.5, 5, 1.7, 9.2, 0.8, '#7e573e');
    rr(ctx, 12.8, 5, 1.7, 9.2, 0.8, '#7e573e');
  });

  def('chair_down', (ctx) => {
    rr(ctx, 4, 2.4, 8, 4.8, 1.8, '#596474');
    rr(ctx, 3.6, 7, 8.8, 4.4, 1.7, '#414b58');
    rr(ctx, 7.2, 11.1, 1.6, 2.2, 0.6, '#5b6574');
    rr(ctx, 4.2, 13.1, 1, 1.8, 0.5, '#2d3540');
    rr(ctx, 10.8, 13.1, 1, 1.8, 0.5, '#2d3540');
    rr(ctx, 7.3, 14, 1, 1.4, 0.5, '#2d3540');
  });

  def('chair_up', (ctx) => {
    rr(ctx, 3.6, 4.6, 8.8, 4.4, 1.7, '#414b58');
    rr(ctx, 4, 9, 8, 4.8, 1.8, '#596474');
    rr(ctx, 7.2, 2.7, 1.6, 2.2, 0.6, '#5b6574');
    rr(ctx, 4.2, 1.1, 1, 1.8, 0.5, '#2d3540');
    rr(ctx, 10.8, 1.1, 1, 1.8, 0.5, '#2d3540');
    rr(ctx, 7.3, 0.6, 1, 1.4, 0.5, '#2d3540');
  });

  def('chair_left', (ctx) => {
    rr(ctx, 4.6, 3.6, 4.6, 8.8, 1.7, '#414b58');
    rr(ctx, 9.1, 4, 4.8, 8, 1.8, '#596474');
    rr(ctx, 2.8, 7.2, 2.2, 1.6, 0.6, '#5b6574');
    rr(ctx, 1.1, 4.2, 1.7, 1, 0.5, '#2d3540');
    rr(ctx, 1.1, 10.8, 1.7, 1, 0.5, '#2d3540');
  });

  def('monitor', (ctx) => {
    rr(ctx, 2, 1.8, 12, 8.2, 1.8, '#2e3540');
    rr(ctx, 3, 2.8, 10, 6.2, 1.2, grad(ctx, 3, 2.8, 13, 9, [[0, '#6cc0d8'], [1, '#3f8bb2']]));
    rr(ctx, 4, 3.8, 5.6, 1, 0.4, 'rgba(255,255,255,0.34)');
    rr(ctx, 7.2, 9.8, 1.6, 3.8, 0.6, '#687384');
    rr(ctx, 5, 13.1, 6, 1.4, 0.7, '#515c6d');
    rr(ctx, 4.8, 14.3, 6.4, 0.8, 0.4, 'rgba(0,0,0,0.22)');
  });

  def('laptop', (ctx) => {
    rr(ctx, 3, 2.5, 10, 5.8, 1.2, '#394350');
    rr(ctx, 3.8, 3.2, 8.4, 4.4, 0.9, grad(ctx, 3.8, 3.2, 12.2, 7.6, [[0, '#88d0e1'], [1, '#4f8eb3']]));
    rr(ctx, 1.8, 8.5, 12.4, 4.8, 1.1, '#d7dde2');
    rr(ctx, 2.6, 9.4, 10.8, 2.8, 0.8, '#c1c8cf');
    rr(ctx, 6, 11.1, 4, 0.8, 0.4, '#a5aeb7');
  });

  def('keyboard', (ctx) => {
    rr(ctx, 2, 11.2, 12, 2.8, 0.9, '#d5dbe0');
    rr(ctx, 3, 11.9, 10, 1.4, 0.4, '#bfc7cd');
    for (let i = 0; i < 4; i++) rr(ctx, 3.6 + (i * 2.2), 12.1, 1.4, 0.9, 0.2, 'rgba(123,136,149,0.42)');
  });

  def('mouse', (ctx) => {
    ellipse(ctx, 8, 12.2, 2, 2.6, '#d5dbe0', '#b4bcc5', 0.7);
    rr(ctx, 7.7, 10.2, 0.6, 1.2, 0.3, '#a6afb9');
  });

  def('printer', (ctx) => {
    rr(ctx, 2, 5, 12, 8, 1.5, '#e8ecef', '#b9c3cb', 0.8);
    rr(ctx, 3.4, 3.2, 9.2, 3, 1.1, '#f6f8fa', '#d1d8dd', 0.7);
    rr(ctx, 4, 7.4, 8, 3.8, 0.9, '#d8dee4');
    rr(ctx, 3.4, 6.4, 1.1, 1.1, 0.4, '#6ad37a');
    rr(ctx, 5.1, 6.4, 1.1, 1.1, 0.4, '#f0b866');
  });

  def('filing_cabinet', (ctx) => {
    rr(ctx, 2.2, 1.2, 11.6, 13.6, 1.2, grad(ctx, 2, 1, 14, 15, [[0, '#94a1b0'], [1, '#758190']]), '#5c6673', 0.8);
    [3.2, 7.2, 11.2].forEach((y) => {
      rr(ctx, 3.2, y, 9.6, 2.5, 0.7, 'rgba(255,255,255,0.08)');
      rr(ctx, 6.8, y + 1, 2.4, 0.4, 0.2, '#dbe2e7');
    });
  });

  def('bookshelf', (ctx) => {
    rr(ctx, 1.4, 0.7, 13.2, 14.6, 1.2, '#9a6a4c', '#6b4632', 0.8);
    [4.8, 9.4].forEach((y) => rr(ctx, 2.1, y, 11.8, 0.8, 0.3, '#6b4632'));
    const books = [
      [2.6, 1.5, 1.5, 2.7, '#d86d72'], [4.5, 1.8, 1.3, 2.4, '#6a97d8'], [6.2, 1.3, 1, 2.9, '#78b96e'], [7.8, 1.9, 1.7, 2.3, '#e0bf6a'], [10.1, 1.4, 2.1, 2.8, '#8b74c9'],
      [2.7, 6.1, 2.1, 2.5, '#e58a62'], [5.3, 6.6, 1.4, 2, '#6fa0d8'], [8, 6.1, 1.6, 2.5, '#72b3a3'], [10.4, 6.5, 1.8, 2.1, '#c56f89'],
      [2.8, 10.7, 1.6, 2.8, '#7d95bf'], [5.1, 10.8, 2.4, 2.7, '#b58c5b'], [8.8, 11.2, 1.7, 2.3, '#a3b85d'], [11.2, 10.8, 1, 2.8, '#d68ba3']
    ];
    books.forEach(([x, y, w, h, c]) => rr(ctx, x, y, w, h, 0.3, c));
  });

  def('whiteboard', (ctx) => {
    rr(ctx, 1.2, 2, 13.6, 10.8, 1.3, '#f6f7f8', '#b9c1c8', 0.8);
    rr(ctx, 2.2, 3.1, 11.6, 8.6, 0.9, '#ffffff');
    rr(ctx, 3.4, 5, 7.2, 0.7, 0.3, '#6a97d8');
    rr(ctx, 3.4, 7.1, 5.8, 0.7, 0.3, '#db786e');
    rr(ctx, 3.4, 9.2, 8.3, 0.7, 0.3, '#72b96e');
    rr(ctx, 4, 12.8, 8, 0.8, 0.3, '#d4d9de');
  });

  def('plant_small', (ctx) => {
    rr(ctx, 5, 10.4, 6, 3.2, 1, '#d79a63');
    rr(ctx, 5.8, 13.2, 4.4, 1.4, 0.5, '#c27d49');
    ellipse(ctx, 8, 7.4, 3.7, 3.6, '#4aaf61');
    ellipse(ctx, 5.6, 8, 2, 2.4, '#3d9a53');
    ellipse(ctx, 10.4, 8, 2, 2.4, '#3d9a53');
    ellipse(ctx, 8, 5.5, 2.4, 1.8, '#67c97a');
  });

  def('plant_tall', (ctx) => {
    rr(ctx, 4.3, 11.1, 7.4, 3.5, 1.1, '#d79a63');
    rr(ctx, 5, 13.8, 6, 1.2, 0.5, '#c27d49');
    rr(ctx, 7.5, 5.8, 1, 5.2, 0.4, '#8b6a43');
    ellipse(ctx, 8, 4.6, 4.6, 3.5, '#47a75b');
    ellipse(ctx, 5.4, 4.8, 2.2, 2.8, '#378f4a');
    ellipse(ctx, 10.6, 4.8, 2.2, 2.8, '#378f4a');
    ellipse(ctx, 8, 2.6, 3, 1.9, '#63c575');
  });

  def('water_cooler', (ctx) => {
    rr(ctx, 4.2, 11, 7.6, 4, 1, '#8e99a5');
    rr(ctx, 5, 5.3, 6, 6.1, 1.2, '#dbe3e9', '#adb7c1', 0.7);
    rr(ctx, 5.6, 0.8, 4.8, 5.2, 1.6, grad(ctx, 5.6, 0.8, 5.6, 6, [[0, 'rgba(181,225,248,0.95)'], [1, 'rgba(124,183,222,0.8)']]), '#7facc6', 0.6);
    rr(ctx, 5.1, 8.1, 1.1, 1.1, 0.4, '#9aa5af');
    rr(ctx, 5.1, 9.5, 1.1, 1.1, 0.4, '#64a6ff');
  });

  def('coffee_machine', (ctx) => {
    rr(ctx, 3.2, 4.2, 9.6, 9.8, 1.2, '#4d5662');
    rr(ctx, 4.7, 1.4, 6.4, 3, 1, '#2f3742');
    rr(ctx, 5.2, 6.2, 3.8, 2.7, 0.8, '#75b788');
    rr(ctx, 5.9, 10.3, 3.4, 2.7, 0.6, '#efefef');
    rr(ctx, 6.4, 11.1, 2.4, 1, 0.4, '#9a6a4c');
    rr(ctx, 10.2, 6.2, 1, 1, 0.4, '#ff7c72');
    rr(ctx, 10.2, 8, 1, 1, 0.4, '#8adf87');
  });

  def('trash_can', (ctx) => {
    rr(ctx, 4.4, 4.1, 7.2, 9.7, 1.1, '#7a838e');
    rr(ctx, 3.5, 3.1, 9, 2.1, 0.9, '#929aa5');
    [6, 8, 10].forEach((x) => rr(ctx, x, 6, 0.8, 6.2, 0.3, 'rgba(62,71,81,0.3)'));
  });

  def('clock', (ctx) => {
    circle(ctx, 8, 8, 4.8, '#ffffff', '#3e4650', 0.9);
    circle(ctx, 8, 8, 0.7, '#3e4650');
    ctx.strokeStyle = '#3e4650';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(8, 4.8); ctx.stroke();
    ctx.strokeStyle = '#db786e';
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(10.6, 6.3); ctx.stroke();
  });

  def('picture', (ctx) => {
    rr(ctx, 2.2, 2.6, 11.6, 9.6, 1, '#8e6547', '#6a4a35', 0.8);
    rr(ctx, 3.3, 3.6, 9.4, 7.4, 0.8, grad(ctx, 3.3, 3.6, 3.3, 11, [[0, '#a8d1eb'], [0.56, '#76b7d8'], [0.57, '#8ccf89'], [1, '#6aad68']]));
    circle(ctx, 10.8, 5.2, 0.9, '#f0d27d');
  });

  def('fire_extinguisher', (ctx) => {
    rr(ctx, 6, 3, 4, 9.4, 1.1, '#d84f4d');
    rr(ctx, 6.4, 3.6, 3.2, 1.4, 0.4, '#ee7d79');
    rr(ctx, 7.2, 0.8, 1.6, 2.3, 0.6, '#9099a4');
    rr(ctx, 5.2, 2.1, 1.6, 1.5, 0.5, '#6d7781');
    rr(ctx, 7.1, 6.4, 1.8, 2.6, 0.4, '#f7f7f7');
    rr(ctx, 7.1, 12.1, 1.8, 1.4, 0.4, '#2e3540');
  });

  def('couch_top', (ctx) => {
    rr(ctx, 1.2, 3, 13.6, 9.8, 2.2, '#7f97be');
    rr(ctx, 1.6, 3.6, 12.8, 2.2, 1.2, '#627fb0');
    rr(ctx, 2.4, 6.3, 11.2, 5.4, 1.6, '#93abd0');
    rr(ctx, 6.8, 6.4, 2.4, 5.2, 0.8, '#7b95bf');
  });

  def('table_round', (ctx) => {
    ellipse(ctx, 8, 8.4, 4.8, 4.3, '#ce976a', '#8d5d3d', 0.8);
    rr(ctx, 7.2, 10.8, 1.6, 3.4, 0.6, '#7e573e');
    rr(ctx, 6.3, 13.6, 3.4, 0.9, 0.4, '#674631');
    rr(ctx, 5.6, 6.2, 4.8, 1.1, 0.4, 'rgba(255,255,255,0.16)');
  });

  def('meeting_table', (ctx) => {
    rr(ctx, 1, 3, 14, 8.4, 1.9, grad(ctx, 1, 3, 1, 11, [[0, '#cf986b'], [1, '#b9784b']]), '#8d5d3d', 0.8);
    rr(ctx, 2.2, 4.1, 11.6, 1.1, 0.4, 'rgba(255,255,255,0.18)');
    rr(ctx, 3, 11.1, 1.8, 3.2, 0.7, '#7e573e');
    rr(ctx, 11.2, 11.1, 1.8, 3.2, 0.7, '#7e573e');
  });

  def('ceiling_light', (ctx) => {
    ctx.save();
    ctx.globalAlpha = 0.18;
    rr(ctx, 1.8, 1.8, 12.4, 12.4, 2.4, '#fff7c8');
    ctx.globalAlpha = 0.26;
    rr(ctx, 4, 4, 8, 8, 1.6, '#fff1b2');
    ctx.restore();
    rr(ctx, 5.1, 5.1, 5.8, 5.8, 1.1, '#fffef4', '#d4d8dc', 0.6);
  });

  // ══════════════════════════════════════════
  //  Init — pre-render every tile to its canvas
  // ══════════════════════════════════════════

  function initTiles() {
    if (_ready) return;
    for (const tile of Object.values(TILES)) {
      const c = document.createElement('canvas');
      c.width = TILE_SIZE * TILE_ART_SCALE;
      c.height = TILE_SIZE * TILE_ART_SCALE;
      const tileCtx = c.getContext('2d');
      tileCtx.setTransform(TILE_ART_SCALE, 0, 0, TILE_ART_SCALE, 0, 0);
      tile.draw(tileCtx);
      tile.canvas = c;
    }
    _ready = true;
  }

  // ══════════════════════════════════════════
  //  PROCEDURAL OFFICE GENERATOR
  //  Returns { mapW, mapH, layers, zones }
  // ══════════════════════════════════════════

  function generate(numManagers, numWorkers) {
    const LOBBY_H = 3;
    const WORK_H = Math.max(8, Math.min(10, 7 + Math.ceil(numWorkers / 12)));
    const AMENITY_H = 4;
    const RIGHT_WING_W = 9;
    const managerColumns = numManagers > 1 ? 2 : 1;
    const managerWingW = Math.max(8, 7 + ((managerColumns - 1) * 3));
    const deskPods = Math.max(4, Math.ceil(numWorkers / 4));
    const baseDeskBayW = Math.max(18, (deskPods * 3) + 6);
    const H = Math.max(18, 2 + LOBBY_H + 1 + WORK_H + 1 + AMENITY_H);
    const W = Math.max(44, Math.ceil(H * 2.3), managerWingW + 1 + baseDeskBayW + 1 + RIGHT_WING_W + 2);

    const layers = [
      new Array(W * H).fill(null),
      new Array(W * H).fill(null),
      new Array(W * H).fill(null)
    ];

    const set = (l, x, y, t) => { if (x >= 0 && x < W && y >= 0 && y < H) layers[l][y * W + x] = t; };
    const get = (l, x, y) => (x >= 0 && x < W && y >= 0 && y < H) ? layers[l][y * W + x] : null;

    const fill = (l, x1, y1, w, h, tile) => {
      for (let y = y1; y < y1 + h; y++) {
        for (let x = x1; x < x1 + w; x++) set(l, x, y, tile);
      }
    };

    const insideW = W - 2;
    const deskBayW = insideW - managerWingW - RIGHT_WING_W - 2;
    const lobbyBottom = 1 + LOBBY_H;
    const workTop = lobbyBottom + 1;
    const workBottom = workTop + WORK_H - 1;
    const amenityDividerY = workBottom + 1;
    const amenityTop = amenityDividerY + 1;
    const amenityBottom = H - 2;
    const managerLeft = 1;
    const managerRight = managerLeft + managerWingW - 1;
    const managerDividerX = managerRight + 1;
    const deskLeft = managerDividerX + 1;
    const deskRight = deskLeft + deskBayW - 1;
    const rightDividerX = deskRight + 1;
    const rightLeft = rightDividerX + 1;
    const rightRight = W - 2;
    const reviewDividerY = workTop + Math.floor(WORK_H / 2);
    const reviewTop = workTop;
    const reviewBottom = reviewDividerY - 1;
    const researchTop = reviewDividerY + 1;
    const researchBottom = workBottom;
    const breakW = Math.max(8, Math.floor((insideW - 2) * 0.24));
    const remoteW = Math.max(8, Math.floor((insideW - 2) * 0.24));
    const meetingW = insideW - breakW - remoteW - 2;
    const breakLeft = 1;
    const breakRight = breakLeft + breakW - 1;
    const breakDividerX = breakRight + 1;
    const meetingLeft = breakDividerX + 1;
    const meetingRight = meetingLeft + meetingW - 1;
    const meetingDividerX = meetingRight + 1;
    const remoteLeft = meetingDividerX + 1;
    const remoteRight = W - 2;

    // ── 1. FLOORS ──
    fill(0, 1, 1, insideW, H - 2, 'floor_tile');
    fill(0, managerLeft, workTop, managerWingW, WORK_H, 'floor_wood');
    fill(0, deskLeft, workTop, deskBayW, WORK_H, 'floor_carpet_blue');
    fill(0, rightLeft, reviewTop, RIGHT_WING_W, Math.max(1, reviewBottom - reviewTop + 1), 'floor_tile');
    fill(0, rightLeft, researchTop, RIGHT_WING_W, Math.max(1, researchBottom - researchTop + 1), 'floor_wood_dark');
    fill(0, breakLeft, amenityTop, breakW, AMENITY_H, 'floor_tile');
    fill(0, meetingLeft, amenityTop, meetingW, AMENITY_H, 'floor_wood_dark');
    fill(0, remoteLeft, amenityTop, remoteW, AMENITY_H, 'floor_carpet_red');

    // ── 2. OUTER WALLS ──
    for (let x = 1; x < W - 1; x++) { set(1, x, 0, 'wall_top'); set(1, x, H - 1, 'wall_bottom'); }
    for (let y = 1; y < H - 1; y++) { set(1, 0, y, 'wall_left'); set(1, W - 1, y, 'wall_right'); }
    set(1, 0, 0, 'wall_corner_tl'); set(1, W - 1, 0, 'wall_corner_tr');
    set(1, 0, H - 1, 'wall_corner_bl'); set(1, W - 1, H - 1, 'wall_corner_br');

    // ── 3. LOBBY DIVIDER ──
    for (let x = 1; x < W - 1; x++) set(1, x, lobbyBottom, 'wall_top');
    const doorX = Math.floor(W / 2);
    set(1, doorX, 0, 'door_h');
    set(1, managerLeft + Math.floor(managerWingW / 2), lobbyBottom, 'door_h');
    set(1, deskLeft + Math.floor(deskBayW / 2), lobbyBottom, 'door_glass_h');
    set(1, rightLeft + Math.floor(RIGHT_WING_W / 2), lobbyBottom, 'door_h');

    // ── 4. WORK MODULE DIVIDERS ──
    for (let y = workTop; y <= workBottom; y++) {
      set(1, managerDividerX, y, 'wall_v');
      set(1, rightDividerX, y, 'wall_v');
    }
    set(1, managerDividerX, workTop + Math.floor(WORK_H / 2), 'door_v');
    set(1, rightDividerX, workTop + Math.floor(WORK_H / 2), 'door_v');

    // ── 5. REVIEW / RESEARCH SPLIT ──
    for (let x = rightLeft; x <= rightRight; x++) set(1, x, reviewDividerY, 'wall_top');
    set(1, rightLeft + Math.floor(RIGHT_WING_W / 2), reviewDividerY, 'door_h');

    // ── 6. AMENITY STRIP ──
    for (let x = 1; x < W - 1; x++) set(1, x, amenityDividerY, 'wall_top');
    for (let y = amenityTop; y <= amenityBottom; y++) {
      set(1, breakDividerX, y, 'wall_v');
      set(1, meetingDividerX, y, 'wall_v');
    }
    set(1, breakLeft + Math.floor(breakW / 2), amenityDividerY, 'door_h');
    set(1, meetingLeft + Math.floor(meetingW / 2), amenityDividerY, 'door_h');
    set(1, remoteLeft + Math.floor(remoteW / 2), amenityDividerY, 'door_h');

    // ── 7. WINDOWS ──
    const wSpac = Math.max(4, Math.floor((W - 4) / 6));
    for (let wx = 3; wx < W - 2; wx += wSpac) if (get(1, wx, 0) === 'wall_top') set(1, wx, 0, 'window_h');

    // ── 8. LOBBY ──
    set(1, 2, 1, 'plant_tall');
    set(1, W - 3, 1, 'plant_tall');
    set(1, doorX - 1, 1, 'rug_center');
    set(1, doorX, 1, 'rug_center');
    set(1, doorX + 1, 1, 'rug_center');
    const recpX = Math.max(4, doorX - 3);
    set(1, recpX, 2, 'desk_h');
    set(1, recpX + 1, 2, 'desk_h');
    set(1, recpX, 1, 'monitor');
    set(1, recpX + 1, 1, 'keyboard');
    set(1, doorX + 3, 1, 'fire_extinguisher');
    set(1, W - 3, 2, 'clock');

    // ── 9. MANAGER SUITE ──
    const mgrCols = Math.min(2, Math.max(1, numManagers));
    const mgrRows = Math.max(1, Math.ceil(numManagers / mgrCols));
    const mgrSlotW = Math.max(4, Math.floor(managerWingW / mgrCols));
    const mgrSlotH = Math.max(3, Math.floor(WORK_H / mgrRows));
    for (let i = 0; i < numManagers; i++) {
      const col = i % mgrCols;
      const row = Math.floor(i / mgrCols);
      const sx = managerLeft + (col * mgrSlotW);
      const sy = workTop + (row * mgrSlotH);
      const deskX = Math.min(managerRight - 1, sx + Math.max(1, Math.floor((mgrSlotW - 2) / 2)));
      const deskY = Math.min(workBottom - 1, sy + Math.min(2, mgrSlotH - 2));
      if (deskY - 1 >= workTop) {
        set(1, deskX, deskY - 1, 'monitor');
        if (deskX + 1 <= managerRight) set(1, deskX + 1, deskY - 1, 'keyboard');
      }
      set(1, deskX, deskY, 'desk_h');
      if (deskX + 1 <= managerRight) set(1, deskX + 1, deskY, 'desk_h');
      if (deskY + 1 <= workBottom) set(1, deskX, deskY + 1, 'chair_down');
      set(1, sx, sy, 'filing_cabinet');
      if (sx + 1 <= managerRight) set(1, sx + 1, Math.min(workBottom, sy + mgrSlotH - 1), 'bookshelf');
      set(1, Math.min(managerRight, sx + mgrSlotW - 1), Math.min(workBottom, sy + mgrSlotH - 1), 'plant_small');
      if (sx + 2 <= managerRight) set(1, sx + 2, sy, 'picture');
      set(2, Math.min(managerRight, deskX), Math.max(workTop, deskY - 1), 'ceiling_light');
    }

    // ── 10. MODULAR WORK BAY ──
    const deskCols = Math.max(1, Math.floor((deskBayW - 2) / 3));
    const laneYs = [workTop + 1, workTop + Math.max(3, Math.floor(WORK_H / 2) - 1), Math.max(workTop + 1, workBottom - 3)];
    let placed = 0;
    const placeDesk = (x, y, facing) => {
      if (facing === 'up') {
        set(1, x, y, 'chair_up');
        set(1, x, y + 1, 'desk_h');
        set(1, x, y + 2, 'monitor');
      } else {
        set(1, x, y, 'monitor');
        set(1, x, y + 1, 'desk_h');
        set(1, x, y + 2, 'chair_down');
      }
    };
    for (let laneIndex = 0; laneIndex < laneYs.length && placed < numWorkers; laneIndex++) {
      const laneY = Math.min(workBottom - 2, laneYs[laneIndex]);
      const facing = laneIndex === 1 ? 'up' : 'down';
      for (let col = 0; col < deskCols && placed < numWorkers; col++) {
        const dx = deskLeft + 1 + (col * 3);
        if (dx > deskRight - 1) break;
        placeDesk(dx, laneY, facing);
        placed += 1;
      }
    }
    set(1, deskLeft + 1, workTop, 'whiteboard');
    set(1, deskRight - 1, workTop, 'printer');
    set(1, deskLeft + 2, workBottom, 'plant_tall');
    set(1, deskRight - 2, workBottom, 'plant_small');
    for (let ly = workTop + 1; ly < workBottom; ly += 3) {
      for (let lx = deskLeft + 2; lx < deskRight; lx += 5) set(2, lx, ly, 'ceiling_light');
    }

    // ── 11. REVIEW / RESEARCH WING ──
    set(1, rightLeft + 1, reviewTop + 1, 'monitor');
    set(1, rightLeft + 1, reviewTop + 2, 'desk_h');
    set(1, rightLeft + 1, reviewTop + 3, 'chair_down');
    set(1, rightLeft + 4, reviewTop + 1, 'monitor');
    set(1, rightLeft + 4, reviewTop + 2, 'desk_h');
    set(1, rightLeft + 4, reviewTop + 3, 'chair_down');
    set(1, rightLeft + 1, reviewTop, 'whiteboard');
    set(1, rightRight - 1, reviewTop + 1, 'printer');
    set(2, rightLeft + Math.floor(RIGHT_WING_W / 2), reviewTop + 1, 'ceiling_light');
    set(1, rightLeft + 1, researchTop + 1, 'bookshelf');
    set(1, rightLeft + 4, researchTop + 1, 'monitor');
    set(1, rightLeft + 4, researchTop + 2, 'desk_h');
    set(1, rightLeft + 6, researchTop + 1, 'table_round');
    set(1, rightLeft + 6, researchTop + 3, 'chair_left');
    set(1, rightRight - 1, researchBottom, 'plant_small');
    set(2, rightLeft + Math.floor(RIGHT_WING_W / 2), Math.min(researchBottom, researchTop + 1), 'ceiling_light');

    // ── 12. BREAK / MEETING / REMOTE ──
    set(1, breakLeft + 1, amenityTop, 'coffee_machine');
    set(1, breakLeft + 2, amenityTop, 'water_cooler');
    set(1, breakLeft + 1, amenityTop + 2, 'couch_top');
    set(1, breakLeft + 2, amenityTop + 2, 'couch_top');
    set(1, Math.min(breakRight - 2, breakLeft + 5), amenityTop + 1, 'table_round');
    set(1, Math.min(breakRight - 2, breakLeft + 5), amenityTop + 3, 'chair_down');
    set(1, breakRight - 1, amenityBottom, 'plant_small');
    set(2, breakLeft + Math.floor(breakW / 2), amenityTop + 1, 'ceiling_light');

    const meetTableY = amenityTop + 2;
    const meetStartX = meetingLeft + Math.max(2, Math.floor((meetingW - 6) / 2));
    for (let x = meetStartX; x < Math.min(meetingRight - 1, meetStartX + 5); x++) {
      set(1, x, meetTableY, 'meeting_table');
      set(1, x, meetTableY - 1, 'chair_down');
      if (meetTableY + 1 <= amenityBottom) set(1, x, meetTableY + 1, 'chair_up');
    }
    set(1, meetingLeft + 1, amenityTop, 'whiteboard');
    set(1, meetingRight - 1, amenityTop, 'monitor');
    set(2, meetingLeft + Math.floor(meetingW / 2), amenityTop + 1, 'ceiling_light');

    set(1, remoteLeft + 1, amenityTop + 1, 'monitor');
    set(1, remoteLeft + 1, amenityTop + 2, 'desk_h');
    set(1, remoteLeft + 4, amenityTop + 1, 'monitor');
    set(1, remoteLeft + 4, amenityTop + 2, 'desk_h');
    set(1, remoteRight - 1, amenityTop, 'printer');
    set(1, remoteRight - 1, amenityBottom, 'plant_small');
    set(2, remoteLeft + Math.floor(remoteW / 2), amenityTop + 1, 'ceiling_light');

    // ── 13. CORRIDOR ──
    for (let x = deskLeft + 2; x < deskRight - 1; x += 6) set(1, x, lobbyBottom - 1, 'plant_small');

    // ── ZONE RECTS (percentages of map) ──
    const pct = (v, total) => (v / total) * 100;

    const zones = {
      manager: { x: pct(managerLeft, W), y: pct(workTop, H), w: pct(managerWingW, W), h: pct(WORK_H, H) },
      desks:   { x: pct(deskLeft, W), y: pct(workTop, H), w: pct(deskBayW, W), h: pct(WORK_H, H) },
      review:  { x: pct(rightLeft, W), y: pct(reviewTop, H), w: pct(RIGHT_WING_W, W), h: pct(Math.max(1, reviewBottom - reviewTop + 1), H) },
      research:{ x: pct(rightLeft, W), y: pct(researchTop, H), w: pct(RIGHT_WING_W, W), h: pct(Math.max(1, researchBottom - researchTop + 1), H) },
      break:   { x: pct(breakLeft, W), y: pct(amenityTop, H), w: pct(breakW, W), h: pct(AMENITY_H, H) },
      remote:  { x: pct(remoteLeft, W), y: pct(amenityTop, H), w: pct(remoteW, W), h: pct(AMENITY_H, H) },
      field:   { x: pct(Math.floor(W * 0.36), W), y: pct(1, H), w: pct(Math.floor(W * 0.28), W), h: pct(LOBBY_H, H) }
    };

    return {
      mapW: W,
      mapH: H,
      layers,
      zones,
      meta: { numManagers, numWorkers },
      layout: {
        lobbyBottom,
        workTop,
        workBottom,
        amenityDividerY,
        amenityTop,
        amenityBottom,
        managerLeft,
        managerRight,
        managerDividerX,
        deskLeft,
        deskRight,
        rightDividerX,
        rightLeft,
        rightRight,
        reviewDividerY,
        reviewTop,
        reviewBottom,
        researchTop,
        researchBottom,
        breakLeft,
        breakRight,
        breakDividerX,
        meetingLeft,
        meetingRight,
        meetingDividerX,
        remoteLeft,
        remoteRight,
        doorX,
        managerWingW,
        deskBayW,
        rightWingW: RIGHT_WING_W,
        breakW,
        meetingW,
        remoteW,
        wSpac
      }
    };
  }

  function renderSvg(data) {
    const { mapW, mapH, layout, meta } = data;
    if (!layout || !meta) return '';

    const fmt = (value) => Number(value.toFixed(3));
    const uid = `officeSvg${mapW}x${mapH}`;
    const wallT = 0.15;  // interior wall thickness
    const outerWT = 0.18; // outer wall thickness
    const doorW = 0.72;   // door visual width (horizontal doors)
    const doorH = 0.76;   // door visual height (vertical/side doors)
    const doorGap = 0.76; // wall gap — matches door size (tiny clearance)
    const wallFill = 'url(#' + uid + 'WallGrad)';

    const rectSvg = (x, y, w, h, attrs = '') => `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs}/>`;
    const lineSvg = (x1, y1, x2, y2, attrs = '') => `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" ${attrs}/>`;
    const circleSvg = (cx, cy, r, attrs = '') => `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" ${attrs}/>`;
    const ellipseSvg = (cx, cy, rx, ry, attrs = '') => `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" ${attrs}/>`;
    const pathSvg = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;

    const windowXs = [];
    for (let wx = 3; wx < mapW - 2; wx += layout.wSpac) windowXs.push(wx);

    /* ── Drop shadow helper ── */
    const shadowRect = (x, y, w, h, blur = 0.15) => `<rect x="${fmt(x + 0.06)}" y="${fmt(y + 0.08)}" width="${fmt(w)}" height="${fmt(h)}" rx="0.06" fill="rgba(0,0,0,0.18)" filter="url(#${uid}Blur)"/>`;

    /* ── Workstation with shading ── */
    const workstationSvg = (x, y, direction = 'south', tone = 'oak') => {
      const topY = direction === 'south' ? y + 0.58 : y + 0.82;
      const chairY = direction === 'south' ? y + 1.14 : y + 0.08;
      const monitorY = direction === 'south' ? y + 0.18 : y + 1.06;
      const deskFill = tone === 'dark' ? `url(#${uid}DeskDark)` : `url(#${uid}DeskOak)`;
      const deskEdge = tone === 'dark' ? '#6b4632' : '#9d6a47';
      const deskHighlight = tone === 'dark' ? '#b0805f' : '#e8c09a';
      return `
        <g>
          <!-- desk shadow -->
          ${shadowRect(x + 0.16, topY, 0.98, 0.6)}
          <!-- desk surface -->
          ${rectSvg(x + 0.16, topY, 0.98, 0.22, `rx="0.06" fill="${deskFill}" stroke="${deskEdge}" stroke-width="0.04"`)}
          <!-- desk highlight -->
          ${rectSvg(x + 0.2, topY + 0.02, 0.9, 0.06, `rx="0.03" fill="${deskHighlight}" opacity="0.35"`)}
          <!-- desk legs -->
          ${rectSvg(x + 0.22, topY + 0.22, 0.08, 0.45, `rx="0.03" fill="${deskEdge}"`)}
          ${rectSvg(x + 0.98, topY + 0.22, 0.08, 0.45, `rx="0.03" fill="${deskEdge}"`)}
          <!-- monitor bezel -->
          ${rectSvg(x + 0.36, monitorY, 0.56, 0.34, `rx="0.08" fill="url(#${uid}MonitorBezel)" stroke="#576274" stroke-width="0.04"`)}
          <!-- screen with glow -->
          ${rectSvg(x + 0.42, monitorY + 0.05, 0.44, 0.22, `rx="0.05" fill="url(#${uid}Screen)"`)}
          <!-- screen reflection -->
          ${rectSvg(x + 0.44, monitorY + 0.06, 0.18, 0.08, `rx="0.03" fill="white" opacity="0.12"`)}
          <!-- screen glow on desk -->
          ${ellipseSvg(x + 0.64, topY + 0.08, 0.32, 0.08, `fill="url(#${uid}ScreenGlow)" opacity="0.25"`)}
          <!-- monitor stand -->
          ${rectSvg(x + 0.61, monitorY + 0.34, 0.06, 0.13, `rx="0.02" fill="url(#${uid}MetalV)"`)}
          ${rectSvg(x + 0.51, monitorY + 0.47, 0.26, 0.05, `rx="0.02" fill="url(#${uid}MetalH)"`)}
          <!-- chair back -->
          ${rectSvg(x + 0.27, chairY, 0.5, 0.34, `rx="0.08" fill="url(#${uid}ChairBack)"`)}
          <!-- chair seat -->
          ${rectSvg(x + 0.23, chairY + 0.28, 0.58, 0.32, `rx="0.09" fill="url(#${uid}ChairSeat)"`)}
          <!-- chair seat highlight -->
          ${rectSvg(x + 0.28, chairY + 0.32, 0.48, 0.1, `rx="0.05" fill="white" opacity="0.06"`)}
          <!-- chair stem -->
          ${rectSvg(x + 0.47, chairY + 0.58, 0.08, 0.18, `rx="0.03" fill="#556273"`)}
          <!-- chair wheel dots -->
          ${circleSvg(x + 0.35, chairY + 0.78, 0.04, 'fill="#3d4653"')}
          ${circleSvg(x + 0.67, chairY + 0.78, 0.04, 'fill="#3d4653"')}
        </g>
      `;
    };

    /* ── Plant with leaf detail + pot shading ── */
    const plantSvg = (x, y, scale = 1) => `
      <g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">
        <!-- pot shadow -->
        <ellipse cx="0" cy="0.42" rx="0.22" ry="0.06" fill="rgba(0,0,0,0.15)"/>
        <!-- pot -->
        <rect x="-0.18" y="0.18" width="0.36" height="0.2" rx="0.06" fill="url(#${uid}Pot)"/>
        <rect x="-0.2" y="0.16" width="0.4" height="0.06" rx="0.03" fill="#d9a570"/>
        <!-- pot rim highlight -->
        <rect x="-0.16" y="0.17" width="0.32" height="0.02" rx="0.01" fill="white" opacity="0.2"/>
        <!-- soil -->
        <ellipse cx="0" cy="0.2" rx="0.14" ry="0.04" fill="#5a4030"/>
        <!-- foliage cluster -->
        <ellipse cx="0" cy="-0.02" rx="0.24" ry="0.2" fill="#4aaa61"/>
        <ellipse cx="-0.13" cy="0.02" rx="0.12" ry="0.14" fill="#3a9450"/>
        <ellipse cx="0.13" cy="0.02" rx="0.12" ry="0.14" fill="#3a9450"/>
        <!-- leaf highlights -->
        <ellipse cx="-0.06" cy="-0.08" rx="0.08" ry="0.06" fill="#62c87a" opacity="0.5"/>
        <ellipse cx="0.1" cy="-0.04" rx="0.06" ry="0.05" fill="#62c87a" opacity="0.4"/>
        <!-- leaf veins -->
        <path d="M0 0.1V-0.12" stroke="#2f7d42" stroke-width="0.02" opacity="0.4" fill="none"/>
        <path d="M-0.1 0.06L-0.1 -0.06" stroke="#2f7d42" stroke-width="0.015" opacity="0.3" fill="none"/>
        <path d="M0.1 0.06L0.1 -0.06" stroke="#2f7d42" stroke-width="0.015" opacity="0.3" fill="none"/>
      </g>
    `;

    /* ── Whiteboard with frame shadow ── */
    const boardSvg = (x, y, w = 0.9) => `
      <g>
        ${shadowRect(x, y, w, 0.56, 0.1)}
        ${rectSvg(x, y, w, 0.56, `rx="0.08" fill="url(#${uid}Board)" stroke="#a0aab2" stroke-width="0.04"`)}
        <!-- board sheen -->
        ${rectSvg(x + 0.04, y + 0.04, w - 0.08, 0.15, `rx="0.04" fill="white" opacity="0.08"`)}
        <!-- sticky notes -->
        ${rectSvg(x + 0.1, y + 0.12, w * 0.28, 0.1, 'rx="0.02" fill="#71a3dd" opacity="0.85"')}
        ${rectSvg(x + 0.1 + w * 0.3, y + 0.1, w * 0.22, 0.12, 'rx="0.02" fill="#f7d96e" opacity="0.85"')}
        ${rectSvg(x + 0.1, y + 0.26, w * 0.42, 0.04, 'rx="0.02" fill="#df7b71"')}
        ${rectSvg(x + 0.1, y + 0.34, w * 0.6, 0.04, 'rx="0.02" fill="#73ba75"')}
        ${rectSvg(x + 0.1, y + 0.42, w * 0.35, 0.04, 'rx="0.02" fill="#c090d4"')}
      </g>
    `;

    /* ── Bookshelf with depth and book shading ── */
    const bookshelfSvg = (x, y) => `
      <g>
        ${shadowRect(x, y, 0.56, 1.1)}
        <!-- shelf body -->
        ${rectSvg(x, y, 0.56, 1.1, `rx="0.06" fill="url(#${uid}ShelfWood)" stroke="#6b4632" stroke-width="0.04"`)}
        <!-- shelf highlight -->
        ${rectSvg(x + 0.02, y + 0.02, 0.52, 0.08, `rx="0.04" fill="white" opacity="0.08"`)}
        <!-- shelves -->
        ${rectSvg(x + 0.04, y + 0.36, 0.48, 0.05, `rx="0.02" fill="#6b4632"`)}
        ${rectSvg(x + 0.04, y + 0.36, 0.48, 0.02, `rx="0.01" fill="white" opacity="0.08"`)}
        ${rectSvg(x + 0.04, y + 0.73, 0.48, 0.05, `rx="0.02" fill="#6b4632"`)}
        ${rectSvg(x + 0.04, y + 0.73, 0.48, 0.02, `rx="0.01" fill="white" opacity="0.08"`)}
        <!-- inner shadow -->
        ${rectSvg(x + 0.06, y + 0.06, 0.44, 0.28, 'rx="0.02" fill="rgba(0,0,0,0.12)"')}
        ${rectSvg(x + 0.06, y + 0.42, 0.44, 0.28, 'rx="0.02" fill="rgba(0,0,0,0.1)"')}
        ${rectSvg(x + 0.06, y + 0.8, 0.44, 0.24, 'rx="0.02" fill="rgba(0,0,0,0.08)"')}
        <!-- books top row -->
        ${rectSvg(x + 0.08, y + 0.08, 0.08, 0.26, 'rx="0.02" fill="#d86d72"')}
        ${rectSvg(x + 0.09, y + 0.09, 0.02, 0.24, 'rx="0.01" fill="white" opacity="0.12"')}
        ${rectSvg(x + 0.18, y + 0.1, 0.08, 0.24, 'rx="0.02" fill="#6d98d8"')}
        ${rectSvg(x + 0.19, y + 0.11, 0.02, 0.22, 'rx="0.01" fill="white" opacity="0.1"')}
        ${rectSvg(x + 0.3, y + 0.06, 0.06, 0.28, 'rx="0.02" fill="#79ba71"')}
        ${rectSvg(x + 0.38, y + 0.09, 0.08, 0.25, 'rx="0.02" fill="#dfbf6e"')}
        ${rectSvg(x + 0.39, y + 0.1, 0.02, 0.23, 'rx="0.01" fill="white" opacity="0.12"')}
        <!-- books mid row -->
        ${rectSvg(x + 0.1, y + 0.44, 0.11, 0.23, 'rx="0.02" fill="#df8c68"')}
        ${rectSvg(x + 0.11, y + 0.45, 0.02, 0.21, 'rx="0.01" fill="white" opacity="0.1"')}
        ${rectSvg(x + 0.25, y + 0.46, 0.07, 0.21, 'rx="0.02" fill="#71a3dd"')}
        ${rectSvg(x + 0.36, y + 0.44, 0.08, 0.23, 'rx="0.02" fill="#74b4a4"')}
        <!-- books bottom row -->
        ${rectSvg(x + 0.09, y + 0.82, 0.1, 0.18, 'rx="0.02" fill="#c97eae"')}
        ${rectSvg(x + 0.22, y + 0.84, 0.08, 0.16, 'rx="0.02" fill="#8ec2d4"')}
        ${rectSvg(x + 0.34, y + 0.81, 0.09, 0.19, 'rx="0.02" fill="#e6a95f"')}
      </g>
    `;

    /* ── Meeting table with wood grain + shadow ── */
    const meetingTableSvg = (x, y, w) => {
      let chairs = '';
      for (let i = 0; i < w; i += 1.1) {
        chairs += `<g>`;
        chairs += rectSvg(x + i + 0.14, y - 0.26, 0.44, 0.2, `rx="0.05" fill="url(#${uid}ChairBack)"`);
        chairs += rectSvg(x + i + 0.14, y + 0.58, 0.44, 0.2, `rx="0.05" fill="url(#${uid}ChairBack)"`);
        chairs += `</g>`;
      }
      return `
        <g>
          ${shadowRect(x, y, w, 0.7, 0.18)}
          ${rectSvg(x, y, w, 0.42, `rx="0.08" fill="url(#${uid}TableWood)" stroke="#8d5d3d" stroke-width="0.04"`)}
          <!-- table highlight -->
          ${rectSvg(x + 0.1, y + 0.04, w - 0.2, 0.1, `rx="0.04" fill="white" opacity="0.1"`)}
          <!-- table legs -->
          ${rectSvg(x + 0.2, y + 0.42, 0.12, 0.34, `rx="0.04" fill="#7e573e"`)}
          ${rectSvg(x + w - 0.32, y + 0.42, 0.12, 0.34, `rx="0.04" fill="#7e573e"`)}
          ${chairs}
        </g>
      `;
    };

    /* ── Windows with light shafts ── */
    const windowSvg = (x) => `
      <g>
        <!-- light pool on floor -->
        <polygon points="${fmt(x - 0.6)},${fmt(layout.lobbyBottom - 0.4)} ${fmt(x + 0.6)},${fmt(layout.lobbyBottom - 0.4)} ${fmt(x + 1.1)},${fmt(layout.lobbyBottom + 0.8)} ${fmt(x - 1.1)},${fmt(layout.lobbyBottom + 0.8)}" fill="url(#${uid}LightPool)" opacity="0.12"/>
        <!-- window frame -->
        ${rectSvg(x - 0.38, 0.16, 0.76, 0.62, `rx="0.12" fill="url(#${uid}Window)" stroke="#6a7a8b" stroke-width="0.05"`)}
        <!-- window glare -->
        ${rectSvg(x - 0.28, 0.2, 0.22, 0.15, 'rx="0.06" fill="white" opacity="0.18"')}
        <!-- mullion -->
        ${lineSvg(x, 0.16, x, 0.78, 'stroke="#6a7a8b" stroke-width="0.03" opacity="0.6"')}
        ${lineSvg(x - 0.38, 0.47, x + 0.38, 0.47, 'stroke="#6a7a8b" stroke-width="0.03" opacity="0.6"')}
        <!-- sill -->
        ${rectSvg(x - 0.42, 0.76, 0.84, 0.06, 'rx="0.03" fill="#8494a5"')}
        ${rectSvg(x - 0.42, 0.76, 0.84, 0.02, 'rx="0.01" fill="white" opacity="0.15"')}
      </g>
    `;

    const doorTopSvg = (x, wallY, isGlass = false) => {
      const fill = isGlass ? `url(#${uid}GlassDoor)` : `url(#${uid}WoodDoor)`;
      const stroke = isGlass ? '#789cb0' : '#8d5d3d';
      const dw = doorW, dh = wallT + 0.08; // door fills the wall gap + a bit extra
      return `<g>
        ${rectSvg(x - dw/2, wallY - dh/2, dw, dh, `rx="0.06" fill="${fill}" stroke="${stroke}" stroke-width="0.03"`)}
        <!-- door handle -->
        ${circleSvg(x + dw/2 - 0.1, wallY, 0.03, `fill="#c0b49a" stroke="#9a8e76" stroke-width="0.01"`)}
      </g>`;
    };

    const doorSideSvg = (x, y) => {
      const dw = wallT + 0.08, dh = doorH;
      return `<g>
        ${rectSvg(x - dw/2, y - dh/2, dw, dh, `rx="0.06" fill="url(#${uid}WoodDoor)" stroke="#8d5d3d" stroke-width="0.03"`)}
        ${circleSvg(x, y + dh/2 - 0.1, 0.03, `fill="#c0b49a" stroke="#9a8e76" stroke-width="0.01"`)}
      </g>`;
    };

    /* ── Floor rects — each extends exactly from one wall centerline to the next ── */
    // Wall centerline positions
    const wLobbyY  = layout.lobbyBottom + 0.5;
    const wAmenityY = layout.amenityDividerY + 0.5;
    const wReviewY = layout.reviewDividerY + 0.5;
    const wManagerX = layout.managerDividerX + 0.5;
    const wRightX  = layout.rightDividerX + 0.5;
    const wBreakX  = layout.breakDividerX + 0.5;
    const wMeetingX = layout.meetingDividerX + 0.5;
    // Outer wall inner edges
    const oL = 1, oR = mapW - 1, oT = 1, oB = mapH - 1;

    const floorRects = [
      // Lobby — full width, outer top to lobby wall
      rectSvg(oL, oT, oR - oL, wLobbyY - oT, `fill="url(#${uid}Tile)"`),
      // Manager — outer left to manager|desk wall, lobby wall to amenity wall
      rectSvg(oL, wLobbyY, wManagerX - oL, wAmenityY - wLobbyY, `fill="url(#${uid}Wood)"`),
      // Desk bay — manager|desk wall to desk|right wall, lobby wall to amenity wall
      rectSvg(wManagerX, wLobbyY, wRightX - wManagerX, wAmenityY - wLobbyY, `fill="url(#${uid}BlueCarpet)"`),
      // Review — desk|right wall to outer right, lobby wall to review|research wall
      rectSvg(wRightX, wLobbyY, oR - wRightX, wReviewY - wLobbyY, `fill="url(#${uid}Tile)"`),
      // Research — desk|right wall to outer right, review|research wall to amenity wall
      rectSvg(wRightX, wReviewY, oR - wRightX, wAmenityY - wReviewY, `fill="url(#${uid}DarkWood)"`),
      // Break room — outer left to break|meeting wall, amenity wall to outer bottom
      rectSvg(oL, wAmenityY, wBreakX - oL, oB - wAmenityY, `fill="url(#${uid}Tile)"`),
      // Meeting — break|meeting wall to meeting|remote wall, amenity wall to outer bottom
      rectSvg(wBreakX, wAmenityY, wMeetingX - wBreakX, oB - wAmenityY, `fill="url(#${uid}DarkWood)"`),
      // Remote hub — meeting|remote wall to outer right, amenity wall to outer bottom
      rectSvg(wMeetingX, wAmenityY, oR - wMeetingX, oB - wAmenityY, `fill="url(#${uid}RedCarpet)"`)
    ].join('');

    /* ── Ambient occlusion along walls ── */
    const ao = 0.18; // AO strip width
    const aoAlpha = 0.45; // interior wall AO opacity
    const ambientOcclusion = [
      // ── Outer walls (AO on inside face only) ──
      rectSvg(oL, oT, oR - oL, ao, `fill="url(#${uid}AODown)" opacity="0.5"`),          // top wall → down
      rectSvg(oL, oB - ao, oR - oL, ao, `fill="url(#${uid}AOUp)" opacity="0.5"`),        // bottom wall → up
      rectSvg(oL, oT, ao, oB - oT, `fill="url(#${uid}AORight)" opacity="0.5"`),           // left wall → right
      rectSvg(oR - ao, oT, ao, oB - oT, `fill="url(#${uid}AOLeft)" opacity="0.5"`),       // right wall → left

      // ── Lobby → Work horizontal wall (AO above & below) ──
      rectSvg(oL, wLobbyY + wallT/2, oR - oL, ao, `fill="url(#${uid}AODown)" opacity="${aoAlpha}"`),
      rectSvg(oL, wLobbyY - wallT/2 - ao, oR - oL, ao, `fill="url(#${uid}AOUp)" opacity="${aoAlpha}"`),

      // ── Work → Amenity horizontal wall (AO above & below) ──
      rectSvg(oL, wAmenityY + wallT/2, oR - oL, ao, `fill="url(#${uid}AODown)" opacity="${aoAlpha}"`),
      rectSvg(oL, wAmenityY - wallT/2 - ao, oR - oL, ao, `fill="url(#${uid}AOUp)" opacity="${aoAlpha}"`),

      // ── Manager | Desk bay vertical wall (AO left & right) ──
      rectSvg(wManagerX + wallT/2, wLobbyY, ao, wAmenityY - wLobbyY, `fill="url(#${uid}AORight)" opacity="${aoAlpha}"`),
      rectSvg(wManagerX - wallT/2 - ao, wLobbyY, ao, wAmenityY - wLobbyY, `fill="url(#${uid}AOLeft)" opacity="${aoAlpha}"`),

      // ── Desk bay | Right wing vertical wall (AO left & right) ──
      rectSvg(wRightX + wallT/2, wLobbyY, ao, wAmenityY - wLobbyY, `fill="url(#${uid}AORight)" opacity="${aoAlpha}"`),
      rectSvg(wRightX - wallT/2 - ao, wLobbyY, ao, wAmenityY - wLobbyY, `fill="url(#${uid}AOLeft)" opacity="${aoAlpha}"`),

      // ── Review | Research horizontal wall (AO above & below) ──
      rectSvg(wRightX, wReviewY + wallT/2, oR - wRightX, ao, `fill="url(#${uid}AODown)" opacity="${aoAlpha}"`),
      rectSvg(wRightX, wReviewY - wallT/2 - ao, oR - wRightX, ao, `fill="url(#${uid}AOUp)" opacity="${aoAlpha}"`),

      // ── Break | Meeting vertical wall (AO left & right) ──
      rectSvg(wBreakX + wallT/2, wAmenityY, ao, oB - wAmenityY, `fill="url(#${uid}AORight)" opacity="${aoAlpha}"`),
      rectSvg(wBreakX - wallT/2 - ao, wAmenityY, ao, oB - wAmenityY, `fill="url(#${uid}AOLeft)" opacity="${aoAlpha}"`),

      // ── Meeting | Remote vertical wall (AO left & right) ──
      rectSvg(wMeetingX + wallT/2, wAmenityY, ao, oB - wAmenityY, `fill="url(#${uid}AORight)" opacity="${aoAlpha}"`),
      rectSvg(wMeetingX - wallT/2 - ao, wAmenityY, ao, oB - wAmenityY, `fill="url(#${uid}AOLeft)" opacity="${aoAlpha}"`)
    ].join('');

    /* ── Wall helpers: filled rects with door gaps ── */
    const hWall = (x1, x2, y, doorXs = []) => {
      const sorted = [...doorXs].sort((a, b) => a - b);
      const segs = [];
      let cx = x1;
      for (const dx of sorted) {
        const gs = dx - doorGap / 2, ge = dx + doorGap / 2;
        if (gs > cx) segs.push(rectSvg(cx, y - wallT / 2, gs - cx, wallT, `fill="${wallFill}"`));
        cx = ge;
      }
      if (cx < x2) segs.push(rectSvg(cx, y - wallT / 2, x2 - cx, wallT, `fill="${wallFill}"`));
      return segs.join('');
    };
    const vWall = (y1, y2, x, doorYs = []) => {
      const sorted = [...doorYs].sort((a, b) => a - b);
      const segs = [];
      let cy = y1;
      for (const dy of sorted) {
        const gs = dy - doorGap / 2, ge = dy + doorGap / 2;
        if (gs > cy) segs.push(rectSvg(x - wallT / 2, cy, wallT, gs - cy, `fill="${wallFill}"`));
        cy = ge;
      }
      if (cy < y2) segs.push(rectSvg(x - wallT / 2, cy, wallT, y2 - cy, `fill="${wallFill}"`));
      return segs.join('');
    };

    /* ── Wall partitions ── */
    const manMidY = layout.workTop + (layout.workBottom - layout.workTop + 1) / 2;
    const partitions = [
      // Outer wall
      rectSvg(0.5, 0.5, mapW - 1, mapH - 1, `rx="0.15" fill="none" stroke="${wallFill}" stroke-width="${outerWT}"`),
      // Lobby → work row (horizontal)
      hWall(oL, oR, wLobbyY, [
        layout.managerLeft + layout.managerWingW / 2,
        layout.deskLeft + layout.deskBayW / 2,
        layout.rightLeft + layout.rightWingW / 2
      ]),
      // Manager | Desk bay (vertical) — extend into h-walls
      vWall(wLobbyY - wallT / 2, wAmenityY + wallT / 2, wManagerX, [manMidY]),
      // Desk bay | Right wing (vertical) — extend into h-walls
      vWall(wLobbyY - wallT / 2, wAmenityY + wallT / 2, wRightX, [manMidY]),
      // Review | Research (horizontal, right wing)
      hWall(wRightX - wallT / 2, oR, wReviewY, [
        layout.rightLeft + layout.rightWingW / 2
      ]),
      // Work row → amenity row (horizontal)
      hWall(oL, oR, wAmenityY, [
        layout.breakLeft + layout.breakW / 2,
        layout.meetingLeft + layout.meetingW / 2,
        layout.remoteLeft + layout.remoteW / 2
      ]),
      // Break | Meeting (vertical) — extend into h-wall
      vWall(wAmenityY - wallT / 2, oB, wBreakX, []),
      // Meeting | Remote (vertical) — extend into h-wall
      vWall(wAmenityY - wallT / 2, oB, wMeetingX, [])
    ].join('');
    const openings = [
      // Lobby → work row doors
      doorTopSvg(layout.managerLeft + layout.managerWingW / 2, wLobbyY),
      doorTopSvg(layout.deskLeft + layout.deskBayW / 2, wLobbyY, true),
      doorTopSvg(layout.rightLeft + layout.rightWingW / 2, wLobbyY),
      // Work row → amenity row doors
      doorTopSvg(layout.breakLeft + layout.breakW / 2, wAmenityY),
      doorTopSvg(layout.meetingLeft + layout.meetingW / 2, wAmenityY),
      doorTopSvg(layout.remoteLeft + layout.remoteW / 2, wAmenityY),
      // Main entrance (outer wall)
      `<g>${rectSvg(layout.doorX - 0.32, 0.06, 0.64, 0.22, `rx="0.08" fill="url(#${uid}WoodDoor)" stroke="#8d5d3d" stroke-width="0.04"`)}${circleSvg(layout.doorX + 0.16, 0.17, 0.03, 'fill="#c0b49a" stroke="#9a8e76" stroke-width="0.01"')}</g>`,
      // Side doors (vertical walls)
      doorSideSvg(wManagerX, manMidY),
      doorSideSvg(wRightX, manMidY),
      // Review/Research divider door
      doorTopSvg(layout.rightLeft + layout.rightWingW / 2, wReviewY)
    ].join('');

    let furnishings = '';

    // ── Lobby ──
    const lobbyMidY = 1 + (wLobbyY - oT) / 2; // vertical center of lobby
    // Reception desk — left of entrance, lower down to not overlap windows
    furnishings += workstationSvg(layout.doorX - 2.5, lobbyMidY + 0.1, 'south');
    // Waiting area sofa — right of entrance, centered vertically
    furnishings += `<g>`;
    furnishings += shadowRect(layout.doorX + 1.6, lobbyMidY - 0.1, 2.2, 0.66);
    furnishings += rectSvg(layout.doorX + 1.6, lobbyMidY - 0.1, 2.2, 0.66, `rx="0.12" fill="url(#${uid}Sofa)" stroke="#8a4042" stroke-width="0.04"`);
    furnishings += rectSvg(layout.doorX + 1.68, lobbyMidY - 0.04, 0.9, 0.15, 'rx="0.06" fill="white" opacity="0.06"');
    furnishings += rectSvg(layout.doorX + 2.7, lobbyMidY - 0.04, 0.9, 0.15, 'rx="0.06" fill="white" opacity="0.06"');
    furnishings += `</g>`;
    // Small coffee table in front of sofa
    furnishings += shadowRect(layout.doorX + 2.0, lobbyMidY + 0.7, 1.3, 0.5);
    furnishings += rectSvg(layout.doorX + 2.0, lobbyMidY + 0.7, 1.3, 0.34, `rx="0.06" fill="url(#${uid}DeskOak)" stroke="#9d6a47" stroke-width="0.03"`);
    furnishings += rectSvg(layout.doorX + 2.06, lobbyMidY + 0.72, 1.18, 0.08, 'rx="0.03" fill="white" opacity="0.08"');
    // Coat rack — far right of lobby
    furnishings += rectSvg(layout.doorX + 5.2, lobbyMidY - 0.2, 0.14, 0.7, 'rx="0.05" fill="#8a6b4f"');
    furnishings += circleSvg(layout.doorX + 5.27, lobbyMidY - 0.22, 0.06, 'fill="#7a5c42"');
    furnishings += circleSvg(layout.doorX + 5.14, lobbyMidY + 0.0, 0.04, 'fill="#9a7c5a"');
    furnishings += circleSvg(layout.doorX + 5.38, lobbyMidY + 0.12, 0.04, 'fill="#9a7c5a"');

    // ── Manager offices ──
    const mgrCols = Math.min(2, Math.max(1, meta.numManagers));
    const mgrRows = Math.max(1, Math.ceil(meta.numManagers / mgrCols));
    const mgrSlotW = Math.max(4, Math.floor(layout.managerWingW / mgrCols));
    const mgrSlotH = Math.max(3, Math.floor((layout.workBottom - layout.workTop + 1) / mgrRows));
    for (let i = 0; i < meta.numManagers; i += 1) {
      const col = i % mgrCols;
      const row = Math.floor(i / mgrCols);
      const sx = layout.managerLeft + (col * mgrSlotW);
      const sy = layout.workTop + (row * mgrSlotH);
      // filing cabinet with shading
      furnishings += shadowRect(sx + 0.22, sy + 0.22, 0.58, 1.12);
      furnishings += rectSvg(sx + 0.22, sy + 0.22, 0.58, 1.12, `rx="0.06" fill="url(#${uid}FilingCab)" stroke="#5c6673" stroke-width="0.04"`);
      furnishings += rectSvg(sx + 0.32, sy + 0.38, 0.38, 0.06, 'rx="0.02" fill="#7a8594"');
      furnishings += rectSvg(sx + 0.32, sy + 0.68, 0.38, 0.06, 'rx="0.02" fill="#7a8594"');
      furnishings += rectSvg(sx + 0.32, sy + 0.98, 0.38, 0.06, 'rx="0.02" fill="#7a8594"');
      furnishings += workstationSvg(sx + Math.max(0.6, (mgrSlotW * 0.28)), sy + 0.7, 'south');
      furnishings += bookshelfSvg(sx + 0.26, sy + Math.max(1.65, mgrSlotH - 1.35));
      furnishings += boardSvg(sx + Math.max(1.6, mgrSlotW - 1.25), sy + 0.18, 0.86);
      furnishings += plantSvg(sx + mgrSlotW - 0.75, Math.min(layout.workBottom - 0.45, sy + mgrSlotH - 0.55), 1.05);
    }

    // ── Worker desk bay ──
    const deskCols = Math.max(1, Math.floor((layout.deskBayW - 2) / 3));
    const laneYs = [layout.workTop + 1, layout.workTop + Math.max(3, Math.floor((layout.workBottom - layout.workTop + 1) / 2) - 1), Math.max(layout.workTop + 1, layout.workBottom - 3)];
    let placed = 0;
    for (let laneIndex = 0; laneIndex < laneYs.length && placed < meta.numWorkers; laneIndex += 1) {
      const laneY = Math.min(layout.workBottom - 1.7, laneYs[laneIndex]);
      const facing = laneIndex === 1 ? 'north' : 'south';
      for (let col = 0; col < deskCols && placed < meta.numWorkers; col += 1) {
        const dx = layout.deskLeft + 0.8 + (col * 3);
        if (dx > layout.deskRight - 1.25) break;
        furnishings += workstationSvg(dx, laneY, facing, 'oak');
        placed += 1;
      }
    }
    furnishings += boardSvg(layout.deskLeft + 0.9, layout.workTop + 0.18, 0.92);
    // Printer with detail
    furnishings += shadowRect(layout.deskRight - 0.98, layout.workTop + 0.18, 0.72, 0.56);
    furnishings += rectSvg(layout.deskRight - 0.98, layout.workTop + 0.18, 0.72, 0.56, `rx="0.08" fill="url(#${uid}PrinterBody)" stroke="#bbc3c9" stroke-width="0.04"`);
    furnishings += rectSvg(layout.deskRight - 0.88, layout.workTop + 0.26, 0.52, 0.12, 'rx="0.04" fill="#2a3240"');
    furnishings += rectSvg(layout.deskRight - 0.84, layout.workTop + 0.28, 0.44, 0.06, 'rx="0.02" fill="#5e99c4"');
    furnishings += plantSvg(layout.deskLeft + 2.55, layout.workBottom - 0.25, 1.12);
    furnishings += plantSvg(layout.deskRight - 0.85, layout.workBottom - 0.15, 0.96);
    // Ceiling light glows (subtle ambient spots, no visible fixture)
    for (let ly = layout.workTop + 1.8; ly < layout.workBottom; ly += 3.5) {
      for (let lx = layout.deskLeft + 3; lx < layout.deskRight - 1; lx += 5.5) {
        furnishings += ellipseSvg(lx, ly, 1.2, 0.8, `fill="url(#${uid}CeilingLight)" opacity="0.06"`);
      }
    }

    // ── Review room ──
    furnishings += boardSvg(layout.rightLeft + 0.4, layout.reviewTop + 0.22, 0.86);
    furnishings += workstationSvg(layout.rightLeft + 0.75, layout.reviewTop + 1.1, 'south');
    furnishings += workstationSvg(layout.rightLeft + 3.95, layout.reviewTop + 1.1, 'south');
    furnishings += shadowRect(layout.rightRight - 0.9, layout.reviewTop + 0.28, 0.72, 0.56);
    furnishings += rectSvg(layout.rightRight - 0.9, layout.reviewTop + 0.28, 0.72, 0.56, `rx="0.08" fill="url(#${uid}PrinterBody)" stroke="#bbc3c9" stroke-width="0.04"`);
    furnishings += rectSvg(layout.rightRight - 0.8, layout.reviewTop + 0.36, 0.52, 0.12, 'rx="0.04" fill="#2a3240"');

    // ── Research room ──
    furnishings += bookshelfSvg(layout.rightLeft + 0.55, layout.researchTop + 0.75);
    furnishings += workstationSvg(layout.rightLeft + 3.7, layout.researchTop + 0.95, 'south', 'dark');
    // Globe
    furnishings += `<g>`;
    furnishings += shadowRect(layout.rightLeft + 6.1, layout.researchTop + 0.95, 0.7, 0.6);
    furnishings += ellipseSvg(layout.rightLeft + 6.45, layout.researchTop + 1.25, 0.42, 0.34, `fill="url(#${uid}Globe)" stroke="#8d5d3d" stroke-width="0.04"`);
    furnishings += ellipseSvg(layout.rightLeft + 6.35, layout.researchTop + 1.18, 0.12, 0.1, 'fill="white" opacity="0.12"');
    furnishings += `</g>`;
    furnishings += plantSvg(layout.rightRight - 0.78, layout.researchBottom - 0.28, 0.96);

    // ── Break room ──
    // Fridge with shading
    furnishings += shadowRect(layout.breakLeft + 0.35, layout.amenityTop + 0.35, 0.62, 0.92);
    furnishings += rectSvg(layout.breakLeft + 0.35, layout.amenityTop + 0.35, 0.62, 0.92, `rx="0.1" fill="url(#${uid}Appliance)"`);
    furnishings += rectSvg(layout.breakLeft + 0.39, layout.amenityTop + 0.38, 0.54, 0.4, 'rx="0.06" fill="rgba(255,255,255,0.06)"');
    furnishings += lineSvg(layout.breakLeft + 0.35, layout.amenityTop + 0.82, layout.breakLeft + 0.97, layout.amenityTop + 0.82, 'stroke="#3a4250" stroke-width="0.03"');
    furnishings += rectSvg(layout.breakLeft + 0.88, layout.amenityTop + 0.48, 0.04, 0.12, 'rx="0.02" fill="#7a8594"');
    furnishings += rectSvg(layout.breakLeft + 0.88, layout.amenityTop + 0.88, 0.04, 0.12, 'rx="0.02" fill="#7a8594"');
    // Microwave
    furnishings += shadowRect(layout.breakLeft + 1.2, layout.amenityTop + 0.22, 0.58, 1.02);
    furnishings += rectSvg(layout.breakLeft + 1.2, layout.amenityTop + 0.22, 0.58, 1.02, `rx="0.1" fill="url(#${uid}Appliance)" stroke="#adb7c1" stroke-width="0.04"`);
    furnishings += rectSvg(layout.breakLeft + 1.26, layout.amenityTop + 0.3, 0.36, 0.32, 'rx="0.04" fill="#1e2530"');
    furnishings += rectSvg(layout.breakLeft + 1.66, layout.amenityTop + 0.32, 0.06, 0.08, 'rx="0.02" fill="#7a8594"');
    // Break sofa
    furnishings += shadowRect(layout.breakLeft + 0.55, layout.amenityTop + 2.1, 1.65, 0.55);
    furnishings += rectSvg(layout.breakLeft + 0.55, layout.amenityTop + 2.1, 1.65, 0.55, `rx="0.18" fill="url(#${uid}BreakSofa)" stroke="#6681ae" stroke-width="0.04"`);
    furnishings += rectSvg(layout.breakLeft + 0.65, layout.amenityTop + 2.16, 0.65, 0.15, 'rx="0.06" fill="white" opacity="0.06"');
    furnishings += rectSvg(layout.breakLeft + 0.62, layout.amenityTop + 1.78, 1.52, 0.26, 'rx="0.12" fill="#6985b5"');
    // Coffee table
    furnishings += ellipseSvg(layout.breakLeft + 4.7, layout.amenityTop + 1.22, 0.42, 0.34, `fill="url(#${uid}TableWood)" stroke="#8d5d3d" stroke-width="0.04"`);
    furnishings += ellipseSvg(layout.breakLeft + 4.6, layout.amenityTop + 1.15, 0.14, 0.1, 'fill="white" opacity="0.1"');
    furnishings += rectSvg(layout.breakLeft + 4.55, layout.amenityTop + 2.28, 0.3, 0.18, `rx="0.05" fill="url(#${uid}ChairSeat)"`);
    furnishings += plantSvg(layout.breakRight - 0.72, layout.amenityBottom - 0.2, 0.92);

    // ── Meeting room ──
    furnishings += boardSvg(layout.meetingLeft + 0.6, layout.amenityTop + 0.22, 0.92);
    furnishings += workstationSvg(layout.meetingRight - 1.55, layout.amenityTop + 0.2, 'south', 'dark');
    furnishings += meetingTableSvg(layout.meetingLeft + Math.max(2, ((layout.meetingW - 4.8) / 2)), layout.amenityTop + 2.1, Math.min(4.8, layout.meetingW - 3.2));

    // ── Remote hub ──
    furnishings += workstationSvg(layout.remoteLeft + 0.8, layout.amenityTop + 1.05, 'south');
    furnishings += workstationSvg(layout.remoteLeft + 4.0, layout.amenityTop + 1.05, 'south');
    furnishings += shadowRect(layout.remoteRight - 0.95, layout.amenityTop + 0.25, 0.72, 0.56);
    furnishings += rectSvg(layout.remoteRight - 0.95, layout.amenityTop + 0.25, 0.72, 0.56, `rx="0.08" fill="url(#${uid}PrinterBody)" stroke="#bbc3c9" stroke-width="0.04"`);
    furnishings += rectSvg(layout.remoteRight - 0.85, layout.amenityTop + 0.33, 0.52, 0.12, 'rx="0.04" fill="#2a3240"');
    furnishings += plantSvg(layout.remoteRight - 0.8, layout.amenityBottom - 0.25, 0.96);

    /* ── Lobby decor ── */
    const decor = [
      plantSvg(2.2, 1.42, 1.02),
      plantSvg(mapW - 2.35, 1.42, 1.02),
      plantSvg(layout.breakLeft + 11.1, 1.42, 0.92),
      plantSvg(layout.deskLeft + 9.2, 1.42, 0.92),
      plantSvg(layout.deskRight - 2.7, 1.42, 0.92),
      // Wall clock with shading
      `<g>`,
      circleSvg(mapW - 1.75, 2.28, 0.38, `fill="url(#${uid}ClockFace)" stroke="#3f4750" stroke-width="0.06"`),
      circleSvg(mapW - 1.75, 2.28, 0.32, 'fill="none" stroke="#e8e4df" stroke-width="0.01"'),
      // clock tick marks
      ...Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * Math.PI / 180;
        const r1 = 0.26;
        const r2 = 0.3;
        return lineSvg(mapW - 1.75 + Math.cos(angle) * r1, 2.28 + Math.sin(angle) * r1, mapW - 1.75 + Math.cos(angle) * r2, 2.28 + Math.sin(angle) * r2, 'stroke="#5a636e" stroke-width="0.02" stroke-linecap="round"');
      }),
      lineSvg(mapW - 1.75, 2.28, mapW - 1.75, 2.04, 'stroke="#3f4750" stroke-width="0.04" stroke-linecap="round"'),
      lineSvg(mapW - 1.75, 2.28, mapW - 1.58, 2.14, 'stroke="#3f4750" stroke-width="0.03" stroke-linecap="round"'),
      lineSvg(mapW - 1.75, 2.28, mapW - 1.7, 2.35, 'stroke="#db786e" stroke-width="0.02" stroke-linecap="round"'),
      circleSvg(mapW - 1.75, 2.28, 0.04, 'fill="#3f4750"'),
      `</g>`,
      // Welcome mat at entrance
      rectSvg(layout.doorX - 0.8, 0.86, 1.6, 0.6, `rx="0.08" fill="url(#${uid}WelcomeMat)" opacity="0.7"`)
    ].join('');

    /* ── Ceiling light pools for general ambient ── */
    let lightPools = '';
    // Manager room ambient
    lightPools += ellipseSvg(layout.managerLeft + layout.managerWingW / 2, layout.workTop + (layout.workBottom - layout.workTop) / 2, layout.managerWingW * 0.35, (layout.workBottom - layout.workTop) * 0.3, `fill="url(#${uid}CeilingLight)" opacity="0.04"`);
    // Meeting room ambient
    lightPools += ellipseSvg(layout.meetingLeft + layout.meetingW / 2, layout.amenityTop + (layout.amenityBottom - layout.amenityTop) / 2, layout.meetingW * 0.35, (layout.amenityBottom - layout.amenityTop) * 0.3, `fill="url(#${uid}CeilingLight)" opacity="0.04"`);

    return `
      <div class="office-tilemap-svg" aria-hidden="true">
        <svg viewBox="0 0 ${mapW} ${mapH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" role="presentation">
          <defs>
            <!-- blur filter for drop shadows -->
            <filter id="${uid}Blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.12"/>
            </filter>

            <!-- ═══ GRADIENTS ═══ -->

            <!-- Screen gradient with glow -->
            <linearGradient id="${uid}Screen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#91e0ed"/>
              <stop offset="40%" stop-color="#6cbdd5"/>
              <stop offset="100%" stop-color="#4889ac"/>
            </linearGradient>
            <radialGradient id="${uid}ScreenGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stop-color="#7ed8ec" stop-opacity="1"/>
              <stop offset="100%" stop-color="#7ed8ec" stop-opacity="0"/>
            </radialGradient>

            <!-- Window glass with sky -->
            <linearGradient id="${uid}Window" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e8f6ff"/>
              <stop offset="35%" stop-color="#b8dfef"/>
              <stop offset="100%" stop-color="#8bbdd4"/>
            </linearGradient>

            <!-- Light pool from window -->
            <radialGradient id="${uid}LightPool" cx="0.5" cy="0" r="0.8">
              <stop offset="0%" stop-color="#fff8e0" stop-opacity="1"/>
              <stop offset="100%" stop-color="#fff8e0" stop-opacity="0"/>
            </radialGradient>

            <!-- Wall gradient (3D bevel) -->
            <linearGradient id="${uid}WallGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#6e7a8a"/>
              <stop offset="40%" stop-color="#556272"/>
              <stop offset="100%" stop-color="#3d4a58"/>
            </linearGradient>

            <!-- Monitor bezel -->
            <linearGradient id="${uid}MonitorBezel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3a4654"/>
              <stop offset="100%" stop-color="#252e38"/>
            </linearGradient>
            <!-- Metal finish (vertical) -->
            <linearGradient id="${uid}MetalV" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7d8a9a"/>
              <stop offset="50%" stop-color="#5e6b7c"/>
              <stop offset="100%" stop-color="#7d8a9a"/>
            </linearGradient>
            <!-- Metal finish (horizontal) -->
            <linearGradient id="${uid}MetalH" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#5e6b7c"/>
              <stop offset="50%" stop-color="#7d8a9a"/>
              <stop offset="100%" stop-color="#5e6b7c"/>
            </linearGradient>

            <!-- Chair gradients -->
            <linearGradient id="${uid}ChairBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#6e7d90"/>
              <stop offset="100%" stop-color="#4e5a6a"/>
            </linearGradient>
            <linearGradient id="${uid}ChairSeat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#4e5a68"/>
              <stop offset="100%" stop-color="#38424e"/>
            </linearGradient>

            <!-- Desk surface gradients -->
            <linearGradient id="${uid}DeskOak" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#d8a877"/>
              <stop offset="30%" stop-color="#d29b6d"/>
              <stop offset="70%" stop-color="#c89060"/>
              <stop offset="100%" stop-color="#d29b6d"/>
            </linearGradient>
            <linearGradient id="${uid}DeskDark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#a47860"/>
              <stop offset="50%" stop-color="#9a6a52"/>
              <stop offset="100%" stop-color="#8e6048"/>
            </linearGradient>

            <!-- Wood door -->
            <linearGradient id="${uid}WoodDoor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#d8a872"/>
              <stop offset="50%" stop-color="#c99668"/>
              <stop offset="100%" stop-color="#b5835a"/>
            </linearGradient>
            <!-- Glass door -->
            <linearGradient id="${uid}GlassDoor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#d4eef8"/>
              <stop offset="100%" stop-color="#a0cfe0"/>
            </linearGradient>

            <!-- Sofa -->
            <linearGradient id="${uid}Sofa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#c86e70"/>
              <stop offset="60%" stop-color="#b85e61"/>
              <stop offset="100%" stop-color="#9e4e50"/>
            </linearGradient>
            <!-- Break sofa (blue) -->
            <linearGradient id="${uid}BreakSofa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#a0bade"/>
              <stop offset="60%" stop-color="#90a8ce"/>
              <stop offset="100%" stop-color="#7890b8"/>
            </linearGradient>

            <!-- Filing cabinet -->
            <linearGradient id="${uid}FilingCab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#a4b0c0"/>
              <stop offset="100%" stop-color="#808d9e"/>
            </linearGradient>

            <!-- Potted plant pot -->
            <linearGradient id="${uid}Pot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e0a96e"/>
              <stop offset="100%" stop-color="#b87e48"/>
            </linearGradient>

            <!-- Shelf wood -->
            <linearGradient id="${uid}ShelfWood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#a87a58"/>
              <stop offset="100%" stop-color="#88644a"/>
            </linearGradient>

            <!-- Meeting/coffee table wood -->
            <linearGradient id="${uid}TableWood" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#d5a474"/>
              <stop offset="50%" stop-color="#cb9467"/>
              <stop offset="100%" stop-color="#bf8558"/>
            </linearGradient>

            <!-- Board surface -->
            <linearGradient id="${uid}Board" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="100%" stop-color="#eef1f4"/>
            </linearGradient>

            <!-- Globe -->
            <radialGradient id="${uid}Globe" cx="0.35" cy="0.35" r="0.6">
              <stop offset="0%" stop-color="#7ec4a8"/>
              <stop offset="45%" stop-color="#5da889"/>
              <stop offset="100%" stop-color="#3d7a60"/>
            </radialGradient>

            <!-- Clock face -->
            <radialGradient id="${uid}ClockFace" cx="0.45" cy="0.4" r="0.55">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="100%" stop-color="#e8e4df"/>
            </radialGradient>

            <!-- Printer body -->
            <linearGradient id="${uid}PrinterBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f4f6f8"/>
              <stop offset="100%" stop-color="#dbe2e8"/>
            </linearGradient>

            <!-- Appliance (fridge/microwave) -->
            <linearGradient id="${uid}Appliance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#5e6a78"/>
              <stop offset="100%" stop-color="#3e4854"/>
            </linearGradient>

            <!-- Ceiling light glow -->
            <radialGradient id="${uid}CeilingLight" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stop-color="#fffde8" stop-opacity="1"/>
              <stop offset="100%" stop-color="#fffde8" stop-opacity="0"/>
            </radialGradient>

            <!-- Welcome mat -->
            <linearGradient id="${uid}WelcomeMat" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#6b7a5d"/>
              <stop offset="50%" stop-color="#7a8a6a"/>
              <stop offset="100%" stop-color="#6b7a5d"/>
            </linearGradient>

            <!-- ═══ AMBIENT OCCLUSION GRADIENTS ═══ -->
            <linearGradient id="${uid}AODown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(0,0,0,0.14)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
            </linearGradient>
            <linearGradient id="${uid}AOUp" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="rgba(0,0,0,0.14)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
            </linearGradient>
            <linearGradient id="${uid}AORight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="rgba(0,0,0,0.14)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
            </linearGradient>
            <linearGradient id="${uid}AOLeft" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stop-color="rgba(0,0,0,0.14)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
            </linearGradient>

            <!-- ═══ FLOOR PATTERNS ═══ -->

            <!-- Tile Floor (polished, grout + specular) -->
            <pattern id="${uid}Tile" width="1" height="1" patternUnits="userSpaceOnUse">
              <rect width="1" height="1" fill="#f1eadf"/>
              <rect x="0.02" y="0.02" width="0.96" height="0.96" fill="#efe8dc" rx="0.02"/>
              <path d="M1 0H0V1" fill="none" stroke="#d0c3b0" stroke-width="0.05"/>
              <rect x="0.05" y="0.05" width="0.4" height="0.2" fill="white" opacity="0.04" rx="0.04"/>
              <circle cx="0.7" cy="0.3" r="0.02" fill="#d1c5b5" opacity="0.4"/>
              <circle cx="0.3" cy="0.7" r="0.015" fill="#d1c5b5" opacity="0.3"/>
            </pattern>

            <!-- Wood Floor (rich grain) -->
            <pattern id="${uid}Wood" width="3" height="1" patternUnits="userSpaceOnUse">
              <rect width="3" height="1" fill="#c99366"/>
              <rect x="0" y="0" width="3" height="0.15" fill="#c08a5c" opacity="0.3"/>
              <rect x="0" y="0.85" width="3" height="0.15" fill="#b07848" opacity="0.2"/>
              <path d="M0 0.5H3" stroke="#a97046" stroke-width="0.06"/>
              <path d="M0.5 0.25Q1 0.2 1.5 0.26" stroke="#b5784c" stroke-width="0.025" fill="none" opacity="0.5"/>
              <path d="M1.8 0.72Q2.2 0.68 2.6 0.74" stroke="#b5784c" stroke-width="0.025" fill="none" opacity="0.4"/>
              <path d="M1 0V0.5M2.1 0.5V1" stroke="#8b5d3d" stroke-width="0.05"/>
              <!-- knot -->
              <ellipse cx="2.5" cy="0.3" rx="0.06" ry="0.04" fill="#8b5d3d" opacity="0.35"/>
              <!-- specular -->
              <rect x="0.2" y="0.08" width="0.8" height="0.12" fill="white" opacity="0.03" rx="0.04"/>
            </pattern>

            <!-- Dark Wood Floor (walnut-like) -->
            <pattern id="${uid}DarkWood" width="3" height="1" patternUnits="userSpaceOnUse">
              <rect width="3" height="1" fill="#7d5a4d"/>
              <rect x="0" y="0" width="3" height="0.15" fill="#6d4a3d" opacity="0.3"/>
              <rect x="0" y="0.85" width="3" height="0.15" fill="#5d3a2d" opacity="0.25"/>
              <path d="M0 0.5H3" stroke="#5d4034" stroke-width="0.06"/>
              <path d="M0.8 0.22Q1.3 0.18 1.8 0.24" stroke="#6d4a3d" stroke-width="0.025" fill="none" opacity="0.5"/>
              <path d="M1.2 0V0.5M2.2 0.5V1" stroke="#473025" stroke-width="0.05"/>
              <ellipse cx="0.6" cy="0.7" rx="0.05" ry="0.03" fill="#473025" opacity="0.3"/>
              <rect x="1.5" y="0.06" width="0.7" height="0.1" fill="white" opacity="0.025" rx="0.03"/>
            </pattern>

            <!-- Blue Carpet (woven pile) -->
            <pattern id="${uid}BlueCarpet" width="1.5" height="1.5" patternUnits="userSpaceOnUse">
              <rect width="1.5" height="1.5" fill="#4f78b3"/>
              <path d="M0 0.375H1.5M0 0.75H1.5M0 1.125H1.5" stroke="#4568a0" stroke-width="0.04" opacity="0.5"/>
              <path d="M0.375 0V1.5M0.75 0V1.5M1.125 0V1.5" stroke="#4568a0" stroke-width="0.04" opacity="0.5"/>
              <path d="M0 0.75H1.5M0.75 0V1.5" stroke="#3f6396" stroke-width="0.06"/>
              <circle cx="0.375" cy="0.375" r="0.04" fill="#335281" opacity="0.3"/>
              <circle cx="1.125" cy="1.125" r="0.04" fill="#335281" opacity="0.3"/>
              <rect x="0" y="0" width="0.75" height="0.75" fill="white" opacity="0.015"/>
            </pattern>

            <!-- Red Carpet (woven pile) -->
            <pattern id="${uid}RedCarpet" width="1.5" height="1.5" patternUnits="userSpaceOnUse">
              <rect width="1.5" height="1.5" fill="#b45a62"/>
              <path d="M0 0.375H1.5M0 0.75H1.5M0 1.125H1.5" stroke="#a04a52" stroke-width="0.04" opacity="0.5"/>
              <path d="M0.375 0V1.5M0.75 0V1.5M1.125 0V1.5" stroke="#a04a52" stroke-width="0.04" opacity="0.5"/>
              <path d="M0 0.75H1.5M0.75 0V1.5" stroke="#97424a" stroke-width="0.06"/>
              <circle cx="0.375" cy="1.125" r="0.04" fill="#7d3138" opacity="0.3"/>
              <circle cx="1.125" cy="0.375" r="0.04" fill="#7d3138" opacity="0.3"/>
              <rect x="0.75" y="0" width="0.75" height="0.75" fill="white" opacity="0.015"/>
            </pattern>
          </defs>

          <!-- Background -->
          <rect width="${mapW}" height="${mapH}" fill="#10182a"/>

          <!-- Floor surfaces -->
          ${floorRects}

          <!-- Ambient occlusion along walls -->
          ${ambientOcclusion}

          <!-- Ceiling light pools -->
          ${lightPools}

          <!-- Wall partitions -->
          ${partitions}

          <!-- Windows -->
          ${windowXs.map(windowSvg).join('')}

          <!-- Doors / openings -->
          ${openings}

          <!-- Furniture -->
          ${furnishings}

          <!-- Decor -->
          ${decor}

          <!-- Room Sign Plaques -->
          <style>
            .sign-text { font-family: 'Inter', sans-serif; fill: #3a434e; font-size: 0.28px; font-weight: 700; text-anchor: middle; letter-spacing: 0.04px; pointer-events: none; dominant-baseline: central; }
          </style>
          ${[
            { label: 'LOBBY', x: layout.doorX + 2.5, y: 1.3 },
            { label: 'MANAGER', x: layout.managerLeft + layout.managerWingW / 2, y: layout.workTop + 0.5 },
            { label: 'WORKSPACE', x: layout.deskLeft + layout.deskBayW / 2, y: layout.workTop + 0.5 },
            { label: 'REVIEW', x: layout.rightLeft + layout.rightWingW / 2, y: layout.reviewTop + 0.5 },
            { label: 'RESEARCH', x: layout.rightLeft + layout.rightWingW / 2, y: layout.researchTop + 0.5 },
            { label: 'BREAK ROOM', x: layout.breakLeft + layout.breakW / 2, y: layout.amenityTop + 0.5 },
            { label: 'MEETING', x: layout.meetingLeft + layout.meetingW / 2, y: layout.amenityTop + 0.5 },
            { label: 'REMOTE HUB', x: layout.remoteLeft + layout.remoteW / 2, y: layout.amenityTop + 0.5 }
          ].map(s => {
            const tw = s.label.length * 0.24 + 0.5;
            return `<g><rect x="${fmt(s.x - tw/2)}" y="${fmt(s.y - 0.22)}" width="${fmt(tw)}" height="0.44" rx="0.08" fill="#f0ede8" stroke="#b8b0a4" stroke-width="0.02"/><text class="sign-text" x="${fmt(s.x)}" y="${fmt(s.y)}">${s.label}</text></g>`;
          }).join('\n          ')}
        </svg>
      </div>
    `;
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, pw, ph);

    for (let l = 0; l < 3; l++) {
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          const tid = layers[l][y * mapW + x];
          if (tid && TILES[tid] && TILES[tid].canvas) {
            ctx.drawImage(TILES[tid].canvas, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════
  //  EXPORT
  // ══════════════════════════════════════════

  window.OfficeTilemap = { TILE_SIZE, TILES, initTiles, generate, render, renderSvg };
})();
