// The editor: pick a showroom photo, pick a design and a size, move the photo with a finger,
// then save a picture or a moving video and send it straight to Instagram.
import { loadBrand, drawLogo } from './brand.js';
import { DESIGNS, FORMATS, STILL, DUR, render, photoRect, drawContactCard, CARD, ITEM_NAMES } from './scene.js';
import { savePicture, saveVideo } from './export.js';

const $ = (id) => document.getElementById(id);
const KEY = 'mahatta.info.v2';
// the shop's own details are the defaults; Abbas can change any of them from ⚙
const DEFAULT_INFO = {
  line: 'متجر المحطة لتقسيط الأجهزة الكهربائية والمنزلية',
  phone: '0774 068 1484', insta: 'elect.ronicsstation', place: '',
  tape: 'تقسيط الأجهزة الكهربائية والمنزلية',
  bar: 'outline',                         // the numbers bar in «سريع»: an orange frame, white words (Abbas)
};
const store = {
  get() { try { return { ...DEFAULT_INFO, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_INFO }; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: keep for this visit */ } },
};

const S = { img: null, view: { z: 1, x: 0, y: 0 }, info: store.get(), fields: { title: '', badge: '' }, layout: {}, editing: false, sel: null, boxes: [] };
let design = DESIGNS[0];
let fmt = 'story';

// where Abbas put each element, per design and size: { house: { story: { logo: {dx, dy, s} } } }
const LKEY = 'mahatta.layout.v1';
const layouts = (() => { try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch { return {}; } })();
const saveLayouts = () => { try { localStorage.setItem(LKEY, JSON.stringify(layouts)); } catch { /* private mode */ } };
function layoutFor(d, f) { const a = (layouts[d.id] ||= {}); return (a[f] ||= {}); }
S.layout = layoutFor(design, fmt);
const plain = () => ({ ...S, editing: false, boxes: null });   // what gets saved: no guides
let playing = true, holdUntil = 0, t0 = performance.now();

await loadBrand('.');

// ---------- header mark ----------
{
  const c = $('mini'), x = c.getContext('2d');
  drawLogo(x, { x: 0, y: 0, w: c.width });
}

// ---------- preview ----------
const view = $('view'), vctx = view.getContext('2d');
function sizeView() {
  const r = view.getBoundingClientRect();
  const [W, H] = FORMATS[fmt];
  const w = Math.min(W, Math.round(r.width * Math.min(devicePixelRatio || 1, 3)));
  const h = Math.round(w * H / W);
  if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
}
new ResizeObserver(sizeView).observe(view);

function frame(now) {
  let t;
  if (!playing || now < holdUntil || S.editing) t = STILL;
  else t = ((now - t0) / 1000) % (DUR + 0.6);
  render(vctx, design, fmt, Math.min(t, DUR), S);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('play').addEventListener('click', () => {
  playing = !playing; t0 = performance.now();
  $('play').setAttribute('aria-label', playing ? 'إيقاف الحركة' : 'تشغيل الحركة');
  $('playIcon').innerHTML = playing
    ? '<rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/>'
    : '<path d="M4 2.5v11l9-5.5z"/>';
});

// ---------- design thumbnails ----------
const thumbs = DESIGNS.map((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  const c = document.createElement('canvas');
  b.append(c, document.createTextNode(d.name));
  b.addEventListener('click', () => { design = d; S.layout = layoutFor(design, fmt); S.sel = null; panel(); markDesign(); restart(); });
  $('designs').append(b);
  return { d, b, c };
});
function markDesign() { thumbs.forEach(({ d, b }) => b.classList.toggle('on', d === design)); }
let thumbTimer = 0;
function drawThumbs() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    const [W, H] = FORMATS[fmt];
    for (const { d, c } of thumbs) {
      c.width = 216; c.height = Math.round(216 * H / W);
      render(c.getContext('2d'), d, fmt, STILL, { ...plain(), layout: layoutFor(d, fmt) });
    }
  }, 60);
}
markDesign(); drawThumbs();

function restart() { t0 = performance.now(); }

// ---------- size ----------
$('fmt').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  fmt = b.dataset.f;
  [...$('fmt').children].forEach((x) => x.classList.toggle('on', x === b));
  $('frame').classList.toggle('post', fmt === 'post');
  $('designs').classList.toggle('post', fmt === 'post');
  S.layout = layoutFor(design, fmt); S.sel = null; panel();
  sizeView(); clampView(); drawThumbs(); restart();
});

