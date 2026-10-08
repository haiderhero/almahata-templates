// Saving: a picture (the settled frame) or a short MP4 (the whole motion).
// The MP4 is made frame by frame with WebCodecs (H.264) and packed by mp4-muxer, so every
// frame is exact and it works on iPhone (Safari 16.4+) and Android Chrome. Where WebCodecs
// is missing, the canvas is recorded in real time instead.
import { DUR, STILL, FORMATS, render } from './scene.js';

const FPS = 30;
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function savePicture(design, fmt, S) {
  const [W, H] = FORMATS[fmt];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  render(c.getContext('2d'), design, fmt, STILL, S);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
  return new File([blob], `المحطة-${fmt === 'story' ? 'ستوري' : 'بوست'}-${stamp()}.jpg`, { type: 'image/jpeg' });
}

export async function saveVideo(design, fmt, S, onProgress = () => {}) {
  if ('VideoEncoder' in window && window.Mp4Muxer) {
    try { return await viaWebCodecs(design, fmt, S, onProgress); } catch (e) { console.warn('webcodecs failed, recording instead', e); }
  }
  return viaRecorder(design, fmt, S, onProgress);
}

async function pickConfig(W, H) {
  // High, then Main, then Baseline; level 4.0 covers 1080×1920 at 30 fps
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032', 'avc1.42e032']) {
    const cfg = { codec, width: W, height: H, bitrate: 12_000_000, framerate: FPS, avc: { format: 'avc' } };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return r.config; } catch { /* next */ }
  }
  throw new Error('no H.264 encoder');
}

async function viaWebCodecs(design, fmt, S, onProgress) {
  const [W, H] = FORMATS[fmt];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const config = await pickConfig(W, H);
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    fastStart: 'in-memory',
  });
  let failed = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  enc.configure(config);
  const n = Math.round(DUR * FPS);
  for (let i = 0; i < n; i++) {
    if (failed) throw failed;
    render(ctx, design, fmt, i / FPS, S);
    const frame = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
    if (i % 3 === 0) { onProgress(i / n); await tick(); }
  }
  await enc.flush();
  if (failed) throw failed;
  enc.close();
  muxer.finalize();
  onProgress(1);
  return new File([muxer.target.buffer], `المحطة-${fmt === 'story' ? 'ستوري' : 'بوست'}-${stamp()}.mp4`, { type: 'video/mp4' });
}

async function viaRecorder(design, fmt, S, onProgress) {
  // real time, so keep it light: 720 wide is smooth on a phone and still sharp on Instagram
  const [W, H] = FORMATS[fmt];
  const c = document.createElement('canvas'); c.width = 720; c.height = Math.round(720 * H / W);
  const ctx = c.getContext('2d');
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
  if (!mime) throw new Error('no recorder');
  render(ctx, design, fmt, 0, S);
  const stream = c.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const done = new Promise((r) => { rec.onstop = r; });
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      render(ctx, design, fmt, Math.min(t, DUR), S);
      onProgress(Math.min(t / DUR, 1));
      if (t < DUR) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  rec.stop(); await done;
  const type = mime.split(';')[0];
  return new File(parts, `المحطة-${stamp()}.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
}

function stamp() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
