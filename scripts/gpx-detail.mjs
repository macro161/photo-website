/**
 * Detailed stats for a few GPX recordings (lab "Valsorey" page).
 *   node scripts/gpx-detail.mjs <out.json> <id:label:file.gpx>...
 * Output: { tracks: [{ id, label, name, date, start, end, stats, points }] }
 * points are [lat, lng, ele, km, sec] (sec since the first point), thinned to roughly one per 10 m,
 * plus the raw stats computed from the full-resolution GPX (gain/loss use a 10 m hysteresis,
 * so they run a little different from AllTrails' own figures).
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [out, ...specs] = process.argv.slice(2)
if (!out || !specs.length) throw new Error('usage: gpx-detail.mjs <out.json> <id:label:file.gpx>...')

const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180
const dist = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const tracks = specs.map((spec) => {
  const [id, label, file] = spec.split(':')
  const xml = readFileSync(file, 'utf8')
  const name = (xml.match(/<name><!\[CDATA\[(.*?)\]\]>/) || [])[1] || ''
  const pts = [...xml.matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)">\s*<ele>([\d.-]+)<\/ele>(?:\s*<time>([^<]*)<\/time>)?/g)]
    .map((m) => ({ lat: +m[1], lng: +m[2], ele: +m[3], t: m[4] ? Date.parse(m[4]) : null }))
  if (pts.length < 2) throw new Error(`no points in ${file}`)

  let meters = 0, gain = 0, loss = 0, ref = pts[0].ele
  let lo = Infinity, hi = -Infinity, maxSpeed = 0
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i])
    meters += d
    cum.push(meters)
  }
  // Elevation totals with a 10 m hysteresis to ignore GPS noise.
  for (const p of pts) {
    lo = Math.min(lo, p.ele); hi = Math.max(hi, p.ele)
    if (p.ele - ref >= 10) { gain += p.ele - ref; ref = p.ele }
    else if (ref - p.ele >= 10) { loss += ref - p.ele; ref = p.ele }
  }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t
  const elapsed = t0 != null && t1 != null ? (t1 - t0) / 1000 : null
  const first = pts[0], last = pts[pts.length - 1]

  const points = []
  let lastKm = -1
  pts.forEach((p, i) => {
    const km = cum[i] / 1000
    if (i === 0 || i === pts.length - 1 || km - lastKm >= 0.01) {
      points.push([+p.lat.toFixed(5), +p.lng.toFixed(5), Math.round(p.ele), +km.toFixed(3), t0 != null && p.t != null ? Math.round((p.t - t0) / 1000) : 0])
      lastKm = km
    }
  })

  return {
    id, label, name,
    start: t0 != null ? new Date(t0).toISOString() : null,
    end: t1 != null ? new Date(t1).toISOString() : null,
    stats: {
      km: +(meters / 1000).toFixed(2),
      gain: Math.round(gain), loss: Math.round(loss),
      minEle: Math.round(lo), maxEle: Math.round(hi),
      startEle: Math.round(first.ele), endEle: Math.round(last.ele),
      elapsedSec: elapsed,
    },
    points,
  }
})

writeFileSync(out, JSON.stringify({ tracks }))
for (const t of tracks) console.log(t.id, t.label, JSON.stringify(t.stats), t.points.length, 'points')
