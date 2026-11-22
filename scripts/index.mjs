/**
 * Builds the photo index for the site.
 *
 * You upload photos straight into the public R2 bucket, one folder per
 * catalog:
 *
 *   photos-web/London 2026/0042.jpg      -> catalog "London 2026"
 *   photos-web/Swiss/Le Chasseron/07.jpg -> catalog "Swiss", album
 *                                           "Le Chasseron"
 *
 * The first folder is the catalog, the second is an album inside it. A
 * catalog with albums shows album cards; one without opens straight to its
 * grid. Folders deeper than two levels are yours to organise and do not
 * affect the site.
 *
 * This script lists the bucket and writes src/generated/manifest.json. It
 * never downloads a whole photo: to lay the grid out without the page
 * jumping, it fetches only the first chunk of each new file and reads the
 * pixel dimensions from the header. Results are cached by size + modified
 * time, so re-runs only touch photos that actually changed.
 *
 * Nothing is resized here -- upload web-sized exports.
 *
 * --- Captions ---
 * Text after "@" in the filename becomes the caption, as before:
 *   "0042.jpg"                  -> no caption
 *   "0042@Rue de Rivoli.jpg"    -> caption "Rue de Rivoli"
 *   "0042@Rue de Rivoli@2026-05-05.jpg" -> caption + date
 * site.config.json can override captions per file.
 */
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'src', 'generated', 'manifest.json')
// Written by scripts/optimize.mjs: which web-sized widths exist per photo, plus an average colour.
const VARIANTS_PATH = path.join(ROOT, 'src', 'generated', 'variants.json')
// What the browser actually loads: a small index (catalogs, albums, counts, covers) in the main bundle,
// plus one file per catalog holding that catalog's photos, fetched on demand.
const INDEX_PATH = path.join(ROOT, 'src', 'generated', 'index.json')
const CATALOGS_DIR = path.join(ROOT, 'src', 'generated', 'catalogs')

// Photos kept in the bucket but left out of the site (hidden.json at the repo root).
let HIDDEN = new Set()
try {
  HIDDEN = new Set(JSON.parse(await fs.readFile(path.join(ROOT, 'hidden.json'), 'utf8')).hidden.map((h) => h.file))
} catch {
  /* no hidden.json: nothing is hidden */
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])

// Enough of a JPEG/PNG/WebP header to contain the dimensions.
const HEADER_BYTES = 131072

// Left over from the old local-resizing workflow; not a catalog.
const IGNORED_PREFIXES = ['generated/']

const LOOSE_CATALOG = 'Other'

/**
 * URL-safe slug. Accents are folded rather than dropped, so "Mont Pèlerin"
 * becomes "mont-pelerin" instead of "mont-p-lerin".
 */
function slugifyName(name) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}

/** Same, but drops a file extension first. Used for photo ids. */
function slugifyPath(key) {
  return slugifyName(key.replace(/\.[^.]+$/, '')) || 'photo'
}

function parseFilename(file) {
  const withoutExt = file.replace(/\.[^.]+$/, '')
  const parts = withoutExt.split('@')
  return {
    description: parts.length >= 2 ? parts[1].trim() || null : null,
    date: parts.length >= 3 ? parts[2].trim() || null : null,
  }
}

function dateValue(date) {
  if (!date) return 0
  const t = Date.parse(date)
  return Number.isNaN(t) ? 0 : t
}

async function loadConfig() {
  const p = path.join(ROOT, 'site.config.json')
  return JSON.parse(await fs.readFile(p, 'utf8'))
}

/** Everything in the bucket, via rclone (listing needs credentials). */
async function listBucket(remote) {
  let stdout
  try {
    ;({ stdout } = await execFileAsync(
      'rclone',
      ['lsjson', remote, '--recursive', '--files-only'],
      { maxBuffer: 64 * 1024 * 1024 }
    ))
  } catch (err) {
    throw new Error(
      `Could not list ${remote}. Is rclone configured? Try \`rclone lsd r2:\`.\n` +
        (err.stderr || err.message)
    )
  }
  return JSON.parse(stdout)
}

/**
 * Pixel dimensions without downloading the whole file: ask for the first
 * chunk with a Range request and let sharp read the header.
 */
async function readDimensions(url) {
  // JPEG and PNG put their dimensions near the start, so a partial read is
  // enough. Some formats (WebP especially) will not parse from a truncated
  // buffer, so fall back to the whole file -- these are web-sized exports,
  // and the result is cached afterwards either way.
  try {
    // `await` matters: returning the promise directly would let a rejection
    // escape this try/catch and skip the fallback.
    return await measure(await fetchBytes(url, HEADER_BYTES))
  } catch {
    return await measure(await fetchBytes(url))
  }
}

