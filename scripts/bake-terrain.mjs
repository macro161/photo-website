/**
 * Bakes a small elevation model (and nearby peak names) for a lab route page, so the page needs no third-party requests.
 *   node scripts/bake-terrain.mjs <name> <south> <west> <north> <east> [zoom=13] [targetMetres=20]
 * Writes:
 *   public/lab/<name>/dem.bin        gzip of width*height Int16 values: elevation in `unit` metres, each stored as the difference from the
 *                                    predictor left + up - upleft (row-major). ~100 KB for 540x500 cells.
 *   src/lab/<name>/terrain.json      { width, height, unit, bounds, metersPerPx, minEle, maxEle, peaks: [{name, kind, ele, lat, lng}] }
 * Data: AWS Open Data "Terrain Tiles" (Mapzen terrarium; SRTM, EU-DEM, national sources), peaks from OpenStreetMap (ODbL). Needs `sharp`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import sharp from 'sharp'

const [name, S, W, N, E, Z = '13', TARGET = '20'] = process.argv.slice(2)
if (!name || !E) throw new Error('usage: bake-terrain.mjs <name> <south> <west> <north> <east> [zoom] [targetMetres]')
const [south, west, north, east, z, target] = [S, W, N, E, Z, TARGET].map(Number)

const TILE = 256
const n = 2 ** z
const px = (lng) => ((lng + 180) / 360) * n * TILE
const py = (lat) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE
}
const unpx = (x) => (x / (n * TILE)) * 360 - 180
const unpy = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (n * TILE)))) * 180) / Math.PI

const x0 = px(west), x1 = px(east), y0 = py(north), y1 = py(south)
const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor(x1 / TILE), ty0 = Math.floor(y0 / TILE), ty1 = Math.floor(y1 / TILE)
const gw = (tx1 - tx0 + 1) * TILE, gh = (ty1 - ty0 + 1) * TILE
const grid = new Float32Array(gw * gh)

for (let ty = ty0; ty <= ty1; ty++) {
  for (let tx = tx0; tx <= tx1; tx++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== TILE || info.height !== TILE || info.channels !== 3) throw new Error('unexpected tile')
    for (let j = 0; j < TILE; j++) {
      for (let i = 0; i < TILE; i++) {
        const o = (j * TILE + i) * 3
        grid[((ty - ty0) * TILE + j) * gw + (tx - tx0) * TILE + i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768
      }
    }
    process.stdout.write('.')
  }
}
console.log(`\nstitched ${gw}x${gh}`)

// Resample (bilinear) the crop to about `target` metres per pixel.
const midLat = (north + south) / 2
const mPerSrcPx = (40075016.686 / (n * TILE)) * Math.cos((midLat * Math.PI) / 180)
const step = Math.max(1, target / mPerSrcPx)
const cw = Math.floor((x1 - x0) / step), ch = Math.floor((y1 - y0) / step)
const sample = (x, y) => {
  const gx = x - tx0 * TILE - 0.5, gy = y - ty0 * TILE - 0.5
  const i = Math.max(0, Math.min(gw - 2, Math.floor(gx))), j = Math.max(0, Math.min(gh - 2, Math.floor(gy)))
  const fx = gx - i, fy = gy - j
  const a = grid[j * gw + i], b = grid[j * gw + i + 1], c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}
const UNIT = 0.5
const q = new Int32Array(cw * ch)
let minEle = Infinity, maxEle = -Infinity
for (let j = 0; j < ch; j++) {
  for (let i = 0; i < cw; i++) {
    // Average a step x step block so the downsample doesn't alias.
    let s = 0, k = 0
    const sub = Math.max(1, Math.round(step))
    for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) { s += sample(x0 + (i + (a + 0.5) / sub) * step, y0 + (j + (b + 0.5) / sub) * step); k++ }
    const h = s / k
    minEle = Math.min(minEle, h); maxEle = Math.max(maxEle, h)
    q[j * cw + i] = Math.round(h / UNIT)
  }
}
const res = new Int16Array(cw * ch)
for (let j = 0; j < ch; j++) {
  for (let i = 0; i < cw; i++) {
    const a = i ? q[j * cw + i - 1] : 0, b = j ? q[(j - 1) * cw + i] : 0, c = i && j ? q[(j - 1) * cw + i - 1] : 0
    res[j * cw + i] = q[j * cw + i] - (a + b - c)
  }
}
mkdirSync(`public/lab/${name}`, { recursive: true })
mkdirSync(`src/lab/${name}`, { recursive: true })
const packed = gzipSync(Buffer.from(res.buffer), { level: 9 })
writeFileSync(`public/lab/${name}/dem.bin`, packed)
console.log(`dem.bin ${(packed.length / 1024).toFixed(0)} KB`)

const bounds = { south: unpy(y0 + ch * step), north: unpy(y0), west: unpx(x0), east: unpx(x0 + cw * step) }
const meta = { width: cw, height: ch, unit: UNIT, bounds, metersPerPx: mPerSrcPx * step, minEle: Math.round(minEle), maxEle: Math.round(maxEle) }
console.log(`DEM ${cw}x${ch}, ${meta.metersPerPx.toFixed(1)} m/px, ${Math.round(minEle)}-${Math.round(maxEle)} m`)

const kindOf = (t) =>
  t.natural === 'peak' ? 'peak'
    : t.natural === 'saddle' || t.mountain_pass ? 'pass'
    : t.tourism === 'alpine_hut' || t.tourism === 'wilderness_hut' ? 'hut'
    : t.tourism === 'viewpoint' ? 'view'
    : t.railway || t.aerialway ? 'station'
    : t.amenity ? 'poi'
    : 'place'

// Named peaks and huts from OpenStreetMap (Overpass), baked in so the page never calls it.
let peaks = []
try {
  const B = `(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`
  const q = `[out:json][timeout:60];(node["natural"~"^(peak|saddle)$"]["name"]${B};node["mountain_pass"="yes"]["name"]${B};node["tourism"~"^(alpine_hut|wilderness_hut|viewpoint)$"]["name"]${B};node["place"~"^(village|hamlet|locality|isolated_dwelling|town)$"]["name"]${B};node["railway"~"^(station|halt)$"]["name"]${B};node["amenity"~"^(restaurant|parking)$"]["name"]${B};node["aerialway"="station"]["name"]${B};node["natural"="peak"]["name"]${B};);out;`
  let j
  for (const host of ['https://overpass.openstreetmap.fr', 'https://overpass-api.de', 'https://overpass.kumi.systems']) {
    try {
      const r = await fetch(host + '/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'photo-website-terrain-bake/1.0' }, signal: AbortSignal.timeout(30000) })
      j = await r.json()
      break
    } catch (e) { console.warn(host, e.message) }
  }
  if (!j) throw new Error('no Overpass host answered')
  peaks = j.elements.map((e) => ({ name: e.tags.name, kind: kindOf(e.tags), ele: e.tags.ele ? Math.round(+e.tags.ele) : null, lat: e.lat, lng: e.lon }))
  console.log(`${peaks.length} named points`)
} catch (e) {
  console.warn('Overpass failed, no labels:', e.message)
}
writeFileSync(`src/lab/${name}/terrain.json`, JSON.stringify({ ...meta, peaks }, null, 1) + '\n')
