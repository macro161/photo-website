/**
 * Bakes an elevation model (plus nearby names and, with --tracks, buildings) for a hike album's route view, so the page needs no third-party requests.
 *   node scripts/bake-terrain.mjs <name> <south> <west> <north> <east> [zoom=13] [targetMetres=13.4] [--tracks=<detail.json>]
 * Writes:
 *   public/<name>/dem.bin        gzip of width*height elevations in `unit` metres, each stored as the difference from the
 *                                    predictor left + up - upleft (row-major), zigzag-coded to uint16, all low bytes then all high bytes.
 *   public/<name>/buildings.bin      with --tracks: OSM buildings within 1.8 km of the route, as 12-byte records (gzip), see bakeBuildings below
 *   src/<name>/terrain.json      { width, height, unit, bounds, metersPerPx, minEle, maxEle, peaks: [{name, kind, ele, lat, lng}] }
 * Cell size and sources: z13 tiles are ~13 m/px at 46 N. Measured on Valsorey and Mont Pelerin (2026-11): AWS z14/z15 differ from a bilinear upsample
 * of z13 by only ~0.4 m (alps) / 0.1 m (hills) RMS, and compared with swisstopo's 2 m LiDAR model block-averaged to 13.4 m the AWS heights have
 * ~4x less curvature (mean |Laplacian| 0.76 vs 3.08 m at Valsorey): that data is much smoother than its pixel size. So inside Switzerland the
 * heights come from swissALTI3D (open government data, (c) swisstopo, scripts/lib-swissalti.mjs), averaged to the cell size; AWS Terrain Tiles
 * fill in outside it (--alti=off bakes from AWS alone). With swissALTI3D the cells can be finer than a z13 pixel: build-routes.mjs asks for ~6.7 m
 * (coarsened to at most ~1.6 M cells), where the LiDAR model still shows gullies, scree cones and cliff bands. Heights are stored in 0.25 m units.
 * Other data: AWS Open Data "Terrain Tiles" (Mapzen terrarium; SRTM, EU-DEM, national sources), peaks from OpenStreetMap (ODbL). Needs `sharp`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import sharp from 'sharp'
import { loadSwissAlti } from './lib-swissalti.mjs'

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const [name, S, W, N, E, Z = '13', TARGET = '13.4'] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
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
const unpyLat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (n * TILE)))) * 180) / Math.PI
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
const step = Math.max(0.25, target / mPerSrcPx) // below 1 source pixel only pays off where swissALTI3D fills the cells
const cw = Math.floor((x1 - x0) / step), ch = Math.floor((y1 - y0) / step)
const sample = (x, y) => {
  const gx = x - tx0 * TILE - 0.5, gy = y - ty0 * TILE - 0.5
  const i = Math.max(0, Math.min(gw - 2, Math.floor(gx))), j = Math.max(0, Math.min(gh - 2, Math.floor(gy)))
  const fx = gx - i, fy = gy - j
  const a = grid[j * gw + i], b = grid[j * gw + i + 1], c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}
const UNIT = 0.25 // metres; 0.5 m steps showed as speckle and terracing in the shading of gentle slopes at ~7 m cells
const alti = flags.alti === 'off' ? null : await loadSwissAlti({ south, west, north, east }).catch((e) => { console.warn('swissALTI3D unavailable:', e.message); return null })
let altiCells = 0
const q = new Int32Array(cw * ch)
let minEle = Infinity, maxEle = -Infinity
for (let j = 0; j < ch; j++) {
  for (let i = 0; i < cw; i++) {
    // Average a step x step block so the downsample doesn't alias.
    let s = 0, k = 0
    const sub = Math.max(1, Math.round(step))
    for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) { s += sample(x0 + (i + (a + 0.5) / sub) * step, y0 + (j + (b + 0.5) / sub) * step); k++ }
    let h = s / k
    if (alti) {
      // pixel centre of this cell -> lat/lng (inverse Mercator), then the LiDAR block mean where swissALTI3D covers it
      const cx = x0 + (i + 0.5) * step, cy = y0 + (j + 0.5) * step
      const v = alti.cell(unpyLat(cy), unpx(cx), step * mPerSrcPx)
      if (v != null) { h = v; altiCells++ }
    }
    minEle = Math.min(minEle, h); maxEle = Math.max(maxEle, h)
    q[j * cw + i] = Math.round(h / UNIT)
  }
}
if (alti) console.log(`swissALTI3D covers ${((altiCells / (cw * ch)) * 100).toFixed(0)}% of the cells`)
const res = new Int16Array(cw * ch)
for (let j = 0; j < ch; j++) {
  for (let i = 0; i < cw; i++) {
    const a = i ? q[j * cw + i - 1] : 0, b = j ? q[(j - 1) * cw + i] : 0, c = i && j ? q[(j - 1) * cw + i - 1] : 0
    res[j * cw + i] = q[j * cw + i] - (a + b - c)
  }
}
mkdirSync(`public/${name}`, { recursive: true })
mkdirSync(`src/${name}`, { recursive: true })
// Zigzag the residuals to unsigned, then store all low bytes followed by all high bytes: far better for gzip than interleaved Int16.
const zz = Buffer.alloc(res.length * 2)
for (let k = 0; k < res.length; k++) { const z = ((res[k] << 1) ^ (res[k] >> 15)) & 0xffff; zz[k] = z & 255; zz[res.length + k] = z >> 8 }
const packed = gzipSync(zz, { level: 9 })
writeFileSync(`public/${name}/dem.bin`, packed)
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
writeFileSync(`src/${name}/terrain.json`, JSON.stringify({ ...meta, peaks }, null, 1) + '\n')

/**
 * Buildings near the route from OpenStreetMap (ODbL), baked so the page makes no third-party requests. Each footprint becomes an oriented box.
 * Record (12 bytes, little endian): int32 lat*1e6, int32 lng*1e6 (centre), uint8 width, uint8 depth (0.5 m units), uint8 height (0.5 m units),
 * uint8 angle (0..255 = 0..pi, clockwise from east). Named huts without a mapped building get a small default box.
 */
