/**
 * Turns the flat photo manifest into catalogs, and albums within them — one
 * per folder level in the photos-web R2 bucket, as recorded by
 * scripts/index.mjs.
 *
 *   London 2026/0042.jpg          -> catalog "London 2026"
 *   Swiss/Le Chasseron/0007.jpg   -> catalog "Swiss", album "Le Chasseron"
 *
 * A catalog with albums shows album cards; one without opens straight to its
 * grid. A catalog can have both — loose photos appear below its album cards.
 *
 * Nothing here knows any catalog by name. Creating a folder creates a
 * catalog; the site picks it up on the next `npm run index`.
 *
 * Ordering: names listed in `order` come first, in that order. Everything
 * else follows, newest photo first, so a freshly added folder surfaces at the
 * top without touching the config.
 */
export function buildCatalogs(photos, { order = [], covers = {}, dateFor = () => null } = {}) {
  const groups = new Map()

  for (const photo of photos) {
    const name = photo.catalog || 'Other'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(photo)
  }

  const catalogs = [...groups.entries()].map(([name, list]) => {
    const loose = list.filter((p) => !p.album)

    const albumNames = []
    const byAlbum = new Map()
    for (const photo of list) {
      if (!photo.album) continue
      if (!byAlbum.has(photo.album)) {
        byAlbum.set(photo.album, [])
        albumNames.push(photo.album)
      }
      byAlbum.get(photo.album).push(photo)
    }

    const albums = albumNames.map((albumName) => {
      const items = byAlbum.get(albumName)
      return {
        name: albumName,
        slug: items[0].albumSlug,
        items: withIndices(items),
        cover: pickCover(items, covers, [`${name}/${albumName}`, albumName]),
        count: items.length,
        label: photoLabel(items.length),
        newest: newestOf(items),
        date: dateFor(items[0].catalogSlug, items[0].albumSlug),
      }
    })

    sortByOrder(albums, order)

    return {
      name,
      slug: list[0].catalogSlug,
      albums,
      items: withIndices(loose),
      cover: pickCover(list, covers, [name]),
      count: list.length,
      label: catalogLabel(albums.length, loose.length, list.length),
      newest: newestOf(list),
      date: dateFor(list[0].catalogSlug, null),
    }
  })

  sortByOrder(catalogs, order)
  return catalogs
}

/**
 * The same catalogs, built from the small generated index (scripts/index.mjs) instead of every photo.
 * Counts, covers and ordering are all there; `items` stay empty until the catalog's photos are loaded
 * and passed through withPhotos().
 */
export function buildCatalogsFromIndex(index, { order = [], dateFor = () => null } = {}) {
  const catalogs = index.map((c) => {
    const albums = c.albums.map((a) => ({
      name: a.name,
      slug: a.slug,
      items: [],
      cover: a.cover,
      count: a.count,
      label: photoLabel(a.count),
      newest: a.newest,
      date: dateFor(c.slug, a.slug),
    }))
    sortByOrder(albums, order)
    return {
      name: c.name,
      slug: c.slug,
      albums,
      items: [],
      looseCount: c.looseCount,
      cover: c.cover,
      count: c.count,
      label: catalogLabel(albums.length, c.looseCount, c.count),
      newest: c.newest,
      date: dateFor(c.slug, null),
    }
  })
  sortByOrder(catalogs, order)
  return catalogs
}

/** Fills a catalog from the index with its photos (the per-catalog file), keeping everything else. */
export function withPhotos(catalog, photos) {
  const byAlbum = new Map()
  const loose = []
  for (const p of photos) {
    if (!p.albumSlug) loose.push(p)
    else {
      if (!byAlbum.has(p.albumSlug)) byAlbum.set(p.albumSlug, [])
      byAlbum.get(p.albumSlug).push(p)
    }
  }
  return {
    ...catalog,
    items: withIndices(loose),
    albums: catalog.albums.map((a) => ({ ...a, items: withIndices(byAlbum.get(a.slug) || []) })),
  }
}

/** Indices are local to the grid being shown; the lightbox pages within it. */
function withIndices(list) {
  return list.map((photo, index) => ({ photo, index }))
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

function photoLabel(n) {
  return `${n} ${n === 1 ? 'photo' : 'photos'}`
}

function catalogLabel(albumCount, looseCount, total) {
  if (!albumCount) return photoLabel(total)
  const albums = `${albumCount} ${albumCount === 1 ? 'album' : 'albums'}`
  return looseCount ? `${albums} · ${photoLabel(looseCount)}` : albums
}

function newestOf(list) {
  return Math.max(...list.map((p) => dateValue(p.date)))
}

function sortByOrder(entries, order) {
  const rank = (e) => {
    const i = order.indexOf(e.name)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  entries.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    const ea = a.date?.end || a.date?.start || ''
    const eb = b.date?.end || b.date?.start || ''
    if (ea !== eb) return ea < eb ? 1 : -1 // dated entries: newest first, undated last
    if (a.newest !== b.newest) return b.newest - a.newest
    return a.name.localeCompare(b.name)
  })
}

function dateValue(date) {
  if (!date) return 0
  const t = Date.parse(date)
  return Number.isNaN(t) ? 0 : t
}
