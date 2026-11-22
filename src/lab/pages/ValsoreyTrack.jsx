/**
 * Cabane de Valsorey with its GPS tracks (ascent 1 Aug 2026, descent 2 Aug 2026).
 * Photos mode: the album's gallery over a faint, scroll-linked drawing of the route.
 * Route mode: the route in front, with stats, an elevation profile you can scrub, and the photos as a strip.
 * Track data comes from scripts/gpx-detail.mjs (src/lab/valsorey/detail.json).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import detail from '../valsorey/detail.json'
import activities from '../activities.json'
import { projectTracks, toPath, valueAt, xyAt, gradeAt, clock, duration } from '../valsorey/geo.js'
import Gallery, { GallerySkeleton } from '../../components/Gallery.jsx'
import Lightbox from '../../components/Lightbox.jsx'
import Picture from '../../components/Picture.jsx'
import '../valsorey/valsorey.css'

const TRACKS = detail.tracks // [ascent, descent]
const COLORS = { ascent: '#c2410c', descent: '#2563a8' }
const MINUTES = { ascent: activities.find((a) => a.n === 14)?.minutes, descent: activities.find((a) => a.n === 13)?.minutes }
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'long', year: 'numeric' })
const TOTAL_KM = TRACKS.reduce((s, t) => s + t.stats.km, 0)

const BG = { W: 1000, H: 700 }
const bgGeo = projectTracks(TRACKS, BG.W, BG.H, 70)
const bgPaths = bgGeo.paths.map(toPath)

/** The two tracks laid end to end, as one journey: distance along it -> which track and km on it. */
const journey = (u) => (u < TRACKS[0].stats.km ? [0, u] : [1, Math.min(u - TRACKS[0].stats.km, TRACKS[1].stats.km)])

function useAlbum() {
  const [photos, setPhotos] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    import('../../generated/catalogs/swiss.json').then(
      (m) => live && setPhotos((m.default || m).filter((p) => p.albumSlug === 'cabane-de-valsorey')),
      () => live && setFailed(true),
    )
    return () => { live = false }
  }, [])
  return { photos, failed }
}

/* ---------- Background: the route, drawn faintly and filled in as you scroll ---------- */
function Background() {
  const doneRefs = useRef([])
  const dot = useRef(null)
  const ridge = useRef(null)
  const ridgeDot = useRef(null)

  const ridgeGeo = useMemo(() => {
    const lo = Math.min(...TRACKS.map((t) => t.stats.minEle)), hi = Math.max(...TRACKS.map((t) => t.stats.maxEle))
    const pts = []
    TRACKS.forEach((t, ti) => {
      const off = ti === 0 ? 0 : TRACKS[0].stats.km
      t.points.forEach((p) => pts.push([((off + p[3]) / TOTAL_KM) * 1000, 100 - ((p[2] - lo) / (hi - lo)) * 90]))
    })
    return { line: toPath(pts), area: `${toPath(pts)}L1000 100L0 100Z`, lo, hi }
  }, [])

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const room = document.documentElement.scrollHeight - window.innerHeight
      const p = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0
      const u = p * TOTAL_KM
      const [ti, km] = journey(u)
      doneRefs.current.forEach((el, i) => {
        if (!el) return
        const frac = i < ti ? 1 : i > ti ? 0 : km / TRACKS[i].stats.km
        el.setAttribute('stroke-dasharray', `${(frac * 1000).toFixed(1)} 1000`)
      })
      const [x, y] = xyAt(bgGeo.paths[ti], TRACKS[ti].points, km)
      dot.current?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      dot.current?.setAttribute('fill', ti === 0 ? COLORS.ascent : COLORS.descent)
      const rx = p * 1000
      const re = valueAt(TRACKS[ti].points, km, 2)
      ridgeDot.current?.setAttribute('transform', `translate(${rx.toFixed(1)} ${(100 - ((re - ridgeGeo.lo) / (ridgeGeo.hi - ridgeGeo.lo)) * 90).toFixed(1)})`)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ridgeGeo])

  return (
    <div className="vt-bg" aria-hidden="true">
      <svg className="vt-bg-route" viewBox={`0 0 ${BG.W} ${BG.H}`} preserveAspectRatio="xMidYMid meet">
        {bgPaths.map((d, i) => (
          <g key={i} style={{ '--c': i === 0 ? COLORS.ascent : COLORS.descent }}>
            <path d={d} pathLength="1000" className="vt-bg-base" />
            <path d={d} pathLength="1000" className="vt-bg-done" strokeDasharray="0 1000" ref={(el) => (doneRefs.current[i] = el)} />
          </g>
        ))}
        <circle ref={dot} r="9" className="vt-bg-dot" />
      </svg>
      <svg className="vt-bg-ridge" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <path d={ridgeGeo.area} className="vt-ridge-area" />
        <path d={ridgeGeo.line} className="vt-ridge-line" vectorEffect="non-scaling-stroke" />
        <circle ref={ridgeDot} r="1" className="vt-ridge-dot" />
        <g ref={ridge} />
      </svg>
    </div>
  )
}

