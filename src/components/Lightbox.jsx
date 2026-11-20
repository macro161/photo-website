/**
 * Full-screen photo viewer. Keyboard: ← / → to navigate, Esc to close.
 * Touch: swipe left/right to navigate, swipe down to close, pinch or
 * double-tap to zoom and drag to pan (swiping is off while zoomed).
 * Shows the description and date from the filename, exactly as written.
 *
 * The neighbouring photos are preloaded, and the grid's already-cached
 * thumbnail is shown at once while the full image decodes, so stepping
 * through never lands on an empty frame.
 */
import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../imageUrl.js'

const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 2.5
const AXIS_LOCK_PX = 8
const SWIPE_PX = 70
const CLOSE_PX = 110

/** Keep a few Image objects alive so the browser holds on to the preloads. */
function usePreload(photos) {
  const keep = useRef([])
  const key = photos.map((p) => p?.src).join('|')
  useEffect(() => {
    keep.current = photos
      .filter(Boolean)
      .map((p) => {
        const img = new Image()
        img.decoding = 'async'
        img.src = imageUrl(p.src)
        img.decode?.().catch(() => {})
        return img
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/** Thumbnail first (blurred, same box), full image on top once decoded. */
function LightboxImage({ photo }) {
  const [full, setFull] = useState(false)
  const src = imageUrl(photo.src)
  const thumb = imageUrl(photo.thumb)
  const alt = photo.description || photo.file
  const distinct = thumb !== src

  return (
    <div className="lb-stack">
      {distinct && (
        <img
          className={`lb-thumb${full ? ' done' : ''}`}
          src={thumb}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
      <img
        className={`lb-full${distinct && !full ? ' pending' : ''}`}
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget
          const done = () => setFull(true)
          if (img.decode) img.decode().then(done, done)
          else done()
        }}
      />
    </div>
  )
}

export default function Lightbox({
  photo,
  prevPhoto,
  nextPhoto,
  onClose,
  onNext,
  onPrev,
  hasMultiple,
}) {
  const rootRef = useRef(null)
  const figureRef = useRef(null)
  const zoomRef = useRef(null)
  const latest = useRef({})
  latest.current = { onClose, onNext, onPrev, hasMultiple }
  const g = useRef({
    pointers: new Map(),
    mode: 'none', // none | undecided | swipe-x | swipe-y | pan | pinch
    scale: 1,
    x: 0,
    y: 0,
    moved: false,
    lastTap: { t: 0, x: 0, y: 0 },
  })

  usePreload([nextPhoto, prevPhoto])

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

  function paintZoom(settle) {
    const el = zoomRef.current
    if (!el) return
    const { x, y, scale } = g.current
    el.classList.toggle('settle', !!settle)
    el.style.transform =
      scale === 1 && x === 0 && y === 0
        ? ''
        : `translate(${x}px, ${y}px) scale(${scale})`
  }

  function paintDrag(dx, dy, settle) {
    const fig = figureRef.current
    const root = rootRef.current
    if (!fig || !root) return
    fig.classList.toggle('settle', !!settle)
    root.classList.toggle('settle', !!settle)
    fig.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : ''
    root.style.opacity = dy > 0 ? String(Math.max(0.3, 1 - dy / 500)) : ''
  }

  // A new photo always starts un-zoomed and un-dragged.
  useEffect(() => {
    Object.assign(g.current, { scale: 1, x: 0, y: 0, mode: 'none' })
    g.current.pointers.clear()
    paintZoom(false)
    paintDrag(0, 0, false)
  }, [photo.id])

  function clampPan(x, y, scale) {
    const el = zoomRef.current
    if (!el) return { x, y }
    const maxX = Math.max(0, (el.offsetWidth * scale - window.innerWidth) / 2)
    const maxY = Math.max(0, (el.offsetHeight * scale - window.innerHeight) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  /** Untransformed centre of the zoom box, in viewport coordinates. */
  function origin() {
    const r = zoomRef.current.getBoundingClientRect()
    return {
      x: r.left + r.width / 2 - g.current.x,
      y: r.top + r.height / 2 - g.current.y,
    }
  }

  /** Zoom to `next`, keeping the viewport point (px, py) where it is. */
  function zoomAbout(px, py, next, settle) {
    const s = g.current
    const c = origin()
    const k = next / s.scale
    const pos = clampPan(
      px - c.x - k * (px - c.x - s.x),
      py - c.y - k * (py - c.y - s.y),
      next
    )
    Object.assign(s, { scale: next, x: pos.x, y: pos.y })
    paintZoom(settle)
  }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

  function onPointerDown(e) {
    const s = g.current
    if (e.pointerType === 'mouse') s.moved = false
    if (e.pointerType === 'mouse' || e.target.closest('button')) return
    if (s.pointers.size === 0) s.moved = false
    s.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      t: e.timeStamp,
    })
    e.currentTarget.setPointerCapture?.(e.pointerId)

    if (s.pointers.size === 2) {
      const [a, b] = [...s.pointers.values()]
      s.mode = 'pinch'
      s.pinch = {
        dist: dist(a, b) || 1,
        scale: s.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        x: s.x,
        y: s.y,
      }
      paintDrag(0, 0, false)
    } else if (s.pointers.size === 1) {
      s.mode = s.scale > 1 ? 'pan' : 'undecided'
      s.panStart = { x: s.x, y: s.y }
    }
  }

  function onPointerMove(e) {
    const s = g.current
    const p = s.pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    const dx = p.x - p.sx
    const dy = p.y - p.sy
    if (Math.hypot(dx, dy) > AXIS_LOCK_PX) s.moved = true

    if (s.mode === 'pinch' && s.pointers.size >= 2) {
      const [a, b] = [...s.pointers.values()]
      const scale = Math.min(
        MAX_SCALE,
        Math.max(1, s.pinch.scale * (dist(a, b) / s.pinch.dist))
      )
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const c = origin()
      const k = scale / s.pinch.scale
      const pos = clampPan(
        mid.x - c.x - k * (s.pinch.mid.x - c.x - s.pinch.x),
        mid.y - c.y - k * (s.pinch.mid.y - c.y - s.pinch.y),
        scale
      )
      Object.assign(s, { scale, x: pos.x, y: pos.y })
      paintZoom(false)
    } else if (s.mode === 'pan') {
      const pos = clampPan(s.panStart.x + dx, s.panStart.y + dy, s.scale)
      s.x = pos.x
      s.y = pos.y
      paintZoom(false)
    } else if (s.mode === 'undecided' && Math.hypot(dx, dy) > AXIS_LOCK_PX) {
      if (Math.abs(dx) > Math.abs(dy)) {
        s.mode = latest.current.hasMultiple ? 'swipe-x' : 'none'
      } else {
        s.mode = dy > 0 ? 'swipe-y' : 'none'
      }
    }
    if (s.mode === 'swipe-x') paintDrag(dx, 0, false)
    else if (s.mode === 'swipe-y') paintDrag(0, Math.max(0, dy), false)
  }

  function onPointerUp(e) {
    const s = g.current
    const p = s.pointers.get(e.pointerId)
    if (!p) return
    s.pointers.delete(e.pointerId)
    const dx = p.x - p.sx
    const dy = p.y - p.sy
    const dt = Math.max(1, e.timeStamp - p.t)
    const mode = s.mode
    const cancelled = e.type === 'pointercancel'

    if (s.pointers.size > 0) {
      // One finger of a pinch lifted: ignore the rest until all are up.
      s.mode = 'none'
      return
    }
    s.mode = 'none'

    if (mode === 'pinch' || mode === 'pan') {
      if (s.scale < 1.05) {
        Object.assign(s, { scale: 1, x: 0, y: 0 })
        paintZoom(true)
      }
      return
    }

    if (mode === 'swipe-x' && !cancelled) {
      const fast = Math.abs(dx) / dt > 0.5 && Math.abs(dx) > 30
      if (Math.abs(dx) > SWIPE_PX || fast) {
        paintDrag(0, 0, false)
        if (dx < 0) latest.current.onNext()
        else latest.current.onPrev()
        return
      }
    }
    if (mode === 'swipe-y' && !cancelled) {
      const fast = dy / dt > 0.5 && dy > 40
      if (dy > CLOSE_PX || fast) {
        latest.current.onClose()
        return
      }
    }
    if (mode === 'swipe-x' || mode === 'swipe-y') {
      paintDrag(0, 0, true)
      return
    }

    // A still tap on the photo; two in quick succession toggle zoom.
    if (!cancelled && !s.moved && e.target.closest('.lb-figure img')) {
      const last = s.lastTap
      if (
        e.timeStamp - last.t < 320 &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40
      ) {
        if (s.scale > 1) {
          Object.assign(s, { scale: 1, x: 0, y: 0 })
          paintZoom(true)
        } else {
          zoomAbout(e.clientX, e.clientY, DOUBLE_TAP_SCALE, true)
        }
        s.lastTap = { t: 0, x: 0, y: 0 }
      } else {
        s.lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY }
      }
    }
  }

  function onBackdropClick() {
    // A drag that ended over the backdrop must not count as a click, and
    // neither should a tap while zoomed in.
    if (g.current.moved || g.current.scale > 1) {
      g.current.moved = false
      return
    }
    onClose()
  }

  const date = photo.date

  return (
    <div
      className="lightbox"
      ref={rootRef}
      onClick={onBackdropClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
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

      <figure
        className="lb-figure"
        ref={figureRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lb-zoom" ref={zoomRef}>
          <LightboxImage key={photo.id} photo={photo} />
        </div>
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
