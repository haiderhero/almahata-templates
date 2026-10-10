// المحطة للتقسيط — the brand on a canvas: colours, the logo (traced mark + Almarai lettering,
// so it is sharp at any size) and its entrance: the house draws itself, the hand passes the
// coin, the pie slices and % pop in, the name wipes in from the right.

export const C = {
  orange: '#FD9104', orange2: '#FFB347', ember: '#FF6A00',
  indigo: '#26227A', indigo2: '#4B3FD8', night: '#0D0B2A', deep: '#15123F',
  white: '#FFFFFF', cream: '#FFF6EA',
};

export const brand = { ready: false };

export async function loadBrand(base = '.') {
  const faces = [
    ['Almarai', 'Almarai-Light.ttf', 300], ['Almarai', 'Almarai-Regular.ttf', 400],
    ['Almarai', 'Almarai-Bold.ttf', 700], ['Almarai', 'Almarai-ExtraBold.ttf', 800],
  ];
  await Promise.all(faces.map(async ([fam, file, weight]) => {
    const f = new FontFace(fam, `url(${base}/fonts/${file})`, { weight: String(weight) });
    document.fonts.add(await f.load());
  }));
  const m = await (await fetch(`${base}/assets/mark.json`)).json();
  brand.pieces = m.pieces.map((p) => ({ ...p, path: new Path2D(p.d), cx: (p.bbox[0] + p.bbox[2]) / 2, cy: (p.bbox[1] + p.bbox[3]) / 2 }));
  brand.houseLine = m.house_line;
  brand.houseLen = m.house_line.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - m.house_line[i][0], p[1] - m.house_line[i][1]), 0);
  brand.text = m.text;
  brand.box = m.box;            // the logo's extent in the 1280 source
  brand.ready = true;
  // where each part's weight sits, as a fraction of its width right of the box centre
  brand.nudge = {};
  for (const parts of ['all', 'mark', 'icons', 'text']) {
    const b = logoBox(parts), w = 320, h = Math.round((w * (b[3] - b[1])) / (b[2] - b[0]));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    drawLogo(x, { x: 0, y: 0, w, parts });
    const d = x.getImageData(0, 0, w, h).data;
    let mass = 0, mx = 0;
    for (let i = 3, px = 0; i < d.length; i += 4, px++) { mass += d[i]; mx += d[i] * (px % w); }
    brand.nudge[parts] = mass ? (w / 2 - mx / mass) / w : 0;
  }
}

/** the x that centres a logo of width w in a space of width W by its weight, not its box */
export function opticalX(W, w, parts = 'all') { return (W - w) / 2 + w * 0.9 * ((brand.nudge && brand.nudge[parts]) || 0); }

// ---------- easing ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
};

/**
 * Draw the logo.
 *  x, y   top-left of the logo box; w its width (height follows the logo's ratio)
 *  t      seconds since the logo's entrance began (Infinity = settled)
 *  look   'color' (orange mark, white letters) | 'white' | 'orange' (all orange) | 'indigo' (orange mark, indigo letters) | 'night' (all indigo, for orange grounds)
 *  parts  'all' | 'mark' (house + icons) | 'icons' (no house) | 'text'
 *  the box (and so x, y, w) is the extent of the parts drawn
 */
export const BOXES = { all: null, mark: [130, 240, 870, 940], icons: [450, 248, 868, 590], text: [262, 650, 1158, 952] };
export function logoBox(parts = 'all') { return BOXES[parts] || brand.box; }

