import { useEffect, useMemo, useRef, useState } from 'react'
import photos from '../../generated/manifest.json'
import activities from '../activities.json'
import hikeAlbums from '../hikeAlbums.json'
import { imageUrl } from '../../imageUrl.js'
import '../elevation/elevation.css'

const MAX_MARKERS = 14
const STEPS = 60
const H = 40 // viewBox height; width 100
const PAD = 6 // headroom so frames at the peak fit

// Schematic: one smooth climb to the midpoint, then back down (peak = gain).
const hAt = (t) => Math.sin(Math.PI * t)
const yOf = (h) => H - PAD - h * (H - PAD * 2)
const LINE = Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = i / STEPS
  return `${(t * 100).toFixed(2)},${yOf(hAt(t)).toFixed(2)}`
}).join(' ')
const AREA = `0,${H - PAD} ${LINE} 100,${H - PAD}`

function build() {
  const byAlbum = {}
  for (const p of photos) {
    if (!p.albumSlug) continue
    ;(byAlbum[`${p.catalogSlug}/${p.albumSlug}`] ||= []).push(p)
  }
  const byN = Object.fromEntries(activities.map((a) => [a.n, a]))
  const hikes = []
  for (const [key, ns] of Object.entries(hikeAlbums)) {
    const acts = ns.map((n) => byN[n]).filter(Boolean)
    const list = (byAlbum[key] || [])
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    if (!acts.length || !list.length) continue
    hikes.push({
      key,
      title: acts.map((a) => a.title).join(' + '),
      date: acts.map((a) => a.date).sort().pop(),
      km: acts.reduce((s, a) => s + a.km, 0),
      gain: acts.reduce((s, a) => s + a.gain, 0),
      photos: list,
    })
  }
  return hikes.sort((a, b) => b.date.localeCompare(a.date))
}

function sample(list, max) {
  if (list.length <= max) return list
  return Array.from({ length: max }, (_, i) => list[Math.round((i * (list.length - 1)) / (max - 1))])
}

function Card({ hike }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const marks = useMemo(() => sample(hike.photos, MAX_MARKERS), [hike])
  const n = marks.length
  const pos = (i) => (n === 1 ? 0.5 : 0.04 + (0.92 * i) / (n - 1))
  const href = (p) => `#/c/${p.catalogSlug}/${p.albumSlug}/p/${p.id}`
  const act = active != null ? marks[active] : null

  return (
    <article className="elv-card" ref={ref}>
      <h3>{hike.title}</h3>
      <div className="elv-meta">
        <span>{hike.date}</span>
        <span>{hike.km.toFixed(1)} km</span>
        <span>+{hike.gain} m</span>
        <span>{hike.photos.length} frames</span>
      </div>
      <div className="elv-chart">
        <svg
          className="elv-svg"
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Schematic elevation profile, ${hike.km.toFixed(1)} km, ${hike.gain} m gain`}
        >
          <polygon className="elv-area" points={AREA} />
          <line className="elv-base" x1="0" x2="100" y1={H - PAD} y2={H - PAD} />
          <polyline className="elv-line" points={LINE} />
          {marks.map((p, i) => {
            const t = pos(i)
            return (
              <line
                key={p.id}
                className={'elv-stem' + (active === i ? ' on' : '')}
                x1={t * 100}
                x2={t * 100}
                y1={yOf(hAt(t))}
                y2={H - PAD}
              />
            )
          })}
        </svg>
        <span className="elv-ylab">+{hike.gain} m</span>
        {seen &&
          marks.map((p, i) => {
            const t = pos(i)
            return (
              <a
                key={p.id}
                href={href(p)}
                className={'elv-frame' + (active === i ? ' on' : '')}
                style={{ left: `${t * 100}%`, top: `${(yOf(hAt(t)) / H) * 100}%` }}
                aria-label={`Open frame ${i + 1} of ${n}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onTouchStart={() => setActive(i)}
              >
                <img src={imageUrl(p.thumb)} alt={p.description || ''} loading="lazy" decoding="async" />
              </a>
            )
          })}
        {act && (
          <div
            className="elv-preview"
            style={pos(active) > 0.5 ? { left: 0 } : { right: 0 }}
          >
            <img src={imageUrl(act.thumb)} alt="" />
          </div>
        )}
      </div>
      <div className="elv-axis">
        <span>0 km</span>
        <span>{(hike.km / 2).toFixed(1)}</span>
        <span>{hike.km.toFixed(1)} km</span>
      </div>
      <div className="elv-foot">
        <span>schematic profile (no GPS track)</span>
        <span>
          frame positions estimated
          {hike.photos.length > n ? `, showing ${n} of ${hike.photos.length}` : ''}
        </span>
      </div>
    </article>
  )
}

export default function Elevation() {
  const hikes = useMemo(build, [])
  return (
    <section className="elv-page">
      <h2>Elevation contact sheet</h2>
      <p className="elv-intro">
        Each hike as a <strong>schematic profile</strong>: a smooth climb and descent that totals the real
        distance and elevation gain, not the actual track. Frames sit in filename order, spread evenly, so{' '}
        <strong>frame positions are estimated</strong>. Album-to-hike matches are unverified. Click a frame to
        open it.
      </p>
      <div className="elv-grid">
        {hikes.map((h) => (
          <Card key={h.key} hike={h} />
        ))}
      </div>
    </section>
  )
}
