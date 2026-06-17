import { useState, useCallback, useEffect } from 'react'
import photos from './generated/manifest.json'
import config from '../site.config.json'
import Gallery from './components/Gallery.jsx'
import Lightbox from './components/Lightbox.jsx'

export default function App() {
  const [view, setView] = useState('gallery') // 'gallery' | 'about'
  const [activeIndex, setActiveIndex] = useState(null)
  const [scrolled, setScrolled] = useState(false)

  // Reveal the header divider once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const open = useCallback((i) => setActiveIndex(i), [])
  const close = useCallback(() => setActiveIndex(null), [])
  const next = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i + 1) % photos.length)),
    []
  )
  const prev = useCallback(
    () =>
      setActiveIndex((i) =>
        i === null ? i : (i - 1 + photos.length) % photos.length
      ),
    []
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
        ) : photos.length === 0 ? (
          <section className="empty">
            <h2>No photos yet</h2>
            <p>
              Drop image files into the <code>photos/</code> folder, then run{' '}
              <code>npm run dev</code> (or redeploy). They'll appear here
              automatically.
            </p>
          </section>
        ) : (
          <Gallery photos={photos} onOpen={open} />
        )}
        </div>
      </main>

      <footer className="site-footer">
        <span>{config.footer}</span>
      </footer>

      {activeIndex !== null && (
        <Lightbox
          photo={photos[activeIndex]}
          onClose={close}
          onNext={next}
          onPrev={prev}
          hasMultiple={photos.length > 1}
        />
      )}
    </div>
  )
}