/* ---------- Foreground: route, stats, profile ---------- */
const MAP = { W: 800, H: 600 }
const mapGeo = projectTracks(TRACKS, MAP.W, MAP.H, 50)
const mapPaths = mapGeo.paths.map(toPath)

const PROF = { W: 800, H: 240, l: 46, r: 14, t: 12, b: 28 }

function Profile({ shown, scrub, setScrub }) {
  const lo = Math.floor(Math.min(...shown.map((i) => TRACKS[i].stats.minEle)) / 100) * 100
  const hi = Math.ceil(Math.max(...shown.map((i) => TRACKS[i].stats.maxEle)) / 100) * 100
  const maxKm = Math.max(...shown.map((i) => TRACKS[i].stats.km))
  const iw = PROF.W - PROF.l - PROF.r, ih = PROF.H - PROF.t - PROF.b
  const X = (km) => PROF.l + (km / maxKm) * iw
  const Y = (e) => PROF.t + (1 - (e - lo) / (hi - lo)) * ih
  const svg = useRef(null)

  const move = (e) => {
    const r = svg.current.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * PROF.W
    setScrub(Math.min(maxKm, Math.max(0, ((px - PROF.l) / iw) * maxKm)))
  }
  const eleTicks = []
  for (let e = Math.ceil(lo / 500) * 500; e <= hi; e += 500) eleTicks.push(e)
  const kmTicks = []
  for (let k = 0; k <= maxKm; k += 1) kmTicks.push(k)

  return (
    <svg
      ref={svg}
      className="vt-profile"
      viewBox={`0 0 ${PROF.W} ${PROF.H}`}
      role="img"
      aria-label="Elevation profile. Move along it to follow the route."
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={() => setScrub(null)}
    >
      {eleTicks.map((e) => (
        <g key={e}>
          <line x1={PROF.l} x2={PROF.W - PROF.r} y1={Y(e)} y2={Y(e)} className="vt-grid" />
          <text x={PROF.l - 6} y={Y(e) + 4} className="vt-tick" textAnchor="end">{e}</text>
        </g>
      ))}
      {kmTicks.map((k) => (
        <text key={k} x={X(k)} y={PROF.H - 8} className="vt-tick" textAnchor="middle">{k} km</text>
      ))}
      {shown.map((i) => {
        const pts = TRACKS[i].points.map((p) => [X(p[3]), Y(p[2])])
        const line = toPath(pts)
        const c = i === 0 ? COLORS.ascent : COLORS.descent
        return (
          <g key={i} style={{ '--c': c }}>
            <path d={`${line}L${X(TRACKS[i].stats.km)} ${Y(lo)}L${X(0)} ${Y(lo)}Z`} className="vt-prof-area" />
            <path d={line} className="vt-prof-line" />
          </g>
        )
      })}
      {scrub != null && (
        <g>
          <line x1={X(scrub)} x2={X(scrub)} y1={PROF.t} y2={PROF.H - PROF.b} className="vt-scrub" />
          {shown.map((i) => {
            const km = Math.min(scrub, TRACKS[i].stats.km)
            return <circle key={i} cx={X(km)} cy={Y(valueAt(TRACKS[i].points, km, 2))} r="5" fill={i === 0 ? COLORS.ascent : COLORS.descent} className="vt-scrub-dot" />
          })}
        </g>
      )}
    </svg>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="vt-stat">
      <dt>{label}</dt>
      <dd>{value}{sub && <small>{sub}</small>}</dd>
    </div>
  )
}

