// Real GPS tracks: src/lab/tracks/<activity n>.json (see scripts/gpx-to-json.mjs).
const mods = import.meta.glob('../tracks/*.json', { eager: true })
export const TRACKS = Object.values(mods).map((m) => m.default || m)

// Equirectangular projection with cos(lat) correction, fitted into a W x H box.
export function prepareTrack(track, W, H, pad = 40) {
  const pts = track.points
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const c = Math.cos((lat0 * Math.PI) / 180)
  const xs = pts.map((p) => p[1] * c), ys = pts.map((p) => -p[0])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY
  const s = Math.min((W - 2 * pad) / (w || 1), (H - 2 * pad) / (h || 1))
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2
  const xy = pts.map((_, i) => [ox + (xs[i] - minX) * s, oy + (ys[i] - minY) * s])
  const kms = pts.map((p) => p[3])
  const eles = pts.map((p) => p[2])
  const total = kms[kms.length - 1] || track.km || 1
  let lo = Infinity, hi = -Infinity
  eles.forEach((e) => { lo = Math.min(lo, e); hi = Math.max(hi, e) })
  return { xy, kms, eles, total, lo, hi }
}

// Interpolated state at a given km: index of last point at or before, fraction, x, y, ele.
export function stateAt(g, km) {
  const k = Math.min(Math.max(km, 0), g.total)
  let a = 0, b = g.kms.length - 1
  while (b - a > 1) { const m = (a + b) >> 1; if (g.kms[m] <= k) a = m; else b = m }
  const span = g.kms[b] - g.kms[a]
  const f = span > 0 ? (k - g.kms[a]) / span : 0
  const L = (arr) => arr[a] + (arr[b] - arr[a]) * f
  return {
    i: a,
    x: g.xy[a][0] + (g.xy[b][0] - g.xy[a][0]) * f,
    y: g.xy[a][1] + (g.xy[b][1] - g.xy[a][1]) * f,
    ele: L(g.eles),
  }
}
