/**
 * Justified rows of one catalog's photos: every frame at its true aspect
 * ratio, rows filling the width, read left to right in roll order. Row breaks
 * are chosen to keep each row close to a target height (smaller on phones);
 * the last row keeps the target height instead of stretching. Each frame
 * fades and rises into view as it scrolls in; the image fades in once decoded.
 */
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import Picture from './Picture.jsx'

const ratioOf = (p) => (p.width && p.height ? p.width / p.height : 1.5)

/** Matches the old column gutter: clamp(12px, 2vw, 26px). */
const gutter = () => Math.min(26, Math.max(12, window.innerWidth * 0.02))
const targetHeight = (w) => (w < 560 ? 230 : w < 1000 ? 260 : 320)

/**
 * Splits `ratios` into rows for a container `width` px wide. Dynamic
 * programming over break points: cost is the squared deviation of each row's
 * height from the target, so rows stay even instead of greedy-filled. The last
 * row is free as long as it doesn't have to shrink below the target.
 */
export function justify(ratios, width, gap, target) {
  const n = ratios.length
  if (!n || width <= 0) return []
  const maxPer = Math.max(1, Math.ceil(width / (target * 0.5)))
  const cost = new Array(n + 1).fill(Infinity)
  const from = new Array(n + 1).fill(0)
  cost[0] = 0
  for (let j = 1; j <= n; j++) {
    let sum = 0
    for (let i = j - 1; i >= 0 && j - i <= maxPer; i--) {
      sum += ratios[i]
      const h = (width - gap * (j - i - 1)) / sum
      const last = j === n
      const dev = last && h >= target ? 0 : (h - target) / target
      const c = cost[i] + dev * dev
      if (c < cost[j]) {
        cost[j] = c
        from[j] = i
      }
    }
  }
  const rows = []
  for (let j = n; j > 0; j = from[j]) rows.push([from[j], j])
  rows.reverse()
  return rows.map(([i, j], k) => {
    const sum = ratios.slice(i, j).reduce((a, b) => a + b, 0)
    let h = (width - gap * (j - i - 1)) / sum
    const last = k === rows.length - 1
    if (last && h > target) h = target
    return { start: i, end: j, height: h }
  })
}

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
  return useMemo(() => {
    const gap = width ? Math.round(gutter() * gutterScale) : 0
    const rows = justify(ratios, width, gap, targetHeight(width))
    const boxes = new Array(ratios.length)
    let top = 0
    rows.forEach((row, r) => {
      let left = 0
      for (let i = row.start; i < row.end; i++) {
        const w = ratios[i] * row.height
        boxes[i] = { left, top, w, h: row.height, priority: r === 0 }
        left += w + gap
      }
      top += row.height + gap
    })
    return { boxes, height: rows.length ? top - gap : 0 }
  }, [ratios, width, gutterScale])
}

function Thumb({ photo, index, onOpen, box }) {
  const { left, top, w, h, priority } = box
  const [loaded, setLoaded] = useState(false)
  const [revealed, setRevealed] = useState(priority)
  const ref = useRef(null)

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
      <Picture
        photo={photo}
        sizes={`${Math.ceil(w)}px`}
        alt={photo.description || photo.file}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
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

/** `gutterScale` widens the gaps between frames (1 = the site's usual gutter). */
export default function Gallery({ items, onOpen, gutterScale = 1 }) {
  const [ref, width] = useWidth()
  const ratios = useMemo(() => items.map(({ photo }) => ratioOf(photo)), [items])
  const { boxes, height } = useLayout(ratios, width, gutterScale)

  return (
    <div className="gallery" ref={ref} style={{ height }}>
      {width > 0 &&
        items.map(({ photo, index }, i) => (
          <Thumb key={photo.id} photo={photo} index={index} onOpen={onOpen} box={boxes[i]} />
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
