/**
 * Builds the data for every hike album's route view (the Route button on #/c/<catalog>/<album>): detailed track stats, a baked elevation
 * model and nearby names. Needs network (AWS Terrain Tiles, OpenStreetMap) and `sharp`.
 *   node scripts/build-routes.mjs            all albums in src/lab/hikeAlbums.json (shared with the lab pages) that have no data yet
 *   node scripts/build-routes.mjs <slug>...  just these (rebuilds them)
 *   node scripts/build-routes.mjs --detail-only [<slug>...]  redo track stats, names and labels from gpx/ (e.g. after scripts/clean-gpx.mjs), keep the baked terrain,
 *                                            and warn when a track no longer fits inside its baked terrain
 * Writes src/route/<slug>/{detail.json,terrain.json} and public/route/<slug>/{dem.bin,buildings.bin}.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const albums = JSON.parse(readFileSync('src/lab/hikeAlbums.json', 'utf8'))
const acts = JSON.parse(readFileSync('src/lab/activities.json', 'utf8'))
const files = readdirSync('gpx').filter((f) => f.endsWith('.gpx'))
const args = process.argv.slice(2)
const RELABEL = args.includes('--relabel') // keep the baked terrain and tracks, only redo the landmark labels
const DETAIL_ONLY = args.includes('--detail-only')
const only = args.filter((a) => !a.startsWith('--'))
const overrides = existsSync('src/route/overrides.json') ? JSON.parse(readFileSync('src/route/overrides.json', 'utf8')) : {}
const rad = (d) => (d * Math.PI) / 180
const hav = (a, b) => 2 * 6371008.8 * Math.asin(Math.sqrt(Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2))

for (const [key, ns] of Object.entries(albums)) {
  const slug = key.split('/')[1]
  if (only.length ? !only.includes(slug) : !RELABEL && !DETAIL_ONLY && existsSync(`src/route/${slug}/detail.json`)) continue
  console.log(`\n== ${slug}`)
  const dir = `src/route/${slug}`
  mkdirSync(dir, { recursive: true })
  let detail
  if (RELABEL) detail = JSON.parse(readFileSync(`${dir}/detail.json`, 'utf8'))
  else {
    const specs = ns.map((n) => `t${n}:x:gpx/${files.find((f) => f.startsWith(String(n).padStart(2, '0') + '_'))}`)
    execFileSync('node', ['scripts/gpx-detail.mjs', `${dir}/detail.json`, ...specs], { stdio: 'inherit' })
    detail = JSON.parse(readFileSync(`${dir}/detail.json`, 'utf8'))
    detail.tracks.sort((a, b) => a.start.localeCompare(b.start))

    // Names the tracks: Ascent/Descent for an up-and-down pair, the time of day for same-day recordings, "Route" for one.
    const T = detail.tracks
    T.forEach((t, i) => {
      const n = ns.find((m) => `t${m}` === t.id)
      const act = acts.find((a) => a.n === n)
      t.n = n
      t.minutes = act?.minutes ?? null
      t.title = act?.title ?? t.name
      t.id = i === 0 ? 'ascent' : 'descent' // style ids: first = black line, second = grey
    })
    if (T.length === 1) T[0].label = 'Route'
    else {
      const net = (t) => t.stats.endEle - t.stats.startEle
      const paren = (t) => (t.title.match(/\(([^)]+)\)\s*$/) || [])[1]
      if (T.every(paren)) T.forEach((t) => (t.label = paren(t).replace(/^./, (c) => c.toUpperCase())))
      else if (net(T[0]) > 50 && net(T[1]) < -50) { T[0].label = 'Ascent'; T[1].label = 'Descent' }
      else T.forEach((t, i) => (t.label = i ? 'Second recording' : 'First recording'))
    }

    // Bounding box with room around the route.
    const pts = T.flatMap((t) => t.points)
    const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1])
    const [s0, n0, w0, e0] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
    const padLat = Math.max(0.028, (n0 - s0) * 0.35), padLng = Math.max(0.04, (e0 - w0) * 0.35)
    const box = [s0 - padLat, w0 - padLng, n0 + padLat, e0 + padLng]
    const widthM = (box[3] - box[1]) * 111320 * Math.cos(rad(s0)), heightM = (box[2] - box[0]) * 110574
    // Cells of about 6.7 m: swissALTI3D (2 m LiDAR) holds real detail at that size (see bake-terrain.mjs). Large extents are coarsened to at most
    // ~1.6 M cells, which keeps dem.bin under ~0.8 MB and the per-pixel detail texture affordable on phones. CELL=<m> overrides (e.g. CELL=13.4).
    const target = Math.max(+(process.env.CELL || 6.7), Math.sqrt((widthM * heightM) / 1.6e6))
    if (!DETAIL_ONLY) execFileSync('node', ['scripts/bake-terrain.mjs', `route/${slug}`, ...box.map((v) => v.toFixed(5)), '13', target.toFixed(1), `--tracks=${dir}/detail.json`], { stdio: 'inherit' })
    else {
      const b = JSON.parse(readFileSync(`${dir}/terrain.json`, 'utf8')).bounds
      const margin = 0.012 // about 1.3 km: the labels and the camera want some terrain around the route
      if (s0 < b.south + margin || n0 > b.north - margin || w0 < b.west + margin || e0 > b.east - margin) console.warn(`  ! track is within ${margin} deg of the baked terrain edge: consider re-baking ${slug}`)
    }
  }

  const T = detail.tracks
  // Landmarks: the start and finish take the closest village, station or hut (peaks are never a trailhead); the top takes the closest peak, hut, pass or viewpoint.
  const terrain = JSON.parse(readFileSync(`${dir}/terrain.json`, 'utf8'))
  const clean = (n) => n.replace(/^\((.*)\)$/, '$1').trim()
  const named = terrain.peaks.map((q) => ({ ...q, name: clean(q.name) })).filter((q) => q.name && !/^(parking|restaurant|p)$/i.test(q.name))
  const nearest = (p, kinds, r, bias = {}) =>
    named.filter((q) => kinds.includes(q.kind)).map((q) => [hav(p, [q.lat, q.lng]) * (bias[q.kind] ?? 1), q]).filter(([d]) => d < r).sort((a, b) => a[0] - b[0])[0]?.[1]
  const first = T[0].points[0]
  const top = T[0].points.reduce((b, p) => (p[2] > b[2] ? p : b))
  const last = T[0].points[T[0].points.length - 1]
  const loop = hav(first, last) < 400
  const ov = overrides[slug] || {}
  const labelKind = (q) => (q?.kind === 'hut' ? 'hut' : ['peak', 'pass', 'view'].includes(q?.kind) ? 'peak' : 'place')
  const pick = (key, text, kind, p) => ({ key, text, kind, lat: p[0], lng: p[1], ele: p[2] })
  const trail = (p, fallback, over) => {
    if (over) return [over, 'place']
    // Villages and stations first; a named restaurant or car park only counts when it is right at the trailhead.
    const q = nearest(p, ['place', 'station', 'hut'], 1200, { station: 1.2 }) || nearest(p, ['poi'], 120)
    return [q?.name || fallback, labelKind(q)]
  }
  const labels = []
  { const [t, k] = trail(first, 'Start', ov.start); labels.push(pick('start', t, k, first)) }
  if (hav(first, top) > 400) {
    // A summit, hut, pass or viewpoint near the highest point; failing that a village right on it; else just "Highest point".
    const tp = nearest(top, ['peak', 'hut', 'pass', 'view'], 500) || nearest(top, ['place'], 150)
    labels.push(pick('top', ov.top || tp?.name || 'Highest point', ov.top || !tp ? 'peak' : labelKind(tp), top))
  }
  if (!loop && hav(last, top) > 400 && hav(last, first) > 400) {
    const [t, k] = trail(last, 'Finish', ov.end)
    labels.push(pick('end', t, k, last))
  }
  // Two labels with one name (e.g. the start and the finish in the same village) are collapsed into the first.
  detail.labels = labels.filter((l, i) => labels.findIndex((m) => m.text === l.text) === i)
  writeFileSync(`${dir}/detail.json`, JSON.stringify(detail))
  console.log(T.map((t) => `${t.label}: ${t.stats.km} km`).join(' | '), '|', labels.map((l) => l.text).join(', '))
}