export function drawLogo(ctx, { x, y, w, t = Infinity, look = 'color', parts = 'all', glow = 0 }) {
  if (!brand.ready) return;
  const [bx0, by0, bx1] = logoBox(parts);
  const k = w / (bx1 - bx0);
  const markCol = look === 'white' ? C.white : look === 'night' ? C.night : C.orange;
  const textCol = look === 'indigo' || look === 'night' ? C.night : look === 'orange' ? C.orange : C.white;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-bx0, -by0);
  if (glow) { ctx.shadowColor = 'rgba(253,145,4,0.55)'; ctx.shadowBlur = glow / k; }

  const withHouse = parts === 'all' || parts === 'mark';
  const withIcons = withHouse || parts === 'icons';
  const withText = parts === 'all' || parts === 'text';
  if (withIcons) {
    // the house: the traced shape, revealed along its centre line
    const house = brand.pieces.find((p) => p.name === 'house');
    const draw = withHouse ? ease.inOut(seg(t, 0, 1.1)) : 0;
    if (draw >= 1) {
      ctx.fillStyle = markCol; ctx.fill(house.path);
    } else if (draw > 0) {
      // a fat dashed stroke along the centre line, used as a mask over the traced shape
      const line = new Path2D();
      line.moveTo(...brand.houseLine[0]);
      for (const p of brand.houseLine.slice(1)) line.lineTo(...p);
      const m = maskCanvas(ctx.canvas);
      const mc = m.getContext('2d');
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.clearRect(0, 0, m.width, m.height);
      mc.setTransform(ctx.getTransform());
      mc.setLineDash([brand.houseLen * draw, brand.houseLen * 2]);
      mc.lineWidth = 92; mc.lineCap = 'round'; mc.lineJoin = 'round';
      mc.strokeStyle = '#000'; mc.stroke(line);
      mc.setLineDash([]);
      mc.globalCompositeOperation = 'source-in';
      mc.fillStyle = markCol; mc.fill(house.path);
      mc.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(m, 0, 0); ctx.restore();
    }
    // the rest of the mark
    const T = {
      hand: [0.55, 1.05], coin: [0.8, 1.35], pie_big: [0.9, 1.35], pie_right: [1.0, 1.45], pie_top: [1.1, 1.55],
      pct_a: [1.15, 1.5], pct_slash: [1.2, 1.55], pct_b: [1.25, 1.6], dash: [1.2, 1.7],
    };
    for (const p of brand.pieces) {
      if (p.name === 'house') continue;
      const [a, b] = T[p.name] || [1, 1.4];
      const u = seg(t, a, b);
      if (u <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= clamp(u * 2.5);
      if (p.name === 'hand') {
        const e = ease.out(u); ctx.translate((1 - e) * 60, (1 - e) * 40);
      } else if (p.name === 'coin') {
        const e = ease.back(u); ctx.translate(0, (1 - e) * -120);
        if (t > 1.6 && Number.isFinite(t)) ctx.translate(0, Math.sin((t - 1.6) * 2.2) * 5);
      } else if (p.name.startsWith('pie') || p.name.startsWith('pct')) {
        const e = ease.back(u); const s = 0.4 + 0.6 * e;
        ctx.translate(p.cx, p.cy); ctx.scale(s, s); ctx.translate(-p.cx, -p.cy);
      } else if (p.name === 'dash') {
        const e = ease.out(u); ctx.translate((1 - e) * -50, (1 - e) * 22);
      }
      ctx.fillStyle = markCol;
      ctx.fill(p.path, 'evenodd');
      ctx.restore();
    }
  }

  if (withText) {
    ctx.shadowBlur = 0;
    const { big, small } = brand.text;
    // the name wipes in from the right (Arabic reads right to left)
    const u = ease.inOut(seg(t, 0.45, 1.15));
    if (u > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(big.x - (big.x - 240) * u - 20, 560, (big.x - 240) * u + 60, 330); ctx.clip();
      text(ctx, big, textCol);
      ctx.restore();
    }
    const v = ease.out(seg(t, 1.0, 1.5));
    if (v > 0) {
      ctx.save(); ctx.globalAlpha *= v; ctx.translate(0, (1 - v) * 18);
      text(ctx, small, textCol);
      ctx.restore();
    }
  }
  ctx.restore();
}

function text(ctx, s, col) {
  ctx.save();
  ctx.font = `${s.weight} ${s.size}px ${s.font}`;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = col;
  ctx.translate(s.x, s.y); ctx.scale(s.sx, 1);
  ctx.fillText(s.t, 0, 0);
  ctx.restore();
}

const masks = new WeakMap();
function maskCanvas(c) {
  let m = masks.get(c);
  if (!m || m.width !== c.width || m.height !== c.height) {
    m = document.createElement('canvas'); m.width = c.width; m.height = c.height; masks.set(c, m);
  }
  return m;
}

export const logoRatio = (parts = 'all') => { const b = logoBox(parts); return (b[3] - b[1]) / (b[2] - b[0]); };
