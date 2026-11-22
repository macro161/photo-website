// Projection and interpolation helpers for the Valsorey route page. Points are [lat, lng, ele, km, sec].

const M_PER_DEG = 111320

/** Projects several tracks into one W x H box with a shared scale (equirectangular, cos(lat) corrected, north up). */
export function projectTracks(tracks, W, H, pad = 40) {
  const all = tracks.flatMap((t) => t.points)
  const lat0 = all.reduce((s, p) => s + p[0], 0) / all.length
  const c = Math.cos((lat0 * Math.PI) / 180)
  const xs = all.map((p) => p[1] * c), ys = all.map((p) => -p[0])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY
  const s = Math.min((W - 2 * pad) / (w || 1), (H - 2 * pad) / (h || 1))
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2
  const xy = (p) => [ox + (p[1] * c - minX) * s, oy + (-p[0] - minY) * s]
  return {
    paths: tracks.map((t) => t.points.map(xy)),
    /** Pixels in the W x H box that equal one kilometre on the ground. */
    kmPx: (1000 / M_PER_DEG) * s,
  }
}

export const toPath = (xy) => 'M' + xy.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')

/** Index of the last point at or before `km`, and the fraction towards the next. */
function locate(points, km) {
  const k = Math.min(Math.max(km, 0), points[points.length - 1][3])
  let a = 0, b = points.length - 1
  while (b - a > 1) {
    const m = (a + b) >> 1
    if (points[m][3] <= k) a = m
    else b = m
  }
  const span = points[b][3] - points[a][3]
  return { a, b, f: span > 0 ? (k - points[a][3]) / span : 0 }
}

/** Interpolated value of column `col` (2 = elevation, 4 = seconds) or projected x/y at `km`. */
export function valueAt(points, km, col) {
  const { a, b, f } = locate(points, km)
  return points[a][col] + (points[b][col] - points[a][col]) * f
}

export function xyAt(path, points, km) {
  const { a, b, f } = locate(points, km)
  return [path[a][0] + (path[b][0] - path[a][0]) * f, path[a][1] + (path[b][1] - path[a][1]) * f]
}

/** Slope in percent over a 200 m window around `km`. */
export function gradeAt(points, km) {
  const total = points[points.length - 1][3]
  const k0 = Math.max(0, km - 0.1), k1 = Math.min(total, km + 0.1)
  if (k1 - k0 < 0.05) return 0
  return ((valueAt(points, k1, 2) - valueAt(points, k0, 2)) / ((k1 - k0) * 1000)) * 100
}

const zurich = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' })
export const clock = (iso, plusSec = 0) => zurich.format(new Date(Date.parse(iso) + plusSec * 1000))

export function duration(sec) {
  const m = Math.round(sec / 60)
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
