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
 *   #/               all catalogs
 *   #/c/london-2026  one catalog
 *   #/about          about
 */
function parseHash(hash) {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'about') return { view: 'about', slug: null }
  const match = path.match(/^c\/(.+)$/)
  if (match) return { view: 'catalog', slug: decodeURIComponent(match[1]) }
  return { view: 'catalogs', slug: null }
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

export default function App() {
  const route = useHashRoute()
  const [activeIndex, setActiveIndex] = useState(null)
  const [scrolled, setScrolled] = useState(false)

  const catalogs = useMemo(
    () =>
      buildCatalogs(photos, {
        order: config.gallery?.catalogOrder,
        covers: config.gallery?.covers,
      }),
    []
  )

  const active = catalogs.find((c) => c.slug === route.slug) || null
  // An unknown slug falls back to the index rather than a blank page.
  const view = route.view === 'catalog' && !active ? 'catalogs' : route.view

  // Reveal the header divider once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Leaving a catalog must not leave the lightbox open behind it.
  useEffect(() => {
    setActiveIndex(null)
    window.scrollTo(0, 0)
  }, [route.view, route.slug])

  const total = active ? active.items.length : 0
  const open = useCallback((i) => setActiveIndex(i), [])
  const close = useCallback(() => setActiveIndex(null), [])
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i + 1) % total)),
    [total]
  )
  const prev = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i - 1 + total) % total)),
    [total]
  )

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
        <div className="view" key={`${view}:${route.slug ?? ''}`}>
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
          ) : view === 'catalog' ? (
            <section className="catalog-view">
              <button className="back-link" onClick={() => go('/')}>
                ← All catalogs
              </button>
              <h2 className="section-title">
                {active.name}
                <span className="section-count">{active.count}</span>
              </h2>
              <Gallery items={active.items} onOpen={open} />
            </section>
          ) : (
            <CatalogIndex catalogs={catalogs} onOpen={(slug) => go(`/c/${slug}`)} />
          )}
        </div>
      </main>

      <footer className="site-footer">
        <span>{config.footer}</span>
      </footer>

      {activeIndex !== null && active && (
        <Lightbox
          photo={active.items[activeIndex].photo}
          onClose={close}
          onNext={next}
          onPrev={prev}
          hasMultiple={total > 1}
        />
      )}
    </div>
  )
}
