/**
 * A small hand-written WebGL2 terrain viewer for the route lab pages: greyscale hillshade with contour lines,
 * the GPX tracks draped over the relief, an orbit camera, and a 2D (top-down) / 3D (tilted) switch.
 * No dependencies and no network requests beyond the baked elevation file (see scripts/bake-terrain.mjs).
 *
 * World units are metres: x east, y up (elevation), z south, origin at the centre of the elevation grid.
 */

const D2R = Math.PI / 180

/* ---------- Tiny matrix helpers (column-major, like WebGL expects) ---------- */
const mul = (a, b) => {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
    o[c * 4 + r] = s
  }
  return o
}
const perspective = (fovy, aspect, near, far) => {
  const f = 1 / Math.tan(fovy / 2), o = new Float32Array(16)
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = (2 * far * near) / (near - far)
  return o
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
function lookAt(eye, target, yaw) {
  const f = norm(sub(target, eye))
  // Straight down has no "up", so fall back to the heading, which keeps north at the top of the screen.
  let r = Math.abs(f[1]) > 0.9999 ? [Math.cos(yaw), 0, -Math.sin(yaw)] : norm(cross(f, [0, 1, 0]))
  const u = cross(r, f)
  const o = new Float32Array(16)
  o[0] = r[0]; o[4] = r[1]; o[8] = r[2]
  o[1] = u[0]; o[5] = u[1]; o[9] = u[2]
  o[2] = -f[0]; o[6] = -f[1]; o[10] = -f[2]
  o[12] = -dot(r, eye); o[13] = -dot(u, eye); o[14] = dot(f, eye); o[15] = 1
  return o
}
const transform = (m, p) => {
  const x = p[0], y = p[1], z = p[2]
  const w = m[3] * x + m[7] * y + m[11] * z + m[15]
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w]
}

