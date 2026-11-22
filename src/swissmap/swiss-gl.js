/**
 * A small WebGL2 relief viewer for the Swiss catalog map: the same greyscale hillshade and thin contour lines as the hike route views,
 * for the whole country at a coarse resolution (about 800 m cells, baked by scripts/bake-swiss.mjs). Lakes are flat pale shapes.
 * An orbit camera with a 2D (top-down) and a tilted 3D view, a calm 'bg' look for the backdrop behind the album cards, and project()
 * so the page can place HTML pins and labels on the relief. No dependencies, no network requests beyond the baked files.
 *
 * World units are metres: x east, y up (elevation), z south, origin at the centre of the grid.
 */

const D2R = Math.PI / 180

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
  const r = Math.abs(f[1]) > 0.9999 ? [Math.cos(yaw), 0, -Math.sin(yaw)] : norm(cross(f, [0, 1, 0]))
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

const VS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec2 aSlope;
in float aWater;
uniform mat4 uVP;
uniform float uExag;
uniform vec2 uHalf;
uniform vec3 uEye;
out float vElev;
out vec3 vN;
out vec2 vUV;
out float vDist;
out float vWater;
void main() {
  vec3 p = vec3(aPos.x, aPos.y * uExag, aPos.z);
  gl_Position = uVP * vec4(p, 1.0);
  vElev = aPos.y;
  vN = normalize(vec3(-aSlope.x * uExag, 1.0, -aSlope.y * uExag));
  vUV = aPos.xz / uHalf;
  vDist = length(p - uEye);
  vWater = aWater;
}`

const FS = `#version 300 es
precision highp float;
in float vElev;
in vec3 vN;
in vec2 vUV;
in float vDist;
in float vWater;
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
  float g = mix(0.5, 1.02, pow(lit, 0.8));
  g -= (1.0 - n.y) * 0.18;
  float fw = max(fwidth(vElev), 0.001);
  float minor = contour(vElev, uMinor, fw, 1.0);
  float major = contour(vElev, uMajor, fw, 1.3);
  float water = smoothstep(0.45, 0.55, vWater);
  g = mix(g, 1.0, uCalm * 0.12);
  g -= (minor * 0.07 + major * 0.17) * (1.0 - uCalm * 0.55) * (1.0 - water);
  g = mix(g, 0.93, water * 0.9);
  float fog = 1.0 - exp(-vDist * uFog);
  g = mix(g, 1.0, fog * 0.8);
  float e = max(abs(vUV.x), abs(vUV.y));
  float a = 1.0 - smoothstep(0.82, 1.0, e);
  g = clamp(g, 0.0, 1.0);
  o = vec4(vec3(g) * a, a);
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
  const u = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) { const { name } = gl.getActiveUniform(p, i); u[name] = gl.getUniformLocation(p, name) }
  return { p, u }
}

const gunzip = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

/** Fetches and unpacks the baked elevation grid and the lake mask (see scripts/bake-swiss.mjs). */
export async function loadGrid(demUrl, waterUrl, meta) {
  const [demBuf, watBuf] = await Promise.all([gunzip(demUrl), gunzip(waterUrl)])
  const resid = new Int16Array(demBuf)
  const { width: w, height: h, unit } = meta
  if (resid.length !== w * h) throw new Error('elevation size mismatch')
  const q = new Int32Array(w * h), H = new Float32Array(w * h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = i ? q[j * w + i - 1] : 0, b = j ? q[(j - 1) * w + i] : 0, c = i && j ? q[(j - 1) * w + i - 1] : 0
    const v = resid[j * w + i] + a + b - c
    q[j * w + i] = v
    H[j * w + i] = v * unit
  }
  return { H, water: new Uint8Array(watBuf) }
}

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2))

/**
 * @param canvas target canvas
 * @param meta   terrain.json (width, height, bounds, metersPerPx)
 * @param grid   { H, water } from loadGrid
 */
