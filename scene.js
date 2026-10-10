// The designs. Each one draws a whole frame (photo, brand, contact, motion) for time t,
// in story (1080×1920) or post (1080×1350). The preview, the saved picture and the saved
// video all come from this one function, so what Abbas sees is what he gets.
import { C, brand, drawLogo, logoRatio, opticalX, ease, seg, clamp } from './brand.js';
import { Smoke } from './smoke.js';

export const DUR = 7;            // video length, seconds
export const STILL = 4.2;        // the moment a saved picture is taken (everything settled)
export const FORMATS = { story: [1080, 1920], post: [1080, 1350] };
// Instagram covers the top and bottom of a story with its own buttons: keep words inside
export const SAFE = { story: [250, 1670], post: [40, 1310] };

const smoke = new Smoke(360, 640);
const F = (w, s) => `${w} ${s}px Almarai`;

// ---------- small tools ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function text(ctx, s, x, y, { size = 40, weight = 700, color = C.white, align = 'center', maxW = 0, dir = 'rtl', base = 'alphabetic' } = {}) {
  ctx.save();
  ctx.font = F(weight, size);
  if (maxW) { const m = ctx.measureText(s).width; if (m > maxW) { size *= maxW / m; ctx.font = F(weight, size); } }
  ctx.direction = dir; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
  return size;
}

function wrap(ctx, s, maxW, size, weight) {
  ctx.save(); ctx.font = F(weight, size);
  const words = s.split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  for (const w of words) {
    const tryL = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(tryL).width <= maxW || !cur) cur = tryL; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

// deterministic film grain, made once
let grainPat = null;
function grain(ctx, W, H, amt = 0.07) {
  if (!grainPat) {
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const gx = g.getContext('2d'); const d = gx.createImageData(256, 256);
    let s = 1234567;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff; const v = (s >> 16) & 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    gx.putImageData(d, 0, 0); grainPat = ctx.createPattern(g, 'repeat');
  }
  ctx.save(); ctx.globalAlpha = amt; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W, H); ctx.restore();
}

function laySmoke(ctx, W, H, t, opts, alpha = 1, op = 'screen') {
  smoke.resize(360, Math.round(360 * H / W));
  const c = smoke.render(t, opts);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op;
  ctx.drawImage(c, 0, 0, W, H); ctx.restore();
}

// ---------- the photo ----------
/** where a photo sits for a given cover box and the user's pan/zoom; also used by the editor */
export function photoRect(img, box, view, kb = 1) {
  const base = Math.max(box.w / img.width, box.h / img.height);
  const z = base * Math.max(1, view.z) * kb;
  const dw = img.width * z, dh = img.height * z;
  const mx = (dw - box.w) / 2, my = (dh - box.h) / 2;
  const ox = clamp(view.x * box.w, -mx, mx), oy = clamp(view.y * box.h, -my, my);
  return { x: box.x + box.w / 2 - dw / 2 + ox, y: box.y + box.h / 2 - dh / 2 + oy, w: dw, h: dh, mx, my };
}

function photo(ctx, S, box, kb = 1) {
  if (!S.img) return placeholder(ctx, box);
  const r = photoRect(S.img, box, S.view, kb);
  ctx.drawImage(S.img, r.x, r.y, r.w, r.h);
}

function placeholder(ctx, b) {
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  g.addColorStop(0, '#2b2780'); g.addColorStop(1, '#141142');
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
  for (let x = b.x - b.h; x < b.x + b.w; x += 46) { ctx.beginPath(); ctx.moveTo(x, b.y + b.h); ctx.lineTo(x + b.h, b.y); ctx.stroke(); }
  ctx.restore();
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  rr(ctx, cx - 60, cy - 70, 120, 92, 16); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - 24, 22, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  text(ctx, 'اختر صورة من المعرض', cx, cy + 80, { size: 42, weight: 700, color: 'rgba(255,255,255,.85)' });
}