function StatsCard({ index }) {
  const t = TRACKS[index]
  const s = t.stats
  const rec = MINUTES[t.id]
  const dateLabel = DATE_FMT.format(new Date(t.start))
  return (
    <section className="vt-card" style={{ '--c': index === 0 ? COLORS.ascent : COLORS.descent }}>
      <h3>{t.label}<span>{dateLabel}</span></h3>
      <dl>
        <Stat label="Distance" value={`${s.km.toFixed(1)} km`} />
        <Stat label="Climbed" value={`+${s.gain.toLocaleString('en-US')} m`} />
        <Stat label="Descended" value={`−${s.loss.toLocaleString('en-US')} m`} />
        <Stat label="Highest" value={`${s.maxEle.toLocaleString('en-US')} m`} />
        <Stat label="Lowest" value={`${s.minEle.toLocaleString('en-US')} m`} />
        <Stat label="Started" value={clock(t.start)} sub={` → ${clock(t.end)}`} />
        <Stat label="Start to finish" value={duration(s.elapsedSec)} />
        {rec && <Stat label="Recorded time" value={duration(rec * 60)} sub=" by AllTrails" />}
        {rec && <Stat label="Average speed" value={`${(s.km / (rec / 60)).toFixed(1)} km/h`} sub={` · ${Math.round(rec / s.km)} min/km`} />}
        <Stat label="Net height" value={`${s.endEle - s.startEle > 0 ? '+' : '−'}${Math.abs(s.endEle - s.startEle).toLocaleString('en-US')} m`} sub={` ${s.startEle} → ${s.endEle} m`} />
      </dl>
    </section>
  )
}

function Readout({ scrub, shown }) {
  if (scrub == null) return <p className="vt-hint">Move across the profile to follow the route.</p>
  return (
    <div className="vt-readout" aria-live="off">
      {shown.map((i) => {
        const t = TRACKS[i]
        const km = Math.min(scrub, t.stats.km)
        return (
          <p key={i} style={{ '--c': i === 0 ? COLORS.ascent : COLORS.descent }}>
            <b>{t.label}</b> {km.toFixed(2)} km · {Math.round(valueAt(t.points, km, 2)).toLocaleString('en-US')} m · {gradeAt(t.points, km).toFixed(0)}% · {clock(t.start, valueAt(t.points, km, 4))}
          </p>
        )
      })}
    </div>
  )
}

function RouteView({ photos, onOpen }) {
  const [which, setWhich] = useState('both')
  const [scrub, setScrub] = useState(null)
  const shown = which === 'both' ? [0, 1] : [which === 'ascent' ? 0 : 1]
  const scale = mapGeo.kmPx

  return (
    <div className="vt-route">
      <div className="vt-tabs" role="group" aria-label="Which track">
        {[['ascent', 'Ascent · 1 Aug'], ['descent', 'Descent · 2 Aug'], ['both', 'Both']].map(([k, label]) => (
          <button key={k} className={which === k ? 'is-on' : ''} aria-pressed={which === k} onClick={() => setWhich(k)}>{label}</button>
        ))}
      </div>
      <div className="vt-grid-main">
        <div className="vt-map-wrap">
          <svg className="vt-map" viewBox={`0 0 ${MAP.W} ${MAP.H}`} role="img" aria-label="Route map, north up">
            {mapPaths.map((d, i) => {
              const on = shown.includes(i)
              return <path key={i} d={d} className={`vt-map-line${on ? ' is-on' : ''}`} style={{ '--c': i === 0 ? COLORS.ascent : COLORS.descent }} />
            })}
            {shown.map((i) => {
              // Both tracks share their ends, so "Both" labels the ascent's ends only.
              if (which === 'both' && i === 1) return null
              const p = mapGeo.paths[i]
              const a = p[0], b = p[p.length - 1]
              const c = i === 0 ? COLORS.ascent : COLORS.descent
              return (
                <g key={i}>
                  <circle cx={a[0]} cy={a[1]} r="7" className="vt-end" />
                  <text x={a[0] + 11} y={a[1] + 4} className="vt-label">{i === 0 ? 'Start' : 'Top'}</text>
                  <circle cx={b[0]} cy={b[1]} r="7" className="vt-end is-fill" style={{ '--c': c }} />
                  <text x={b[0] + 11} y={b[1] + 4} className="vt-label">{i === 0 ? 'Top' : 'Bottom'}</text>
                </g>
              )
            })}
            {scrub != null && shown.map((i) => {
              const km = Math.min(scrub, TRACKS[i].stats.km)
              const [x, y] = xyAt(mapGeo.paths[i], TRACKS[i].points, km)
              return <circle key={i} cx={x} cy={y} r="9" className="vt-scrub-dot" fill={i === 0 ? COLORS.ascent : COLORS.descent} />
            })}
            <g transform={`translate(${MAP.W - 40 - scale} ${MAP.H - 28})`} className="vt-scale">
              <line x1="0" x2={scale} y1="0" y2="0" />
              <line x1="0" x2="0" y1="-5" y2="5" />
              <line x1={scale} x2={scale} y1="-5" y2="5" />
              <text x={scale / 2} y="-9" textAnchor="middle">1 km</text>
            </g>
            <text x="24" y="34" className="vt-label">N ↑</text>
          </svg>
        </div>
        <div className="vt-side">
          {shown.map((i) => <StatsCard key={i} index={i} />)}
        </div>
      </div>
      <Profile shown={shown} scrub={scrub} setScrub={setScrub} />
      <Readout scrub={scrub} shown={shown} />
      {photos && photos.length > 0 && (
        <div className="vt-strip" aria-label="Photos from this hike">
          {photos.map((p, i) => (
            <button key={p.id} className="vt-strip-item" onClick={() => onOpen(i)} aria-label={`Open photo ${i + 1}`} style={p.c ? { backgroundColor: p.c } : undefined}>
              <Picture photo={p} sizes="140px" alt={p.description || p.file} loading="lazy" decoding="async" width={p.width} height={p.height} className="loaded" />
            </button>
          ))}
        </div>
      )}
      <p className="vt-note">
        Routes are the AllTrails recordings (ascent 1 Aug, descent 2 Aug 2026). Climb and descent are summed with a 10 m filter, so they differ slightly from AllTrails' own totals.
        Photos are not placed on the route: the scans carry no capture time.
      </p>
    </div>
  )
}

