import { lazy, Suspense, useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import catalogIndex from './generated/index.json'
import config from '../site.config.json'
import { buildCatalogsFromIndex, withPhotos } from './catalogs.js'
import CatalogIndex from './components/CatalogIndex.jsx'
import Gallery, { GallerySkeleton } from './components/Gallery.jsx'
import Lightbox from './components/Lightbox.jsx'
import Lab from './lab/Lab.jsx'
import NotFound from './components/NotFound.jsx'
import { rollInfo, rollLine } from './rolls.js'
import hikeAlbums from './lab/hikeAlbums.json'

const RouteBackdrop = lazy(() => import('./lab/valsorey/Backdrop.jsx'))
import albumLinks from './albumLinks.json'
import DateFilter from './components/DateFilter.jsx'
import { openPhoto, closePhoto } from './viewTransition.js'
import { dateFor, inRange, formatRange, formatHike, yearsFor, sortByDate } from './dates.js'

/**
 * Routing lives in the URL hash so catalogs are linkable and the browser's
 * back button works:
 *   #/                          all catalogs
 *   #/c/swiss                   one catalog (album cards, or its grid)
 *   #/c/swiss/le-chasseron      one album inside a catalog
 *   #/c/swiss/p/<photo-id>      a photo, open in the lightbox
 *   #/c/swiss/le-chasseron/p/<photo-id>
 *   #/about                     about
 * Opening a photo pushes one history entry (so Back closes the lightbox);
 * stepping between photos replaces it.
 */
function decode(part) {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

function parseHash(hash) {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  if (path === 'about') {
    return { view: 'about', catalog: null, album: null, photo: null }
  }
  const parts = path.split('/').filter(Boolean).map(decode)
  if (parts[0] === 'lab') {
    return { view: 'lab', labSlug: parts[1] || null, labArg: parts[2] || null, catalog: null, album: null, photo: null }
  }
  if (parts[0] === 'c' && parts[1]) {
    let rest = parts.slice(2)
    let photo = null
    if (rest.length >= 2 && rest[rest.length - 2] === 'p') {
      photo = rest[rest.length - 1]
      rest = rest.slice(0, -2)
    }
    const album = rest.length ? rest.join('/') : null
    return {
      view: album ? 'album' : 'catalog',
      catalog: parts[1],
      album,
      photo,
    }
  }
  if (parts.length) return { view: 'notfound', catalog: null, album: null, photo: null }
  return { view: 'catalogs', catalog: null, album: null, photo: null }
}

/** Identifies the page on screen (the lightbox is not a page). Unknown album/catalog pages share the not-found key. */
function pageKeyOf(r) {
  return `${r.view}:${r.catalog ?? ''}:${r.album ?? ''}`
}

// Scroll memory. This listener is registered at import time, i.e. before React's own hashchange listener,
// so it still sees the page being left (React may re-render between two listeners of one event).
const scroll = { key: pageKeyOf(parseHash(window.location.hash)), saved: new Map(), pending: 0 }
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
window.addEventListener('hashchange', () => {
  const nextKey = pageKeyOf(parseHash(window.location.hash))
  if (nextKey === scroll.key) return
  scroll.saved.set(scroll.key, window.scrollY)
  scroll.key = nextKey
  scroll.pending = forceTop ? 0 : scroll.saved.get(nextKey) || 0
  forceTop = false
})

function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// Forward navigation starts at the top of the page; going back (browser Back or a back link) restores
// where you were. `forceTop` is read once per page change by the scroll handling in App.
let forceTop = false
const go = (path) => {
  forceTop = true
  window.location.hash = path
}
const goBack = (path) => {
  forceTop = false
  window.location.hash = path
}

/** Change the hash without (replace) or with (push) a history entry. */
function writeHash(path, mode) {
  const state = mode === 'push' ? { lb: true } : window.history.state
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](
    state,
    '',
    `#${path}`
  )
  // pushState/replaceState do not fire hashchange; the route hook listens.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const photoPath = (p) =>
  `/c/${p.catalogSlug}${p.albumSlug ? `/${p.albumSlug}` : ''}/p/${p.id}`

/**
 * Each catalog's photos live in their own file (scripts/index.mjs) and are fetched when that catalog is
 * opened. The main bundle only carries the small index: catalogs, albums, counts and covers.
 */
const photoLoaders = import.meta.glob('./generated/catalogs/*.json', { import: 'default' })
const photoCache = new Map()
const photoDone = new Map() // resolved lists, so a revisited catalog renders without a loading frame
function loadCatalogPhotos(slug) {
  if (!photoCache.has(slug)) {
    const load = photoLoaders[`./generated/catalogs/${slug}.json`]
    photoCache.set(
      slug,
      load
        ? load().then(
            (list) => {
              photoDone.set(slug, list)
              return list
            },
            (err) => {
              photoCache.delete(slug) // allow a retry on the next visit
              throw err
            }
          )
        : Promise.resolve([])
    )
  }
  return photoCache.get(slug)
}

/** The photos of one catalog, or null while they load (or when no catalog is open). */
function useCatalogPhotos(slug) {
  const [state, setState] = useState({ slug: null, photos: null, failed: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!slug) return
    let live = true
    setState((s) => (s.failed ? { slug, photos: null, failed: false } : s))
    loadCatalogPhotos(slug).then(
      (photos) => live && setState({ slug, photos, failed: false }),
      () => live && setState({ slug, photos: null, failed: true })
    )
    return () => {
      live = false
    }
  }, [slug, attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const photos = (slug && photoDone.get(slug)) || (state.slug === slug ? state.photos : null)
  return { photos, failed: Boolean(slug) && !photos && state.slug === slug && state.failed, retry }
}

/** Opens a random photo from the whole site: a catalog weighted by photo count, then one of its photos. */
async function shuffle() {
  const total = catalogIndex.reduce((n, c) => n + c.count, 0)
  if (!total) return
  let r = Math.random() * total
  const cat = catalogIndex.find((c) => (r -= c.count) < 0) || catalogIndex[catalogIndex.length - 1]
  try {
    const list = await loadCatalogPhotos(cat.slug)
    if (list.length) writeHash(photoPath(list[Math.floor(Math.random() * list.length)]), 'push')
  } catch {
    /* offline or rate-limited: the button simply does nothing */
  }
}

function RollLine({ info }) {
  const text = rollLine(info)
  return text ? <p className="roll-line">{text}</p> : null
}

function DateLine({ entry }) {
  if (!entry) return null
  const hike = formatHike(entry)
  return (
    <p className="date-line">
      <span>{formatRange(entry)}</span>
      {hike && <span className="date-line-hike">{hike}</span>}
    </p>
  )
}

export default function App() {
  const route = useHashRoute()
  // Date-range filter; also kept in the hash query (#/?from=...&to=...) so it survives a reload.
  const [range, setRange] = useState(() => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const ok = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '')
    return { from: ok(q.get('from')), to: ok(q.get('to')) }
  })
  // A hash that carries a range (pasted or followed link) updates the filter; one without leaves it alone.
  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash.split('?')[1]
      if (raw == null) return
      const q = new URLSearchParams(raw)
      const ok = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '')
      const next = { from: ok(q.get('from')), to: ok(q.get('to')) }
      setRange((cur) => (cur.from === next.from && cur.to === next.to ? cur : next))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [sortDir, setSortDir] = useState(() => {
    try {
      return window.localStorage.getItem('sortDir') === 'oldest' ? 'oldest' : 'newest'
    } catch {
      return 'newest'
    }
  })
  const toggleSort = useCallback(() => {
    setSortDir((d) => {
      const next = d === 'oldest' ? 'newest' : 'oldest'
      try {
        window.localStorage.setItem('sortDir', next)
      } catch {
        /* storage unavailable: the choice just won't persist */
      }
      return next
    })
  }, [])
  const changeRange = useCallback((next) => {
    setRange(next)
    const q = new URLSearchParams()
    if (next.from) q.set('from', next.from)
    if (next.to) q.set('to', next.to)
    const base = window.location.hash.replace(/^#/, '').split('?')[0] || '/'
    window.history.replaceState(window.history.state, '', `#${base}${q.toString() ? `?${q}` : ''}`)
  }, [])
  const [scrolled, setScrolled] = useState(false)

  const catalogs = useMemo(
    () =>
      buildCatalogsFromIndex(catalogIndex, {
        order: config.gallery?.catalogOrder,
        dateFor,
      }),
    []
  )

  const filtering = Boolean(range.from || range.to)
  const matches = (entry) => inRange(entry, range.from, range.to)
  const visibleCatalogs = sortByDate(catalogs.filter((c) => matches(c.date)), sortDir)
  const catalogLite = catalogs.find((c) => c.slug === route.catalog) || null
  // The index alone draws the home page and a catalog's album cards; photos are fetched only when a grid or lightbox needs them.
  const needsPhotos = Boolean(
    catalogLite && (route.album || route.photo || catalogLite.looseCount > 0)
  )
  const { photos: catalogPhotos, failed: loadFailed, retry } = useCatalogPhotos(needsPhotos ? catalogLite.slug : null)
  const [notice, setNotice] = useState('')
  const catalog = useMemo(
    () => (catalogLite && catalogPhotos ? withPhotos(catalogLite, catalogPhotos) : catalogLite),
    [catalogLite, catalogPhotos]
  )
  // True once whatever the current page needs is in hand (the index alone is enough for the home page).
  const ready = !needsPhotos || catalogPhotos !== null
  const album = catalog?.albums.find((a) => a.slug === route.album) || null
  // Undated albums are hidden while a filter is active (and the filter says so).
  const shownAlbums = catalog ? sortByDate(catalog.albums.filter((a) => matches(a.date)), sortDir) : []
  const hiddenUndatedAlbums = catalog ? catalog.albums.filter((a) => !a.date).length : 0
  const showLoose = !catalog || catalog.albums.length === 0 || matches(catalog.date)

  // An unknown slug falls back to the nearest real page rather than a blank one.
  let view = route.view
  // Unknown catalogs/albums get a real "not found" page; wait for the photos before judging an album.
  if ((view === 'catalog' || view === 'album') && !catalogLite) view = 'notfound'
  if (view === 'album' && !album) view = 'notfound'
  if (view === 'album' && loadFailed) view = 'loadfailed'

  // Whichever grid is on screen is what the lightbox pages through.
  const shownItems =
    view === 'album' ? album.items : view === 'catalog' ? catalog.items : []
  const pageKey = pageKeyOf(route)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll: remember each page's position and restore it when coming back (once its content has rendered).
  useEffect(() => setNotice(''), [pageKey])
  useLayoutEffect(() => {
    const target = scroll.pending
    if (!target) {
      window.scrollTo(0, 0)
      return
    }
    if (!ready) return // restore once the photos (and the real grid height) are in
    scroll.pending = 0
    let tries = 0
    const attempt = () => {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) > 2 && tries++ < 30) requestAnimationFrame(attempt)
    }
    attempt()
  }, [pageKey, ready])

  // The lightbox is driven by the URL: the open photo is whatever the hash names.
  const total = shownItems.length
  const activeIndex = route.photo
    ? shownItems.findIndex((it) => it.photo.id === route.photo)
    : -1
  const basePath =
    view === 'album'
      ? `/c/${catalog.slug}/${album.slug}`
      : view === 'catalog'
        ? `/c/${catalog.slug}`
        : '/'

  // A photo id that is not on this page: if it exists elsewhere, go to its
  // real home, otherwise drop it and show the page underneath.
  useEffect(() => {
    if (!route.photo || activeIndex >= 0 || !ready) return
    // Photo ids start with their catalog's slug, so an old link with the wrong catalog can still be found.
    const owner = catalogs
      .filter((c) => route.photo.startsWith(`${c.slug}-`) && c.slug !== catalogLite?.slug)
      .sort((a, b) => b.slug.length - a.slug.length)[0]
    let live = true
    const own = catalogPhotos?.find((p) => p.id === route.photo)
    const done = (found) => {
      if (!live) return
      if (!found) setNotice("That photo couldn't be found, so here's the album instead.")
      writeHash(found && view !== 'about' ? photoPath(found) : basePath, 'replace')
    }
    if (own || !owner) done(own)
    else loadCatalogPhotos(owner.slug).then((list) => done(list.find((p) => p.id === route.photo)), () => done(null))
    return () => {
      live = false
    }
  }, [route.photo, activeIndex, basePath, view, ready, catalogs, catalogLite, catalogPhotos])

  // Opening and closing morph between the grid thumbnail and the lightbox (see viewTransition.js).
  const open = useCallback((i) => {
    const p = shownItems[i].photo
    openPhoto(p.id, () => writeHash(photoPath(p), 'push'))
  }, [shownItems])
  const close = useCallback(() => {
    // Opened from this page: Back is the natural way out. Deep-linked in: no
    // entry to go back to, so replace instead of leaving the site.
    const leave = () => {
      if (window.history.state?.lb) window.history.back()
      else writeHash(basePath, 'replace')
    }
    if (route.photo) closePhoto(route.photo, leave)
    else leave()
  }, [basePath, route.photo])
  const step = useCallback(
    (delta) => {
      if (activeIndex < 0) return
      const to = shownItems[(activeIndex + delta + total) % total]
      writeHash(photoPath(to.photo), 'replace')
    },
    [activeIndex, shownItems, total]
  )
  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])

  return (
    <div className="app">
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <button
          className="site-title"
          onClick={() => go('/')}
          aria-label="Back to catalogs"
        >
          <span className="name">{config.title}</span>
          <span className="tagline">{config.tagline}</span>
        </button>
        <nav className="nav">
          <button
            className={view !== 'about' ? 'active' : ''}
            onClick={() => go('/')}
          >
            Gallery
          </button>
          <button
            className={view === 'about' ? 'active' : ''}
            onClick={() => go('/about')}
          >
            About
          </button>
          <button onClick={shuffle} title="Open a random photo" aria-label="Open a random photo">
            Shuffle
          </button>
        </nav>
      </header>

      <main>
        <div
          className="view"
          key={pageKey}
        >
          {view === 'lab' ? (
            <Lab slug={route.labSlug} arg={route.labArg} />
          ) : view === 'notfound' ? (
            <NotFound
              message={
                route.view === 'album' && catalogLite
                  ? "That album doesn't exist (it may have been renamed)."
                  : undefined
              }
              onHome={() => go('/')}
              onBack={route.view === 'album' && catalogLite ? () => go(`/c/${catalogLite.slug}`) : undefined}
              backLabel={route.view === 'album' && catalogLite ? `← ${catalogLite.name}` : undefined}
            />
          ) : view === 'loadfailed' ? (
            <NotFound
              title="Couldn't load these photos"
              message="The photos didn't come through. Check your connection and try again."
              onRetry={retry}
              onHome={() => go('/')}
            />
          ) : view === 'about' ? (
            <section className="about">
              <p className="about-text">{config.about}</p>
              {config.links?.length > 0 && (
                <ul className="about-links">
                  {config.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : catalogIndex.length === 0 ? (
            <section className="empty">
              <h2>No photos yet</h2>
              <p>
                Upload photos to the <code>photos-web</code> bucket in a folder
                — say <code>London 2026</code> — then run{' '}
                <code>npm run index</code>. Each folder becomes a catalog here.
              </p>
            </section>
          ) : view === 'album' ? (
            <>
            {hikeAlbums[`${catalog.slug}/${album.slug}`] && (
              <Suspense fallback={null}>
                <RouteBackdrop slug={album.slug} />
              </Suspense>
            )}
            <section className="catalog-view" style={hikeAlbums[`${catalog.slug}/${album.slug}`] ? { position: 'relative', zIndex: 1 } : undefined}>
              <button
                className="back-link"
                onClick={() => goBack(`/c/${catalog.slug}`)}
              >
                ← {catalog.name}
              </button>
              <h2 className="section-title">
                {album.name}
                <span className="section-count">{album.count}</span>
              </h2>
              <DateLine entry={album.date} />
              <RollLine info={rollInfo(catalog.slug, album.slug)} />
              {hikeAlbums[`${catalog.slug}/${album.slug}`] && (
                <p className="roll-line">
                  <a href={`#/lab/route/${album.slug}`}>Route and track →</a>
                  {albumLinks[`${catalog.slug}/${album.slug}`] && (
                    <>
                      {albumLinks[`${catalog.slug}/${album.slug}`].alltrails.map((u, i, all) => (
                        <span key={u}>
                          {' · '}
                          <a href={u} target="_blank" rel="noreferrer">AllTrails{all.length > 1 ? ` ${i + 1}` : ''} ↗</a>
                        </span>
                      ))}
                      {' · '}
                      <a href={albumLinks[`${catalog.slug}/${album.slug}`].map} target="_blank" rel="noreferrer">Map ↗</a>
                    </>
                  )}
                </p>
              )}
              {notice && <p className="notice">{notice}</p>}
              {ready ? (
                <Gallery items={album.items} onOpen={open} gutterScale={hikeAlbums[`${catalog.slug}/${album.slug}`] ? 2.3 : 1} />
              ) : (
                <GallerySkeleton count={album.count} gutterScale={hikeAlbums[`${catalog.slug}/${album.slug}`] ? 2.3 : 1} />
              )}
            </section>
            </>
          ) : view === 'catalog' ? (
            <section className="catalog-view">
              <button className="back-link" onClick={() => goBack('/')}>
                ← All catalogs
              </button>
              <h2 className="section-title">
                {catalog.name}
                <span className="section-count">{catalog.count}</span>
              </h2>
              <DateLine entry={catalog.date} />
              <RollLine info={rollInfo(catalog.slug)} />
              {notice && <p className="notice">{notice}</p>}
              {(catalog.albums.length > 1 || (filtering && catalog.albums.length > 0)) && (
                <DateFilter
                  value={range}
                  onChange={changeRange}
                  years={yearsFor(catalog.albums.map((a) => a.date))}
                  shown={shownAlbums.length}
                  total={catalog.albums.length}
                  hiddenUndated={hiddenUndatedAlbums}
                  sort={sortDir}
                  onSort={toggleSort}
                />
              )}
              {/* Only label the groups when both are present; a catalog
                  that is all albums or all photos needs no explaining. */}
              {shownAlbums.length > 0 && (
                <>
                  {showLoose && catalog.looseCount > 0 && (
                    <h3 className="group-label">Albums</h3>
                  )}
                  <CatalogIndex
                    catalogs={shownAlbums}
                    onOpen={(slug) => go(`/c/${catalog.slug}/${slug}`)}
                  />
                </>
              )}
              {filtering && catalog.albums.length > 0 && shownAlbums.length === 0 && !showLoose && (
                <p className="df-empty">No albums in this date range.</p>
              )}
              {showLoose && catalog.looseCount > 0 && (
                <>
                  {shownAlbums.length > 0 && (
                    <h3 className="group-label">Photos</h3>
                  )}
                  {loadFailed ? (
                    <NotFound
                      title="Couldn't load these photos"
                      message="The photos didn't come through. Check your connection and try again."
                      onRetry={retry}
                      onHome={() => go('/')}
                    />
                  ) : ready ? (
                    <Gallery items={catalog.items} onOpen={open} />
                  ) : (
                    <GallerySkeleton count={catalog.looseCount} />
                  )}
                </>
              )}
            </section>
          ) : (
            <>
              <DateFilter
                value={range}
                onChange={changeRange}
                years={yearsFor(catalogs.map((c) => c.date))}
                shown={visibleCatalogs.length}
                total={catalogs.length}
                hiddenUndated={catalogs.filter((c) => !c.date).length}
                sort={sortDir}
                onSort={toggleSort}
              />
              {visibleCatalogs.length > 0 ? (
                <CatalogIndex catalogs={visibleCatalogs} onOpen={(slug) => go(`/c/${slug}`)} />
              ) : (
                <p className="df-empty">No catalogs in this date range. Use the Dates menu to change or clear it.</p>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="site-footer">
        <span>{config.footer}</span>
      </footer>

      {activeIndex >= 0 && (
        <Lightbox
          photo={shownItems[activeIndex].photo}
          prevPhoto={shownItems[(activeIndex - 1 + total) % total].photo}
          nextPhoto={shownItems[(activeIndex + 1) % total].photo}
          onClose={close}
          onNext={next}
          onPrev={prev}
          hasMultiple={total > 1}
        />
      )}
    </div>
  )
}
