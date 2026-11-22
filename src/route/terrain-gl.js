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
uniform mat4 uVP;
uniform float uExag;
uniform vec2 uHalf;
uniform vec3 uEye;
out float vElev;
out vec2 vUV;
out float vDist;
void main() {
  vec3 p = vec3(aPos.x, aPos.y * uExag, aPos.z);
  gl_Position = uVP * vec4(p, 1.0);
  vElev = aPos.y;
  vUV = aPos.xz / uHalf;
  vDist = length(p - uEye);
}`

// The mesh is coarse (see createTerrain); the shading comes from full-resolution textures: uDetail = slope x, slope z, curvature, openness,
// uResid = the height the mesh misses (so contours follow every gully).
const TERRAIN_FS = `#version 300 es
precision highp float;
in float vElev;
in vec2 vUV;
in float vDist;
uniform sampler2D uDetail;
uniform sampler2D uResid;
uniform vec3 uLight;
uniform float uMinor;
uniform float uMajor;
uniform float uFog;
uniform float uCalm;
uniform float uExag;
out vec4 o;
float contour(float e, float step, float fw, float soft) {
  float d = abs(fract(e / step - 0.5) - 0.5) * step;
  float line = 1.0 - smoothstep(0.0, soft * fw, d);
  return line * (1.0 - smoothstep(step * 0.3, step * 0.75, fw));
}
float lambert(vec3 n, float az) {
  // light from azimuth az (radians, clockwise from north), 45 degrees up; x east, z south
  return max(dot(n, normalize(vec3(sin(az), 1.0, -cos(az)))), 0.0);
}
void main() {
  vec2 uv = vUV * 0.5 + 0.5;
  vec4 t = texture(uDetail, uv, uCalm * 1.6);         // the backdrop reads coarser mip levels: the shape, not the texture
  vec3 n = normalize(vec3(-t.x * uExag, 1.0, -t.y * uExag));
  float slope = length(t.xy);
  float q = 1.0 - uCalm * 0.6;                       // the quiet backdrop keeps the structure but less of its contrast
  // Multi-directional hillshade: the main light from the north-west plus weaker ones from the west, north and south-west, so
  // ridges facing any way keep their form instead of going flat.
  float key = max(dot(n, uLight), 0.0);
  float md = 0.45 * key + 0.2 * lambert(n, -1.571) + 0.2 * lambert(n, 0.0) + 0.15 * lambert(n, -2.356);
  float g = mix(0.30, 1.06, pow(md, 0.9));
  g += clamp(-t.z * 0.08, -1.0, 1.0) * 0.20 * q;     // ridges catch light, gullies close up
  g -= smoothstep(0.75, 1.6, slope) * 0.22 * q;      // cliffs and rock faces read darker than the scree below them
  g *= mix(1.0, 0.62 + 0.38 * smoothstep(0.55, 0.98, t.w), q);   // valleys and hollows sit deeper
  float e = vElev + texture(uResid, uv).r;
  float fw = max(fwidth(e), 0.001);
  float minor = contour(e, uMinor, fw, 1.0);
  float major = contour(e, uMajor, fw, 1.3);
  g = mix(g, 1.0, uCalm * 0.2);
  g -= (minor * 0.10 + major * 0.24) * (1.0 - uCalm * 0.55);
  float fog = 1.0 - exp(-vDist * uFog);
  g = mix(g, 1.0, fog * 0.8);
  float edge = max(abs(vUV.x), abs(vUV.y));
  float a = 1.0 - smoothstep(0.7, 1.0, edge);
  g = clamp(g, 0.0, 1.0);
  o = vec4(vec3(g) * a, a);
}`

// Buildings: instanced boxes (centre, footprint, base and height per instance) draped on the terrain.
const BLD_VS = `#version 300 es
precision highp float;
in vec3 aCube;     // unit box: x,z in -0.5..0.5, y in 0..1
in vec3 aNormal;
in vec3 aC;        // centre x, base y, centre z (metres)
in vec3 aS;        // width, depth, height (metres)
in float aAng;     // radians, clockwise from east
uniform mat4 uVP;
uniform float uExag;
uniform vec3 uEye;
uniform float uPx;     // metres per pixel per metre of distance
uniform vec2 uHalf;
out vec3 vN;
out float vDist;
out vec2 vUV;
out float vTop;
out float vFade;
void main() {
  float big = max(aS.x, aS.y);
  float px = big / (uPx * length(vec3(aC.x, aC.y * uExag, aC.z) - uEye));   // footprint size on screen, device pixels
  float s = clamp(2.5 / px, 1.0, 1.8);              // a little bigger when small, so a village still reads as blocks
  vFade = smoothstep(0.8, 2.6, px * s);             // and gone once it would be under a couple of pixels (far zoom)
  float c = cos(aAng), sn = sin(aAng);
  vec2 l = vec2(aCube.x * aS.x * s, aCube.z * aS.y * s);
  vec2 w = vec2(l.x * c - l.y * sn, -(l.x * sn + l.y * c));
  vec3 p = vec3(aC.x + w.x, (aC.y + aCube.y * aS.z * s) * uExag, aC.z + w.y);
  gl_Position = uVP * vec4(p, 1.0);
  vN = vec3(aNormal.x * c - aNormal.z * sn, aNormal.y, -(aNormal.x * sn + aNormal.z * c));
  vDist = length(p - uEye);
  vUV = p.xz / uHalf;
  vTop = aCube.y;
}`

const BLD_FS = `#version 300 es
precision highp float;
in vec3 vN;
in float vDist;
in vec2 vUV;
in float vTop;
in float vFade;
uniform vec3 uLight;
uniform float uFog;
uniform float uCalm;
out vec4 o;
void main() {
  if (vFade < 0.02) discard;
  vec3 n = normalize(vN);
  float key = max(dot(n, uLight), 0.0);
  // light grey blocks: pale roofs, walls a step darker on the side away from the light
  float g = n.y > 0.5 ? 0.93 : 0.62 + 0.3 * key;
  g -= 0.06 * (1.0 - vTop) * (1.0 - n.y);
  float fog = 1.0 - exp(-vDist * uFog);
  g = mix(g, 1.0, fog * 0.8);
  float e = max(abs(vUV.x), abs(vUV.y));
  float a = (1.0 - smoothstep(0.7, 1.0, e)) * vFade * (1.0 - uCalm * 0.55);   // faint in the photo backdrop
  o = vec4(vec3(clamp(g, 0.0, 1.0)) * a, a);
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
  const { width: w, height: h, unit } = meta
  if (buf.byteLength !== w * h * 2) throw new Error('elevation size mismatch')
  // Residuals are zigzag-coded uint16, stored as a plane of low bytes followed by a plane of high bytes (see bake-terrain.mjs).
  const bytes = new Uint8Array(buf), n = w * h, resid = new Int16Array(n)
  for (let k = 0; k < n; k++) { const z = bytes[k] | (bytes[n + k] << 8); resid[k] = (z >> 1) ^ -(z & 1) }
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

/** Fetches the baked buildings (see scripts/bake-terrain.mjs): 12-byte records. Returns [] if the file is missing. */
export async function loadBuildings(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const buf = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    const dv = new DataView(buf), u8 = new Uint8Array(buf), out = []
    for (let o = 0; o + 12 <= buf.byteLength; o += 12) {
      out.push({ lat: dv.getInt32(o, true) / 1e6, lng: dv.getInt32(o + 4, true) / 1e6, w: u8[o + 8] / 2, d: u8[o + 9] / 2, h: u8[o + 10] / 2, ang: (u8[o + 11] / 256) * Math.PI })
    }
    return out
  } catch { return [] }
}

