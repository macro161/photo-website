/**
 * swissALTI3D (swisstopo, open government data, free use with attribution "© swisstopo") for the terrain bake.
 * The AWS Terrain Tiles hold much smoother data in Switzerland (measured: about 4x less curvature than the 2 m LiDAR model at 13 m cells),
 * so where swissALTI3D exists we take heights from it, block-averaged to the bake's cell size.
 *   const alti = await loadSwissAlti({ south, west, north, east })   // null if the area is outside Switzerland
 *   alti.cell(lat, lng, metres)  ->  mean height of a square of that size around the point (null where there is no tile)
 */
import sharp from 'sharp'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

// Downloaded tiles are kept here (outside the repo) so re-bakes don't fetch them again.
const CACHE = `${homedir()}/.cache/photo-website-terrain/swissalti3d`

/** WGS84 -> LV95 (swisstopo's approximate formulas, about 1 m). */
export function toLV95(lat, lng) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lng * 3600 - 26782.5) / 10000
  return [
    2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3,
    1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p ** 3,
  ]
}

export async function loadSwissAlti({ south, west, north, east }) {
  // Which 1 km tiles exist (STAC), newest survey year per tile.
  const urls = new Map()
  let next = `https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items?bbox=${west},${south},${east},${north}&limit=100`
  while (next) {
    const res = await fetch(next)
    if (!res.ok) throw new Error(`STAC ${res.status}`)
    const j = await res.json()
    for (const f of j.features) {
      const a = Object.values(f.assets).find((x) => /_2_2056_\d+\.tif$/.test(x.href))
      const m = /swissalti3d_(\d{4})_(\d+-\d+)\//.exec(a?.href || '')
      if (!m) continue
      const old = urls.get(m[2])
      if (!old || +m[1] > old.year) urls.set(m[2], { year: +m[1], href: a.href })
    }
    next = j.links?.find((l) => l.rel === 'next')?.href
  }
  if (!urls.size) return null
  const tiles = new Map()
  const keys = [...urls.keys()]
  let done = 0
  const worker = async () => {
    while (keys.length) {
      const k = keys.pop()
      for (let attempt = 0; attempt < 3 && !tiles.has(k); attempt++) {
        try {
          const file = `${CACHE}/${urls.get(k).href.split('/').pop()}`
          let tif
          if (existsSync(file)) tif = readFileSync(file)
          else {
            const r = await fetch(urls.get(k).href)
            if (!r.ok) throw new Error(String(r.status))
            tif = Buffer.from(await r.arrayBuffer())
            mkdirSync(CACHE, { recursive: true }); writeFileSync(file, tif)
          }
          const { data } = await sharp(tif).raw({ depth: 'float' }).toBuffer({ resolveWithObject: true })
          const f = new Float32Array(data.buffer, data.byteOffset, data.length / 4), g = new Float32Array(250000)
          for (let i = 0; i < 250000; i++) g[i] = f[i * 3]
          tiles.set(k, g)
        } catch (e) { if (attempt === 2) console.warn('tile', k, e.message) }
      }
      if (++done % 20 === 0) process.stdout.write('+')
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  console.log(`\nswissALTI3D: ${tiles.size} tiles`)
  const px = (te, tn, x, y) => {
    const g = tiles.get(`${te}-${tn}`)
    if (!g) return NaN
    const v = g[y * 500 + x]
    return v > -1000 && v < 6000 ? v : NaN
  }
  // Bilinear between the 2 m pixel centres. (Nearest-pixel sampling beat against the bake's cell size and showed as faint stripes.)
  const at = (E, N) => {
    const fx = (E - 1) / 2, fy = (N - 1) / 2   // pixel-centre grid in 2 m units (centres sit at odd metres)
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
    const get = (X, Y) => { const e = X * 2 + 1, n = Y * 2 + 1, te = Math.floor(e / 1000), tn = Math.floor(n / 1000); return px(te, tn, Math.floor((e - te * 1000) / 2), 499 - Math.floor((n - tn * 1000) / 2)) }
    const a = get(x0, y0), b = get(x0 + 1, y0), c = get(x0, y0 + 1), d = get(x0 + 1, y0 + 1)
    const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    return Number.isNaN(v) ? [a, b, c, d].find((x) => !Number.isNaN(x)) ?? NaN : v
  }
  return {
    cell(lat, lng, metres) {
      const [E, N] = toLV95(lat, lng)
      // mean of an n x n grid of bilinear samples spread evenly over the cell (spacing <= 2 m)
      const n = Math.max(2, Math.ceil(metres / 2))
      let s = 0, c = 0
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const v = at(E + ((a + 0.5) / n - 0.5) * metres, N + ((b + 0.5) / n - 0.5) * metres); if (!Number.isNaN(v)) { s += v; c++ } }
      return c >= n * n * 0.6 ? s / c : null
    },
  }
}
