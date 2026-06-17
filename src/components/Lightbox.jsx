/**
 * Full-screen photo viewer. Keyboard: ← / → to navigate, Esc to close.
 * Shows the description and date from the filename, exactly as written.
 */
import { useEffect } from 'react'

export default function Lightbox({ photo, onClose, onNext, onPrev, hasMultiple }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNext()
      else if (e.key === 'ArrowLeft') onPrev()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onNext, onPrev])

  const date = photo.date

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Close">
        ×
      </button>

      {hasMultiple && (
        <>
          <button
            className="lb-nav lb-prev"
            onClick={(e) => {
              e.stopPropagation()
              onPrev()
            }}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            className="lb-nav lb-next"
            onClick={(e) => {
              e.stopPropagation()
              onNext()
            }}
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      <figure className="lb-figure" onClick={(e) => e.stopPropagation()}>
        <img
          key={photo.src}
          src={photo.src}
          alt={photo.description || photo.file}
        />
        {(photo.description || date) && (
          <figcaption className="lb-meta" key={photo.id}>
            {photo.description && <h2>{photo.description}</h2>}
            {date && (
              <div className="lb-details">
                <span>{date}</span>
              </div>
            )}
          </figcaption>
        )}
      </figure>
    </div>
  )
}