/**
 * Per-cell shading inputs from the elevation grid, as RGBA floats:
 * slope dh/dx and dh/dz (Horn 3x3), curvature (the Laplacian at ~1 cell and ~25 m, so both small gullies and broad ridges register),
 * and openness (how much sky each cell sees: horizon angles in 8 directions out to ~400 m; low in hollows and narrow valleys).
 */
async function buildDetail(H, cw, ch, mpp, yieldFn) {
  const out = new Float32Array(cw * ch * 4)
  const h = (i, j) => H[Math.min(ch - 1, Math.max(0, j)) * cw + Math.min(cw - 1, Math.max(0, i))]
  const dirs = []
  for (let k = 0; k < 8; k++) dirs.push([Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)])
  // Horizon search distances in cells (about 20, 45, 100, 200 and 400 m whatever the cell size).
  const steps = [...new Set([20, 45, 100, 200, 400].map((m) => Math.max(1, Math.round(m / mpp))))]
  const r3 = Math.max(2, Math.round(25 / mpp))
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const o = (j * cw + i) * 4, c = H[j * cw + i]
      const a = h(i - 1, j - 1), b = h(i, j - 1), cc = h(i + 1, j - 1), d = h(i - 1, j), f = h(i + 1, j), g = h(i - 1, j + 1), hh = h(i, j + 1), ii = h(i + 1, j + 1)
      out[o] = ((cc + 2 * f + ii) - (a + 2 * d + g)) / (8 * mpp)
      out[o + 1] = ((g + 2 * hh + ii) - (a + 2 * b + cc)) / (8 * mpp)
      // Curvature in metres of height per (13 m)^2, so the shader's scale does not depend on the cell size.
      const lap1 = (d + f + b + hh - 4 * c) / (mpp * mpp)
      const lap3 = (h(i - r3, j) + h(i + r3, j) + h(i, j - r3) + h(i, j + r3) - 4 * c) / (r3 * r3 * mpp * mpp)
      out[o + 2] = (lap1 * 0.25 + lap3 * 3.6) * 180
      let open = 0
      for (let k = 0; k < 8; k++) {
        let m = 0
        for (let q = 0; q < steps.length; q++) {
          const st = steps[q]
          const e = (h(Math.round(i + dirs[k][0] * st), Math.round(j + dirs[k][1] * st)) - c) / (st * mpp)
          if (e > m) m = e
        }
        open += 1 - Math.atan(m) / (Math.PI / 2)
      }
      out[o + 3] = open / 8
    }
    if (j % 32 === 31) await yieldFn()
  }
  return out
}

