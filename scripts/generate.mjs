/**
 * Build step for the photo site.
 *
 * Scans the /photos folder for image files and, for each one:
 *   - generates an optimized "large" web image (for the lightbox)
 *   - generates a smaller thumbnail (for the gallery grid)
 *   - reads the description and date from the FILENAME (see below)
 *
 * The results are written to src/generated/manifest.json, which the
 * React app imports. Optimized images go to public/generated/.
 *
 * --- Naming convention ---
 * The text after "@" symbols in the filename becomes the photo's caption.
 *   "abcd.jpg"                    -> no description, no date
 *   "abcd@Paris.jpg"              -> description "Paris", no date
 *   "abcd@Paris@2026-05-05.jpg"   -> description "Paris", date 2026-05-05
 * (The part before the first "@" is ignored — name it however you like.)
 *
 * Subfolders are scanned too, so /photos/batch 1/roll@Paris.jpg works the
 * same as /photos/roll@Paris.jpg. Folder names are organisational only --
 * they do not affect the site.
 *
 * Add a photo: drop a file in /photos. Remove one: delete it. That's all.
 *
 * Processing is cached by file size + modified time, so re-runs only
 * touch photos that actually changed.
 */
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const PHOTOS_DIR = path.join(ROOT, 'photos')
const OUT_IMAGES_DIR = path.join(ROOT, 'public', 'generated')
const MANIFEST_PATH = path.join(ROOT, 'src', 'generated', 'manifest.json')

// Web image sizes (longest edge, in pixels) and quality.
const LARGE_WIDTH = 2200 // shown in the lightbox
const THUMB_WIDTH = 800 // shown in the grid
const QUALITY = 80

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'])

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // drop extension
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Pull description + date out of the filename using "@" as the separator.
 *   part 0 = whatever you want (ignored)
 *   part 1 = description
 *   part 2 = date
 */
function parseFilename(file) {
  const withoutExt = file.replace(/\.[^.]+$/, '')
  const parts = withoutExt.split('@')
  const description = parts.length >= 2 ? parts[1].trim() || null : null
  const date = parts.length >= 3 ? parts[2].trim() || null : null
  return { description, date }
}

// For sorting only: turn the filename date into a sortable number (0 if absent/invalid).
function dateValue(date) {
  if (!date) return 0
  const t = Date.parse(date)
  return Number.isNaN(t) ? 0 : t
}

async function main() {
  await fs.mkdir(OUT_IMAGES_DIR, { recursive: true })
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true })

  if (!existsSync(PHOTOS_DIR)) {
    await fs.mkdir(PHOTOS_DIR, { recursive: true })
  }

  // Load the previous manifest so we can skip unchanged photos.
  let previous = []
  if (existsSync(MANIFEST_PATH)) {
    try {
      previous = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
    } catch {
      previous = []
    }
  }
  const previousByFile = new Map(previous.map((p) => [p.file, p]))

  const imageFiles = await collectImages(PHOTOS_DIR)

  const manifest = []
  const usedSlugs = new Set()
  let processed = 0
  let cached = 0

  for (const file of imageFiles.sort()) {
    const srcPath = path.join(PHOTOS_DIR, file)
    const stat = await fs.stat(srcPath)

    // Stable id, unique even if two files slugify to the same thing.
    let id = slugify(file) || 'photo'
    let n = 2
    const baseId = id
    while (usedSlugs.has(id)) id = `${baseId}-${n++}`
    usedSlugs.add(id)

    const largeName = `${id}.webp`
    const thumbName = `${id}.thumb.webp`
    const largePath = path.join(OUT_IMAGES_DIR, largeName)
    const thumbPath = path.join(OUT_IMAGES_DIR, thumbName)

    const prev = previousByFile.get(file)
    const unchanged =
      prev &&
      prev.size === stat.size &&
      prev.mtimeMs === stat.mtimeMs &&
      existsSync(largePath) &&
      existsSync(thumbPath)

    let geometry
    if (unchanged) {
      geometry = { width: prev.width, height: prev.height }
      cached++
    } else {
      // Auto-orient (honor any rotation flag), then produce both sizes.
      const pipeline = sharp(srcPath).rotate()

      const largeInfo = await pipeline
        .clone()
        .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(largePath)

      await pipeline
        .clone()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(thumbPath)

      geometry = { width: largeInfo.width, height: largeInfo.height }
      processed++
      console.log(`✓ processed ${file}`)
    }

    // Description + date come straight from the filename (not the folder).
    const { description, date } = parseFilename(path.basename(file))

    manifest.push({
      id,
      file,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      src: `/generated/${largeName}`,
      thumb: `/generated/${thumbName}`,
      width: geometry.width,
      height: geometry.height,
      description,
      date,
    })
  }

  // Safety net: an empty scan next to a populated manifest almost always means
  // the photos are somewhere unexpected, not that they were all deleted. Bail
  // out rather than pruning every generated image.
  if (manifest.length === 0 && previous.length > 0) {
    console.error(
      `\n\u26a0  Found 0 photos in ${PHOTOS_DIR}, but the existing manifest has ` +
        `${previous.length}. Refusing to wipe it.\n` +
        `   If you really did remove every photo, delete ${path.relative(ROOT, MANIFEST_PATH)} and re-run.`
    )
    process.exit(1)
  }

  // Sort the gallery.
  const { sortBy = 'date', sortDirection = 'desc' } =
    (await loadSiteGalleryConfig()) || {}
  const dir = sortDirection === 'asc' ? 1 : -1
  manifest.sort((a, b) => {
    if (sortBy === 'name') return dir * a.file.localeCompare(b.file)
    // Default: by date from filename, falling back to filename when absent.
    const da = dateValue(a.date)
    const db = dateValue(b.date)
    if (da !== db) return dir * (da - db)
    return dir * a.file.localeCompare(b.file)
  })

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  // Clean up generated images whose source photo was deleted.
  await pruneOrphans(manifest)

  console.log(
    `\n📸 Manifest written: ${manifest.length} photo(s) — ${processed} processed, ${cached} cached.`
  )
  if (manifest.length === 0) {
    console.log('   (No photos yet. Drop image files into the /photos folder.)')
  }
}

/**
 * Every image under /photos, at any depth, as paths relative to /photos.
 * A leading capital "X" on a file or folder hides it (e.g. "Xdrafts/").
 */
async function collectImages(dir, prefix = '') {
  const found = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('X') || entry.name.startsWith('.')) continue
    const rel = prefix ? path.join(prefix, entry.name) : entry.name
    if (entry.isDirectory()) {
      found.push(...(await collectImages(path.join(dir, entry.name), rel)))
    } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(rel)
    }
  }
  return found
}

async function loadSiteGalleryConfig() {
  const p = path.join(ROOT, 'site.config.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')).gallery || null
  } catch {
    return null
  }
}

async function pruneOrphans(manifest) {
  const keep = new Set()
  for (const p of manifest) {
    keep.add(path.basename(p.src))
    keep.add(path.basename(p.thumb))
  }
  const generated = existsSync(OUT_IMAGES_DIR)
    ? await fs.readdir(OUT_IMAGES_DIR)
    : []
  for (const f of generated) {
    if (f.endsWith('.webp') && !keep.has(f)) {
      await fs.rm(path.join(OUT_IMAGES_DIR, f))
      console.log(`🗑  removed orphaned ${f}`)
    }
  }
}

main().catch((err) => {
  console.error('Photo generation failed:', err)
  process.exit(1)
})
