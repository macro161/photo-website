/**
 * Cleans GPS jumps out of the AllTrails GPX recordings in gpx/.
 *   node scripts/clean-gpx.mjs --dry [n ...]     report only, per recording (n = activity numbers, default all)
 *   node scripts/clean-gpx.mjs [n ...]           write cleaned files into gpx/ (originals are copied once to gpx/original/ and never touched again)
 *   --json <file>                                also write the report as JSON
 *   --smooth                                     also apply the optional smoothing
 *
 * The cleaner always reads gpx/original/ when it exists, so re-running is deterministic.
 *
 * What it does (all thresholds are constants below):
 *  1. Vehicle / lift runs are protected: a long, straight, fast, steady stretch (a car, bus, train or gondola logged by AllTrails) is real
 *     movement and is never touched; it is only reported.
 *  2. Position outliers: the largest subset of points in which every consecutive pair is reachable on foot (speed <= VMAX plus a GPS
 *     error allowance) is kept (dynamic programming over a window). Spikes, out-and-back excursions and multipath zigzags are dropped; the track
 *     is simply drawn straight between the surviving neighbours. Honest gaps in the recording (a phone that stopped logging for 20 min) stay as they are:
 *     a straight line across a long gap is not a jump, there is just no data inside it.
 *  3. Elevation spikes: short runs of points far above or below two agreeing neighbours are replaced by the line between those neighbours.
 *  4. Optional (--smooth, off by default): mild position smoothing (1-2-1) between points sampled a few seconds apart, never moving a point more than SMOOTH_MAX metres.
 *     Off by default because it only trims 1-3% of the distance and the jump removal is what fixes the visible defects.
 * Timestamps are never changed; removed points leave their neighbours' times alone.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

const VMAX = 6.0 // m/s (21.6 km/h) over a few seconds: faster than a hiker or a downhill runner sustains
const VLONG = 2.5 // m/s (9 km/h) averaged over a gap of two minutes or more (a hiker with rests never averages that); in between it is interpolated
const TOL = 30 // m: GPS error allowance on top of VMAX * dt
const WINDOW = 80 // points the DP looks back
const BREAK_PENALTY = 4 // points a chain break costs, so isolated bad stretches are cut rather than dragging the whole line
const ELE_SPIKE = 25 // m
const SMOOTH_DT = 12, SMOOTH_MAX = 6 // s, m
const VEH = { vMin: 12, vMax: 120, dtMax: 60, minSteps: 8, minLen: 250, straight: 0.7, turn: 20, meanMax: 80 } // meanMax km/h: faster 'runs' are position bursts, not vehicles

const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180
const dist = (a, b) => {
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
const bearing = (a, b) => (Math.atan2((b.lng - a.lng) * Math.cos(rad(a.lat)), b.lat - a.lat) * 180) / Math.PI

export function parse(xml) {
  const pts = []
  const re = /\s*<trkpt lat="([\d.-]+)" lon="([\d.-]+)">\s*<ele>([\d.-]+)<\/ele>(?:\s*<time>([^<]*)<\/time>)?\s*<\/trkpt>/g
  for (const m of xml.matchAll(re)) pts.push({ lat: +m[1], lng: +m[2], ele: +m[3], t: m[4] ? Date.parse(m[4]) : null, index: m.index, len: m[0].length })
  return pts
}

export function stats(pts) {
  let m = 0, maxStep = 0
  for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); m += d; maxStep = Math.max(maxStep, d) }
  let gain = 0, ref = pts[0].ele
  for (const p of pts) { if (p.ele - ref >= 10) { gain += p.ele - ref; ref = p.ele } else if (ref - p.ele >= 10) ref = p.ele }
  return { km: m / 1000, gain: Math.round(gain), maxStep }
}

/** Indices (into pts) of fast, straight, steady runs: vehicles and lifts. Returns [{a, b, m, kmh}] with a..b inclusive point indices. */
function vehicleRuns(pts) {
  const runs = []
  let cur = []
  const flush = () => {
    if (cur.length >= VEH.minSteps) {
      const a = cur[0] - 1, b = cur[cur.length - 1]
      let path = 0
      const turns = []
      for (let i = a + 1; i <= b; i++) {
        path += dist(pts[i - 1], pts[i])
        if (i > a + 1) { let d = Math.abs(bearing(pts[i - 1], pts[i]) - bearing(pts[i - 2], pts[i - 1])); if (d > 180) d = 360 - d; turns.push(d) }
      }
      turns.sort((x, y) => x - y)
      const net = dist(pts[a], pts[b])
      const dt = (pts[b].t - pts[a].t) / 1000
      if (path >= VEH.minLen && (path / dt) * 3.6 <= VEH.meanMax && net / path >= VEH.straight && turns[turns.length >> 1] <= VEH.turn) runs.push({ a, b, m: Math.round(path), kmh: Math.round((path / dt) * 3.6) })
    }
    cur = []
  }
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].t - pts[i - 1].t) / 1000
    const v = dt > 0 ? (dist(pts[i - 1], pts[i]) / dt) * 3.6 : 0
    if (v >= VEH.vMin && v <= VEH.vMax && dt <= VEH.dtMax) cur.push(i)
    else flush()
  }
  flush()
  return runs
}