// ---------- photo ----------
$('file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    S.img = await loadPhoto(f);
    S.view = { z: 1, x: 0, y: 0 };
    $('pickLabel').textContent = 'غيّر الصورة';
    $('hint').textContent = 'حرّك الصورة بإصبعك، وقرّب أو بعّد بإصبعين';
    drawThumbs(); restart();
  } catch (err) {
    alert('ما گدرت أفتح هاي الصورة، جرّب صورة ثانية.');
  }
  e.target.value = '';
});

async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.src = url; await im.decode();
    // phone photos are huge: shrink once so every frame stays light
    const max = 2200, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// demo photo for previews: ?demo=1
const demo = new URLSearchParams(location.search).get('demo');
if (demo) {
  const im = new Image(); im.src = `demo/showroom-${demo}.jpg`;
  im.decode().then(() => { S.img = im; $('pickLabel').textContent = 'غيّر الصورة'; setMode(mode); drawThumbs(); }).catch(() => {});
}

// ---------- move / zoom the photo ----------
const pts = new Map();
let last = null, lastTap = 0;
function gesture() {
  const p = [...pts.values()];
  if (p.length === 1) return { x: p[0].x, y: p[0].y, d: 0 };
  const [a, b] = p;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}
function clampView() {
  if (!S.img) return;
  const [W, H] = FORMATS[fmt];
  const box = design.photoBox(W, H, fmt);
  S.view.z = Math.min(4, Math.max(1, S.view.z));
  const r = photoRect(S.img, box, { z: S.view.z, x: 0, y: 0 });
  S.view.x = Math.max(-r.mx / box.w, Math.min(r.mx / box.w, S.view.x));
  S.view.y = Math.max(-r.my / box.h, Math.min(r.my / box.h, S.view.y));
}
// ---------- arrange: move and size every element ----------
let mode = 'photo', drag = null, pinch = null;
function toDesign(e) {
  const r = view.getBoundingClientRect(); const [W, H] = FORMATS[fmt];
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function panel() {
  const o = S.sel ? (S.layout[S.sel] || {}) : null;
  $('selName').textContent = S.sel ? `المختار: ${ITEM_NAMES[S.sel] || S.sel}` : 'اضغط على أي شي بالتصميم حتى تختاره';
  $('size').disabled = !S.sel; $('resetOne').disabled = !S.sel;
  $('size').value = Math.round((o?.s ?? 1) * 100);
  $('sizeOut').textContent = `${$('size').value}%`;
}
function setMode(m) {
  mode = m; S.editing = m === 'arrange'; if (!S.editing) S.sel = null;
  [...$('modes').children].forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  $('arrange').hidden = !S.editing;
  $('hint').textContent = S.editing
    ? 'اضغط على أي شي واسحبه لمكانه، وكبّره أو صغّره بإصبعين أو بالشريط'
    : (S.img ? 'حرّك الصورة بإصبعك، وقرّب أو بعّد بإصبعين' : 'اختار صورة من المعرض حتى تطلع داخل التصميم');
  panel();
}
$('modes').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) setMode(b.dataset.m); });
const keep = (id) => (S.layout[id] ||= {});
function commit() { saveLayouts(); drawThumbs(); }
$('size').addEventListener('input', () => {
  if (!S.sel) return;
  keep(S.sel).s = Number($('size').value) / 100; $('sizeOut').textContent = `${$('size').value}%`;
});
$('size').addEventListener('change', commit);
$('resetOne').addEventListener('click', () => { if (S.sel) { delete S.layout[S.sel]; panel(); commit(); } });
$('resetAll').addEventListener('click', () => { for (const k of Object.keys(S.layout)) delete S.layout[k]; S.sel = null; panel(); commit(); });
function arrangeDown(e) {
  const p = toDesign(e);
  if (pts.size === 1) {
    const hit = [...(S.boxes || [])].reverse().find((b) => p.x >= b.x - 26 && p.x <= b.x + b.w + 26 && p.y >= b.y - 26 && p.y <= b.y + b.h + 26);
    S.sel = hit ? hit.id : null; panel();
    if (hit) {
      const o = keep(hit.id);
      drag = { p0: p, dx: o.dx || 0, dy: o.dy || 0, cx: hit.x + hit.w / 2 - (o.dx || 0), cy: hit.y + hit.h / 2 - (o.dy || 0) };
    } else drag = null;
  } else if (pts.size === 2 && S.sel) {
    const [a, b] = [...pts.values()];
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), s0: keep(S.sel).s ?? 1 };
  }
}
function arrangeMove(e) {
  if (!S.sel) return;
  const [W, H] = FORMATS[fmt];
  if (pinch && pts.size === 2) {
    const [a, b] = [...pts.values()];
    keep(S.sel).s = Math.min(2.6, Math.max(0.35, pinch.s0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0));
    panel();
  } else if (drag && pts.size === 1) {
    const p = toDesign(e), o = keep(S.sel);
    // the element's middle stays on the picture, so it can never be lost off the edge
    o.dx = Math.min(W - 30 - drag.cx, Math.max(30 - drag.cx, drag.dx + p.x - drag.p0.x));
    o.dy = Math.min(H - 30 - drag.cy, Math.max(30 - drag.cy, drag.dy + p.y - drag.p0.y));
  }
}