// ---------- icons (24-unit) ----------
const PHONE = new Path2D('M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.27-.27.67-.36 1-.25 1.1.37 2.3.57 3.6.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.6 21 3 13.4 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z');
function icon(ctx, kind, x, y, s, color) {
  ctx.save(); ctx.translate(x - s / 2, y - s / 2); ctx.scale(s / 24, s / 24);
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === 'phone') ctx.fill(PHONE);
  else if (kind === 'insta') {
    ctx.lineWidth = 2.1; rr(ctx, 3, 3, 18, 18, 5.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, 12, 4.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(17.2, 6.8, 1.25, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'pin') {
    ctx.fill(new Path2D('M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z'));
  }
  ctx.restore();
}

// ---------- contact ----------
export const PLACEHOLDER = { phone: '07XX XXX XXXX', insta: '@instagram' };
function contactItems(info) {
  const it = [];
  it.push({ icon: 'phone', text: info.phone || PLACEHOLDER.phone, ph: !info.phone });
  it.push({ icon: 'insta', text: info.insta ? (info.insta.startsWith('@') ? info.insta : '@' + info.insta) : PLACEHOLDER.insta, ph: !info.insta });
  if (info.place) it.push({ icon: 'pin', text: info.place, ph: false, rtl: true });
  return it;
}

/** the pills' size before drawing them (so they can be placed and moved as one block) */
function pillsLayout(ctx, maxW, info, { h = 84, size = 36, gap = 18 } = {}) {
  const items = contactItems(info);
  ctx.save(); ctx.font = F(700, size);
  const ws = items.map((i) => Math.min(ctx.measureText(i.text).width + h + 34, maxW));
  ctx.restore();
  const rows = [];
  let row = [], rw = 0;
  items.forEach((it, i) => {
    if (row.length && rw + gap + ws[i] > maxW) { rows.push([row, rw]); row = []; rw = 0; }
    rw += (row.length ? gap : 0) + ws[i]; row.push(i);
  });
  rows.push([row, rw]);
  return { items, ws, rows, w: Math.max(...rows.map((r) => r[1])), h: rows.length * h + (rows.length - 1) * 14 };
}

/** a centred row of pills (wraps to two rows if needed) */
function pills(ctx, cx, y, maxW, info, { h = 84, size = 36, bg = 'rgba(13,11,42,.74)', fg = C.white, dot = C.orange, dotFg = C.night, stroke = 'rgba(255,255,255,.14)', gap = 18, a = 1 } = {}) {
  const { items, ws, rows } = pillsLayout(ctx, maxW, info, { h, size, gap });
  ctx.save(); ctx.globalAlpha *= a;
  rows.forEach(([r, total], ri) => {
    // right to left: the first item sits on the right
    let x = cx + total / 2;
    const yy = y + ri * (h + 14);
    for (const i of r) {
      const w = ws[i], it = items[i];
      x -= w;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      rr(ctx, x, yy, w, h, h / 2); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
      if (stroke) { rr(ctx, x, yy, w, h, h / 2); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x + w - h / 2, yy + h / 2, h / 2 - 9, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill();
      icon(ctx, it.icon, x + w - h / 2, yy + h / 2, h * 0.42, dotFg);
      text(ctx, it.text, x + w - h - 12, yy + h / 2 + 2, { size, weight: 700, color: it.ph ? 'rgba(255,255,255,.55)' : fg, align: 'right', dir: it.rtl ? 'rtl' : 'ltr', base: 'middle', maxW: w - h - 30 });
      x -= gap;
    }
  });
  ctx.restore();
}

// ---------- the elements Abbas can move and size ----------
export const ITEM_NAMES = { logo: 'الشعار', name: 'الاسم', headline: 'العنوان', line: 'سطر المحل', contact: 'الرقم والحساب', title: 'اسم المنتج', badge: 'السعر', frame: 'الصورة' };
/**
 * Draw one movable element: `box` is where it sits by default (design pixels); Abbas's offset and
 * size come from S.layout[id]. The final box is kept (S.boxes) so the editor can pick it.
 */
function item(ctx, S, id, box, draw) {
  const o = (S.layout && S.layout[id]) || {};
  const s = o.s ?? 1, dx = o.dx || 0, dy = o.dy || 0;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  ctx.save();
  ctx.translate(cx + dx, cy + dy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
  if (S.boxes) S.boxes.push({ id, x: cx + dx - (box.w * s) / 2, y: cy + dy - (box.h * s) / 2, w: box.w * s, h: box.h * s });
}
/** a logo of width w, centred by its weight (the eye), not its box */
function logoBoxAt(W, y, w, parts = 'all') { return { x: opticalX(W, w, parts), y, w, h: w * logoRatio(parts) }; }

/** the shop line, alone (it can be moved apart from the numbers) */
function shopLine(ctx, S, id, W, baseY, size, t, t0, { color = C.white, shadow = true } = {}) {
  if (!S.info.line) return;
  ctx.save(); ctx.font = F(800, size);
  let w = ctx.measureText(S.info.line).width; const maxW = W - 140;
  let sz = size; if (w > maxW) { sz = size * maxW / w; w = maxW; }
  ctx.restore();
  const box = { x: (W - w) / 2, y: baseY - sz * 0.95, w, h: sz * 1.25 };
  item(ctx, S, id, box, () => {
    const u = ease.out(seg(t, t0, t0 + 0.6));
    ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 24);
    if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16; }
    text(ctx, S.info.line, W / 2, baseY, { size: sz, weight: 800, color });
    ctx.restore();
  });
}

/** the numbers as a block of pills, placed by its top edge */
function contactBlock(ctx, S, W, y, t, t0, opts) {
  const lay = pillsLayout(ctx, W - 120, S.info, opts);
  const box = { x: (W - lay.w) / 2, y, w: lay.w, h: lay.h };
  item(ctx, S, 'contact', box, () => {
    const u = ease.out(seg(t, t0, t0 + 0.55));
    ctx.save(); ctx.translate(0, (1 - u) * 30);
    pills(ctx, W / 2, y, W - 120, S.info, { ...opts, a: u });
    ctx.restore();
  });
}

/** the product line as a movable element; y is the baseline of its last line */
function titleItem(ctx, S, W, y, maxW, t, t0, size) {
  const s = S.fields.title; if (!s) return;
  const lines = wrap(ctx, s, maxW, size, 800).slice(0, 2);
  ctx.save(); ctx.font = F(800, size); const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))); ctx.restore();
  const hgt = lines.length * size * 1.18;
  const box = { x: (W - w) / 2, y: y - hgt + size * 0.25, w, h: hgt };
  item(ctx, S, 'title', box, () => title(ctx, s, W / 2, y, maxW, t, t0, size));
}

function badgeItem(ctx, S, cx, cy, r, t0, t, opts) {
  if (!S.fields.badge) return;
  item(ctx, S, 'badge', { x: cx - r * 1.08, y: cy - r * 1.08, w: r * 2.16, h: r * 2.16 }, () => badge(ctx, S.fields.badge, cx, cy, r, t0, t, opts));
}

// the badge: a price / installment line in a circle, if Abbas wrote one
function badge(ctx, s, cx, cy, r, t0, t, { bg = C.orange, fg = C.night, ring = C.white, rot = -0.14, shape = 'circle' } = {}) {
  if (!s) return;
  const u = ease.back(seg(t, t0, t0 + 0.5));
  if (u <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot + (shape === 'burst' ? (1 - u) * -0.8 : 0)); ctx.scale(u, u);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.beginPath();
  if (shape === 'burst') {
    // a sales sticker: an 18-point burst
    const n = 18;
    for (let j = 0; j < n * 2; j++) { const r2 = j % 2 ? r * 0.88 : r * 1.04; const an = (j * Math.PI) / n; ctx[j ? 'lineTo' : 'moveTo'](Math.cos(an) * r2, Math.sin(an) * r2); }
    ctx.closePath();
  } else ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.strokeStyle = ring;
  ctx.beginPath(); ctx.arc(0, 0, r - 14, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  let size = r * 0.36; let lines = wrap(ctx, s, r * 1.45, size, 800);
  while (lines.length > 3 && size > 18) { size *= 0.9; lines = wrap(ctx, s, r * 1.45, size, 800); }
  const lh = size * 1.12;
  lines.forEach((l, i) => text(ctx, l, 0, (i - (lines.length - 1) / 2) * lh + size * 0.36, { size, weight: 800, color: fg, maxW: r * 1.6 }));
  ctx.restore();
}

// a light sheen passing over the logo, every few seconds
function logoWithSheen(ctx, W, H, opts, t, at = [2.4, 5.2]) {
  const L = layer(ctx.canvas, 0); const lc = L.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, L.width, L.height);
  lc.setTransform(ctx.getTransform());
  drawLogo(lc, opts);
  for (const a of at) {
    const u = seg(t, a, a + 0.9);
    if (u <= 0 || u >= 1) continue;
    const h = opts.w * logoRatio(opts.parts);
    const x = opts.x - opts.w * 0.4 + (opts.w * 1.8) * ease.inOut(u);
    const g = lc.createLinearGradient(x - 120, opts.y, x + 120, opts.y + h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    lc.save(); lc.globalCompositeOperation = 'source-atop'; lc.fillStyle = g; lc.fillRect(opts.x - 200, opts.y - 50, opts.w + 400, h + 100); lc.restore();
  }
  rim(ctx, L);
}
/** draw a layer with a thin dark rim that hugs its shape (Abbas: «فقط محيط باللوكو»), not a big glow */
function rim(ctx, L, { r = 2.6, a = 0.6 } = {}) {
  const k = ctx.getTransform().a;
  const R = layer(ctx.canvas, 1), rc = R.getContext('2d');
  rc.setTransform(1, 0, 0, 1, 0, 0); rc.clearRect(0, 0, R.width, R.height);
  for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; rc.drawImage(L, Math.cos(an) * r * k, Math.sin(an) * r * k); }
  rc.globalCompositeOperation = 'source-in'; rc.fillStyle = '#07061a'; rc.fillRect(0, 0, R.width, R.height);
  rc.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * a; ctx.drawImage(R, 0, 0);
  ctx.globalAlpha = a0; ctx.drawImage(L, 0, 0);
  ctx.restore();
}
/** the logo (any part, any look) with that rim */
function logoRim(ctx, opts, rimOpts) {
  const L = layer(ctx.canvas, 2), lc = L.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, L.width, L.height);
  lc.setTransform(ctx.getTransform());
  drawLogo(lc, opts);
  rim(ctx, L, rimOpts);
}
const layers = new WeakMap();
function layer(c, i) {
  let arr = layers.get(c); if (!arr) layers.set(c, (arr = []));
  if (!arr[i] || arr[i].width !== c.width || arr[i].height !== c.height) {
    arr[i] = document.createElement('canvas'); arr[i].width = c.width; arr[i].height = c.height;
  }
  return arr[i];
}

