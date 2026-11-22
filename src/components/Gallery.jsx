/**
 * Justified rows of one catalog's photos: every frame at its true aspect
 * ratio, rows filling the width, read left to right in roll order. Row breaks
 * are chosen to keep each row close to a target height (smaller on phones);
 * the last row keeps the target height instead of stretching. Each frame
 * fades and rises into view as it scrolls in; the image fades in once decoded.
 */
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import Picture from './Picture.jsx'
import { firstScreenLoaded, whenGateOpen } from '../loadGate.js'
import { justify, layoutBoxes, ratioOf } from '../layout.js'

export { justify }

/** Container width, measured before paint and kept current with a ResizeObserver. */
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      setWidth((cur) => (cur === w ? cur : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Absolute boxes for every frame, so a resize re-flows without remounting (and re-fading) any image. */
function useLayout(ratios, width, gutterScale = 1) {
  return useMemo(
    () => layoutBoxes(ratios, width, gutterScale, window.innerWidth),
    [ratios, width, gutterScale]
  )
}

function Thumb({ photo, index, onOpen, box, defer }) {
  const { left, top, w, h } = box
  // `defer`: a photo is open on top of the grid (opened by its link), so no grid image is the main one; all wait for the viewer's photo.
  const priority = box.priority && !defer
  const [loaded, setLoaded] = useState(false)
  const [revealed, setRevealed] = useState(priority)
  const [near, setNear] = useState(priority)
  const ref = useRef(null)

  // Photos off the first screen start loading once the first screen has loaded and they are within a short distance.
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

  // Reveal on scroll into view.
  useEffect(() => {
    const el = ref.current
    if (!el || revealed) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      ref={ref}
      className={`thumb${revealed ? ' revealed' : ''}`}
      data-photo-id={photo.id}
      style={{ left, top, width: w, height: h, ...(photo.c ? { backgroundColor: photo.c } : {}) }}
      onClick={() => onOpen(index)}
      aria-label={photo.description || photo.file}
    >
      {near && (
        <Picture
          photo={photo}
          sizes={`${Math.ceil(w)}px`}
          alt={photo.description || photo.file}
          loading="eager"
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          width={photo.width}
          height={photo.height}
          className={loaded ? 'loaded' : ''}
          onLoad={() => {
            setLoaded(true)
            if (priority) firstScreenLoaded()
          }}
        />
      )}
      {photo.description && (
        <span className="thumb-title">{photo.description}</span>
      )}
    </button>
  )
}

/** `gutterScale` widens the gaps between frames (1 = the site's usual gutter). */
export default function Gallery({ items, onOpen, gutterScale = 1, defer = false }) {
  const [ref, width] = useWidth()
  const ratios = useMemo(() => items.map(({ photo }) => ratioOf(photo)), [items])
  const { boxes, height } = useLayout(ratios, width, gutterScale)

  return (
    <div className="gallery" ref={ref} style={{ height }}>
      {width > 0 &&
        items.map(({ photo, index }, i) => (
          <Thumb key={photo.id} photo={photo} index={index} onOpen={onOpen} box={boxes[i]} defer={defer} />
        ))}
    </div>
  )
}

/** Holds the grid's place while a catalog's photos load: 3:2 tiles, the usual shape of a 35mm frame, in the same rows. */
export function GallerySkeleton({ count, gutterScale = 1 }) {
  const [ref, width] = useWidth()
  const ratios = useMemo(() => new Array(Math.min(count || 12, 48)).fill(1.5), [count])
  const { boxes, height } = useLayout(ratios, width, gutterScale)
  return (
    <div className="gallery gallery-skeleton" ref={ref} style={{ height }} aria-busy="true" aria-label="Loading photos">
      {width > 0 &&
        boxes.map((b, i) => (
          <div key={i} className="thumb-skel" style={{ left: b.left, top: b.top, width: b.w, height: b.h }} />
        ))}
    </div>
  )
}