/** Keeps the largest set of points that can be walked in order (see header). Returns a boolean keep[] array. */
function keepSet(pts, protect) {
  const n = pts.length
  const w = pts.map((_, i) => (protect[i] != null ? 1000 : 1))
  const dp = new Float64Array(n), prev = new Int32Array(n).fill(-1)
  const feasible = (i, j) => {
    if (protect[i] != null && protect[i] === protect[j]) return true
    const dt = Math.max(0, (pts[j].t - pts[i].t) / 1000)
    const v = dt <= 15 ? VMAX : dt >= 120 ? VLONG : VMAX + ((VLONG - VMAX) * (dt - 15)) / 105
    return dist(pts[i], pts[j]) <= v * dt + TOL
  }
  for (let j = 0; j < n; j++) {
    let best = j <= WINDOW ? 0 : -Infinity, bi = -1
    for (let i = Math.max(0, j - WINDOW); i < j; i++) {
      const v = dp[i] - (feasible(i, j) ? 0 : BREAK_PENALTY)
      if (v > best || (v === best && bi !== -1 && i > bi)) { best = v; bi = i }
    }
    dp[j] = w[j] + best
    prev[j] = bi
  }
  let end = n - 1
  for (let j = Math.max(0, n - 1 - WINDOW); j < n; j++) if (dp[j] > dp[end] || (dp[j] === dp[end] && j > end)) end = j
  const keep = new Array(n).fill(false)
  for (let j = end; j !== -1; j = prev[j]) keep[j] = true
  return keep
}

/**
 * Elevation spikes: a run of 1-4 kept points that all sit more than ELE_SPIKE above (or below) both neighbours, while those neighbours agree with each other,
 * is replaced by the line between the neighbours. Real climbs and descents (the neighbours then differ) are never touched.
 * Returns the number of points replaced.
 */
function fixElevation(k) {
  const out = k.map((p) => p.ele)
  let fixed = 0
  for (let i = 1; i < k.length - 1; i++) {
    for (let len = 1; len <= 4 && i + len < k.length; len++) {
      const a = out[i - 1], b = out[i + len]
      if (Math.abs(a - b) > ELE_SPIKE / 2) continue
      let up = true, down = true
      for (let j = i; j < i + len; j++) { if (!(out[j] - Math.max(a, b) > ELE_SPIKE)) up = false; if (!(Math.min(a, b) - out[j] > ELE_SPIKE)) down = false }
      if (up || down) {
        for (let j = i; j < i + len; j++) out[j] = Math.round((a + ((b - a) * (j - i + 1)) / (len + 1)) * 100) / 100
        fixed += len
        i += len - 1
        break
      }
    }
  }
  k.forEach((p, i) => (p.ele2 = out[i]))
  return fixed
}

function smooth(k, on) {
  let moved = 0
  const out = k.map((p) => ({ lat: p.lat, lng: p.lng }))
  if (on) {
    for (let i = 1; i < k.length - 1; i++) {
      const a = k[i - 1], p = k[i], b = k[i + 1]
      if ((p.t - a.t) / 1000 > SMOOTH_DT || (b.t - p.t) / 1000 > SMOOTH_DT) continue
      const lat = (a.lat + 2 * p.lat + b.lat) / 4, lng = (a.lng + 2 * p.lng + b.lng) / 4
      if (dist(p, { lat, lng }) <= SMOOTH_MAX) { out[i] = { lat, lng }; moved++ }
    }
  }
  k.forEach((p, i) => { p.lat2 = out[i].lat; p.lng2 = out[i].lng })
  return moved
}

