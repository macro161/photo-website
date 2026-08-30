/**
 * Turns the flat photo manifest into catalogs — one per top-level folder in
 * the photos-web R2 bucket, as recorded by scripts/index.mjs.
 *
 * Nothing here knows any catalog by name. Creating a folder creates a
 * catalog; the site picks it up on the next `npm run index`.
 *
 * Ordering: catalogs listed in `order` come first, in that order. Everything
 * else follows, newest photo first, so a freshly added folder surfaces at the
 * top without touching the config.
 *
 * Cover: the first photo in the catalog, unless `covers` names a file.
 */
export function buildCatalogs(photos, { order = [], covers = {} } = {}) {
  const groups = new Map()

  for (const photo of photos) {
    const name = photo.catalog || 'Other'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(photo)
  }

  const catalogs = [...groups.entries()].map(([name, list]) => {
    // Indices are catalog-local: the lightbox pages within one catalog.
    const items = list.map((photo, index) => ({ photo, index }))

    const wanted = covers[name]
    const cover =
      (wanted && list.find((p) => p.file.split('/').pop() === wanted)) ||
      list[0]

    return {
      name,
      slug: list[0].catalogSlug || slugify(name),
      items,
      cover,
      count: list.length,
      newest: Math.max(...list.map((p) => dateValue(p.date))),
    }
  })

  const rank = (c) => {
    const i = order.indexOf(c.name)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }

  catalogs.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.newest !== b.newest) return b.newest - a.newest
    return a.name.localeCompare(b.name)
  })

  return catalogs
}

function dateValue(date) {
  if (!date) return 0
  const t = Date.parse(date)
  return Number.isNaN(t) ? 0 : t
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'other'
  )
}
