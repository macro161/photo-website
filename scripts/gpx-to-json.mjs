/**
 * Converts an AllTrails GPX recording into a compact track JSON for the Lab pages.
 *   node scripts/gpx-to-json.mjs <file.gpx> <activity n> [out.json]
 * Output: { activity, name, start, bounds, km, gain, points: [[lat, lng, ele, km]] }
 * Points are thinned to roughly one per 10 m; gain uses a 10 m hysteresis (AllTrails' own gain figure is lower, so treat as approximate) to ignore noise.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [file, n, out = `src/lab/tracks/${n}.json`] = process.argv.slice(2)
if (!file || !n) throw new Error('usage: gpx-to-json.mjs <file.gpx> <activity n> [out.json]')
const xml = readFileSync(file, 'utf8')
const name = (xml.match(/<name><!\[CDATA\[(.*?)\]\]>/) || [])[1] || ''
const pts = [...xml.matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)">\s*<ele>([\d.-]+)<\/ele>(?:\s*<time>([^<]*)<\/time>)?/g)]
  .map((m) => ({ lat: +m[1], lng: +m[2], ele: +m[3], time: m[4] }))

const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180
const dist = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

let total = 0, gain = 0, ref = pts[0].ele
const withKm = pts.map((p, i) => {
  if (i) total += dist(pts[i - 1], p)
  if (p.ele - ref >= 10) { gain += p.ele - ref; ref = p.ele } else if (p.ele < ref) ref = p.ele
  return { ...p, km: total / 1000 }
})
const thinned = withKm.filter((p, i) => i === 0 || i === withKm.length - 1 || i % 3 === 0)
const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng)
const result = {
  activity: +n, name, start: pts[0].time || null, source: 'AllTrails GPX',
  bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
  km: +(total / 1000).toFixed(2), gain: Math.round(gain),
  minEle: Math.min(...pts.map((p) => p.ele)), maxEle: Math.max(...pts.map((p) => p.ele)),
  points: thinned.map((p) => [+p.lat.toFixed(5), +p.lng.toFixed(5), Math.round(p.ele), +p.km.toFixed(3)]),
}
writeFileSync(out, JSON.stringify(result))
console.log(`${name}: ${pts.length} -> ${result.points.length} points, ${result.km} km, +${result.gain} m, ele ${result.minEle}-${result.maxEle} -> ${out}`)
