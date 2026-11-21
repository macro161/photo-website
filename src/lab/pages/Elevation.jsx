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

const tracks = Object.fromEntries(
  Object.values(import.meta.glob('../tracks/*.json', { eager: true })).map((m) => {
    const t = m.default || m
    return [t.activity, t]
  }),
)

// Test-only stand-ins: activities without an album, shown with frames of another album.
const TEST_ALBUMS = {
  42: { album: 'swiss/pointe-de-bellevue', banner: 'TEST: photos are from Pointe de Bellevue, not from this hike' },
}

const yOf = (h) => H - PAD - h * (H - PAD * 2)

// Schematic: one smooth climb to the midpoint, then back down (peak = gain).
function schematic() {
  const hAt = (t) => Math.sin(Math.PI * t)
  const line = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS
    return [t, hAt(t)]
  })
  return { kind: 'schematic', line, hAt }
}

// Real GPS profile: x = km, y = metres above sea level.
function gps(track) {
  const pts = track.points
  const total = pts[pts.length - 1][3] || track.km
  const lo = Math.min(...pts.map((p) => p[2]))
  const hi = Math.max(...pts.map((p) => p[2]))
  const span = hi - lo || 1
  const step = Math.max(1, Math.floor(pts.length / 240))
  const line = []
  for (let i = 0; i < pts.length; i += step) line.push([pts[i][3] / total, (pts[i][2] - lo) / span])
  if ((pts.length - 1) % step) line.push([1, (pts[pts.length - 1][2] - lo) / span])
  const hAt = (t) => {
    const j = line.findIndex((q) => q[0] >= t)
    if (j < 0) return line[line.length - 1][1]
    if (j === 0) return line[0][1]
    const [x0, y0] = line[j - 1]
    const [x1, y1] = line[j]
    return x1 === x0 ? y1 : y0 + ((y1 - y0) * (t - x0)) / (x1 - x0)
  }
  const niceStep = [10, 20, 50, 100, 200, 250, 500].find((v) => span / v <= 4) || 500
  const ticks = []
  for (let e = Math.ceil(lo / niceStep) * niceStep; e < hi; e += niceStep) {
    const h = (e - lo) / span
    if (h > 0.1 && h < 0.9) ticks.push({ e, h })
  }
  ticks.push({ e: Math.round(lo), h: 0 }, { e: Math.round(hi), h: 1 })
  return { kind: 'gps', line, hAt, total, lo: Math.round(lo), hi: Math.round(hi), ticks }
}

const polyOf = (line) => line.map(([t, h]) => `${(t * 100).toFixed(2)},${yOf(h).toFixed(2)}`).join(' ')

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
      ns,
      title: acts.map((a) => a.title).join(' + '),
      date: acts.map((a) => a.date).sort().pop(),
      km: acts.reduce((s, a) => s + a.km, 0),
      gain: acts.reduce((s, a) => s + a.gain, 0),
      photos: list,
    })
  }
  const addedNs = new Set(hikes.flatMap((h) => h.ns))
  for (const [n, test] of Object.entries(TEST_ALBUMS)) {
    const act = byN[n]
    const list = byAlbum[test.album]
    if (!act || !list || addedNs.has(act.n)) continue
    const tr = tracks[n]
    hikes.push({
      key: `test-${n}`,
      ns: [act.n],
      title: act.title,
      date: act.date,
      km: tr ? tr.km : act.km,
      gain: tr ? tr.gain : act.gain,
      banner: test.banner,
      photos: list.slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    })
  }
  for (const h of hikes) {
    const tr = h.ns.length === 1 ? tracks[h.ns[0]] : null
    if (tr) {
      h.km = tr.km
      h.gain = tr.gain
    }
    h.prof = tr ? gps(tr) : schematic()
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

  const prof = hike.prof
  const isGps = prof.kind === 'gps'
  const hAt = prof.hAt
  const LINE = useMemo(() => polyOf(prof.line), [prof])
  const AREA = `0,${H - PAD} ${LINE} 100,${H - PAD}`
  const marks = useMemo(() => sample(hike.photos, MAX_MARKERS), [hike])
  const n = marks.length
  const pos = (i) => (n === 1 ? 0.5 : 0.04 + (0.92 * i) / (n - 1))
  const href = (p) => `#/c/${p.catalogSlug}/${p.albumSlug}/p/${p.id}`
  const act = active != null ? marks[active] : null

  return (
    <article className="elv-card" ref={ref}>
      <h3>{hike.title}</h3>
      {hike.banner && (
        <div className="elv-banner" role="note">
          {hike.banner}
        </div>
      )}
      <div className="elv-meta">
        <span>{hike.date}</span>
        <span>{hike.km.toFixed(1)} km</span>
        <span>+{hike.gain} m</span>
        <span>{hike.photos.length} frames</span>
      </div>
      <div className={'elv-chart' + (isGps ? ' gps' : '')}>
        <svg
          className="elv-svg"
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={
            isGps
              ? `GPS elevation profile, ${hike.km.toFixed(1)} km, ${prof.lo} to ${prof.hi} m`
              : `Schematic elevation profile, ${hike.km.toFixed(1)} km, ${hike.gain} m gain`
          }
        >
          {isGps &&
            prof.ticks.map((k) => (
              <line key={k.e} className="elv-grid-l" x1="0" x2="100" y1={yOf(k.h)} y2={yOf(k.h)} />
            ))}
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
        {isGps ? (
          prof.ticks.map((k) => (
            <span key={k.e} className="elv-tick" style={{ top: `${(yOf(k.h) / H) * 100}%` }}>
              {k.e} m
            </span>
          ))
        ) : (
          <span className="elv-ylab">+{hike.gain} m</span>
        )}
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
      <div className={'elv-axis' + (isGps ? ' gps' : '')}>
        <span>0 km</span>
        <span>{(hike.km / 2).toFixed(1)}</span>
        <span>{hike.km.toFixed(1)} km</span>
      </div>
      <div className="elv-foot">
        <span>{isGps ? 'GPS profile' : 'schematic profile (no GPS track)'}</span>
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
        Hikes with a GPS track show the <strong>real elevation profile</strong> (km vs metres above sea level).
        The others get a <strong>schematic profile</strong>: a smooth climb and descent matching the distance and
        gain, not the actual track. Frames sit in filename order, spread evenly, so{' '}
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
