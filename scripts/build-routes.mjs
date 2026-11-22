/**
 * Builds the data for every lab route page (#/lab/route/<album>): detailed track stats, a baked elevation
 * model and nearby names. Needs network (AWS Terrain Tiles, OpenStreetMap) and `sharp`.
 *   node scripts/build-routes.mjs            all albums in src/lab/hikeAlbums.json that have no data yet
 *   node scripts/build-routes.mjs <slug>...  just these (rebuilds them)
 * Writes src/lab/routes/<slug>/{detail.json,terrain.json} and public/lab/routes/<slug>/dem.bin.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const albums = JSON.parse(readFileSync('src/lab/hikeAlbums.json', 'utf8'))
const acts = JSON.parse(readFileSync('src/lab/activities.json', 'utf8'))
const files = readdirSync('gpx').filter((f) => f.endsWith('.gpx'))
const only = process.argv.slice(2)
const rad = (d) => (d * Math.PI) / 180
const hav = (a, b) => 2 * 6371008.8 * Math.asin(Math.sqrt(Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2))

for (const [key, ns] of Object.entries(albums)) {
  const slug = key.split('/')[1]
  if (only.length ? !only.includes(slug) : existsSync(`src/lab/routes/${slug}/detail.json`)) continue
  console.log(`\n== ${slug}`)
  const dir = `src/lab/routes/${slug}`
  mkdirSync(dir, { recursive: true })
  const specs = ns.map((n) => `t${n}:x:gpx/${files.find((f) => f.startsWith(String(n).padStart(2, '0') + '_'))}`)
  execFileSync('node', ['scripts/gpx-detail.mjs', `${dir}/detail.json`, ...specs], { stdio: 'inherit' })
  const detail = JSON.parse(readFileSync(`${dir}/detail.json`, 'utf8'))
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
  const target = Math.max(20, Math.ceil(Math.max(widthM, heightM) / 700))
  execFileSync('node', ['scripts/bake-terrain.mjs', `routes/${slug}`, ...box.map((v) => v.toFixed(5)), '13', String(target)], { stdio: 'inherit' })

  // Landmarks at the start and the top, named by the closest OSM feature within 400 m when there is one.
  const terrain = JSON.parse(readFileSync(`${dir}/terrain.json`, 'utf8'))
  const named = terrain.peaks
  const nearest = (p, kinds, r) => named.filter((q) => kinds.includes(q.kind)).map((q) => [hav(p, [q.lat, q.lng]), q]).filter(([d]) => d < r).sort((a, b) => a[0] - b[0])[0]?.[1]
  const first = T[0].points[0]
  const top = T[0].points.reduce((b, p) => (p[2] > b[2] ? p : b))
  const last = T[0].points[T[0].points.length - 1]
  const loop = hav(first, last) < 400
  const labels = []
  const st = nearest(first, ['place', 'hut', 'peak'], 400)
  labels.push({ key: 'start', text: st?.name || 'Start', kind: st?.kind === 'hut' ? 'hut' : 'place', lat: first[0], lng: first[1], ele: first[2] })
  if (hav(first, top) > 400) {
    const tp = nearest(top, ['hut', 'peak'], 400)
    labels.push({ key: 'top', text: tp?.name || 'Top', kind: tp?.kind === 'hut' ? 'hut' : 'peak', lat: top[0], lng: top[1], ele: top[2] })
  }
  if (!loop && hav(last, top) > 400 && hav(last, first) > 400) {
    const en = nearest(last, ['place', 'hut', 'peak'], 400)
    labels.push({ key: 'end', text: en?.name || 'Finish', kind: en?.kind === 'hut' ? 'hut' : 'place', lat: last[0], lng: last[1], ele: last[2] })
  }
  detail.labels = labels
  writeFileSync(`${dir}/detail.json`, JSON.stringify(detail))
  console.log(T.map((t) => `${t.label}: ${t.stats.km} km`).join(' | '), '|', labels.map((l) => l.text).join(', '), `| ${target} m/px`)
}