/** the product line; y is the baseline of its LAST line (it grows upwards) */
function title(ctx, s, cx, y, maxW, t, t0, size = 64) {
  if (!s) return 0;
  const u = ease.out(seg(t, t0, t0 + 0.6));
  if (u <= 0) return 0;
  const lines = wrap(ctx, s, maxW, size, 800).slice(0, 2);
  y -= (lines.length - 1) * size * 1.18;
  ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 30);
  lines.forEach((l, i) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 24;
    text(ctx, l, cx, y + i * size * 1.18, { size, weight: 800, maxW });
    ctx.restore();
  });
  ctx.restore();
  return lines.length * size * 1.18;
}

// =====================================================================================
// 1. الواجهة — the product on show, like a shop window (Abbas: the house hid the photos, the smoke was not nice):
//    the photo whole in a rounded frame that rises onto a glossy floor and shows in it,
//    a warm light behind, a second frame drawn on in orange, slow sparks instead of smoke
// =====================================================================================
function showGeo(W, H, fmt) {
  return fmt === 'story'
    ? { x: 110, y: 520, w: 860, h: 800, r: 40, logoY: 262, logoW: 300, title: 1478 }
    : { x: 220, y: 236, w: 640, h: 630, r: 34, logoY: 44, logoW: 240, title: 1150 };
}
const rnd = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function sparks(ctx, W, H, t, n) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const sp = 22 + rnd(i + 0.3) * 46, span = H * 0.95;
    const y = H - ((rnd(i + 0.7) * span + t * sp) % span);
    const x = rnd(i) * W + Math.sin(t * 0.8 + i) * 14;
    const a = (0.18 + 0.4 * rnd(i + 0.9)) * (0.65 + 0.35 * Math.sin(t * 2.2 + i * 1.7)) * clamp((H - y) / 160);
    ctx.globalAlpha = a; ctx.fillStyle = i % 4 ? C.orange : '#ffd9a0';
    ctx.shadowColor = 'rgba(253,145,4,.9)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, 2 + rnd(i + 0.5) * 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
const showroom = {
  id: 'showroom', name: 'الواجهة',
  photoBox(W, H, fmt) { const g = showGeo(W, H, fmt); return { x: g.x, y: g.y, w: g.w, h: g.h }; },
  draw(ctx, W, H, t, S, fmt) {
    const story = fmt === 'story';
    const g = showGeo(W, H, fmt), box = this.photoBox(W, H, fmt);
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2, floor = g.y + g.h;
    // the room: indigo going dark to the floor, a warm light behind the frame
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#231d6b'); bg.addColorStop(0.62, C.night); bg.addColorStop(1, '#05041a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createRadialGradient(cx, cy, 40, cx, cy, W * 0.78);
    gl.addColorStop(0, `rgba(253,145,4,${0.3 + 0.04 * Math.sin(t * 1.4)})`); gl.addColorStop(0.45, 'rgba(253,145,4,.08)'); gl.addColorStop(1, 'rgba(253,145,4,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    sparks(ctx, W, H, t, story ? 30 : 24);
    // the floor: a line of light where the frame stands
    const fl = ctx.createLinearGradient(0, 0, W, 0);
    fl.addColorStop(0, 'rgba(255,190,110,0)'); fl.addColorStop(0.5, 'rgba(255,190,110,.55)'); fl.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = fl; ctx.fillRect(0, floor, W, 2);

    item(ctx, S, 'frame', box, () => {
      const u = ease.out(seg(t, 0.15, 1.15));
      const lift = (1 - u) * 90 + Math.sin(Math.max(0, t - 1.15) * 1.3) * 4;
      const card = (c) => {
        c.save(); rr(c, g.x, g.y, g.w, g.h, g.r); c.clip();
        photo(c, S, box, 1.06 - 0.06 * u + 0.02 * seg(t, 1.15, DUR));
        c.restore();
      };
      // a second frame, a step up and to the side, drawn on in orange
      const d = ease.inOut(seg(t, 0.5, 1.6));
      if (d > 0) {
        ctx.save(); ctx.translate(story ? 26 : 22, -(story ? 26 : 22));
        ctx.strokeStyle = C.orange; ctx.lineWidth = story ? 5 : 4; ctx.lineCap = 'round';
        const per = 2 * (g.w + g.h);
        ctx.setLineDash([per * d, per]); rr(ctx, g.x, g.y, g.w, g.h, g.r); ctx.stroke();
        ctx.restore();
      }
      // the reflection in the floor: the frame upside down, fading out
      const L = layer(ctx.canvas, 3), lc = L.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, L.width, L.height);
      lc.setTransform(ctx.getTransform());
      lc.translate(0, 2 * floor + lift); lc.scale(1, -1);
      card(lc);
      lc.setTransform(ctx.getTransform());
      lc.globalCompositeOperation = 'destination-in';
      const rf = lc.createLinearGradient(0, floor, 0, floor + g.h * 0.32);
      rf.addColorStop(0, 'rgba(0,0,0,.32)'); rf.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = rf; lc.fillRect(-W, floor, 3 * W, H);
      lc.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha *= u; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L, 0, 0); ctx.restore();
      // the frame itself
      ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, -lift);
      ctx.save(); ctx.shadowColor = 'rgba(3,2,15,.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
      rr(ctx, g.x, g.y, g.w, g.h, g.r); ctx.fillStyle = C.night; ctx.fill(); ctx.restore();
      card(ctx);
      // a light passing over the glass, once
      const su = seg(t, 2.1, 3.0);
      if (su > 0 && su < 1) {
        ctx.save(); rr(ctx, g.x, g.y, g.w, g.h, g.r); ctx.clip();
        const sx = g.x - g.w * 0.5 + g.w * 2 * ease.inOut(su);
        const sh = ctx.createLinearGradient(sx - 160, g.y, sx + 160, g.y + g.h * 0.4);
        sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sh; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.restore();
      }
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.28)'; rr(ctx, g.x + 1, g.y + 1, g.w - 2, g.h - 2, g.r); ctx.stroke();
      ctx.restore();
    });

    badgeItem(ctx, S, g.x + (story ? 30 : 24), g.y + (story ? 40 : 34), story ? 120 : 96, 1.45, t, { rot: -0.16 });
    const lb = logoBoxAt(W, g.logoY, g.logoW);
    item(ctx, S, 'logo', lb, () => logoWithSheen(ctx, W, H, { x: lb.x, y: lb.y, w: lb.w, t: t - 0.2 }, t));
    titleItem(ctx, S, W, g.title, W - 160, t, 1.2, story ? 60 : 50);
    shopLine(ctx, S, 'line', W, story ? 1556 : 1214, story ? 34 : 30, t, 1.15);
    contactBlock(ctx, S, W, story ? 1582 : 1238, t, 1.25, { h: story ? 80 : 72, size: story ? 34 : 30 });
    grain(ctx, W, H, 0.04);
  },
};

