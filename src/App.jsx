import { useState, useCallback, useEffect, useMemo } from 'react'
import photos from './generated/manifest.json'
import config from '../site.config.json'
import { buildCatalogs } from './catalogs.js'
import CatalogIndex from './components/CatalogIndex.jsx'
import Gallery from './components/Gallery.jsx'
import Lightbox from './components/Lightbox.jsx'

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
  const path = hash.replace(/^#\/?/, '')
  if (path === 'about') {
    return { view: 'about', catalog: null, album: null, photo: null }
  }
  const parts = path.split('/').filter(Boolean).map(decode)
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
  return { view: 'catalogs', catalog: null, album: null, photo: null }
}

function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

const go = (path) => {
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

export default function App() {
  const route = useHashRoute()
  const [scrolled, setScrolled] = useState(false)

  const catalogs = useMemo(
    () =>
      buildCatalogs(photos, {
        order: config.gallery?.catalogOrder,
        covers: config.gallery?.covers,
      }),
    []
  )

  const catalog = catalogs.find((c) => c.slug === route.catalog) || null
  const album = catalog?.albums.find((a) => a.slug === route.album) || null

  // An unknown slug falls back to the nearest real page rather than a blank one.
  let view = route.view
  if (view === 'album' && !album) view = catalog ? 'catalog' : 'catalogs'
  if (view === 'catalog' && !catalog) view = 'catalogs'

  // Whichever grid is on screen is what the lightbox pages through.
  const shownItems =
    view === 'album' ? album.items : view === 'catalog' ? catalog.items : []

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.view, route.catalog, route.album])

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
    if (!route.photo || activeIndex >= 0) return
    const found = photos.find((p) => p.id === route.photo)
    writeHash(found && view !== 'about' ? photoPath(found) : basePath, 'replace')
  }, [route.photo, activeIndex, basePath, view])

  const open = useCallback(
    (i) => writeHash(photoPath(shownItems[i].photo), 'push'),
    [shownItems]
  )
  const close = useCallback(() => {
    // Opened from this page: Back is the natural way out. Deep-linked in: no
    // entry to go back to, so replace instead of leaving the site.
    if (window.history.state?.lb) window.history.back()
    else writeHash(basePath, 'replace')
  }, [basePath])
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
        </nav>
      </header>

      <main>
        <div
          className="view"
          key={`${view}:${route.catalog ?? ''}:${route.album ?? ''}`}
        >
          {view === 'about' ? (
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
          ) : photos.length === 0 ? (
            <section className="empty">
              <h2>No photos yet</h2>
              <p>
                Upload photos to the <code>photos-web</code> bucket in a folder
                — say <code>London 2026</code> — then run{' '}
                <code>npm run index</code>. Each folder becomes a catalog here.
              </p>
            </section>
          ) : view === 'album' ? (
            <section className="catalog-view">
              <button
                className="back-link"
                onClick={() => go(`/c/${catalog.slug}`)}
              >
                ← {catalog.name}
              </button>
              <h2 className="section-title">
                {album.name}
                <span className="section-count">{album.count}</span>
              </h2>
              <Gallery items={album.items} onOpen={open} />
            </section>
          ) : view === 'catalog' ? (
            <section className="catalog-view">
              <button className="back-link" onClick={() => go('/')}>
                ← All catalogs
              </button>
              <h2 className="section-title">
                {catalog.name}
                <span className="section-count">{catalog.count}</span>
              </h2>
              {/* Only label the groups when both are present; a catalog
                  that is all albums or all photos needs no explaining. */}
              {catalog.albums.length > 0 && (
                <>
                  {catalog.items.length > 0 && (
                    <h3 className="group-label">Albums</h3>
                  )}
                  <CatalogIndex
                    catalogs={catalog.albums}
                    onOpen={(slug) => go(`/c/${catalog.slug}/${slug}`)}
                  />
                </>
              )}
              {catalog.items.length > 0 && (
                <>
                  {catalog.albums.length > 0 && (
                    <h3 className="group-label">Photos</h3>
                  )}
                  <Gallery items={catalog.items} onOpen={open} />
                </>
              )}
            </section>
          ) : (
            <CatalogIndex catalogs={catalogs} onOpen={(slug) => go(`/c/${slug}`)} />
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