async function fetchBytes(url, limit) {
  const res = await fetch(
    url,
    limit ? { headers: { Range: `bytes=0-${limit - 1}` } } : undefined
  )
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function measure(buf) {
  const meta = await sharp(buf).metadata()
  if (!meta.width || !meta.height) throw new Error('no dimensions in header')
  // Orientations 5-8 mean the image is stored rotated 90 degrees.
  const rotated = meta.orientation >= 5 && meta.orientation <= 8
  return {
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
  }
}

/** A photo as shipped to the browser: no bucket bookkeeping, no null fields. */
function slimPhoto(p) {
  const out = {
    id: p.id,
    src: p.src,
    width: p.width,
    height: p.height,
    catalog: p.catalog,
    catalogSlug: p.catalogSlug,
    album: p.album,
    albumSlug: p.albumSlug,
    file: p.file,
  }
  if (p.description) out.description = p.description
  if (p.date) out.date = p.date
  if (p.w) {
    out.w = p.w
    out.c = p.c
    if (p.v) out.v = p.v
  } else {
    out.thumb = p.thumb
  }
  return out
}

function pickCover(list, covers, keys) {
  for (const key of keys) {
    const wanted = covers[key]
    if (!wanted) continue
    const match = list.find((p) => p.file.split('/').pop() === wanted)
    if (match) return match
  }
  return list[0]
}

/** Writes src/generated/index.json and src/generated/catalogs/<slug>.json from the full manifest. */
async function writeSplit(manifest, config) {
  const covers = config.gallery?.covers || {}
  const groups = new Map()
  for (const p of manifest) {
    if (!groups.has(p.catalog)) groups.set(p.catalog, [])
    groups.get(p.catalog).push(p)
  }
  const newestOf = (list) => Math.max(...list.map((p) => dateValue(p.date)))

  await fs.rm(CATALOGS_DIR, { recursive: true, force: true })
  await fs.mkdir(CATALOGS_DIR, { recursive: true })

  const catalogs = []
  for (const [name, list] of groups) {
    const slug = list[0].catalogSlug
    const albumNames = []
    const byAlbum = new Map()
    let looseCount = 0
    for (const p of list) {
      if (!p.album) {
        looseCount++
        continue
      }
      if (!byAlbum.has(p.album)) {
        byAlbum.set(p.album, [])
        albumNames.push(p.album)
      }
      byAlbum.get(p.album).push(p)
    }
    catalogs.push({
      name,
      slug,
      count: list.length,
      looseCount,
      newest: newestOf(list),
      cover: slimPhoto(pickCover(list, covers, [name])),
      albums: albumNames.map((albumName) => {
        const items = byAlbum.get(albumName)
        return {
          name: albumName,
          slug: items[0].albumSlug,
          count: items.length,
          newest: newestOf(items),
          cover: slimPhoto(pickCover(items, covers, [`${name}/${albumName}`, albumName])),
        }
      }),
    })
    await fs.writeFile(path.join(CATALOGS_DIR, `${slug}.json`), JSON.stringify(list.map(slimPhoto)))
  }
  await fs.writeFile(INDEX_PATH, JSON.stringify(catalogs))
  return catalogs.length
}

async function main() {
  const config = await loadConfig()
  if (process.argv.includes('--split-only')) {
    // Rebuild the split files from the existing manifest without listing the bucket.
    const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
    const n = await writeSplit(manifest, config)
    console.log(`Split ${manifest.length} photos into index.json + ${n} catalog files.`)
    return
  }
  const remote = config.r2Remote || 'r2:photos-web'
  const base = (config.imageBaseUrl || '').replace(/\/+$/, '')
  if (!base) throw new Error('site.config.json needs imageBaseUrl')

  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true })

  let previous = []
  if (existsSync(MANIFEST_PATH)) {
    try {
      previous = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
    } catch {
      previous = []
    }
  }
  const previousByKey = new Map(previous.map((p) => [p.file, p]))
  let variants = {}
  if (existsSync(VARIANTS_PATH)) {
    try {
      variants = JSON.parse(await fs.readFile(VARIANTS_PATH, 'utf8'))
    } catch {
      variants = {}
    }
  }

  const objects = (await listBucket(remote)).filter((o) => {
    const key = o.Path
    if (IGNORED_PREFIXES.some((p) => key.startsWith(p))) return false
    if (!IMAGE_EXTENSIONS.has(path.extname(key).toLowerCase())) return false
    if (HIDDEN.has(key)) return false
    // A leading capital "X" on the file or its folder hides it.
    return !key.split('/').some((seg) => seg.startsWith('X') || seg.startsWith('.'))
  })

  const manifest = []
  const usedIds = new Set()
  let measured = 0
  let cached = 0
  const failures = []

  for (const obj of objects.sort((a, b) => a.Path.localeCompare(b.Path))) {
    const key = obj.Path
    const segments = key.split('/')
    const filename = segments[segments.length - 1]
    // First folder = catalog, second = album within it. Anything deeper is
    // yours to organise and does not affect the site.
    const catalog = segments.length > 1 ? segments[0] : LOOSE_CATALOG
    const album = segments.length > 2 ? segments[1] : null

    let id = slugifyPath(key)
    let n = 2
    const baseId = id
    while (usedIds.has(id)) id = `${baseId}-${n++}`
    usedIds.add(id)

    const prev = previousByKey.get(key)
    const unchanged =
      prev && prev.size === obj.Size && prev.modTime === obj.ModTime && prev.width

    let width = null
    let height = null
    if (unchanged) {
      width = prev.width
      height = prev.height
      cached++
    } else {
      const url = `${base}/${encodeURI(key)}`
      try {
        ;({ width, height } = await readDimensions(url))
        measured++
        console.log(`✓ ${key} (${width}×${height})`)
      } catch (err) {
        // The grid still works without dimensions; it just cannot reserve
        // the exact space beforehand.
        failures.push(`${key} — ${err.message}`)
      }
    }

    const fromName = parseFilename(filename)
    const override = config.gallery?.captions?.[key] || {}

    manifest.push({
      id,
      file: key,
      size: obj.Size,
      modTime: obj.ModTime,
      src: `/${encodeURI(key)}`,
      thumb: `/${encodeURI(key)}`,
      width,
      height,
      catalog,
      catalogSlug: slugifyName(catalog),
      album,
      albumSlug: album ? slugifyName(album) : null,
      description: override.description ?? fromName.description,
      date: override.date ?? fromName.date,
      // Web-sized copies (see scripts/optimize.mjs); absent = serve the original.
      ...(variants[key] ? { w: variants[key].w, c: variants[key].c, ...(variants[key].v ? { v: variants[key].v } : {}) } : {}),
    })
  }

  const { sortBy = 'date', sortDirection = 'desc' } = config.gallery || {}
  const dir = sortDirection === 'asc' ? 1 : -1
  manifest.sort((a, b) => {
    if (sortBy === 'name') return dir * a.file.localeCompare(b.file)
    const da = dateValue(a.date)
    const db = dateValue(b.date)
    if (da !== db) return dir * (da - db)
    return dir * a.file.localeCompare(b.file)
  })

  if (manifest.length === 0 && previous.length > 0) {
    console.error(
      `\n⚠  Found 0 photos in ${remote}, but the existing manifest has ` +
        `${previous.length}. Refusing to wipe it.\n` +
        `   If the bucket really is empty, delete ${path.relative(ROOT, MANIFEST_PATH)} and re-run.`
    )
    process.exit(1)
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  await writeSplit(manifest, config)

  const catalogNames = [...new Set(manifest.map((p) => p.catalog))]
  console.log(
    `\n📸 Indexed ${manifest.length} photo(s) in ${catalogNames.length} ` +
      `catalog(s) — ${measured} measured, ${cached} cached.`
  )
  for (const name of catalogNames) {
    const inCatalog = manifest.filter((p) => p.catalog === name)
    const albums = [...new Set(inCatalog.map((p) => p.album).filter(Boolean))]
    console.log(`   ${name}: ${inCatalog.length}`)
    for (const a of albums) {
      console.log(`      ${a}: ${inCatalog.filter((p) => p.album === a).length}`)
    }
  }
  if (failures.length) {
    console.log(`\n⚠  Could not read dimensions for ${failures.length} photo(s):`)
    for (const f of failures) console.log(`   ${f}`)
    console.log('   They will still display, but may shift the layout as they load.')
  }
  if (manifest.length === 0) {
    console.log(`   (Bucket is empty. Upload photos into ${remote}/<Catalog>/.)`)
  }
}

main().catch((err) => {
  console.error('Indexing failed:', err.message)
  process.exit(1)
})
