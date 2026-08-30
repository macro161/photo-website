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
export function buildCatalogs(photos, { order = [], covers = {} } = {}) {
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
    }
  })

  sortByOrder(catalogs, order)
  return catalogs
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
    if (a.newest !== b.newest) return b.newest - a.newest
    return a.name.localeCompare(b.name)
  })
}

function dateValue(date) {
  if (!date) return 0
  const t = Date.parse(date)
  return Number.isNaN(t) ? 0 : t
}
