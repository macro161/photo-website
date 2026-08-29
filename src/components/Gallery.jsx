/**
 * Masonry grid of one catalog's photos. Mixed portrait/landscape 35mm frames
 * pack naturally via CSS columns. Each frame fades and rises into view as it
 * scrolls in; the image fades in once decoded.
 */
import { useState, useEffect, useRef } from 'react'
import { imageUrl } from '../imageUrl.js'

function Thumb({ photo, index, onOpen }) {
  const [loaded, setLoaded] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const ref = useRef(null)

  // Reveal on scroll into view.
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

  // Reserve space using the real aspect ratio to avoid layout shift.
  const ratio = photo.width && photo.height ? photo.width / photo.height : 1.5

  return (
    <button
      ref={ref}
      className={`thumb${revealed ? ' revealed' : ''}`}
      style={{ aspectRatio: ratio }}
      onClick={() => onOpen(index)}
      aria-label={photo.description || photo.file}
    >
      <img
        src={imageUrl(photo.thumb)}
        alt={photo.description || photo.file}
        loading="lazy"
        decoding="async"
        width={photo.width}
        height={photo.height}
        className={loaded ? 'loaded' : ''}
        onLoad={() => setLoaded(true)}
      />
      {photo.description && (
        <span className="thumb-title">{photo.description}</span>
      )}
    </button>
  )
}

export default function Gallery({ items, onOpen }) {
  return (
    <div className="gallery">
      {items.map(({ photo, index }) => (
        <Thumb key={photo.id} photo={photo} index={index} onOpen={onOpen} />
      ))}
    </div>
  )
}