// =====================================================================================
// 2. سينما — the photo full screen and clear; a small logo, the shop and its numbers low
// =====================================================================================
const cinema = {
  id: 'cinema', name: 'سينما',
  photoBox(W, H) { return { x: 0, y: 0, w: W, h: H }; },
  draw(ctx, W, H, t, S, fmt) {
    const story = fmt === 'story';
    ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
    const pu = ease.expo(seg(t, 0, 1.6));
    ctx.save(); ctx.globalAlpha = clamp(pu * 1.5);
    photo(ctx, S, this.photoBox(W, H), 1.12 - 0.1 * pu + 0.03 * seg(t, 1.6, DUR));
    ctx.restore();
    // keep the product clear (Abbas): only a light vignette and a low shade under the words
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.78);
    vg.addColorStop(0, 'rgba(7,6,26,0)'); vg.addColorStop(1, 'rgba(7,6,26,.3)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const fy = H * 0.74;
    const fg = ctx.createLinearGradient(0, fy, 0, H);
    fg.addColorStop(0, 'rgba(13,11,42,0)'); fg.addColorStop(1, 'rgba(10,8,32,.62)');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
    laySmoke(ctx, W, H, t, { a: C.orange, b: C.indigo2, amt: 0.8, mode: 'bottom', seed: 4.2, rise: 1.2 }, 0.55);

    // the logo, small; a thin rim round its shape keeps it readable on any photo (no corners, no shade: Abbas)
    const lb = logoBoxAt(W, story ? 262 : 56, story ? 360 : 280);
    item(ctx, S, 'logo', lb, () => logoWithSheen(ctx, W, H, { x: lb.x, y: lb.y, w: lb.w, t: t - 0.2 }, t));

    // low on the screen: the product (if written), the shop line, the numbers
    titleItem(ctx, S, W, story ? 1478 : 1150, W - 160, t, 1.0, story ? 60 : 50);
    shopLine(ctx, S, 'line', W, story ? 1556 : 1214, story ? 34 : 30, t, 1.0);
    contactBlock(ctx, S, W, story ? 1582 : 1238, t, 1.1, { h: story ? 80 : 72, size: story ? 34 : 30 });
    badgeItem(ctx, S, W - (story ? 190 : 160), story ? 1240 : 880, story ? 120 : 100, 1.4, t, { rot: 0.12 });
    grain(ctx, W, H, 0.06);
  },
};

