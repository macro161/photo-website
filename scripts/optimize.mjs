/**
 * Makes web-sized copies of every photo and uploads them next to the originals.
 *
 *   node scripts/optimize.mjs [--only <key prefix>] [--force] [--dry] [--concurrency N] [--no-upload]
 *
 * For each photo in src/generated/manifest.json this downloads the original from
 * the bucket (rclone), writes AVIF + WebP copies at several widths, and uploads
 * them to  <bucket>/generated/<width>/<original key without extension>.<avif|webp>
 * (scripts/index.mjs ignores the `generated/` prefix, so they never show up as
 * catalogs). The originals are never touched.
 *
 * It records what exists in src/generated/variants.json:
 *   { "<original key>": { "w": [480, 960, 1600, 2400], "c": "#a1b2c3" } }
 * `npm run index` merges that into the manifest (fields `w` and `c`), and the
 * site falls back to the original for any photo without variants.
 * Re-runs only process photos with missing variants.
 */
import { promises as fs, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const exec = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = path.join(ROOT, 'src/generated/manifest.json')
const VARIANTS = path.join(ROOT, 'src/generated/variants.json')
const WORK = path.join(os.homedir(), '.cache', 'photo-website-optimize')

export const WIDTHS = [480, 960, 1600, 2400]
export const QUALITY = { avif: 55, webp: 78 } // chosen with scripts/quality-ladder.mjs
export const AVIF_EFFORT = 4

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true
}
const only = arg('only')
const force = Boolean(arg('force'))
const dry = Boolean(arg('dry'))
const noUpload = Boolean(arg('no-upload'))
const concurrency = Number(arg('concurrency')) || 2

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'))
const remote = config.r2Remote || 'r2:photos-web'

const stripExt = (k) => k.replace(/\.[^.]+$/, '')
const outRel = (key, w, fmt) => `${w}/${stripExt(key)}.${fmt}`

/** Widths worth making for an original of this width (never upscale; keep at least one). */
export function widthsFor(origWidth) {
  const list = WIDTHS.filter((w) => w < origWidth)
  // Largest variant: the original width itself if it falls between ladder steps is not needed.
  return list.length ? list : [Math.min(...WIDTHS, origWidth)]
}

async function existingGenerated() {
  try {
    const { stdout } = await exec('rclone', ['lsf', '-R', '--files-only', `${remote}/generated`], { maxBuffer: 256 * 1024 * 1024 })
    return new Set(stdout.split('\n').filter(Boolean))
  } catch {
    return new Set() // no generated/ folder yet
  }
}

async function pool(items, n, fn) {
  let next = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++
        await fn(items[i], i)
      }
    })
  )
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'))
  const variants = existsSync(VARIANTS) ? JSON.parse(await fs.readFile(VARIANTS, 'utf8')) : {}
  const present = await existingGenerated()

  const todo = manifest.filter((p) => {
    if (only && !p.file.startsWith(only)) return false
    if (force) return true
    const v = variants[p.file]
    if (!v || !v.c) return true
    return !v.w.every((w) => present.has(outRel(p.file, w, 'avif')) && present.has(outRel(p.file, w, 'webp')))
  })
  console.log(`${manifest.length} photos, ${todo.length} to process${dry ? ' (dry run)' : ''}`)
  if (dry || !todo.length) return

  const stage = path.join(WORK, 'out')
  const orig = path.join(WORK, 'orig')
  await fs.mkdir(stage, { recursive: true })
  await fs.mkdir(orig, { recursive: true })

  let done = 0
  let bytes = 0
  let origBytes = 0
  const t0 = Date.now()

  await pool(todo, concurrency, async (p) => {
    const src = path.join(orig, p.file.replace(/[\\/]/g, '__'))
    try {
      await exec('rclone', ['copyto', `${remote}/${p.file}`, src])
      const meta = await sharp(src).metadata()
      const rotated = meta.orientation >= 5 && meta.orientation <= 8
      const origWidth = rotated ? meta.height : meta.width
      const widths = widthsFor(origWidth)
      const base = sharp(src, { failOn: 'none' }).rotate() // honours EXIF orientation, drops metadata

      for (const w of widths) {
        for (const fmt of ['avif', 'webp']) {
          const rel = outRel(p.file, w, fmt)
          const dest = path.join(stage, rel)
          await fs.mkdir(path.dirname(dest), { recursive: true })
          const img = base.clone().resize({ width: w, withoutEnlargement: true }).toColorspace('srgb')
          const buf = fmt === 'avif'
            ? await img.avif({ quality: QUALITY.avif, effort: AVIF_EFFORT }).toBuffer()
            : await img.webp({ quality: QUALITY.webp, effort: 4 }).toBuffer()
          await fs.writeFile(dest, buf)
          bytes += buf.length
        }
      }
      // Average colour: a cheap placeholder shown while the image loads.
      const { data } = await base.clone().resize(1, 1).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const c = '#' + [...data.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')
      variants[p.file] = { w: widths, c }
      origBytes += (await fs.stat(src)).size
      await fs.rm(src)
    } catch (err) {
      console.error(`✗ ${p.file}: ${err.message}`)
      return
    }
    done++
    if (done % 10 === 0 || done === todo.length) {
      const mins = ((Date.now() - t0) / 60000).toFixed(1)
      console.log(`  ${done}/${todo.length} (${mins} min) — originals ${(origBytes / 1e6).toFixed(0)} MB -> variants ${(bytes / 1e6).toFixed(0)} MB`)
    }
  })

  if (!noUpload) {
    console.log('Uploading to', `${remote}/generated`)
    await exec('rclone', [
      'copy', stage, `${remote}/generated`,
      '--header-upload', 'Cache-Control: public, max-age=31536000, immutable',
      '--transfers', '8', '--checksum',
    ], { maxBuffer: 64 * 1024 * 1024 })
  }
  await fs.writeFile(VARIANTS, JSON.stringify(variants, null, 1))
  console.log(`Wrote ${path.relative(ROOT, VARIANTS)} (${Object.keys(variants).length} photos). Now run: npm run index`)
}

main().catch((e) => { console.error(e); process.exit(1) })