export function createSwissTerrain(canvas, meta, grid) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
  if (!gl) throw new Error('WebGL2 unavailable')
  const { H, water } = grid
  const { width: cw, height: ch, metersPerPx: mpp, bounds } = meta
  const halfX = (cw * mpp) / 2, halfZ = (ch * mpp) / 2

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

  const verts = new Float32Array(cw * ch * 6)
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const k = j * cw + i, o = k * 6
    const l = H[j * cw + Math.max(0, i - 1)], r = H[j * cw + Math.min(cw - 1, i + 1)]
    const u = H[Math.max(0, j - 1) * cw + i], d = H[Math.min(ch - 1, j + 1) * cw + i]
    verts[o] = (i + 0.5 - cw / 2) * mpp
    verts[o + 1] = H[k]
    verts[o + 2] = (j + 0.5 - ch / 2) * mpp
    verts[o + 3] = (r - l) / ((Math.min(cw - 1, i + 1) - Math.max(0, i - 1)) * mpp)
    verts[o + 4] = (d - u) / ((Math.min(ch - 1, j + 1) - Math.max(0, j - 1)) * mpp)
    // Lake mask, softened with the four neighbours so shores are a clean line instead of a staircase.
    let wsum = water[k] * 2, wn = 2
    if (i) { wsum += water[k - 1]; wn++ }
    if (i < cw - 1) { wsum += water[k + 1]; wn++ }
    if (j) { wsum += water[k - cw]; wn++ }
    if (j < ch - 1) { wsum += water[k + cw]; wn++ }
    verts[o + 5] = wsum / wn
  }
  const idx = new Uint32Array((cw - 1) * (ch - 1) * 6)
  let t = 0
  for (let j = 0; j < ch - 1; j++) for (let i = 0; i < cw - 1; i++) {
    const a = j * cw + i, b = a + 1, c = a + cw, d = c + 1
    idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d
  }
  const terrain = program(gl, VS, FS)
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const vb = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
  const attr = (name, size, off) => { const l = gl.getAttribLocation(terrain.p, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 24, off * 4) }
  attr('aPos', 3, 0); attr('aSlope', 2, 3); attr('aWater', 1, 5)
  const ib = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  gl.bindVertexArray(null)

  /* ----- camera ----- */
  const FOV = 32 * D2R
  const cy = 1200
  const state = { w: 1, h: 1, dpr: 1 }
  /** Distance at which the whole country fits the canvas, with a little room, for a given tilt. */
  const fitDist = (tilt) => {
    const aspect = state.w / state.h
    const t = Math.tan(FOV / 2)
    const wide = (halfX * 1.02) / (t * aspect)
    const high = (halfZ * (tilt > 80 ? 1.04 : 1.0 + 0.55 * Math.sin(Math.min(tilt, 90) * D2R) * 0.5)) / t
    return Math.max(wide, high)
  }
  const POSES = {
    '2d': { yaw: 0, el: 90, exag: 1, k: 0.97 },
    '3d': { yaw: 0, el: 46, exag: 3.2, k: 0.86 },
    // The quiet background pose: further back and gently tilted, so the country reads as a calm shape behind the cards.
    bg: { yaw: -6, el: 46, exag: 3, k: 1.12 },
  }
  const cam = { yaw: 0, el: 40, exag: 3.2, dist: 400000, tx: 0, ty: cy, tz: 0 }
  const goal = { ...cam }
  let mode = '3d', look = 'front', scroll = 0
  const calm = { v: 0 }, calmGoal = { v: 0 }
  let dprCap = 2, reduced = false, frames = 0, userMovedFlag = false
  const light = norm([-0.55, 0.8, -0.5])
  let dirty = true, raf = 0, last = 0, disposed = false
  const listeners = new Set()

  const pose = () => {
    const key = look === 'bg' ? 'bg' : mode
    const p = POSES[key]
    return { yaw: p.yaw + (look === 'bg' ? scroll * 14 : 0), el: p.el - (look === 'bg' ? scroll * 6 : 0), exag: p.exag, dist: fitDist(p.el) * p.k, tx: 0, ty: cy, tz: look === 'bg' ? halfZ * 0.04 : 0 }
  }

  const matrices = () => {
    const el = cam.el * D2R, yaw = cam.yaw * D2R
    const target = [cam.tx, cam.ty * cam.exag, cam.tz]
    const eye = [target[0] + cam.dist * Math.cos(el) * Math.sin(yaw), target[1] + cam.dist * Math.sin(el), target[2] + cam.dist * Math.cos(el) * Math.cos(yaw)]
    const near = Math.max(300, cam.dist * 0.02), far = cam.dist * 6 + 60000
    return { vp: mul(perspective(FOV, state.w / state.h, near, far), lookAt(eye, target, yaw)), eye }
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
    gl.uniform1f(terrain.u.uMinor, 100)
    gl.uniform1f(terrain.u.uMajor, 500)
    gl.uniform1f(terrain.u.uFog, 0.0000011 * (1 + calm.v * 0.5))
    gl.uniform1f(terrain.u.uCalm, calm.v)
    gl.bindVertexArray(vao)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0)
    frames++
  }

  /** Screen position (CSS px, relative to the canvas) of a lat/lng on the relief. */
  const project = (lat, lng) => {
    const [x, z] = toWorld(lat, lng)
    const { vp } = matrices()
    const c = transform(vp, [x, heightAt(x, z) * cam.exag, z])
    return { x: (c[0] * 0.5 + 0.5) * (state.w / state.dpr), y: (1 - (c[1] * 0.5 + 0.5)) * (state.h / state.dpr), visible: c[3] > 0 && Math.abs(c[0]) < 1.1 && Math.abs(c[1]) < 1.1 }
  }

  const tick = (now) => {
    raf = 0
    if (disposed) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    const k = reduced ? 1 : 1 - Math.exp(-dt * 8)
    let moving = false
    const ease = (obj, g, key, eps, rate = k) => {
      const d = g[key] - obj[key]
      if (Math.abs(d) > eps) { obj[key] += d * rate; moving = true } else obj[key] = g[key]
    }
    ease(cam, goal, 'yaw', 0.04); ease(cam, goal, 'el', 0.04); ease(cam, goal, 'exag', 0.004)
    ease(cam, goal, 'dist', goal.dist * 0.002); ease(cam, goal, 'tx', 30); ease(cam, goal, 'ty', 30); ease(cam, goal, 'tz', 30)
    ease(calm, calmGoal, 'v', 0.004, reduced ? 1 : k * 0.6)
    if (moving) dirty = true
    if (dirty) { dirty = false; draw(); listeners.forEach((fn) => fn(api)) }
    if (moving) schedule()
  }
  const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(tick) }
  const wake = () => { dirty = true; schedule() }
  const retarget = (snap) => {
    Object.assign(goal, pose())
    if (snap) { Object.assign(cam, goal); calm.v = calmGoal.v }
    wake()
  }

  /* ----- input (map in front only) ----- */
  const clampTarget = () => {
    goal.tx = Math.max(-halfX * 0.75, Math.min(halfX * 0.75, goal.tx))
    goal.tz = Math.max(-halfZ * 0.75, Math.min(halfZ * 0.75, goal.tz))
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
    goal.dist = Math.max(15000, Math.min(fitDist(90) * 1.6, goal.dist * factor))
    cam.dist = goal.dist
  }
  const pointers = new Map()
  const onDown = (e) => { if (look === 'bg') return; canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); userMovedFlag = true }
  const onMove = (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (pointers.size === 1) {
      if (mode === '3d' && !(e.shiftKey || e.ctrlKey || e.button === 2 || (e.buttons & 2))) {
        goal.yaw -= dx * 0.35; goal.el = Math.max(14, Math.min(86, goal.el + dy * 0.3))
        cam.yaw = goal.yaw; cam.el = goal.el
      } else pan(dx, dy)
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const other = a === p ? b : a
      const before = Math.hypot(p.x - other.x, p.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      if (before > 0 && after > 0) zoom(before / after)
      pan(dx / 2, dy / 2)
    }
    p.x = e.clientX; p.y = e.clientY
    wake()
  }
  const onUp = (e) => { pointers.delete(e.pointerId) }
  const onWheel = (e) => { if (look === 'bg') return; e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); userMovedFlag = true; wake() }
  const onMenu = (e) => e.preventDefault()
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onMenu)
  const ro = new ResizeObserver(() => { resize(); if (!userMovedFlag) retarget(true); else wake() })
  ro.observe(canvas)
  const onLost = (e) => e.preventDefault()
  canvas.addEventListener('webglcontextlost', onLost)

  const api = {
    meta,
    toWorld,
    project,
    setMode(m) { mode = m; userMovedFlag = false; if (look !== 'bg') retarget(false) },
    /** 'bg' = the quiet backdrop behind the album cards; 'front' = the interactive map. */
    setLook(l, snap = false) {
      look = l
      calmGoal.v = l === 'bg' ? 1 : 0
      dprCap = l === 'bg' ? 1.25 : 2
      userMovedFlag = false
      retarget(snap)
    },
    get look() { return look },
    /** Page scroll progress 0..1 in the backdrop: the camera swings a little. */
    setScroll(p, snap = false) { scroll = p; if (look === 'bg') retarget(snap) },
    resetView() { userMovedFlag = false; retarget(false) },
    setReducedMotion(r) { reduced = r },
    redraw: wake,
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    get frames() { return frames },
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onMenu)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
  resize()
  retarget(true)
  return api
}