/* ---------- Shaders ---------- */
const TERRAIN_VS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec2 aSlope;
uniform mat4 uVP;
uniform float uExag;
uniform vec2 uHalf;
uniform vec3 uEye;
out float vElev;
out vec3 vN;
out vec2 vUV;
out float vDist;
void main() {
  vec3 p = vec3(aPos.x, aPos.y * uExag, aPos.z);
  gl_Position = uVP * vec4(p, 1.0);
  vElev = aPos.y;
  vN = normalize(vec3(-aSlope.x * uExag, 1.0, -aSlope.y * uExag));
  vUV = aPos.xz / uHalf;
  vDist = length(p - uEye);
}`

const TERRAIN_FS = `#version 300 es
precision highp float;
in float vElev;
in vec3 vN;
in vec2 vUV;
in float vDist;
uniform vec3 uLight;
uniform float uMinor;
uniform float uMajor;
uniform float uFog;
uniform float uCalm;
out vec4 o;
float contour(float e, float step, float fw, float soft) {
  float d = abs(fract(e / step - 0.5) - 0.5) * step;
  float line = 1.0 - smoothstep(0.0, soft * fw, d);
  return line * (1.0 - smoothstep(step * 0.3, step * 0.75, fw));
}
void main() {
  vec3 n = normalize(vN);
  float lit = max(dot(n, uLight), 0.0);
  float g = mix(0.46, 1.02, pow(lit, 0.85));
  g -= (1.0 - n.y) * 0.16;
  float fw = max(fwidth(vElev), 0.001);
  float minor = contour(vElev, uMinor, fw, 1.0);
  float major = contour(vElev, uMajor, fw, 1.3);
  g = mix(g, 1.0, uCalm * 0.12);
  g -= (minor * 0.085 + major * 0.2) * (1.0 - uCalm * 0.55);
  float fog = 1.0 - exp(-vDist * uFog);
  g = mix(g, 1.0, fog * mix(0.8, 0.8, uCalm));
  float e = max(abs(vUV.x), abs(vUV.y));
  float a = 1.0 - smoothstep(0.7, 1.0, e);
  g = clamp(g, 0.0, 1.0);
  o = vec4(vec3(g) * a, a);
}`

const LINE_VS = `#version 300 es
precision highp float;
in vec3 aA;
in vec3 aB;
in vec2 aCorner;
in vec2 aKm;
uniform mat4 uVP;
uniform vec2 uRes;
uniform float uWidth;
uniform float uExag;
uniform float uLift;
uniform float uBias;
out float vKm;
void main() {
  vec4 ca = uVP * vec4(aA.x, aA.y * uExag + uLift, aA.z, 1.0);
  vec4 cb = uVP * vec4(aB.x, aB.y * uExag + uLift, aB.z, 1.0);
  vec2 sa = ca.xy / ca.w * uRes * 0.5;
  vec2 sb = cb.xy / cb.w * uRes * 0.5;
  vec2 d = sb - sa;
  float len = length(d);
  d = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-d.y, d.x);
  vec4 c = mix(ca, cb, aCorner.x);
  vec2 s = mix(sa, sb, aCorner.x) + nrm * aCorner.y * uWidth * 0.5 + d * (aCorner.x * 2.0 - 1.0) * uWidth * 0.5;
  gl_Position = vec4(s / (uRes * 0.5) * c.w, c.z - uBias * c.w, c.w);
  vKm = mix(aKm.x, aKm.y, aCorner.x);
}`

const LINE_FS = `#version 300 es
precision highp float;
in float vKm;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uDash;
uniform float uDone;
out vec4 o;
void main() {
  if (uDash > 0.0 && fract(vKm * 1000.0 / uDash) > 0.58) discard;
  float a = uAlpha;
  if (uDone >= 0.0 && vKm > uDone) a *= 0.3;
  o = vec4(uColor * a, a);
}`

function program(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const p = gl.createProgram()
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
  const uniforms = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) { const { name } = gl.getActiveUniform(p, i); uniforms[name] = gl.getUniformLocation(p, name) }
  return { p, u: uniforms }
}

/** Fetches and unpacks the baked elevation grid (see scripts/bake-terrain.mjs). */
export async function loadElevation(url, meta) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`elevation ${res.status}`)
  const body = res.body.pipeThrough(new DecompressionStream('gzip'))
  const buf = await new Response(body).arrayBuffer()
  const resid = new Int16Array(buf)
  const { width: w, height: h, unit } = meta
  if (resid.length !== w * h) throw new Error('elevation size mismatch')
  const q = new Int32Array(w * h), H = new Float32Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = i ? q[j * w + i - 1] : 0, b = j ? q[(j - 1) * w + i] : 0, c = i && j ? q[(j - 1) * w + i - 1] : 0
      const v = resid[j * w + i] + a + b - c
      q[j * w + i] = v
      H[j * w + i] = v * unit
    }
  }
  return H
}

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2))

/**
 * @param canvas   target canvas
 * @param meta     terrain.json (width, height, bounds, metersPerPx, ...)
 * @param H        Float32Array elevation grid from loadElevation
 * @param tracks   [{ points: [[lat, lng, ele, km]...] }]
 */
/** Gives the browser a chance to paint and handle input between the heavy setup steps. */
const yieldMain = () => new Promise((r) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(r) : setTimeout(r, 0)))

export async function createTerrain(canvas, meta, H, tracks) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
  if (!gl) throw new Error('WebGL2 unavailable')
  const { width: cw, height: ch, metersPerPx: mpp, bounds } = meta
  const halfX = (cw * mpp) / 2, halfZ = (ch * mpp) / 2

  /* ----- coordinate helpers ----- */
  const toWorld = (lat, lng) => {
    const fx = (lng - bounds.west) / (bounds.east - bounds.west)
    const fy = (mercY(lat) - mercY(bounds.north)) / (mercY(bounds.south) - mercY(bounds.north))
    return [(fx * cw - cw / 2) * mpp, (fy * ch - ch / 2) * mpp]
  }
  const heightAt = (x, z) => {
    const gx = Math.min(cw - 1.001, Math.max(0, x / mpp + cw / 2 - 0.5)), gz = Math.min(ch - 1.001, Math.max(0, z / mpp + ch / 2 - 0.5))
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j
    const a = H[j * cw + i], b = H[j * cw + i + 1], c = H[(j + 1) * cw + i], d = H[(j + 1) * cw + i + 1]
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz
  }

  /* ----- terrain mesh ----- */
  const verts = new Float32Array(cw * ch * 5)
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const k = j * cw + i, o = k * 5
      const l = H[j * cw + Math.max(0, i - 1)], r = H[j * cw + Math.min(cw - 1, i + 1)]
      const u = H[Math.max(0, j - 1) * cw + i], d = H[Math.min(ch - 1, j + 1) * cw + i]
      verts[o] = (i + 0.5 - cw / 2) * mpp
      verts[o + 1] = H[k]
      verts[o + 2] = (j + 0.5 - ch / 2) * mpp
      verts[o + 3] = (r - l) / ((Math.min(cw - 1, i + 1) - Math.max(0, i - 1)) * mpp)
      verts[o + 4] = (d - u) / ((Math.min(ch - 1, j + 1) - Math.max(0, j - 1)) * mpp)
    }
  }
  await yieldMain()
  const idx = new Uint32Array((cw - 1) * (ch - 1) * 6)
  let t = 0
  for (let j = 0; j < ch - 1; j++) for (let i = 0; i < cw - 1; i++) {
    const a = j * cw + i, b = a + 1, c = a + cw, d = c + 1
    idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d
  }
  await yieldMain()
  const terrain = program(gl, TERRAIN_VS, TERRAIN_FS)
  const tVao = gl.createVertexArray()
  gl.bindVertexArray(tVao)
  const tvb = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, tvb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(terrain.p, 'aPos'), aSlope = gl.getAttribLocation(terrain.p, 'aSlope')
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0)
  gl.enableVertexAttribArray(aSlope); gl.vertexAttribPointer(aSlope, 2, gl.FLOAT, false, 20, 12)
  const tib = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  gl.bindVertexArray(null)

  await yieldMain()
  /* ----- tracks as screen-space ribbons draped on the terrain ----- */
  const line = program(gl, LINE_VS, LINE_FS)
  const lines = tracks.map((tr) => {
    const pts = tr.points.map((p) => { const [x, z] = toWorld(p[0], p[1]); return { x, z, y: heightAt(x, z), km: p[3], ele: p[2] } })
    const n = pts.length - 1
    const data = new Float32Array(n * 4 * 10)
    const index = new Uint16Array(n * 6)
    const corners = [[0, -1], [0, 1], [1, -1], [1, 1]]
    for (let s = 0; s < n; s++) {
      const A = pts[s], B = pts[s + 1]
      for (let c = 0; c < 4; c++) {
        const o = (s * 4 + c) * 10
        data.set([A.x, A.y, A.z, B.x, B.y, B.z, corners[c][0], corners[c][1], A.km, B.km], o)
      }
      const b = s * 4
      index.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], s * 6)
    }
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const vb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    const at = (name, size, off) => { const l = gl.getAttribLocation(line.p, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 40, off * 4) }
    at('aA', 3, 0); at('aB', 3, 3); at('aCorner', 2, 6); at('aKm', 2, 8)
    const ib = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    return { pts, vao, count: n * 6, km: pts[pts.length - 1].km }
  })

  /* ----- camera and animation state ----- */
  const all = lines.flatMap((l) => l.pts)
  const cx = (Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2
  const cz = (Math.min(...all.map((p) => p.z)) + Math.max(...all.map((p) => p.z))) / 2
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length
  const span = Math.max(Math.max(...all.map((p) => p.x)) - Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.z)) - Math.min(...all.map((p) => p.z)))
  const VIEWS = {
    '2d': { yaw: 0, el: 90, exag: 1, dist: span * 2.1 },
    '3d': { yaw: -20, el: 33, exag: 1.5, dist: span * 2.35 },
    // The quiet background pose: a little higher and further back, so the relief reads as a calm shape behind the photos.
    bg: { yaw: -22, el: 42, exag: 1.45, dist: span * 3.5 },
  }
  const cam = { ...VIEWS['3d'], tx: cx, ty: cy, tz: cz }
  const goal = { ...cam }
  let mode = '3d'
  let look = 'front'
  const calm = { v: 0 }, calmGoal = { v: 0 }
  let dprCap = 2, reduced = false, frames = 0
  const state = { alpha: lines.map(() => 1), alphaGoal: lines.map(() => 1), done: lines.map(() => -1), dpr: 1, w: 1, h: 1 }
  const FOV = 32 * D2R
  /** Portrait canvases are narrow, so pull back until the whole route still fits across. */
  const viewDist = (m) => VIEWS[m].dist * Math.max(1, 1.2 / (state.w / state.h))
  const poseKey = () => (look === 'bg' ? 'bg' : mode)
  let dirty = true, raf = 0, last = 0, disposed = false
  const listeners = new Set()
  const light = norm([-0.62, 0.78, -0.55])

  const matrices = () => {
    const el = cam.el * D2R, yaw = cam.yaw * D2R
    const target = [cam.tx, cam.ty * cam.exag, cam.tz]
    const eye = [target[0] + cam.dist * Math.cos(el) * Math.sin(yaw), target[1] + cam.dist * Math.sin(el), target[2] + cam.dist * Math.cos(el) * Math.cos(yaw)]
    const near = Math.max(30, cam.dist * 0.02), far = cam.dist * 6 + 30000
    const vp = mul(perspective(FOV, state.w / state.h, near, far), lookAt(eye, target, yaw))
    return { vp, eye, target }
  }

  const resize = () => {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true }
    state.w = w; state.h = h; state.dpr = dpr
  }

  const draw = () => {
    resize()
    const { vp, eye } = matrices()
    gl.viewport(0, 0, state.w, state.h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true)
    gl.disable(gl.BLEND)

    gl.useProgram(terrain.p)
    gl.uniformMatrix4fv(terrain.u.uVP, false, vp)
    gl.uniform1f(terrain.u.uExag, cam.exag)
    gl.uniform2f(terrain.u.uHalf, halfX, halfZ)
    gl.uniform3fv(terrain.u.uEye, eye)
    gl.uniform3fv(terrain.u.uLight, light)
    const closeness = Math.min(1, 3500 / cam.dist)
    gl.uniform1f(terrain.u.uMinor, closeness > 0.55 ? 25 : 50)
    gl.uniform1f(terrain.u.uMajor, 250)
    gl.uniform1f(terrain.u.uFog, 0.00007 * (1 + calm.v * 0.6))
    gl.uniform1f(terrain.u.uCalm, calm.v)
    gl.bindVertexArray(tVao)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0)

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.depthMask(false)
    gl.useProgram(line.p)
    gl.uniformMatrix4fv(line.u.uVP, false, vp)
    gl.uniform2f(line.u.uRes, state.w, state.h)
    gl.uniform1f(line.u.uExag, cam.exag)
    const wpx = state.dpr * 2.6 * (1 - calm.v * 0.3)
    const calmA = 1 - calm.v * 0.3
    // The descent is drawn first (thinner, mid grey) so the ascent's black line sits on top where the two share the trail.
    ;[1, 0].forEach((i) => {
      const l = lines[i]
      const a = state.alpha[i] * calmA
      if (a < 0.01) return
      const ink = i === 0 ? 0.07 : 0.5, w = i === 0 ? wpx : wpx * 0.8
      gl.bindVertexArray(l.vao)
      gl.uniform1f(line.u.uLift, 7 * cam.exag)
      gl.uniform1f(line.u.uDone, state.done[i])
      gl.uniform1f(line.u.uDash, 0)
      // 1. faint trace where the relief hides the route
      gl.depthFunc(gl.GREATER)
      gl.uniform1f(line.u.uBias, 0)
      gl.uniform1f(line.u.uWidth, w)
      gl.uniform3f(line.u.uColor, ink, ink, ink)
      gl.uniform1f(line.u.uAlpha, 0.18 * a)
      gl.drawElements(gl.TRIANGLES, l.count, gl.UNSIGNED_SHORT, 0)
      gl.depthFunc(gl.LEQUAL)
      // 2. white halo
      gl.uniform1f(line.u.uBias, 0.0004 + i * 0.00005)
      gl.uniform1f(line.u.uWidth, w + state.dpr * 4)
      gl.uniform3f(line.u.uColor, 1, 1, 1)
      gl.uniform1f(line.u.uAlpha, 0.8 * a)
      gl.drawElements(gl.TRIANGLES, l.count, gl.UNSIGNED_SHORT, 0)
      // 3. the route itself
      gl.uniform1f(line.u.uBias, 0.0008 + (1 - i) * 0.0002)
      gl.uniform1f(line.u.uWidth, w)
      gl.uniform3f(line.u.uColor, ink, ink, ink)
      gl.uniform1f(line.u.uAlpha, a)
      gl.drawElements(gl.TRIANGLES, l.count, gl.UNSIGNED_SHORT, 0)
    })
    gl.bindVertexArray(null)
    gl.depthMask(true)
    canvas.dataset.frames = String(++frames)
  }

  /** Screen position (CSS px) of a world point, and whether the relief hides it from the camera. */
  const project = (p) => {
    const { vp, eye } = matrices()
    const w = [p[0], p[1] * cam.exag, p[2]]
    const c = transform(vp, w)
    const x = (c[0] * 0.5 + 0.5) * (state.w / state.dpr), y = (1 - (c[1] * 0.5 + 0.5)) * (state.h / state.dpr)
    const onScreen = c[3] > 0 && Math.abs(c[0]) < 1.05 && Math.abs(c[1]) < 1.05
    let hidden = false
    if (onScreen && cam.el < 80) {
      for (let s = 1; s <= 28; s++) {
        const f = s / 30
        const rx = eye[0] + (w[0] - eye[0]) * f, ry = eye[1] + (w[1] - eye[1]) * f, rz = eye[2] + (w[2] - eye[2]) * f
        if (Math.abs(rx) < halfX && Math.abs(rz) < halfZ && heightAt(rx, rz) * cam.exag > ry + 10) { hidden = true; break }
      }
    }
    return { x, y, visible: onScreen, hidden }
  }

  const tick = (now) => {
    raf = 0
    if (disposed) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9)
    let moving = false
    const ease = (obj, goalObj, key, eps, rate = k) => {
      const d = goalObj[key] - obj[key]
      if (Math.abs(d) > eps) { obj[key] += d * rate; moving = true } else obj[key] = goalObj[key]
    }
    // Settle within imperceptible distances, so the loop stops (and the GPU rests) soon after a move.
    ease(cam, goal, 'yaw', 0.05); ease(cam, goal, 'el', 0.05); ease(cam, goal, 'exag', 0.004)
    ease(cam, goal, 'dist', goal.dist * 0.002); ease(cam, goal, 'tx', 3); ease(cam, goal, 'ty', 3); ease(cam, goal, 'tz', 3)
    ease(calm, calmGoal, 'v', 0.004, reduced ? 1 : k * 0.6)
    state.alpha.forEach((_, i) => {
      const d = state.alphaGoal[i] - state.alpha[i]
      if (Math.abs(d) > 0.005) { state.alpha[i] += d * Math.min(1, k * 1.2); moving = true } else state.alpha[i] = state.alphaGoal[i]
    })
    if (moving) dirty = true
    if (dirty) {
      dirty = false
      draw()
      listeners.forEach((fn) => fn(api))
    }
    if (moving) schedule()
  }
  const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(tick) }
  const wake = () => { dirty = true; schedule() }

  /* ----- input ----- */
  const clampTarget = () => {
    goal.tx = Math.max(-halfX * 0.8, Math.min(halfX * 0.8, goal.tx))
    goal.tz = Math.max(-halfZ * 0.8, Math.min(halfZ * 0.8, goal.tz))
  }
  const pan = (dx, dy) => {
    const s = (2 * goal.dist * Math.tan(FOV / 2)) / (state.h / state.dpr)
    const yaw = goal.yaw * D2R
    const right = [Math.cos(yaw), -Math.sin(yaw)], fwd = [-Math.sin(yaw), -Math.cos(yaw)]
    const sinEl = Math.max(0.35, Math.sin(goal.el * D2R))
    goal.tx += (-dx * right[0] + (dy * fwd[0]) / sinEl) * s
    goal.tz += (-dx * right[1] + (dy * fwd[1]) / sinEl) * s
    clampTarget()
    Object.assign(cam, { tx: goal.tx, tz: goal.tz })
  }
  const zoom = (factor) => {
    goal.dist = Math.max(900, Math.min(span * 4, goal.dist * factor))
    cam.dist = goal.dist
  }
  const pointers = new Map()
  let userMoved = () => {}
  const onDown = (e) => {
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    userMoved()
  }
  const onMove = (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (pointers.size === 1) {
      if (mode === '3d' && !(e.shiftKey || e.ctrlKey || e.button === 2 || (e.buttons & 2))) {
        goal.yaw -= dx * 0.4; goal.el = Math.max(12, Math.min(86, goal.el + dy * 0.3))
        cam.yaw = goal.yaw; cam.el = goal.el
      } else pan(dx, dy)
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const o = pointers.get(e.pointerId)
      const other = a === o ? b : a
      const before = Math.hypot(o.x - other.x, o.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      if (before > 0 && after > 0) zoom(before / after)
      pan(dx / 2, dy / 2)
    }
    p.x = e.clientX; p.y = e.clientY
    wake()
  }
  const onUp = (e) => { pointers.delete(e.pointerId) }
  const onWheel = (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); userMoved(); wake() }
  const onMenu = (e) => e.preventDefault()
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onMenu)
  const ro = new ResizeObserver(wake)
  ro.observe(canvas)
  const onLost = (e) => e.preventDefault()
  canvas.addEventListener('webglcontextlost', onLost)

  const api = {
    meta,
    /** Camera view of the whole route: '2d' (north up, flat) or '3d' (tilted, exaggerated relief). */
    setMode(m) {
      mode = m
      if (look === 'bg') return
      Object.assign(goal, { yaw: VIEWS[m].yaw, el: VIEWS[m].el, exag: VIEWS[m].exag, dist: viewDist(m) })
      wake()
    },
    /**
     * 'bg' = the quiet backdrop behind a page (soft contrast, contours almost gone, thinner route, low pixel ratio);
     * 'front' = the full map. The camera and look ease between the two.
     */
    setLook(l, snap = false) {
      look = l
      calmGoal.v = l === 'bg' ? 1 : 0
      dprCap = l === 'bg' ? 1.25 : 2
      const key = poseKey()
      Object.assign(goal, { yaw: VIEWS[key].yaw, el: VIEWS[key].el, exag: VIEWS[key].exag, dist: viewDist(key), tx: cx, ty: cy, tz: cz })
      if (snap) { Object.assign(cam, goal); calm.v = calmGoal.v }
      wake()
    },
    get look() { return look },
    /** Page scroll progress 0..1 in the backdrop: the camera swings a little and the route draws itself on. */
    setScroll(p, snap = false) {
      if (look !== 'bg') return
      goal.yaw = VIEWS.bg.yaw + (p - 0.5) * 26
      goal.el = VIEWS.bg.el + (p - 0.5) * -6
      const total = lines.reduce((t, l) => t + l.km, 0)
      const u = Math.min(1, p * 1.15) * total
      const k0 = lines[0].km
      state.done = lines.map((l, i) => (i === 0 ? Math.min(u, k0) : Math.max(0, u - k0)))
      if (snap) { cam.yaw = goal.yaw; cam.el = goal.el }
      wake()
    },
    setReducedMotion(b) { reduced = !!b; wake() },
    get frames() { return frames },
    get mode() { return mode },
    resetView() {
      const key = poseKey()
      Object.assign(goal, VIEWS[key], { dist: viewDist(key), tx: cx, ty: cy, tz: cz })
      wake()
    },
    /** Which tracks are emphasised (the others fade right back). */
    setShown(list) {
      state.alphaGoal = lines.map((_, i) => (list.includes(i) ? 1 : 0.14))
      wake()
    },
    /** Marks progress along each track; unreached stretches dim. Pass null to clear. */
    setProgress(km) {
      state.done = lines.map((l) => (km == null ? -1 : Math.min(km, l.km)))
      wake()
    },
    /** World position at `km` along track i, on the relief. */
    pointAt(i, km) {
      const pts = lines[i].pts
      const k = Math.max(0, Math.min(km, pts[pts.length - 1].km))
      let a = 0, b = pts.length - 1
      while (b - a > 1) { const m = (a + b) >> 1; if (pts[m].km <= k) a = m; else b = m }
      const span2 = pts[b].km - pts[a].km, f = span2 > 0 ? (k - pts[a].km) / span2 : 0
      const x = pts[a].x + (pts[b].x - pts[a].x) * f, z = pts[a].z + (pts[b].z - pts[a].z) * f
      return [x, heightAt(x, z), z]
    },
    toWorld(lat, lng) { const [x, z] = toWorld(lat, lng); return [x, heightAt(x, z), z] },
    /** Eases the camera centre to a world point (used when flying along the route). */
    follow(p) {
      goal.tx = p[0]; goal.tz = p[2]; goal.ty = p[1]
      wake()
    },
    focus(p, dist) {
      goal.tx = p[0]; goal.tz = p[2]; goal.ty = p[1]
      if (dist) goal.dist = dist
      wake()
    },
    spin(deg) { goal.yaw += deg; cam.yaw = goal.yaw; wake() },
    project,
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    onUserMove(fn) { userMoved = fn },
    redraw: wake,
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onMenu)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
  resize()
  cam.dist = goal.dist = viewDist(mode)
  wake()
  return api
}