view.addEventListener('pointerdown', (e) => {
  if (mode === 'arrange') {
    view.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    arrangeDown(e); return;
  }
  if (!S.img) { $('file').click(); return; }
  view.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  last = gesture(); holdUntil = Infinity;
  const now = performance.now();
  if (pts.size === 1 && now - lastTap < 300) { S.view = { z: 1, x: 0, y: 0 }; }
  lastTap = now;
});
view.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (mode === 'arrange') { arrangeMove(e); return; }
  const g = gesture();
  if (last && pts.size === (last.d ? 2 : 1)) {
    const [W] = FORMATS[fmt];
    const k = W / view.clientWidth;
    const box = design.photoBox(...FORMATS[fmt], fmt);
    S.view.x += (g.x - last.x) * k / box.w;
    S.view.y += (g.y - last.y) * k / box.h;
    if (g.d && last.d) S.view.z *= g.d / last.d;
    clampView();
  }
  last = g;
});
const up = (e) => {
  pts.delete(e.pointerId);
  if (mode === 'arrange') {
    if (pts.size < 2) pinch = null;
    if (!pts.size) { drag = null; commit(); }
    else drag = null;                       // two fingers down to one: stop, no jump
    return;
  }
  last = pts.size ? gesture() : null;
  if (!pts.size) { holdUntil = performance.now() + 900; drawThumbs(); setTimeout(restart, 900); }
};
view.addEventListener('pointerup', up);
view.addEventListener('pointercancel', up);
view.addEventListener('wheel', (e) => {
  if (mode === 'arrange') {
    if (!S.sel) return;
    e.preventDefault();
    const o = keep(S.sel); o.s = Math.min(2.6, Math.max(0.35, (o.s ?? 1) * Math.exp(-e.deltaY * 0.0015)));
    panel(); clearTimeout(view._w); view._w = setTimeout(commit, 400);
    return;
  }
  if (!S.img) return;
  e.preventDefault();
  S.view.z *= Math.exp(-e.deltaY * 0.0015); clampView();
  holdUntil = performance.now() + 900; setTimeout(restart, 900);
}, { passive: false });

// ---------- product line and price ----------
for (const [id, k] of [['fTitle', 'title'], ['fBadge', 'badge']]) {
  $(id).addEventListener('input', (e) => { S.fields[k] = e.target.value.trim(); drawThumbs(); });
}

// ---------- shop info ----------
function showNotice() { $('notice').classList.toggle('show', !S.info.phone || !S.info.insta); }
showNotice();
const SET = { sPhone: 'phone', sInsta: 'insta', sLine: 'line', sPlace: 'place', sTape: 'tape', sBar: 'bar' };
function openSettings() {
  for (const [id, k] of Object.entries(SET)) $(id).value = S.info[k] ?? DEFAULT_INFO[k] ?? '';
  $('settings').classList.add('show');
}
$('openSettings').addEventListener('click', openSettings);
document.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.reset; $(Object.keys(SET).find((id) => SET[id] === k)).value = DEFAULT_INFO[k];
}));
$('noticeGo').addEventListener('click', openSettings);
$('setClose').addEventListener('click', () => $('settings').classList.remove('show'));
$('setSave').addEventListener('click', () => {
  for (const [id, k] of Object.entries(SET)) S.info[k] = $(id).value.trim();
  S.info.insta = S.info.insta.replace(/^@+/, '');
  // the lines may be left empty on purpose (they then disappear from the designs)
  store.set(S.info);
  $('settings').classList.remove('show');
  showNotice(); drawThumbs();
});