// =====================================================================================
// 3. بطاقة — a poster: the photo as a polaroid taped to a night-indigo wall, a sun rising
//    behind its corner, the shop's name drawn huge and hollow behind, two tapes crossing
// =====================================================================================
const card = {
  id: 'card', name: 'بطاقة',
  geo(W, H, fmt) {
    return fmt === 'story'
      ? { cx: 540, top: 604, pw: 660, ph: 660, b: 28, cap: 136, rot: -0.06, logoW: 360, logoY: 268, tapeY: 1474, pillY: 1582, sun: 300, mark: 300 }
      : { cx: 540, top: 282, pw: 560, ph: 560, b: 22, cap: 116, rot: -0.06, logoW: 260, logoY: 48, tapeY: 1032, pillY: 1210, sun: 240, mark: 230 };
  },
  photoBox(W, H, fmt) { const g = this.geo(W, H, fmt); return { x: g.cx - g.pw / 2, y: g.top + g.b, w: g.pw, h: g.ph }; },
  draw(ctx, W, H, t, S, fmt) {
    const g = this.geo(W, H, fmt); const story = fmt === 'story';
    const cw = g.pw + 2 * g.b, ch = g.b + g.ph + g.cap;          // the polaroid
    const ccx = g.cx, ccy = g.top + ch / 2;

    // the wall: night indigo, lighter at the top
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1E1A6B'); bg.addColorStop(0.45, '#120F45'); bg.addColorStop(1, '#08071F');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const lg = ctx.createRadialGradient(W / 2, g.logoY + 140, 10, W / 2, g.logoY + 140, W * 0.7);
    lg.addColorStop(0, 'rgba(75,63,216,.35)'); lg.addColorStop(1, 'rgba(75,63,216,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

    // the name, huge and hollow, drifting behind everything
    const wa = ease.out(seg(t, 0, 1.2));
    ctx.save(); ctx.globalAlpha = 0.085 * wa; ctx.strokeStyle = C.white; ctx.lineWidth = story ? 3 : 2.5;
    ctx.font = F(800, story ? 300 : 230); ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const unit = 'المحطة للتقسيط  ✦  ';
    const uw = ctx.measureText(unit).width;
    (story ? [860, 1190] : [470, 760]).forEach((y, i) => {
      const off = ((t * 28 * (i % 2 ? -1 : 1)) % uw + uw) % uw;
      for (let x = W + off; x > -uw; x -= uw) ctx.strokeText(unit, x, y);
    });
    ctx.restore();

    // the sun rising behind the polaroid's corner, low enough to stay clear of the (orange) logo
    const su = ease.out(seg(t, 0.1, 1.3));
    const sx = ccx + cw * 0.42, sy = g.top + ch * 0.3, sr = g.sun * (0.75 + 0.25 * su);
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.1);
    halo.addColorStop(0, `rgba(253,145,4,${0.38 * su})`); halo.addColorStop(1, 'rgba(253,145,4,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    const sg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 10, sx, sy, sr);
    sg.addColorStop(0, C.orange2); sg.addColorStop(0.55, C.orange); sg.addColorStop(1, C.ember);
    ctx.save(); ctx.globalAlpha = su; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(255,214,160,.28)'; ctx.lineWidth = 2; ctx.globalAlpha = su;
    [1.2, 1.45, 1.75].forEach((k, i) => {
      ctx.setLineDash([3, 16 + i * 8]); ctx.lineDashOffset = -t * (26 + i * 10) * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.arc(sx, sy, sr * k, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.restore();
    laySmoke(ctx, W, H, t, { a: C.orange, b: C.indigo2, amt: 0.65, mode: 'sides', seed: 7.3 }, 0.5);

    // the logo
    const lb = logoBoxAt(W, g.logoY, g.logoW);
    item(ctx, S, 'logo', lb, () => {
      ctx.save(); ctx.shadowColor = 'rgba(253,145,4,.25)'; ctx.shadowBlur = 40;
      drawLogo(ctx, { x: lb.x, y: lb.y, w: lb.w, t });
      ctx.restore();
    });

    // the polaroid drops in and swings to rest
    item(ctx, S, 'frame', { x: ccx - cw / 2, y: g.top, w: cw, h: ch }, () => {
      const cu = ease.back(seg(t, 0.3, 1.2));
      const rot = g.rot + (1 - cu) * 0.22;
      ctx.save(); ctx.globalAlpha = clamp(cu * 2.2);
      ctx.translate(ccx, ccy - (1 - cu) * 420); ctx.rotate(rot); ctx.translate(-cw / 2, -ch / 2);
      ctx.save(); ctx.shadowColor = 'rgba(3,2,15,.65)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 34;
      rr(ctx, 0, 0, cw, ch, 14); ctx.fillStyle = C.cream; ctx.fill(); ctx.restore();
      rr(ctx, g.b, g.b, g.pw, g.ph, 6); ctx.save(); ctx.clip();
      photo(ctx, S, { x: g.b, y: g.b, w: g.pw, h: g.ph }, 1.07 - 0.05 * seg(t, 0.3, DUR));
      for (const a of [2.5, 5.3]) {
        const u = seg(t, a, a + 0.9);
        if (u <= 0 || u >= 1) continue;
        const x = -g.pw * 0.6 + g.pw * 2.2 * ease.inOut(u);
        const gl = ctx.createLinearGradient(x - 160, 0, x + 160, g.ph);
        gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(g.b, g.b, g.pw, g.ph);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(13,11,42,.08)'; ctx.lineWidth = 2; rr(ctx, g.b, g.b, g.pw, g.ph, 6); ctx.stroke();
      const capY = g.b + g.ph + g.cap / 2;
      if (S.fields.title) {
        let size = story ? 54 : 44; let lines = wrap(ctx, S.fields.title, g.pw - 40, size, 800);
        if (lines.length > 1) { size *= 0.84; lines = wrap(ctx, S.fields.title, g.pw - 40, size, 800).slice(0, 2); }
        lines.forEach((l, i) => text(ctx, l, cw / 2, capY + (i - (lines.length - 1) / 2) * size * 1.15 + size * 0.36, { size, weight: 800, color: C.night, maxW: g.pw - 40 }));
      } else {
        const mw = g.mark, mh = mw * logoRatio('text');
        drawLogo(ctx, { x: opticalX(cw, mw, 'text'), y: capY - mh / 2, w: mw, parts: 'text', look: 'indigo', t: t - 0.9 });
      }
      const tu = ease.out(seg(t, 1.0, 1.35));
      if (tu > 0) {
        ctx.save(); ctx.translate(cw / 2, 0); ctx.rotate(0.07); ctx.scale(1.25 - 0.25 * tu, 1.25 - 0.25 * tu); ctx.globalAlpha *= tu;
        const tw = story ? 230 : 180, th = story ? 62 : 50;
        ctx.fillStyle = 'rgba(253,145,4,.82)'; ctx.fillRect(-tw / 2, -th / 2, tw, th);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        for (let x = -tw / 2 + 8; x < tw / 2; x += 22) ctx.fillRect(x, -th / 2, 8, th);
        ctx.restore();
      }
      ctx.restore();
    });

    badgeItem(ctx, S, ccx + cw / 2 - 20, g.top + 30, story ? 122 : 100, 1.45, t, { rot: 0.18, shape: 'burst' });

    // sparkles round the print
    const SP = story
      ? [[110, 660, 26], [972, 1265, 22], [150, 1330, 14], [985, 560, 15], [92, 1000, 12]]
      : [[120, 320, 20], [960, 880, 18], [140, 900, 12], [975, 260, 12]];
    SP.forEach(([x, y, r], i) => {
      const a = seg(t, 1.2 + i * 0.12, 1.6 + i * 0.12);
      if (a <= 0) return;
      const k = a * (0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.7));
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4 + i); ctx.scale(k, k);
      ctx.fillStyle = i % 2 ? C.orange2 : C.white; ctx.shadowColor = 'rgba(255,200,120,.8)'; ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) { const r2 = j % 2 ? r * 0.22 : r; const an = (j * Math.PI) / 4; ctx[j ? 'lineTo' : 'moveTo'](Math.cos(an) * r2, Math.sin(an) * r2); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    });

    // two tapes crossing under the print, running opposite ways
    const tapes = [
      { col: C.cream, ink: C.orange, rot: 0.075, dy: -4, txt: 'المحطة للتقسيط', sp: -60, from: -1 },
      { col: C.orange, ink: C.night, rot: -0.06, dy: 0, txt: S.info.tape || 'تقسيط الأجهزة الكهربائية والمنزلية', sp: 85, from: 1 },
    ];
    tapes.forEach((tp, i) => {
      const u = ease.out(seg(t, 0.9 + i * 0.12, 1.4 + i * 0.12));
      if (u <= 0) return;
      const th = story ? 84 : 72;
      ctx.save(); ctx.translate(W / 2 + tp.from * (1 - u) * W * 1.2, g.tapeY + tp.dy); ctx.rotate(tp.rot);
      ctx.shadowColor = 'rgba(3,2,15,.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
      ctx.fillStyle = tp.col; ctx.fillRect(-W, -th / 2, W * 2, th);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-W, -th / 2, W * 2, 3);
      ctx.beginPath(); ctx.rect(-W, -th / 2, W * 2, th); ctx.clip();
      const tunit = `${tp.txt}  ✦  `;
      ctx.font = F(800, story ? 38 : 32);
      const tw = ctx.measureText(tunit).width;
      const off = ((t * tp.sp) % tw + tw) % tw;
      ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = tp.ink;
      for (let x = W + off; x > -W - tw; x -= tw) ctx.fillText(tunit, x, 3);
      ctx.restore();
    });

    contactBlock(ctx, S, W, g.pillY, t, 1.3, { h: story ? 80 : 72, size: story ? 34 : 30, bg: 'rgba(13,11,42,.85)' });
    grain(ctx, W, H, 0.06);
  },
};

// =====================================================================================
// 4. سريع — for every day: the photo clear, a small logo plate, one bar with the numbers
// =====================================================================================
const quick = {
  id: 'quick', name: 'سريع',
  photoBox(W, H) { return { x: 0, y: 0, w: W, h: H }; },
  draw(ctx, W, H, t, S, fmt) {
    const story = fmt === 'story';
    ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
    const pu = ease.out(seg(t, 0, 1.2));
    ctx.save(); ctx.globalAlpha = clamp(pu * 1.4);
    photo(ctx, S, this.photoBox(W, H), 1.05 - 0.05 * pu + 0.025 * seg(t, 1.2, DUR));
    ctx.restore();
    // only a low shade under the bar: the product stays clear
    const fy = H * 0.76;
    const fg = ctx.createLinearGradient(0, fy, 0, H);
    fg.addColorStop(0, 'rgba(13,11,42,0)'); fg.addColorStop(1, 'rgba(13,11,42,.55)');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
    laySmoke(ctx, W, H, t, { a: C.orange, b: C.indigo2, amt: 0.7, mode: 'bottom', seed: 9.1, rise: 0.8 }, 0.5);

    // the logo, small and centred: no plate behind it, only the thin rim round its shape (Abbas)
    const lw = story ? 250 : 200, lh = lw * logoRatio();
    const lb = { x: opticalX(W, lw), y: story ? 262 : 52, w: lw, h: lh };
    item(ctx, S, 'logo', lb, () => logoWithSheen(ctx, W, H, { x: lb.x, y: lb.y, w: lw, t: t - 0.25 }, t, [2.2, 5.0]));

    // the bar: an orange frame with white words (Abbas), or filled orange if he picks it
    const bh = story ? 108 : 96, bx = story ? 64 : 60, by = story ? 1556 : 1208;
    const filled = S.info.bar === 'fill';
    titleItem(ctx, S, W, by - (story ? 104 : 90), W - 160, t, 1.0, story ? 58 : 50);
    shopLine(ctx, S, 'line', W, by - (story ? 26 : 22), story ? 34 : 30, t, 0.9);
    item(ctx, S, 'contact', { x: bx, y: by, w: W - 2 * bx, h: bh }, () => {
      const ba = ease.out(seg(t, 0.9, 1.5));
      ctx.save(); ctx.translate(0, (1 - ba) * 50); ctx.globalAlpha *= ba;
      rr(ctx, bx, by, W - 2 * bx, bh, bh / 2);
      if (filled) {
        ctx.save(); ctx.shadowColor = 'rgba(253,145,4,.45)'; ctx.shadowBlur = 36; ctx.fillStyle = C.orange; ctx.fill(); ctx.restore();
      } else {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.lineWidth = 5; ctx.strokeStyle = C.orange; ctx.stroke(); ctx.restore();
      }
      const items = contactItems(S.info).slice(0, 2);
      const half = (W - 2 * bx) / 2;
      const ink = filled ? C.night : C.white;
      const r = story ? 27 : 23, gap = story ? 14 : 12, pad = story ? 30 : 26;
      items.forEach((it, i) => {
        // the right half holds the first item (Arabic reads from the right)
        const h0 = bx + (i === 0 ? half : 0), avail = half - 2 * pad;
        let size = story ? 36 : 31;
        ctx.save(); ctx.font = F(800, size);
        let tw = ctx.measureText(it.text).width;
        const room = avail - 2 * r - gap;
        if (tw > room) { size *= room / tw; tw = room; }
        ctx.restore();
        const group = 2 * r + gap + tw, gx = h0 + (half - group) / 2;   // the group, centred in its half
        const iconX = gx + group - r, cy = by + bh / 2;
        ctx.beginPath(); ctx.arc(iconX, cy, r, 0, Math.PI * 2); ctx.fillStyle = filled ? C.night : C.orange; ctx.fill();
        icon(ctx, it.icon, iconX, cy, r, filled ? C.orange : C.night);
        ctx.save(); if (!filled) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 12; }
        text(ctx, it.text, gx + tw, cy + 2, { size, weight: 800, color: it.ph ? 'rgba(255,255,255,.5)' : ink, align: 'right', dir: 'ltr', base: 'middle' });
        ctx.restore();
      });
      ctx.fillStyle = filled ? 'rgba(13,11,42,.25)' : 'rgba(253,145,4,.6)'; ctx.fillRect(W / 2 - 1.5, by + 24, 3, bh - 48);
      ctx.restore();
    });
    badgeItem(ctx, S, W - (story ? 190 : 160), story ? 1240 : 860, story ? 120 : 100, 1.3, t, { rot: 0.12 });
    grain(ctx, W, H, 0.05);
  },
};

// =====================================================================================
// 5–6. هادئ — calm, the way the big residential projects post (Abbas: «قالب هادئ ولطيف…
//    مريح للعين»): the photo clean and whole, thin white lines, the mark and the name small in the
//    top corners, a big line and a light one bottom-right, the numbers small bottom-left.
//    A: a level line across (its arc went, Abbas).  B: a short stub, a quarter arc down,
//    a straight drop to the bottom edge. The mark and the name are orange (Abbas).
// =====================================================================================
function calmGeo(W, H, fmt, v) {
  const story = fmt === 'story';
  const m = story ? 80 : 70;
  const g = {
    m, story,
    markW: story ? 128 : 110, markY: story ? 268 : 56,
    nameW: story ? 214 : 190, nameY: story ? 282 : 66,
    headR: W - m, headBottom: story ? (v === 1 ? 1520 : 1490) : (v === 1 ? 1146 : 1124),
    headMaxW: W * 0.52, headSize: story ? 94 : 82, subSize: story ? 52 : 44,
    contactX: m, contactY: story ? 1556 : 1206, contactSize: story ? 34 : 29,
  };
  if (v === 1) {
    g.lineY = story ? H * 0.29 : H * 0.315;
    g.lineX1 = W * 0.7;
  } else {
    g.stubY = story ? H * 0.46 : H * 0.44;
    g.stubX = W * 0.08;
    g.r = W * (story ? 0.62 : 0.6);
  }
  return g;
}

function calmLines(ctx, W, H, t, g, v) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = g.story ? 3.2 : 2.8; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10;
  let dot = null;
  if (v === 1) {
    // the level line, from the left edge
    const p1 = ease.inOut(seg(t, 0.35, 1.5));
    if (p1 > 0) { ctx.beginPath(); ctx.moveTo(0, g.lineY); ctx.lineTo(g.lineX1 * p1, g.lineY); ctx.stroke(); }
    dot = { x: g.lineX1, y: g.lineY, at: 1.45 };
  } else {
    // a short stub from the left edge, a quarter arc down, then straight to the bottom edge
    const cx = g.stubX + g.r, cy = g.stubY, bottom = cy + g.r;
    const L1 = g.stubX, L2 = (Math.PI / 2) * g.r, L3 = Math.max(0, H - bottom), L = L1 + L2 + L3;
    const d = L * ease.inOut(seg(t, 0.35, 2.0));
    ctx.beginPath(); ctx.moveTo(0, cy);
    ctx.lineTo(Math.min(d, L1), cy);
    if (d > L1) ctx.arc(cx, cy, g.r, Math.PI, Math.PI - (Math.PI / 2) * Math.min(1, (d - L1) / L2), true);
    if (d > L1 + L2) ctx.lineTo(cx, bottom + (d - L1 - L2));
    ctx.stroke();
    dot = { x: g.stubX, y: cy, at: 0.55 };
  }
  ctx.restore();
  // one small orange point: the only colour on the picture
  const u = ease.back(seg(t, dot.at, dot.at + 0.35));
  if (u > 0) {
    const pulse = 1 + 0.12 * Math.sin(Math.max(0, t - dot.at - 0.35) * 2.4);
    ctx.save(); ctx.translate(dot.x, dot.y); ctx.scale(u * pulse, u * pulse);
    ctx.beginPath(); ctx.arc(0, 0, g.story ? 9 : 8, 0, Math.PI * 2);
    ctx.fillStyle = C.orange; ctx.shadowColor = 'rgba(253,145,4,.7)'; ctx.shadowBlur = 16; ctx.fill();
    ctx.restore();
  }
}

