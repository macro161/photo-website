/**
 * Quality ladder: encodes a spread of ~12 frames at several AVIF/WebP qualities
 * and writes a side-by-side HTML page, so a quality can be chosen by eye.
 *   node scripts/quality-ladder.mjs   ->  ~/.cache/photo-website-optimize/ladder/index.html
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const exec = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(os.homedir(), '.cache', 'photo-website-optimize', 'ladder')
const WIDTH = 1600
const LADDER = [
  { fmt: 'avif', q: 40 }, { fmt: 'avif', q: 52 }, { fmt: 'avif', q: 62 },
  { fmt: 'webp', q: 70 }, { fmt: 'webp', q: 78 }, { fmt: 'webp', q: 86 },
]

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'))
const remote = config.r2Remote || 'r2:photos-web'
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'src/generated/manifest.json'), 'utf8'))

// One frame from each catalog, plus extras from the big ones, spread through the list.
const byCatalog = new Map()
for (const p of manifest) {
  if (!byCatalog.has(p.catalog)) byCatalog.set(p.catalog, [])
  byCatalog.get(p.catalog).push(p)
}
const picks = []
for (const list of byCatalog.values()) {
  picks.push(list[Math.floor(list.length * 0.3)])
  if (list.length > 60) picks.push(list[Math.floor(list.length * 0.7)])
}
const sample = picks.slice(0, 12)

await fs.mkdir(OUT, { recursive: true })
let html = `<!doctype html><meta charset=utf-8><title>Quality ladder</title>
<style>body{font:14px system-ui;margin:2rem;background:#fff;color:#111}h2{margin:2.5rem 0 .5rem}.row{display:flex;gap:12px;overflow-x:auto}figure{margin:0;flex:0 0 auto;width:${WIDTH / 2}px}img{width:100%;display:block}figcaption{font-size:12px;color:#555}</style>
<h1>Quality ladder (${WIDTH}px wide, shown at half size: zoom the browser to 200% to judge grain)</h1>`
for (const p of sample) {
  const src = path.join(OUT, p.file.replace(/[\\/]/g, '__'))
  await exec('rclone', ['copyto', `${remote}/${p.file}`, src])
  const base = sharp(src, { failOn: 'none' }).rotate().resize({ width: WIDTH })
  const orig = (await fs.stat(src)).size
  html += `<h2>${p.file}</h2><div class=row>`
  const origJpg = `${path.basename(src)}.ref.jpg`
  await base.clone().jpeg({ quality: 92 }).toFile(path.join(OUT, origJpg))
  html += `<figure><img src="${encodeURI(origJpg)}"><figcaption>reference JPEG q92 (${((await fs.stat(path.join(OUT, origJpg))).size / 1024) | 0} KB); original file ${(orig / 1e6).toFixed(1)} MB</figcaption></figure>`
  for (const { fmt, q } of LADDER) {
    const name = `${path.basename(src)}.${fmt}${q}.${fmt}`
    const t = base.clone()
    const buf = fmt === 'avif' ? await t.avif({ quality: q, effort: 4 }).toBuffer() : await t.webp({ quality: q, effort: 4 }).toBuffer()
    await fs.writeFile(path.join(OUT, name), buf)
    html += `<figure><img src="${encodeURI(name)}"><figcaption>${fmt.toUpperCase()} q${q}: ${(buf.length / 1024) | 0} KB</figcaption></figure>`
  }
  html += `</div>`
  await fs.rm(src)
  console.log('✓', p.file)
}
await fs.writeFile(path.join(OUT, 'index.html'), html)
console.log('Open', path.join(OUT, 'index.html'))