async function bakeBuildings(detailFile) {
  const detail = JSON.parse(readFileSync(detailFile, 'utf8'))
  const pts = detail.tracks.flatMap((t) => t.points)
  const R = 1800
  const rad = (d) => (d * Math.PI) / 180
  const mLat = 110574, mLng = 111320 * Math.cos(rad((north + south) / 2))
  // Thin the track to about one point per 250 m so the Overpass query stays small.
  const thin = []
  for (const p of pts) if (!thin.length || Math.hypot((p[0] - thin[thin.length - 1][0]) * mLat, (p[1] - thin[thin.length - 1][1]) * mLng) > 250) thin.push(p)
  const poly = thin.slice(0, 220).map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(',')
  const q = `[out:json][timeout:60];way["building"](around:${R},${poly});out geom;`
  let j
  for (const host of ['https://overpass.openstreetmap.fr', 'https://overpass-api.de', 'https://overpass.kumi.systems']) {
    try {
      const r = await fetch(host + '/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'photo-website-terrain-bake/1.0' }, signal: AbortSignal.timeout(60000) })
      j = await r.json()
      break
    } catch (e) { console.warn(host, e.message) }
  }
  if (!j) throw new Error('no Overpass host answered')
  const num = (v) => { const m = /[\d.]+/.exec(v || ''); return m ? +m[0] : null }
  const dToTrack = (lat, lng) => { let b = Infinity; for (const p of thin) b = Math.min(b, Math.hypot((p[0] - lat) * mLat, (p[1] - lng) * mLng)); return b }
  const out = []
  for (const w of j.elements) {
    if (!w.geometry || w.geometry.length < 4) continue
    const cLat = w.geometry.reduce((s, g) => s + g.lat, 0) / w.geometry.length, cLng = w.geometry.reduce((s, g) => s + g.lon, 0) / w.geometry.length
    const xy = w.geometry.map((g) => [(g.lon - cLng) * mLng, (g.lat - cLat) * mLat])
    // Smallest oriented box over the footprint's own edge directions.
    let best = null
    for (let i = 0; i < xy.length - 1; i++) {
      const a = Math.atan2(xy[i + 1][1] - xy[i][1], xy[i + 1][0] - xy[i][0]), c = Math.cos(a), s = Math.sin(a)
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const [x, y] of xy) { const u = x * c + y * s, v = -x * s + y * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v) }
      const area = (x1 - x0) * (y1 - y0)
      if (!best || area < best.area) best = { area, a, cu: (x0 + x1) / 2, cv: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0 }
    }
    if (!best || best.w < 2 || best.d < 2) continue
    const ox = best.cu * Math.cos(best.a) - best.cv * Math.sin(best.a), oy = best.cu * Math.sin(best.a) + best.cv * Math.cos(best.a)
    const lat = cLat + oy / mLat, lng = cLng + ox / mLng
    const t = w.tags || {}
    let h = num(t.height) ?? (num(t['building:levels']) ? num(t['building:levels']) * 3 + 1 : null)
    if (h == null) h = ['hut', 'cabin', 'chalet', 'shed', 'barn', 'farm_auxiliary', 'garage', 'garages'].includes(t.building) ? 5 : t.building === 'church' || t.building === 'cathedral' ? 14 : 8
    let ang = best.a % Math.PI; if (ang < 0) ang += Math.PI
    out.push({ lat, lng, w: best.w, d: best.d, h: Math.min(63, Math.max(3, h)), ang, dist: dToTrack(lat, lng), name: t.name })
  }
  // Huts that OSM only has as a point (or whose building isn't mapped): a small default box.
  for (const p of peaks) {
    if (p.kind !== 'hut') continue
    if (out.some((b) => Math.hypot((b.lat - p.lat) * mLat, (b.lng - p.lng) * mLng) < 30)) continue
    out.push({ lat: p.lat, lng: p.lng, w: 9, d: 6, h: 5, ang: 0, dist: dToTrack(p.lat, p.lng) })
  }
  out.sort((a, b) => a.dist - b.dist)
  const kept = out.slice(0, 4000).filter((b) => b.lat > south && b.lat < north && b.lng > west && b.lng < east)
  const buf = Buffer.alloc(kept.length * 12)
  kept.forEach((b, i) => {
    const o = i * 12
    buf.writeInt32LE(Math.round(b.lat * 1e6), o); buf.writeInt32LE(Math.round(b.lng * 1e6), o + 4)
    buf[o + 8] = Math.min(255, Math.round(b.w * 2)); buf[o + 9] = Math.min(255, Math.round(b.d * 2)); buf[o + 10] = Math.min(255, Math.round(b.h * 2))
    buf[o + 11] = Math.min(255, Math.round((b.ang / Math.PI) * 256))
  })
  const gz = gzipSync(buf, { level: 9 })
  writeFileSync(`public/${name}/buildings.bin`, gz)
  console.log(`${kept.length} buildings (${out.length} found), buildings.bin ${(gz.length / 1024).toFixed(1)} KB`)
}
if (flags.tracks) await bakeBuildings(flags.tracks)