/** split a line in two where the halves come out most even */
function balance2(ctx, s, size, weight) {
  const ws = s.split(/\s+/).filter(Boolean);
  if (ws.length < 2) return [s];
  ctx.save(); ctx.font = F(weight, size);
  let best = null;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(' '), b = ws.slice(i).join(' ');
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    // a headline reads best wider on top («غسالة أوتوماتيك / 9 كيلو»): a short top line costs a little
    const m = Math.max(wa, wb) * (wa < wb ? 1.15 : 1);
    if (!best || m < best.m - 0.5) best = { m, lines: [a, b] };
  }
  ctx.restore();
  return best.lines;
}

/** the big line and the light one under it, right-aligned, kept inside its width */
function calmHead(ctx, S, W, g, t) {
  const head = (S.fields.title || S.info.head || '').trim();
  const sub = (S.fields.badge || S.info.sub || '').trim();
  if (!head && !sub) return;
  let size = g.headSize, lines = head ? wrap(ctx, head, g.headMaxW, size, 800) : [];
  const widest = () => { ctx.save(); ctx.font = F(800, size); const w = Math.max(0, ...lines.map((l) => ctx.measureText(l).width)); ctx.restore(); return w; };
  while (head && (lines.length > 2 || widest() > g.headMaxW) && size > 40) { size *= 0.93; lines = wrap(ctx, head, g.headMaxW, size, 800); }
  if (lines.length === 2) lines = balance2(ctx, head, size, 800);
  let ss = g.subSize;
  ctx.save(); ctx.font = F(300, ss); let sw = sub ? ctx.measureText(sub).width : 0; ctx.restore();
  if (sw > g.headMaxW * 1.15) { ss *= (g.headMaxW * 1.15) / sw; sw = g.headMaxW * 1.15; }
  const lh = size * 1.1, gap = sub && lines.length ? ss * 0.55 : 0;
  const subY = g.headBottom;
  const lastY = sub ? subY - ss * 1.0 - gap : g.headBottom;
  const w = Math.max(widest(), sw);
  const top = lines.length ? lastY - (lines.length - 1) * lh - size * 0.82 : subY - ss;
  const box = { x: g.headR - w, y: top, w, h: g.headBottom - top + ss * 0.3 };
  item(ctx, S, 'headline', box, () => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18;
    lines.forEach((l, i) => {
      const u = ease.out(seg(t, 1.0 + i * 0.13, 1.65 + i * 0.13));
      if (u <= 0) return;
      ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 34);
      text(ctx, l, g.headR, lastY - (lines.length - 1 - i) * lh, { size, weight: 800, align: 'right' });
      ctx.restore();
    });
    if (sub) {
      const u = ease.out(seg(t, 1.35, 2.0));
      if (u > 0) { ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 20); text(ctx, sub, g.headR, subY, { size: ss, weight: 300, align: 'right' }); ctx.restore(); }
    }
    ctx.restore();
  });
}