/* ---------- Page ---------- */
export default function ValsoreyTrack() {
  const [mode, setMode] = useState('photos')
  const { photos, failed } = useAlbum()
  const [active, setActive] = useState(null)
  const items = useMemo(() => (photos || []).map((photo, index) => ({ photo, index })), [photos])
  const total = items.length

  const open = useCallback((i) => setActive(i), [])
  const close = useCallback(() => setActive(null), [])
  const next = useCallback(() => setActive((i) => (i == null ? i : (i + 1) % total)), [total])
  const prev = useCallback(() => setActive((i) => (i == null ? i : (i - 1 + total) % total)), [total])

  useLayoutEffect(() => { window.scrollTo(0, 0) }, [mode])

  return (
    <div className={`vt vt-${mode}`}>
      {mode === 'photos' && <Background />}
      <div className="vt-content">
        <a className="back-link" href="#/lab">← Lab</a>
        <header className="vt-head">
          <h2>Cabane de Valsorey</h2>
          <p className="vt-sub">
            1–2 August 2026 · Bourg-Saint-Pierre to the Valsorey hut and back · {TRACKS[0].stats.km.toFixed(1)} km up, {TRACKS[1].stats.km.toFixed(1)} km down
          </p>
          <div className="vt-modes" role="group" aria-label="View">
            <button className={mode === 'photos' ? 'is-on' : ''} aria-pressed={mode === 'photos'} onClick={() => setMode('photos')}>Photos</button>
            <button className={mode === 'route' ? 'is-on' : ''} aria-pressed={mode === 'route'} onClick={() => setMode('route')}>Route</button>
          </div>
          {mode === 'photos' && (
            <p className="vt-legend">
              <span style={{ '--c': COLORS.ascent }}>Ascent</span>
              <span style={{ '--c': COLORS.descent }}>Descent</span>
              The route fills in as you scroll.
            </p>
          )}
        </header>
        {mode === 'photos' ? (
          failed ? (
            <p className="notice">Couldn't load the photos.</p>
          ) : photos ? (
            <Gallery items={items} onOpen={open} />
          ) : (
            <GallerySkeleton count={18} />
          )
        ) : (
          <RouteView photos={photos} onOpen={open} />
        )}
      </div>
      {active != null && total > 0 && (
        <Lightbox
          photo={photos[active]}
          prevPhoto={photos[(active - 1 + total) % total]}
          nextPhoto={photos[(active + 1) % total]}
          onClose={close}
          onNext={next}
          onPrev={prev}
          hasMultiple={total > 1}
        />
      )}
    </div>
  )
}