/** Uploads a float texture with a box-filtered mip chain (half-float targets cannot use generateMipmap), so far terrain doesn't shimmer. */
function floatTexture(gl, data, w, h, comps) {
  const fmt = comps === 4 ? [gl.RGBA16F, gl.RGBA] : [gl.R16F, gl.RED]
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  let level = 0, d = data, cw = w, ch = h
  for (;;) {
    gl.texImage2D(gl.TEXTURE_2D, level, fmt[0], cw, ch, 0, fmt[1], gl.FLOAT, d)
    if (cw === 1 && ch === 1) break
    const nw = Math.max(1, cw >> 1), nh = Math.max(1, ch >> 1), n = new Float32Array(nw * nh * comps)
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const i0 = Math.min(cw - 1, i * 2), i1 = Math.min(cw - 1, i * 2 + 1), j0 = Math.min(ch - 1, j * 2), j1 = Math.min(ch - 1, j * 2 + 1)
      for (let k = 0; k < comps; k++) n[(j * nw + i) * comps + k] = (d[(j0 * cw + i0) * comps + k] + d[(j0 * cw + i1) * comps + k] + d[(j1 * cw + i0) * comps + k] + d[(j1 * cw + i1) * comps + k]) / 4
    }
    d = n; cw = nw; ch = nh; level++
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
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

export async function createTerrain(canvas, meta, H, tracks, buildings = []) {
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

  /* ----- terrain mesh: decimated (every `stride`-th cell) so phones are not drawing a million triangles; shading uses the full-resolution detail texture ----- */
  const stride = Math.max(1, Math.ceil(Math.sqrt((cw * ch * 2) / 400000)))   // at most ~400k triangles (every 3rd cell for a 1.6 M cell grid; the old full-res mesh had ~540k)
  const gridIdx = (n) => { const a = []; for (let i = 0; i < n; i += stride) a.push(i); if (a[a.length - 1] !== n - 1) a.push(n - 1); return a }
  const gx = gridIdx(cw), gy = gridIdx(ch), nx = gx.length, ny = gy.length
  const verts = new Float32Array(nx * ny * 3)
  for (let b = 0; b < ny; b++) {
    for (let a = 0; a < nx; a++) {
      const i = gx[a], j = gy[b], o = (b * nx + a) * 3
      verts[o] = (i + 0.5 - cw / 2) * mpp
      verts[o + 1] = H[j * cw + i]
      verts[o + 2] = (j + 0.5 - ch / 2) * mpp
    }
  }
  await yieldMain()
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6)
  let t = 0
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
    idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d
  }
  await yieldMain()
  const terrain = program(gl, TERRAIN_VS, TERRAIN_FS)
  const tVao = gl.createVertexArray()
  gl.bindVertexArray(tVao)
  const tvb = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, tvb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(terrain.p, 'aPos')
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 12, 0)
  const tib = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  gl.bindVertexArray(null)

  const detail = await buildDetail(H, cw, ch, mpp, yieldMain)
  const detailTex = floatTexture(gl, detail, cw, ch, 4)
  // What the decimated mesh misses: full-resolution height minus the mesh's own (triangle-interpolated) height, added back per pixel
  // so contour lines follow every gully instead of the coarse mesh.
  const resid = new Float32Array(cw * ch)
  for (let b = 0; b < ny - 1; b++) {
    const j0 = gy[b], j1 = gy[b + 1]
    for (let a = 0; a < nx - 1; a++) {
      const i0 = gx[a], i1 = gx[a + 1]
      const A = H[j0 * cw + i0], B = H[j0 * cw + i1], C = H[j1 * cw + i0], D = H[j1 * cw + i1]
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const fx = (i - i0) / (i1 - i0), fy = (j - j0) / (j1 - j0)
        const m = fx + fy <= 1 ? A + (B - A) * fx + (C - A) * fy : D + (C - D) * (1 - fx) + (B - D) * (1 - fy)
        resid[j * cw + i] = H[j * cw + i] - m
      }
    }
  }
  const residTex = floatTexture(gl, resid, cw, ch, 1)
  // The drawn surface is the coarse mesh, which in a gully can sit above the true ground: the route, buildings and labels go on
  // whichever of the two is higher, so nothing ends up under the mesh.
  const surfaceAt = (x, z) => {
    const gx = Math.min(cw - 1.001, Math.max(0, x / mpp + cw / 2 - 0.5)), gz = Math.min(ch - 1.001, Math.max(0, z / mpp + ch / 2 - 0.5))
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j
    const m = (k) => H[k] - Math.min(0, resid[k])
    return (m(j * cw + i) * (1 - fx) + m(j * cw + i + 1) * fx) * (1 - fz) + (m((j + 1) * cw + i) * (1 - fx) + m((j + 1) * cw + i + 1) * fx) * fz
  }
  await yieldMain()

  /* ----- buildings: one instanced box mesh, per-building centre / size / angle ----- */
  const bld = program(gl, BLD_VS, BLD_FS)
  const bldVao = gl.createVertexArray()
  let bldCount = 0
  {
    // 5 faces (the bottom is never seen): position + normal
    const faces = [
      [[0, 1, 0], [[-.5, 1, -.5], [-.5, 1, .5], [.5, 1, .5], [.5, 1, -.5]]],
      [[1, 0, 0], [[.5, 0, -.5], [.5, 1, -.5], [.5, 1, .5], [.5, 0, .5]]],
      [[-1, 0, 0], [[-.5, 0, .5], [-.5, 1, .5], [-.5, 1, -.5], [-.5, 0, -.5]]],
      [[0, 0, 1], [[.5, 0, .5], [.5, 1, .5], [-.5, 1, .5], [-.5, 0, .5]]],
      [[0, 0, -1], [[-.5, 0, -.5], [-.5, 1, -.5], [.5, 1, -.5], [.5, 0, -.5]]],
    ]
    const cube = [], cubeIdx = []
    faces.forEach(([n, quad], f) => { quad.forEach((q) => cube.push(...q, ...n)); const b = f * 4; cubeIdx.push(b, b + 1, b + 2, b, b + 2, b + 3) })
    const inst = []
    for (const b of buildings) {
      const [x, z] = toWorld(b.lat, b.lng)
      if (Math.abs(x) > halfX || Math.abs(z) > halfZ) continue
      // Sit on the lowest ground under the footprint and reach down a little, so a slope never leaves a gap.
      const c = Math.cos(b.ang), sn = Math.sin(b.ang)
      let lo = Infinity, hi = -Infinity
      for (const [u, v] of [[0, 0], [.5, .5], [.5, -.5], [-.5, .5], [-.5, -.5]]) {
        const lx = u * b.w, ly = v * b.d
        const px = x + lx * c - ly * sn, pz = z - (lx * sn + ly * c)
        lo = Math.min(lo, heightAt(px, pz)); hi = Math.max(hi, surfaceAt(px, pz))
      }
      inst.push(x, lo - 2, z, b.w, b.d, hi - lo + 2 + b.h, b.ang)
    }
    bldCount = inst.length / 7
    gl.bindVertexArray(bldVao)
    const cvb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, cvb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube), gl.STATIC_DRAW)
    const attr = (name, size, stride, off, div = 0) => { const l = gl.getAttribLocation(bld.p, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off); if (div) gl.vertexAttribDivisor(l, div) }
    attr('aCube', 3, 24, 0); attr('aNormal', 3, 24, 12)
    const ivb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, ivb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inst), gl.STATIC_DRAW)
    attr('aC', 3, 28, 0, 1); attr('aS', 3, 28, 12, 1); attr('aAng', 1, 28, 24, 1)
    const cib = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIdx), gl.STATIC_DRAW)
    gl.bindVertexArray(null)
  }

  await yieldMain()
  /* ----- tracks as screen-space ribbons draped on the terrain ----- */
  const line = program(gl, LINE_VS, LINE_FS)
  const lines = tracks.map((tr) => {
    const pts = tr.points.map((p) => { const [x, z] = toWorld(p[0], p[1]); return { x, z, y: surfaceAt(x, z), km: p[3], ele: p[2] } })
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
    gl.uniform1f(terrain.u.uExag, cam.exag)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, detailTex); gl.uniform1i(terrain.u.uDetail, 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, residTex); gl.uniform1i(terrain.u.uResid, 1)
    gl.bindVertexArray(tVao)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0)

    if (bldCount) {
      gl.useProgram(bld.p)
      gl.uniformMatrix4fv(bld.u.uVP, false, vp)
      gl.uniform1f(bld.u.uExag, cam.exag)
      gl.uniform2f(bld.u.uHalf, halfX, halfZ)
      gl.uniform3fv(bld.u.uEye, eye)
      gl.uniform3fv(bld.u.uLight, light)
      gl.uniform1f(bld.u.uFog, 0.00007 * (1 + calm.v * 0.6))
      gl.uniform1f(bld.u.uCalm, calm.v)
      gl.uniform1f(bld.u.uPx, (2 * Math.tan(FOV / 2)) / state.h)
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.bindVertexArray(bldVao)
      gl.drawElementsInstanced(gl.TRIANGLES, 30, gl.UNSIGNED_SHORT, 0, bldCount)
    }

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.depthMask(false)
    gl.useProgram(line.p)
    gl.uniformMatrix4fv(line.u.uVP, false, vp)
    gl.uniform2f(line.u.uRes, state.w, state.h)
    gl.uniform1f(line.u.uExag, cam.exag)
    const wpx = state.dpr * 2.6 * (1 - calm.v * 0.3)
    const calmA = 1 - calm.v * 0.3
    // The descent is drawn first (thinner, mid grey) so the ascent's black line sits on top where the two share the trail.
    ;lines.map((_, i) => lines.length - 1 - i).forEach((i) => {
      const l = lines[i]
      const a = state.alpha[i] * calmA
      if (a < 0.01) return
      const ink = i === 0 ? 0.07 : 0.5, w = i === 0 ? wpx : wpx * 0.8
      gl.bindVertexArray(l.vao)
      gl.uniform1f(line.u.uLift, 7 * cam.exag)
      gl.uniform1f(line.u.uDone, state.done[i])
      gl.uniform1f(line.u.uDash, 0)
      // 1. faint trace where the relief hides the route (with a soft halo, so it still reads over the detailed relief)
      gl.depthFunc(gl.GREATER)
      gl.uniform1f(line.u.uBias, 0)
      gl.uniform1f(line.u.uWidth, w * 0.8 + state.dpr * 3)
      gl.uniform3f(line.u.uColor, 1, 1, 1)
      gl.uniform1f(line.u.uAlpha, 0.45 * a)
      gl.drawElements(gl.TRIANGLES, l.count, gl.UNSIGNED_SHORT, 0)
      gl.uniform1f(line.u.uWidth, w * 0.8)
      gl.uniform3f(line.u.uColor, ink, ink, ink)
      gl.uniform1f(line.u.uAlpha, 0.38 * a)
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
      return [x, surfaceAt(x, z), z]
    },
    toWorld(lat, lng) { const [x, z] = toWorld(lat, lng); return [x, surfaceAt(x, z), z] },
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
    /** Debug / scripting: set camera angles directly. */
    setPose(o) { Object.assign(goal, o); wake() },
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
