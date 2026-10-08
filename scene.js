// The designs. Each one draws a whole frame (photo, brand, contact, motion) for time t,
// in story (1080×1920) or post (1080×1350). The preview, the saved picture and the saved
// video all come from this one function, so what Abbas sees is what he gets.
import { C, brand, drawLogo, logoRatio, ease, seg, clamp } from './brand.js';
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

/** a centred row of pills (wraps to two rows if needed); returns the height used */
function pills(ctx, cx, y, maxW, info, { h = 84, size = 36, bg = 'rgba(13,11,42,.72)', fg = C.white, dot = C.orange, dotFg = C.night, stroke = 'rgba(255,255,255,.14)', gap = 18, a = 1 } = {}) {
  const items = contactItems(info);
  ctx.save(); ctx.font = F(700, size);
  const ws = items.map((i) => ctx.measureText(i.text).width + h + 34);
  ctx.restore();
  const rows = [];
  let row = [], rw = 0;
  items.forEach((it, i) => {
    if (row.length && rw + gap + ws[i] > maxW) { rows.push([row, rw]); row = []; rw = 0; }
    rw += (row.length ? gap : 0) + ws[i]; row.push(i);
  });
  rows.push([row, rw]);
  ctx.save(); ctx.globalAlpha *= a;
  rows.forEach(([r, total], ri) => {
    // right to left: the first item sits on the right
    let x = cx + total / 2;
    const yy = y + ri * (h + 14);
    for (const i of r) {
      const w = Math.min(ws[i], maxW), it = items[i];
      x -= w;
      rr(ctx, x, yy, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x + w - h / 2, yy + h / 2, h / 2 - 9, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill();
      icon(ctx, it.icon, x + w - h / 2, yy + h / 2, h * 0.42, dotFg);
      text(ctx, it.text, x + w - h - 12, yy + h / 2 + 2, { size, weight: 700, color: it.ph ? 'rgba(255,255,255,.55)' : fg, align: 'right', dir: it.rtl ? 'rtl' : 'ltr', base: 'middle', maxW: w - h - 30 });
      x -= gap;
    }
  });
  ctx.restore();
  return rows.length * h + (rows.length - 1) * 14;
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
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L, 0, 0); ctx.restore();
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
// 1. البيت — the photo lives inside the logo's house; the house draws itself around it
// =====================================================================================
function houseGeo(W, H, fmt) {
  if (fmt === 'story') return { L: 120, R: 960, peak: 370, bottom: 1290 };
  return { L: 150, R: 930, peak: 92, bottom: 905 };
}
function housePath(g, r = 30) {
  const cx = (g.L + g.R) / 2, eave = g.peak + (g.R - g.L) / 2 * 0.84;
  const p = new Path2D();
  const pts = [[cx, g.peak], [g.R, eave], [g.R, g.bottom], [g.L, g.bottom], [g.L, eave]];
  p.moveTo((cx + g.R) / 2, (g.peak + eave) / 2);
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i % pts.length], b = pts[(i + 1) % pts.length];
    p.arcTo(a[0], a[1], b[0], b[1], r);
  }
  p.closePath();
  // the outline as two halves, from the middle of the floor up to the roof's peak, so it can
  // draw itself from both sides at once and meet at the top
  const half = (side) => {
    const q = new Path2D();
    const x = side > 0 ? g.R : g.L;
    const way = [[x, g.bottom], [x, eave], [cx, g.peak]];
    q.moveTo(cx, g.bottom);
    q.arcTo(way[0][0], way[0][1], way[1][0], way[1][1], r);
    q.arcTo(way[1][0], way[1][1], way[2][0], way[2][1], r);
    q.lineTo(cx, g.peak);
    return q;
  };
  const halfLen = (g.R - g.L) / 2 + (g.bottom - eave) + Math.hypot(g.R - cx, eave - g.peak);
  return { p, eave, cx, halves: [half(1), half(-1)], halfLen };
}