/** the numbers, small and white, bottom-left: the phone, the account under it */
function calmContact(ctx, S, g, t) {
  const items = contactItems(S.info);
  const sz = g.contactSize, ic = sz * 0.95, rowH = sz * 1.45;
  const fs = (i) => (i === 0 ? sz : sz * 0.86);
  ctx.save();
  const w = Math.max(...items.map((it, i) => { ctx.font = F(i === 0 ? 700 : 400, fs(i)); return ctx.measureText(it.text).width + (i === 0 ? ic : ic * 0.8) + 14; }));
  ctx.restore();
  const box = { x: g.contactX, y: g.contactY, w, h: rowH * items.length };
  item(ctx, S, 'contact', box, () => {
    const u = ease.out(seg(t, 1.5, 2.1));
    ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 16);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14;
    items.forEach((it, i) => {
      const cy = g.contactY + rowH * i + rowH / 2, isz = i === 0 ? ic : ic * 0.8;
      icon(ctx, it.icon, g.contactX + isz / 2, cy, isz, C.white);
      text(ctx, it.text, g.contactX + isz + 14, cy + 2, { size: fs(i), weight: i === 0 ? 700 : 400, align: 'left', dir: it.rtl ? 'rtl' : 'ltr', base: 'middle', color: it.ph ? 'rgba(255,255,255,.55)' : C.white });
    });
    ctx.restore();
  });
}

function makeCalm(id, name, v) {
  return {
    id, name,
    photoBox(W, H) { return { x: 0, y: 0, w: W, h: H }; },
    draw(ctx, W, H, t, S, fmt) {
      const g = calmGeo(W, H, fmt, v);
      ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
      // the photo, whole and clean, coming slowly closer
      const pu = ease.out(seg(t, 0, 0.9));
      ctx.save(); ctx.globalAlpha = pu;
      photo(ctx, S, this.photoBox(W, H), 1.065 - 0.065 * ease.out(seg(t, 0, DUR)));
      ctx.restore();
      // only a breath of shade where the words sit, the middle stays as it is
      const tg = ctx.createLinearGradient(0, 0, 0, H * 0.22);
      tg.addColorStop(0, 'rgba(8,7,24,.42)'); tg.addColorStop(1, 'rgba(8,7,24,0)');
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.22);
      const by = H * 0.6;
      const bg = ctx.createLinearGradient(0, by, 0, H);
      bg.addColorStop(0, 'rgba(8,7,24,0)'); bg.addColorStop(1, 'rgba(8,7,24,.5)');
      ctx.fillStyle = bg; ctx.fillRect(0, by, W, H - by);

      calmLines(ctx, W, H, t, g, v);

      // the mark top-left, the name top-right, both small and orange
      const mh = g.markW * logoRatio('mark');
      const mb = { x: g.m, y: g.markY, w: g.markW, h: mh };
      item(ctx, S, 'logo', mb, () => {
        const u = ease.out(seg(t, 0.5, 1.15));
        ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 14);
        logoRim(ctx, { x: mb.x, y: mb.y, w: mb.w, parts: 'mark', look: 'orange' });
        ctx.restore();
      });
      const nh = g.nameW * logoRatio('text');
      const nb = { x: W - g.m - g.nameW, y: g.nameY, w: g.nameW, h: nh };
      item(ctx, S, 'name', nb, () => {
        const u = ease.out(seg(t, 0.62, 1.25));
        ctx.save(); ctx.globalAlpha *= u; ctx.translate(0, (1 - u) * 14);
        logoRim(ctx, { x: nb.x, y: nb.y, w: nb.w, parts: 'text', look: 'orange' });
        ctx.restore();
      });

      calmHead(ctx, S, W, g, t);
      calmContact(ctx, S, g, t);
      grain(ctx, W, H, 0.035);
    },
  };
}
const calm = makeCalm('calm', 'هادئ', 1);
const calm2 = makeCalm('calm2', 'هادئ 2', 2);

