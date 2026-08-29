import { useState, useCallback, useEffect, useMemo } from 'react'
import photos from './generated/manifest.json'
import config from '../site.config.json'
import Gallery from './components/Gallery.jsx'
import Lightbox from './components/Lightbox.jsx'

/**
 * Group photos into sections by their description (e.g. all "@Paris" photos
 * together, then all "@London", etc). Sections appear in the order their
 * first photo appears in the manifest. Photos with no description are
 * collected into a final, untitled section.
 *
 * Also returns `flat`: every photo in display (top-to-bottom) order, each
 * tagged with the global index the lightbox uses to navigate across all
 * photos regardless of section.
 */
function buildSections(list) {
  const order = []
  const groups = new Map()
  for (const p of list) {
    const key = p.description || '' // '' => no description
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(p)
  }

  // Titled sections first (in first-appearance order), untitled last.
  const keys = order.filter((k) => k !== '')
  if (groups.has('')) keys.push('')

  const flat = []
  const sections = keys.map((key) => ({
    title: key || null,
    items: groups.get(key).map((photo) => {
      const index = flat.length
      flat.push(photo)
      return { photo, index }
    }),
  }))

  return { sections, flat }
}

export default function App() {
  const [view, setView] = useState('gallery') // 'gallery' | 'about'
  const [activeIndex, setActiveIndex] = useState(null)
  const [scrolled, setScrolled] = useState(false)

  const { sections, flat } = useMemo(() => buildSections(photos), [])

  // Reveal the header divider once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const total = flat.length
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
          onClick={() => setView('gallery')}
          aria-label="Back to gallery"
        >
          <span className="name">{config.title}</span>
          <span className="tagline">{config.tagline}</span>
        </button>
        <nav className="nav">
          <button
            className={view === 'gallery' ? 'active' : ''}
            onClick={() => setView('gallery')}
          >
            Gallery
          </button>
          <button
            className={view === 'about' ? 'active' : ''}
            onClick={() => setView('about')}
          >
            About
          </button>
        </nav>
      </header>

      <main>
        <div className="view" key={view}>
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
        ) : total === 0 ? (
          <section className="empty">
            <h2>No photos yet</h2>
            <p>
              Drop image files into the <code>photos/</code> folder, then run{' '}
              <code>npm run dev</code> (or redeploy). They'll appear here
              automatically.
            </p>
          </section>
        ) : (
          <Gallery sections={sections} onOpen={open} />
        )}
        </div>
      </main>

      <footer className="site-footer">
        <span>{config.footer}</span>
      </footer>

      {activeIndex !== null && (
        <Lightbox
          photo={flat[activeIndex]}
          onClose={close}
          onNext={next}
          onPrev={prev}
          hasMultiple={total > 1}
        />
      )}
    </div>
  )
}
