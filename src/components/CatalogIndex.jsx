/**
 * Landing view: one card per catalog, showing its cover photo, name and
 * count. Clicking a card opens that catalog.
 *
 * Catalogs come from folder names, so this renders however many exist —
 * adding a folder adds a card, with no change here.
 */
import { useState, useEffect, useRef } from 'react'
import { imageUrl } from '../imageUrl.js'

function CatalogCard({ catalog, onOpen }) {
  const [loaded, setLoaded] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const ref = useRef(null)

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
      aria-label={`${catalog.name} — ${catalog.count} photos`}
    >
      <span className="catalog-cover">
        {cover ? (
          <img
            src={imageUrl(cover.thumb)}
            alt=""
            loading="lazy"
            decoding="async"
            className={loaded ? 'loaded' : ''}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <span className="catalog-cover-empty">No photos yet</span>
        )}
      </span>
      <span className="catalog-meta">
        <span className="catalog-name">{catalog.name}</span>
        <span className="catalog-count">
          {catalog.count} {catalog.count === 1 ? 'photo' : 'photos'}
        </span>
      </span>
    </button>
  )
}

export default function CatalogIndex({ catalogs, onOpen }) {
  return (
    <div className="catalog-grid">
      {catalogs.map((catalog) => (
        <CatalogCard key={catalog.slug} catalog={catalog} onOpen={onOpen} />
      ))}
    </div>
  )
}