const house = {
  id: 'house', name: 'البيت',
  photoBox(W, H, fmt) { const g = houseGeo(W, H, fmt); return { x: g.L, y: g.peak, w: g.R - g.L, h: g.bottom - g.peak }; },
  draw(ctx, W, H, t, S, fmt) {
    const g = houseGeo(W, H, fmt); const hp = housePath(g);
    // ground: night indigo, an orange glow behind the house, smoke all round
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1A1650'); bg.addColorStop(0.55, C.night); bg.addColorStop(1, '#07061A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createRadialGradient(W / 2, (g.peak + g.bottom) / 2, 50, W / 2, (g.peak + g.bottom) / 2, W * 0.85);
    gl.addColorStop(0, `rgba(253,145,4,${0.30 + 0.05 * Math.sin(t * 1.6)})`); gl.addColorStop(1, 'rgba(253,145,4,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    laySmoke(ctx, W, H, t, { a: C.orange, b: C.indigo2, amt: 0.9, mode: 'ends', seed: 1.7 }, 0.85);

    // the photo, inside the house
    const pu = ease.out(seg(t, 0.25, 1.3));
    ctx.save(); ctx.clip(hp.p);
    ctx.globalAlpha = pu;
    photo(ctx, S, this.photoBox(W, H, fmt), 1.1 - 0.08 * pu + 0.025 * seg(t, 1.3, DUR));
    // a little night at the foot of the photo, for the title
    if (S.fields.title) {
      const sh = ctx.createLinearGradient(0, g.bottom - 360, 0, g.bottom);
      sh.addColorStop(0, 'rgba(13,11,42,0)'); sh.addColorStop(1, 'rgba(13,11,42,.88)');
      ctx.fillStyle = sh; ctx.fillRect(g.L, g.bottom - 360, g.R - g.L, 360);
    }
    ctx.restore();

    // the orange house line, drawn on
    const d = ease.inOut(seg(t, 0, 1.15));
    ctx.save();
    ctx.lineWidth = fmt === 'story' ? 26 : 22; ctx.strokeStyle = C.orange; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(253,145,4,.55)'; ctx.shadowBlur = 30;
    if (d >= 1) ctx.stroke(hp.p);
    else if (d > 0) {
      ctx.setLineDash([hp.halfLen * d, hp.halfLen * 2]);
      for (const q of hp.halves) ctx.stroke(q);
    }
    ctx.restore();

    // the logo's icons ride the right side of the roof, as in the logo
    const iw = fmt === 'story' ? 330 : 250;
    const ix = g.R - iw * 0.86, iy = Math.max(fmt === 'story' ? 230 : 18, g.peak - iw * logoRatio('icons') * 0.42);
    ctx.save(); ctx.shadowColor = 'rgba(7,6,26,.7)'; ctx.shadowBlur = 40;
    drawLogo(ctx, { x: ix, y: iy, w: iw, t: t - 0.55, parts: 'icons' });
    ctx.restore();

    title(ctx, S.fields.title, W / 2, g.bottom - (fmt === 'story' ? 64 : 52), g.R - g.L - 120, t, 1.3, fmt === 'story' ? 64 : 56);
    const eave = g.peak + (g.R - g.L) / 2 * 0.84;
    badge(ctx, S.fields.badge, g.L + 30, eave + (fmt === 'story' ? 70 : 40), fmt === 'story' ? 128 : 104, 1.45, t, { rot: -0.16 });

    // the name under the house, and how to reach the shop
    const tw = fmt === 'story' ? 560 : 470;
    const ty = g.bottom + (fmt === 'story' ? 52 : 34);
    drawLogo(ctx, { x: (W - tw) / 2, y: ty, w: tw, t: t - 0.3, parts: 'text' });
    const py = ty + tw * logoRatio('text') + (fmt === 'story' ? 34 : 24);
    const pa = ease.out(seg(t, 1.25, 1.8));
    ctx.save(); ctx.translate(0, (1 - pa) * 30);
    pills(ctx, W / 2, py, W - 140, S.info, { a: pa, h: fmt === 'story' ? 84 : 76, size: fmt === 'story' ? 36 : 32 });
    ctx.restore();
    grain(ctx, W, H, 0.06);
  },
};

// =====================================================================================
// 2. سينما — the photo full screen, the logo at the top, smoke rising at the foot
// =====================================================================================
const cinema = {
  id: 'cinema', name: 'سينما',
  photoBox(W, H) { return { x: 0, y: 0, w: W, h: H }; },
  draw(ctx, W, H, t, S, fmt) {
    const story = fmt === 'story';
    ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
    const pu = ease.expo(seg(t, 0, 1.6));
    ctx.save(); ctx.globalAlpha = clamp(pu * 1.5);
    photo(ctx, S, this.photoBox(W, H), 1.14 - 0.12 * pu + 0.035 * seg(t, 1.6, DUR));
    ctx.restore();
    // grade: indigo in the shadows, a vignette
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(38,34,122,.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, 'rgba(7,6,26,0)'); vg.addColorStop(1, 'rgba(7,6,26,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // top and foot in night indigo
    const topH = story ? 860 : 520;
    const tg = ctx.createLinearGradient(0, 0, 0, topH);
    tg.addColorStop(0, 'rgba(13,11,42,.95)'); tg.addColorStop(0.62, 'rgba(13,11,42,.78)'); tg.addColorStop(1, 'rgba(13,11,42,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, topH);
    const fy = story ? 1040 : 740;
    const fg = ctx.createLinearGradient(0, fy, 0, H);
    fg.addColorStop(0, 'rgba(13,11,42,0)'); fg.addColorStop(0.45, 'rgba(13,11,42,.78)'); fg.addColorStop(1, 'rgba(10,8,32,.97)');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
    laySmoke(ctx, W, H, t, { a: C.orange, b: C.indigo2, amt: 1.15, mode: 'bottom', seed: 4.2, rise: 1.2 }, 0.95);

    // viewfinder corners
    const cu = ease.out(seg(t, 0.15, 0.85));
    const m = story ? 56 : 44, L = (story ? 96 : 80) * cu;
    ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.globalAlpha = cu;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
    }
    ctx.restore();

    // the logo
    const lw = story ? 520 : 400;
    logoWithSheen(ctx, W, H, { x: (W - lw) / 2, y: story ? 255 : 66, w: lw, t: t - 0.2, glow: 0 }, t);

    // foot, from the bottom up: how to reach the shop, the shop line, the product
    const ca = ease.out(seg(t, 1.05, 1.7));
    const py = story ? 1478 : 1176;
    ctx.save(); ctx.translate(0, (1 - ca) * 40); ctx.globalAlpha = ca;
    pills(ctx, W / 2, py, W - 120, S.info, { h: story ? 84 : 74, size: story ? 36 : 31 });
    if (S.info.line) {
      ctx.fillStyle = C.orange; rr(ctx, W / 2 - 60, py - 32, 120, 8, 4); ctx.fill();
      text(ctx, S.info.line, W / 2, py - 56, { size: story ? 40 : 34, weight: 800, maxW: W - 150 });
    }
    ctx.restore();
    title(ctx, S.fields.title, W / 2, py - (story ? 150 : 130), W - 160, t, 1.0, story ? 66 : 54);
    badge(ctx, S.fields.badge, W - (story ? 200 : 170), story ? 1020 : 700, story ? 130 : 108, 1.4, t, { rot: 0.12 });
    grain(ctx, W, H, 0.07);
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
      ? { cx: 540, top: 604, pw: 660, ph: 660, b: 28, cap: 136, rot: -0.06, logoW: 470, logoY: 236, tapeY: 1474, pillY: 1566, sun: 300, mark: 300 }
      : { cx: 540, top: 282, pw: 560, ph: 560, b: 22, cap: 116, rot: -0.06, logoW: 300, logoY: 40, tapeY: 1032, pillY: 1128, sun: 240, mark: 230 };
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

    // the sun rising behind the polaroid's top corner, its rings turning
    const su = ease.out(seg(t, 0.1, 1.3));
    // low enough on the right that it never sits behind the (orange) logo
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
    ctx.save(); ctx.shadowColor = 'rgba(253,145,4,.25)'; ctx.shadowBlur = 40;
    drawLogo(ctx, { x: (W - g.logoW) / 2, y: g.logoY, w: g.logoW, t });
    ctx.restore();

    // the polaroid drops in and swings to rest
    const cu = ease.back(seg(t, 0.3, 1.2));
    const rot = g.rot + (1 - cu) * 0.22;
    ctx.save(); ctx.globalAlpha = clamp(cu * 2.2);
    ctx.translate(ccx, ccy - (1 - cu) * 420); ctx.rotate(rot); ctx.translate(-cw / 2, -ch / 2);
    ctx.save(); ctx.shadowColor = 'rgba(3,2,15,.65)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 34;
    rr(ctx, 0, 0, cw, ch, 14); ctx.fillStyle = C.cream; ctx.fill(); ctx.restore();
    rr(ctx, g.b, g.b, g.pw, g.ph, 6); ctx.save(); ctx.clip();
    photo(ctx, S, { x: g.b, y: g.b, w: g.pw, h: g.ph }, 1.07 - 0.05 * seg(t, 0.3, DUR));
    // a gloss passing over the print
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
    // the caption: the product, or the shop's name
    const capY = g.b + g.ph + g.cap / 2;
    if (S.fields.title) {
      let size = story ? 54 : 44; let lines = wrap(ctx, S.fields.title, g.pw - 40, size, 800);
      if (lines.length > 1) { size *= 0.84; lines = wrap(ctx, S.fields.title, g.pw - 40, size, 800).slice(0, 2); }
      lines.forEach((l, i) => text(ctx, l, cw / 2, capY + (i - (lines.length - 1) / 2) * size * 1.15 + size * 0.36, { size, weight: 800, color: C.night, maxW: g.pw - 40 }));
    } else {
      const mw = g.mark, mh = mw * logoRatio('text');
      drawLogo(ctx, { x: (cw - mw) / 2, y: capY - mh / 2, w: mw, parts: 'text', look: 'indigo', t: t - 0.9 });
    }
    // a strip of tape holding it to the wall
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

    badge(ctx, S.fields.badge, ccx + cw / 2 - 20, g.top + 30, story ? 122 : 100, 1.45, t, { rot: 0.18, shape: 'burst' });

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

    const pa = ease.out(seg(t, 1.3, 1.85));
    ctx.save(); ctx.translate(0, (1 - pa) * 30);
    pills(ctx, W / 2, g.pillY, W - 120, S.info, { a: pa, h: story ? 84 : 74, size: story ? 36 : 31, bg: 'rgba(13,11,42,.85)' });
    ctx.restore();
    grain(ctx, W, H, 0.06);
  },
};

// =====================================================================================
// 4. سريع — for every day: the photo, a neat logo plate, one orange bar
// =====================================================================================
const quick = {
  id: 'quick', name: 'سريع',
  photoBox(W, H) { return { x: 0, y: 0, w: W, h: H }; },
  draw(ctx, W, H, t, S, fmt) {
    const story = fmt === 'story';
    ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
    const pu = ease.out(seg(t, 0, 1.2));
    ctx.save(); ctx.globalAlpha = clamp(pu * 1.4);
    photo(ctx, S, this.photoBox(W, H), 1.06 - 0.06 * pu + 0.03 * seg(t, 1.2, DUR));
    ctx.restore();
    const topH = story ? 560 : 380;
    const tg = ctx.createLinearGradient(0, 0, 0, topH);
    tg.addColorStop(0, 'rgba(13,11,42,.55)'); tg.addColorStop(1, 'rgba(13,11,42,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, topH);
    const fy = story ? 1120 : 800;
    const fg = ctx.createLinearGradient(0, fy, 0, H);
    fg.addColorStop(0, 'rgba(13,11,42,0)'); fg.addColorStop(0.4, 'rgba(13,11,42,.62)'); fg.addColorStop(1, 'rgba(13,11,42,.9)');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
    laySmoke(ctx, W, H, t, { a: C.orange, b: C.indigo2, amt: 0.75, mode: 'bottom', seed: 9.1, rise: 0.8 }, 0.7);

    // the logo plate
    const lw = story ? 330 : 250, lh = lw * logoRatio();
    const padX = story ? 44 : 34, padY = story ? 30 : 24;
    const px = (W - lw) / 2 - padX, py = (story ? 250 : 46) - padY;
    const pa = ease.back(seg(t, 0.1, 0.7));
    ctx.save(); ctx.translate(W / 2, py + (lh + 2 * padY) / 2); ctx.scale(0.85 + 0.15 * pa, 0.85 + 0.15 * pa); ctx.translate(-W / 2, -(py + (lh + 2 * padY) / 2));
    ctx.globalAlpha = clamp(pa);
    rr(ctx, px, py, lw + 2 * padX, lh + 2 * padY, 36);
    ctx.fillStyle = 'rgba(13,11,42,.74)'; ctx.fill();
    ctx.strokeStyle = 'rgba(253,145,4,.55)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    logoWithSheen(ctx, W, H, { x: (W - lw) / 2, y: py + padY, w: lw, t: t - 0.25 }, t, [2.2, 5.0]);

    // foot
    const ba = ease.out(seg(t, 0.9, 1.5));
    const bh = story ? 132 : 112, by = story ? 1500 : 1170, bx = story ? 60 : 56;
    ctx.save(); ctx.translate(0, (1 - ba) * 60); ctx.globalAlpha = ba;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18;
    text(ctx, S.info.line, W / 2, by - (story ? 34 : 28), { size: story ? 36 : 30, weight: 700, maxW: W - 140 });
    ctx.restore();
    ctx.shadowColor = 'rgba(253,145,4,.45)'; ctx.shadowBlur = 40;
    rr(ctx, bx, by, W - 2 * bx, bh, bh / 2); ctx.fillStyle = C.orange; ctx.fill();
    ctx.shadowColor = 'transparent';
    // inside the bar: phone on the right, Instagram on the left
    const items = contactItems(S.info).slice(0, 2);
    const half = (W - 2 * bx) / 2;
    items.forEach((it, i) => {
      const cx = bx + half * (i === 0 ? 1.5 : 0.5);
      ctx.save(); ctx.font = F(800, story ? 40 : 34); const tw = Math.min(ctx.measureText(it.text).width, half - 120); ctx.restore();
      const iconX = cx + tw / 2 + 30;
      ctx.beginPath(); ctx.arc(iconX, by + bh / 2, story ? 30 : 26, 0, Math.PI * 2); ctx.fillStyle = C.night; ctx.fill();
      icon(ctx, it.icon, iconX, by + bh / 2, story ? 30 : 26, C.orange);
      text(ctx, it.text, cx - 14, by + bh / 2 + 2, { size: story ? 40 : 34, weight: 800, color: it.ph ? 'rgba(13,11,42,.5)' : C.night, align: 'center', dir: 'ltr', base: 'middle', maxW: half - 120 });
    });
    ctx.fillStyle = 'rgba(13,11,42,.25)'; ctx.fillRect(W / 2 - 1.5, by + 26, 3, bh - 52);
    ctx.restore();
    title(ctx, S.fields.title, W / 2, by - (story ? 110 : 94), W - 160, t, 1.0, story ? 62 : 52);
    badge(ctx, S.fields.badge, W - (story ? 190 : 160), story ? 1180 : 860, story ? 120 : 100, 1.3, t, { rot: 0.12 });
    grain(ctx, W, H, 0.05);
  },
};

export const DESIGNS = [house, cinema, card, quick];

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
  design.draw(ctx, W, H, t, S, fmt);
  ctx.restore();
}