// the calm ones first: Abbas likes them best
export const DESIGNS = [calm, calm2, showroom, cinema, card, quick];

// =====================================================================================
// بطاقة التواصل — the numbers picture, redone: a card with a transparent edge, to lay on
// any photo. 'night' (indigo) or 'sun' (orange).
// =====================================================================================
export const CARD = [1080, 420];
export function drawContactCard(ctx, S, look = 'night') {
  const [W, H] = CARD;
  ctx.save();
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const m = 22, r = 44;
  const sun = look === 'sun';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rr(ctx, m, m, W - 2 * m, H - 2 * m, r);
  const g = ctx.createLinearGradient(0, 0, W, H);
  if (sun) { g.addColorStop(0, C.orange2); g.addColorStop(1, C.orange); } else { g.addColorStop(0, '#2C27A0'); g.addColorStop(1, C.night); }
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.save(); rr(ctx, m, m, W - 2 * m, H - 2 * m, r); ctx.clip();
  // a soft glow and the house line, quietly, behind
  const gl = ctx.createRadialGradient(W - 220, H / 2, 10, W - 220, H / 2, 380);
  gl.addColorStop(0, sun ? 'rgba(255,255,255,.35)' : 'rgba(253,145,4,.28)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save(); rr(ctx, m + 1.5, m + 1.5, W - 2 * m - 3, H - 2 * m - 3, r - 1.5);
  ctx.strokeStyle = sun ? 'rgba(13,11,42,.18)' : 'rgba(253,145,4,.55)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();

  // logo on the right (Arabic reads from there)
  const lw = 300, lh = lw * logoRatio();
  drawLogo(ctx, { x: W - m - 40 - lw, y: (H - lh) / 2, w: lw, look: sun ? 'night' : 'color' });
  ctx.fillStyle = sun ? 'rgba(13,11,42,.22)' : 'rgba(255,255,255,.14)';
  ctx.fillRect(W - m - 40 - lw - 34, 80, 3, H - 160);

  // the shop line and the numbers, on the left
  const right = W - m - 40 - lw - 70, left = m + 46, maxW = right - left;
  const ink = sun ? C.night : C.white;
  const lines = S.info.line ? wrap(ctx, S.info.line, maxW, 38, 800).slice(0, 2) : [];
  const nItems = contactItems(S.info).length;
  let y = lines.length > 1 ? 118 : lines.length ? 138 : (H - nItems * 74) / 2 - 30 + 52;
  lines.forEach((l, i) => text(ctx, l, right, y + i * 48, { size: 38, weight: 800, color: ink, align: 'right', maxW }));
  y += lines.length ? (lines.length - 1) * 48 + 30 : 0;
  const items = contactItems(S.info);
  items.forEach((it, i) => {
    const yy = y + i * 74;
    if (yy > H - 60) return;
    ctx.beginPath(); ctx.arc(right - 26, yy + 26, 26, 0, Math.PI * 2); ctx.fillStyle = sun ? C.night : C.orange; ctx.fill();
    icon(ctx, it.icon, right - 26, yy + 26, 28, sun ? C.orange : C.night);
    text(ctx, it.text, right - 70, yy + 28, { size: 40, weight: 800, color: it.ph ? (sun ? 'rgba(13,11,42,.45)' : 'rgba(255,255,255,.5)') : ink, align: 'right', dir: it.rtl ? 'rtl' : 'ltr', base: 'middle', maxW: maxW - 70 });
  });
  ctx.restore();
}

export function render(ctx, design, fmt, t, S) {
  const [W, H] = FORMATS[fmt];
  ctx.save();
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  if (S.editing) S.boxes = [];
  design.draw(ctx, W, H, t, S, fmt);
  if (S.editing) editOverlay(ctx, W, H, fmt, S);
  ctx.restore();
}

/** while arranging: where Instagram covers the story, and every movable element's box */
function editOverlay(ctx, W, H, fmt, S) {
  const [top, bottom] = SAFE[fmt];
  ctx.save();
  if (fmt === 'story') {
    ctx.fillStyle = 'rgba(200,30,60,.18)';
    ctx.fillRect(0, 0, W, top); ctx.fillRect(0, bottom, W, H - bottom);
    ctx.setLineDash([18, 12]); ctx.strokeStyle = 'rgba(255,90,110,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.moveTo(0, bottom); ctx.lineTo(W, bottom); ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'إنستغرام يغطي هنا', W / 2, top - 40, { size: 34, weight: 700, color: 'rgba(255,255,255,.85)' });
    text(ctx, 'إنستغرام يغطي هنا', W / 2, bottom + 70, { size: 34, weight: 700, color: 'rgba(255,255,255,.85)' });
  } else {
    // the profile grid shows the post cut to 3:4: a thin edge on each side disappears there
    const e = Math.round((W - H * 3 / 4) / 2);
    ctx.fillStyle = 'rgba(200,30,60,.16)'; ctx.fillRect(0, 0, e, H); ctx.fillRect(W - e, 0, e, H);
  }
  for (const b of S.boxes) {
    const on = b.id === S.sel;
    ctx.setLineDash(on ? [] : [14, 10]);
    ctx.lineWidth = on ? 6 : 3;
    ctx.strokeStyle = on ? C.orange : 'rgba(255,255,255,.85)';
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8;
    rr(ctx, b.x - 10, b.y - 10, b.w + 20, b.h + 20, 18); ctx.stroke();
    ctx.shadowBlur = 0; ctx.setLineDash([]);
    if (on) {
      for (const [hx, hy] of [[b.x - 10, b.y - 10], [b.x + b.w + 10, b.y - 10], [b.x - 10, b.y + b.h + 10], [b.x + b.w + 10, b.y + b.h + 10]]) {
        ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.fillStyle = C.orange; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = C.white; ctx.stroke();
      }
      const label = ITEM_NAMES[b.id] || b.id;
      ctx.font = F(800, 30); const lw = ctx.measureText(label).width + 36;
      const ly = b.y - 64 < 10 ? b.y + b.h + 24 : b.y - 64;
      rr(ctx, b.x + b.w / 2 - lw / 2, ly, lw, 46, 23); ctx.fillStyle = C.orange; ctx.fill();
      text(ctx, label, b.x + b.w / 2, ly + 33, { size: 28, weight: 800, color: C.night });
    }
  }
  ctx.restore();
}
