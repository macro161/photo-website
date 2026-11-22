/**
 * Build-time table for src/preloadHints.js: for every route, the photo that will be the main one on the first screen
 * (home / catalogs with albums: the first card's cover for each sort order; photo grids: the first photos with their aspect
 * ratios, so the inline script can run the same justified-rows layout as the Gallery component).
 * Loaded by vite.config.js through Vite's own module loader, so it uses exactly the app's sorting and catalog code.
 */
import catalogIndex from './generated/index.json'
import config from '../site.config.json'
import hikeAlbums from './lab/hikeAlbums.json'
import { buildCatalogsFromIndex, withPhotos } from './catalogs.js'
import { dateFor, sortByDate } from './dates.js'
import { ratioOf } from './layout.js'

const photoFiles = import.meta.glob('./generated/catalogs/*.json', { eager: true, import: 'default' })
const GRID_PHOTOS = 12 // the first two rows hold at most this many frames on any common screen

const tuple = (p) => [p.file, p.v || 0, p.w || []]
const ratioInt = (p) => Math.round(ratioOf(p) * 10000)
/** A grid route: full tuples for the first photos, and every photo's aspect ratio (x10000) so the inline script lays the rows out exactly as the Gallery does. */
const grid = (items) => ({ p: items.slice(0, GRID_PHOTOS).map(({ photo }) => tuple(photo)), r: items.map(({ photo }) => ratioInt(photo)) })
const hasVariants = (p) => Array.isArray(p?.w) && p.w.length > 0

/** @param chunks map of catalog slug -> built chunk URL (only known in a production build) */
export function firstScreenTable(chunks = {}) {
  const catalogs = buildCatalogsFromIndex(catalogIndex, { order: config.gallery?.catalogOrder, dateFor })
  const routes = {}
  const cards = (list) => {
    const n = sortByDate(list, 'newest')[0]?.cover
    const o = sortByDate(list, 'oldest')[0]?.cover
    return { k: 'c', ...(hasVariants(n) ? { n: tuple(n) } : {}), ...(hasVariants(o) ? { o: tuple(o) } : {}) }
  }
  routes[''] = cards(catalogs)
  for (const c of catalogs) {
    const photos = photoFiles[`./generated/catalogs/${c.slug}.json`]
    const full = photos ? withPhotos(c, photos) : c
    const chunk = chunks[c.slug]
    if (c.albums.length > 0) routes[`c/${c.slug}`] = cards(c.albums)
    else if (c.looseCount > 0) {
      routes[`c/${c.slug}`] = { k: 'g', ...grid(full.items), ...(chunk ? { m: chunk } : {}) }
    }
    for (const a of full.albums) {
      const isHike = Boolean(hikeAlbums[`${c.slug}/${a.slug}`])
      routes[`c/${c.slug}/${a.slug}`] = { k: 'g', gs: isHike ? 2.3 : 1, ...grid(a.items), ...(chunk ? { m: chunk } : {}) }
    }
  }
  return { base: String(config.imageBaseUrl || '').replace(/\/+$/, ''), routes }
}