export function clean(xml, { smoothing = false } = {}) {
  const pts = parse(xml)
  const before = stats(pts)
  const runs = vehicleRuns(pts)
  const protect = new Array(pts.length).fill(null)
  runs.forEach((r, ri) => { for (let i = r.a; i <= r.b; i++) protect[i] = ri })
  const keep = keepSet(pts, protect)
  const kept = pts.filter((_, i) => keep[i])
  const removed = pts.length - kept.length
  const eleFixed = fixElevation(kept)
  const smoothed = smooth(kept, smoothing)
  const after = stats(kept.map((p) => ({ lat: p.lat2, lng: p.lng2, ele: p.ele2, t: p.t })))
  // Rebuild the text: drop removed points, rewrite changed ones.
  let out = '', pos = 0, ki = 0
  pts.forEach((p, i) => {
    out += xml.slice(pos, p.index)
    pos = p.index + p.len
    if (!keep[i]) return
    const q = kept[ki++]
    let block = xml.slice(p.index, p.index + p.len)
    if (q.lat2 !== q.lat || q.lng2 !== q.lng) block = block.replace(/lat="[\d.-]+" lon="[\d.-]+"/, `lat="${q.lat2.toFixed(6)}" lon="${q.lng2.toFixed(6)}"`)
    if (q.ele2 !== q.ele) block = block.replace(/<ele>[\d.-]+<\/ele>/, `<ele>${q.ele2.toFixed(2)}</ele>`)
    out += block
  })
  out += xml.slice(pos)
  const lats = kept.map((p) => p.lat2), lngs = kept.map((p) => p.lng2)
  out = out.replace(/<bounds [^>]*\/>/, `<bounds minlat="${Math.min(...lats).toFixed(5)}" minlon="${Math.min(...lngs).toFixed(5)}" maxlat="${Math.max(...lats).toFixed(5)}" maxlon="${Math.max(...lngs).toFixed(5)}"/>`)
  const removedPts = pts.filter((_, i) => !keep[i])
  return {
    xml: out,
    report: {
      points: pts.length, removed, eleFixed, smoothed,
      before, after: { km: after.km, gain: after.gain, maxStep: after.maxStep },
      vehicleRuns: runs.map((r) => `${r.a}-${r.b} ${r.m} m at ${r.kmh} km/h`),
      removedMaxStep: removedPts.length ? Math.round(Math.max(...removedPts.map((p) => { const i = pts.indexOf(p); return Math.max(i ? dist(pts[i - 1], p) : 0, i < pts.length - 1 ? dist(p, pts[i + 1]) : 0) }))) : 0,
    },
  }
}

if (process.argv[1] && process.argv[1].endsWith('clean-gpx.mjs')) {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null
  const smoothing = args.includes('--smooth')
  const nums = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--json').map(Number)
  const acts = JSON.parse(readFileSync('src/lab/activities.json', 'utf8'))
  mkdirSync('gpx/original', { recursive: true })
  const files = readdirSync('gpx').filter((f) => f.endsWith('.gpx')).sort()
  const rows = []
  for (const f of files) {
    const n = +f.slice(0, 2)
    if (nums.length && !nums.includes(n)) continue
    const orig = `gpx/original/${f}`
    if (!existsSync(orig)) { if (dry) { /* read in place */ } else copyFileSync(`gpx/${f}`, orig) }
    const src = existsSync(orig) ? orig : `gpx/${f}`
    const { xml, report } = clean(readFileSync(src, 'utf8'), { smoothing })
    const a = acts.find((x) => x.n === n)
    rows.push({ n, file: f, ...report, alltrails: a ? { km: a.km, gain: a.gain } : null })
    if (!dry) writeFileSync(`gpx/${f}`, xml)
  }
  console.log('n   pts  removed eleFix smooth | km before->after (AllTrails) | gain before->after (AllTrails) | removed-pt max step m | vehicle runs')
  for (const r of rows) {
    console.log(String(r.n).padStart(2), String(r.points).padStart(5), String(r.removed).padStart(6), String(r.eleFixed).padStart(6), String(r.smoothed).padStart(6), '|',
      r.before.km.toFixed(1).padStart(5), '->', r.after.km.toFixed(1).padStart(5), `(${r.alltrails?.km ?? '-'})`, '|',
      String(r.before.gain).padStart(5), '->', String(r.after.gain).padStart(5), `(${r.alltrails?.gain ?? '-'})`, '|', String(r.removedMaxStep).padStart(5), '|', r.vehicleRuns.join('; '))
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1))
}
