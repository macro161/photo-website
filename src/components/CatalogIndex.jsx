/**
 * A grid of cover cards. Used for the catalog index and, one level down, for
 * the albums inside a catalog — both are the same shape, so both render here.
 *
 * Entries come from folder names, so this renders however many exist —
 * adding a folder adds a card, with no change here.
 */
import { useState, useEffect, useRef } from 'react'
import Picture from './Picture.jsx'
import { firstScreenLoaded, whenGateOpen } from '../loadGate.js'
import { formatRange, formatHike } from '../dates.js'

function CatalogCard({ catalog, onOpen, priority }) {
  const [loaded, setLoaded] = useState(false)
  // The first card (the LCP image) starts revealed so it isn't held back by the fade-in; the others load after it (see loadGate.js).
  const [revealed, setRevealed] = useState(!!priority)
  const [near, setNear] = useState(!!priority)
  const ref = useRef(null)

  // Cards off the first screen load their cover once the first screen has loaded and they are within a short distance (see loadGate.js).
  useEffect(() => {
    const el = ref.current
    if (!el || near) return undefined
    let io = null
    const stop = whenGateOpen(() => {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setNear(true)
            io.disconnect()
          }
        },
        { rootMargin: '500px 0px' }
      )
      io.observe(el)
    })
    return () => {
      stop()
      io?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { cover } = catalog

  return (
    <button
      ref={ref}
      className={`catalog-card${revealed ? ' revealed' : ''}`}
      onClick={() => onOpen(catalog.slug)}
      aria-label={`${catalog.name} — ${catalog.label}`}
    >
      <span className="catalog-cover" style={cover?.c ? { backgroundColor: cover.c } : undefined}>
        {cover && near ? (
          <Picture
            photo={cover}
            sizes="(max-width: 700px) 100vw, 480px"
            alt=""
            loading="eager"
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className={loaded ? 'loaded' : ''}
            onLoad={() => {
              setLoaded(true)
              if (priority) firstScreenLoaded()
            }}
          />
        ) : cover ? null : (
          <span className="catalog-cover-empty">No photos yet</span>
        )}
      </span>
      <span className="catalog-meta">
        <span className="catalog-name">{catalog.name}</span>
        <span className="catalog-count">{catalog.label}</span>
      </span>
      {catalog.date && (
        <span className="catalog-sub">
          <span className="catalog-date">{formatRange(catalog.date)}</span>
          {formatHike(catalog.date) && (
            <span className="catalog-hike">{formatHike(catalog.date)}</span>
          )}
        </span>
      )}
    </button>
  )
}

export default function CatalogIndex({ catalogs, onOpen }) {
  return (
    <div className="catalog-grid">
      {catalogs.map((catalog, i) => (
        <CatalogCard key={catalog.slug} catalog={catalog} onOpen={onOpen} priority={i === 0} />
      ))}
    </div>
  )
}
