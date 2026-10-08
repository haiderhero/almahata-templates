// Soft drifting smoke, drawn by a small WebGL shader (domain-warped noise) into its own
// low-resolution canvas, which a design then lays over its frame. The same t always gives
// the same smoke, so a saved video is exactly what the preview showed.

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `
precision highp float;
uniform vec2 res; uniform float t; uniform float seed;
uniform vec3 cA; uniform vec3 cB; uniform float amt; uniform int mode; uniform float rise;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / res;                 // y up
  vec2 p = vec2(uv.x * res.x / res.y, uv.y) * 2.6 + seed;
  float s = t * .09;
  p.y -= s * rise * 2.2;                           // the whole field drifts up
  vec2 q = vec2(fbm(p + vec2(0., s)), fbm(p + vec2(5.2, 1.3) - vec2(s * .7, 0.)));
  vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + s * .8), fbm(p + 3.2 * q + vec2(8.3, 2.8) - s * .6));
  float f = fbm(p + 2.8 * r);
  float d = smoothstep(.42, .92, f) * (.55 + .45 * smoothstep(.2, .8, length(q)));
  float reg = 1.;
  if (mode == 0) reg = pow(smoothstep(.62, 0., uv.y), 1.3);                      // rising from the bottom
  else if (mode == 1) reg = .35 + .65 * smoothstep(.0, .5, 1. - abs(uv.y - .5) * 2.); // all over, softer at the ends
  else if (mode == 2) reg = smoothstep(.42, 0., min(uv.x, 1. - uv.x)) * .9 + pow(smoothstep(.5, 0., uv.y), 1.5) * .6; // the sides
  else if (mode == 3) reg = pow(smoothstep(.55, 0., uv.y), 1.2) + pow(smoothstep(.45, 1., uv.y), 1.6) * .7;   // bottom and top
  float a = clamp(d * reg * amt, 0., 1.);
  vec3 col = mix(cB, cA, smoothstep(.25, .85, r.y + .15 * q.x));
  col += .25 * pow(d, 3.) * cA;                    // hot cores
  gl_FragColor = vec4(col * a, a);
}`;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const MODES = { bottom: 0, all: 1, sides: 2, ends: 3 };

export class Smoke {
  constructor(w = 360, h = 640) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
    this.gl = gl;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(['res', 't', 'seed', 'cA', 'cB', 'amt', 'mode', 'rise'].map((n) => [n, gl.getUniformLocation(pr, n)]));
  }

  resize(w, h) { if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; } }

  /** draw the smoke for time t (s); returns its canvas */
  render(t, { a = '#FD9104', b = '#4B3FD8', amt = 1, mode = 'bottom', seed = 3.1, rise = 1 } = {}) {
    const gl = this.gl;
    if (!gl) return this.canvas;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.t, t); gl.uniform1f(this.u.seed, seed);
    gl.uniform3fv(this.u.cA, hex(a)); gl.uniform3fv(this.u.cB, hex(b));
    gl.uniform1f(this.u.amt, amt); gl.uniform1i(this.u.mode, MODES[mode] ?? 0); gl.uniform1f(this.u.rise, rise);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}