// ---------- saving ----------
let outFile = null, outURL = null;
function openOut(busyText) {
  $('out').classList.add('show');
  $('busy').style.display = ''; $('result').innerHTML = ''; $('share').style.display = 'none';
  $('download').style.display = 'none'; $('tip').style.display = 'none';
  $('outTitle').textContent = 'لحظة…'; $('busyText').textContent = busyText; $('barFill').style.width = '0%';
}
function showOut(file) {
  outFile = file;
  if (outURL) URL.revokeObjectURL(outURL);
  outURL = URL.createObjectURL(file);
  $('busy').style.display = 'none';
  $('outTitle').textContent = 'جاهز';
  const isVideo = file.type.startsWith('video');
  $('result').innerHTML = isVideo
    ? `<video src="${outURL}" autoplay loop muted playsinline controls></video>`
    : `<img src="${outURL}" alt="التصميم الجاهز">`;
  // phones that can share get «شارك»; the rest get the download as the main button
  const canShare = !!navigator.canShare?.({ files: [file] });
  $('share').style.display = canShare ? '' : 'none'; $('tip').style.display = canShare ? '' : 'none';
  $('download').classList.toggle('primary', !canShare);
  $('download').textContent = canShare ? 'تنزيل كملف' : (isVideo ? 'تنزيل الفيديو' : 'تنزيل الصورة');
  $('tip').textContent = isVideo
    ? 'اضغط «شارك» ثم «Save Video» حتى ينحفظ بالصور، أو اختار إنستغرام مباشرة.'
    : 'اضغط «شارك» ثم «Save Image» حتى تنحفظ بالصور، أو اختار إنستغرام مباشرة.';
  const a = $('download'); a.href = outURL; a.download = file.name; a.style.display = '';
}
function needPhoto() {
  if (S.img) return false;
  $('file').click(); return true;
}
$('savePng').addEventListener('click', async () => {
  if (needPhoto()) return;
  openOut('دا تتسوى الصورة…');
  showOut(await savePicture(design, fmt, plain()));
});
$('saveMp4').addEventListener('click', async () => {
  if (needPhoto()) return;
  openOut('دا يتسوى الفيديو… خلّي الصفحة مفتوحة');
  const wasPlaying = playing; playing = false;
  try {
    const f = await saveVideo(design, fmt, plain(), (p) => { $('barFill').style.width = `${Math.round(p * 100)}%`; $('busyText').textContent = `دا يتسوى الفيديو… ${Math.round(p * 100)}%`; });
    showOut(f);
  } catch (err) {
    console.error(err);
    $('busyText').textContent = 'هذا المتصفح ما يدعم حفظ الفيديو. احفظ صورة، أو افتح الرابط بسفاري أو كروم محدّث.';
  } finally { playing = wasPlaying; restart(); }
});
$('share').addEventListener('click', async () => {
  if (!outFile) return;
  if (navigator.canShare?.({ files: [outFile] })) {
    try { await navigator.share({ files: [outFile] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  $('download').click();
});
$('outClose').addEventListener('click', () => $('out').classList.remove('show'));

// ---------- the contact card (the numbers picture, redone) ----------
function drawCards() {
  for (const look of ['night', 'sun']) {
    const c = $(`card_${look}`); c.width = CARD[0] / 2; c.height = CARD[1] / 2;
    drawContactCard(c.getContext('2d'), S, look);
  }
}
$('openCard').addEventListener('click', () => { drawCards(); $('cardSheet').classList.add('show'); });
$('cardClose').addEventListener('click', () => $('cardSheet').classList.remove('show'));
$('cardEdit').addEventListener('click', () => { $('cardSheet').classList.remove('show'); openSettings(); });
document.querySelectorAll('#cardSheet .pick').forEach((b) => b.addEventListener('click', async () => {
  const c = document.createElement('canvas'); [c.width, c.height] = CARD;
  drawContactCard(c.getContext('2d'), S, b.dataset.look);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  $('cardSheet').classList.remove('show');
  openOut('');
  showOut(new File([blob], `المحطة-بطاقة-التواصل-${b.dataset.look === 'sun' ? 'برتقالي' : 'نيلي'}.png`, { type: 'image/png' }));
}));
setMode('photo');
window.__app = { S, layouts, setMode, get design() { return design; }, get fmt() { return fmt; } };
// offline after the first visit (only on the real https address, never while developing)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
