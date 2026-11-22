/**
 * Bakes the low-resolution relief of Switzerland for the Swiss catalog map (src/swissmap/), so the page needs no third-party requests.
 *   node scripts/bake-swiss.mjs [zoom=10] [cellMetres=800]
 * Writes
 *   public/swissmap/dem.bin     gzip of Int16 residuals (left + up - upleft predictor), elevation in 0.5 m units, row-major
 *   public/swissmap/water.bin   gzip of one byte per cell, 1 where the elevation model is perfectly flat (lakes), else 0
 *   src/swissmap/terrain.json   { width, height, unit, bounds, metersPerPx, minEle, maxEle, labels, border }
 * Data: AWS Open Data "Terrain Tiles" (Mapzen terrarium); names, towns and the national border from OpenStreetMap (ODbL). Needs `sharp`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import sharp from 'sharp'

const [Z = '10', CELL = '800'] = process.argv.slice(2)
const z = +Z, target = +CELL
const south = 45.78, north = 47.86, west = 5.9, east = 10.58
const TILE = 256, n = 2 ** z
const px = (lng) => ((lng + 180) / 360) * n * TILE
const py = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE }
const unpx = (x) => (x / (n * TILE)) * 360 - 180
const unpy = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (n * TILE)))) * 180) / Math.PI

const x0 = px(west), x1 = px(east), y0 = py(north), y1 = py(south)
const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor(x1 / TILE), ty0 = Math.floor(y0 / TILE), ty1 = Math.floor(y1 / TILE)
const gw = (tx1 - tx0 + 1) * TILE, gh = (ty1 - ty0 + 1) * TILE
const grid = new Float32Array(gw * gh)
const jobs = []
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty])
let next = 0
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < jobs.length) {
    const [tx, ty] = jobs[next++]
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    const { data } = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const o = (j * TILE + i) * 3
      grid[((ty - ty0) * TILE + j) * gw + (tx - tx0) * TILE + i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768
    }
  }
}))
console.log(`stitched ${gw}x${gh} from ${jobs.length} tiles`)

// Lakes: the elevation model is perfectly flat over open water.
const flat = new Uint8Array(gw * gh)
for (let j = 2; j < gh - 2; j++) for (let i = 2; i < gw - 2; i++) {
  const c = grid[j * gw + i]
  let ok = c > 150 && c < 2300
  for (let dj = -2; dj <= 2 && ok; dj++) for (let di = -2; di <= 2; di++) if (Math.abs(grid[(j + dj) * gw + i + di] - c) > 0.02) { ok = false; break }
  flat[j * gw + i] = ok ? 1 : 0
}

const midLat = (north + south) / 2
const mPerSrcPx = (40075016.686 / (n * TILE)) * Math.cos((midLat * Math.PI) / 180)
const step = Math.max(1, target / mPerSrcPx)
const cw = Math.floor((x1 - x0) / step), ch = Math.floor((y1 - y0) / step)
const UNIT = 0.5
const q = new Int32Array(cw * ch), water = new Uint8Array(cw * ch)
let minEle = Infinity, maxEle = -Infinity
for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
  let s = 0, k = 0, w = 0
  const sub = Math.max(1, Math.round(step))
  for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) {
    const gx = Math.min(gw - 1, Math.floor(x0 + (i + (a + 0.5) / sub) * step - tx0 * TILE)), gy = Math.min(gh - 1, Math.floor(y0 + (j + (b + 0.5) / sub) * step - ty0 * TILE))
    s += grid[gy * gw + gx]; w += flat[gy * gw + gx]; k++
  }
  const h = s / k
  minEle = Math.min(minEle, h); maxEle = Math.max(maxEle, h)
  q[j * cw + i] = Math.round(h / UNIT)
  water[j * cw + i] = w / k > 0.6 ? 1 : 0
}
const res = new Int16Array(cw * ch)
for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
  const a = i ? q[j * cw + i - 1] : 0, b = j ? q[(j - 1) * cw + i] : 0, c = i && j ? q[(j - 1) * cw + i - 1] : 0
  res[j * cw + i] = q[j * cw + i] - (a + b - c)
}
mkdirSync('public/swissmap', { recursive: true }); mkdirSync('src/swissmap', { recursive: true })
const dem = gzipSync(Buffer.from(res.buffer), { level: 9 }), wat = gzipSync(Buffer.from(water), { level: 9 })
writeFileSync('public/swissmap/dem.bin', dem); writeFileSync('public/swissmap/water.bin', wat)
const bounds = { south: unpy(y0 + ch * step), north: unpy(y0), west: unpx(x0), east: unpx(x0 + cw * step) }
const meta = { width: cw, height: ch, unit: UNIT, bounds, metersPerPx: mPerSrcPx * step, minEle: Math.round(minEle), maxEle: Math.round(maxEle) }
console.log(`DEM ${cw}x${ch} @ ${meta.metersPerPx.toFixed(0)} m, ${meta.minEle}-${meta.maxEle} m; dem.bin ${(dem.length / 1024).toFixed(0)} KB, water.bin ${(wat.length / 1024).toFixed(0)} KB, ${water.reduce((s, v) => s + v, 0)} water cells`)

// Names, towns and the national border from OpenStreetMap (Overpass), baked in so the page never calls it.
const overpass = async (query) => {
  for (const host of ['https://overpass.openstreetmap.fr', 'https://overpass-api.de', 'https://overpass.kumi.systems']) {
    try {
      const r = await fetch(host + '/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'photo-website-swiss-bake/1.0' }, signal: AbortSignal.timeout(120000) })
      if (r.ok) return await r.json()
    } catch (e) { console.warn(host, e.message) }
  }
  throw new Error('no Overpass host answered')
}
const bb = `${meta.bounds.south},${meta.bounds.west},${meta.bounds.north},${meta.bounds.east}`
let border = [], labels = []
try {
  const rel = await overpass(`[out:json][timeout:90];relation["ISO3166-1"="CH"]["boundary"="administrative"]["admin_level"="2"];out geom;`)
  const dp = (pts, eps) => {
    if (pts.length < 3) return pts
    let md = 0, mi = 0
    const [a, b] = [pts[0], pts[pts.length - 1]]
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > md) { md = d; mi = i } }
    return md > eps ? [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)] : [a, b]
  }
  for (const m of rel.elements[0].members) {
    if (m.type !== 'way' || m.role !== 'outer' || !m.geometry) continue
    const pts = dp(m.geometry.map((g) => [g.lon, g.lat]), 0.0025)
    border.push(pts.map(([lo, la]) => [+lo.toFixed(4), +la.toFixed(4)]))
  }
  console.log(`border: ${border.length} ways, ${border.reduce((s, w) => s + w.length, 0)} points`)
} catch (e) { console.warn('border failed:', e.message) }
try {
  const j = await overpass(`[out:json][timeout:90];(node["place"~"^(city|town)$"]["population"](${bb});node["natural"="peak"]["name"~"^(Dufourspitze|Matterhorn|Finsteraarhorn|Jungfrau|Piz Bernina|Mont Blanc|Weisshorn|Dom|Säntis|Titlis|Tödi|Piz Kesch)$"](${bb}););out;`)
  labels = j.elements.map((e) => ({ name: e.tags['name:en'] || e.tags.name, kind: e.tags.natural === 'peak' ? 'peak' : 'town', ele: e.tags.ele ? Math.round(+e.tags.ele) : null, pop: e.tags.population ? +e.tags.population : null, lat: e.lat, lng: e.lon }))
  // Keep the places a visitor would recognise: Swiss cities, and the highest peaks spread across the map.
  const CITIES = ['Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Lucerne', 'St. Gallen', 'Lugano', 'Chur', 'Sion', 'Neuchâtel', 'Fribourg', 'Bellinzona', 'Schaffhausen']
  const towns = labels.filter((l) => l.kind === 'town' && CITIES.includes(l.name)).map(({ name, kind, lat, lng }) => ({ name, kind, lat, lng }))
  const keep = labels.filter((l) => l.kind === 'peak' && l.ele).sort((a, b) => b.ele - a.ele).filter((l, i, all) => all.findIndex((o) => o.name === l.name) === i)
  labels = [...towns, ...keep.map(({ name, kind, ele, lat, lng }) => ({ name, kind, ele, lat, lng }))]
  console.log(`labels: ${labels.map((l) => l.name).join(', ')}`)
} catch (e) { console.warn('labels failed:', e.message) }
writeFileSync('src/swissmap/terrain.json', JSON.stringify({ ...meta, border, labels }) + '\n')
