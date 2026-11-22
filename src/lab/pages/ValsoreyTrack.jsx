/**
 * Cabane de Valsorey with its GPS tracks (ascent 1 Aug 2026, descent 2 Aug 2026).
 * Photos mode: the album's gallery, photos first, with the terrain and the route as a calm greyscale backdrop (a flat hairline route until the 3D scene is ready, or where it can't run).
 * Route mode: the same scene comes forward as a map (2D or tilted 3D) with labels, stats, an elevation profile you can scrub, and the photos as a strip.
 * Track data comes from scripts/gpx-detail.mjs (src/lab/valsorey/detail.json); the relief from scripts/bake-terrain.mjs.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import detail from '../valsorey/detail.json'
import activities from '../activities.json'
import { projectTracks, toPath, valueAt, xyAt, gradeAt, clock, duration } from '../valsorey/geo.js'
import Gallery, { GallerySkeleton } from '../../components/Gallery.jsx'
import Lightbox from '../../components/Lightbox.jsx'
import Picture from '../../components/Picture.jsx'
import '../valsorey/valsorey.css'

const Scene = lazy(() => import('../valsorey/Scene.jsx'))

const TRACKS = detail.tracks // [ascent, descent]
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

/* ---------- Background: the route, barely there, filling in as you scroll ---------- */
function Background({ off }) {
  const doneRefs = useRef([])
  const dot = useRef(null)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const room = document.documentElement.scrollHeight - window.innerHeight
      const p = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0
      const [ti, km] = journey(p * TOTAL_KM)
      doneRefs.current.forEach((el, i) => {
        if (!el) return
        const frac = i < ti ? 1 : i > ti ? 0 : km / TRACKS[i].stats.km
        el.setAttribute('stroke-dasharray', `${(frac * 1000).toFixed(1)} 1000`)
      })
      const [x, y] = xyAt(bgGeo.paths[ti], TRACKS[ti].points, km)
      dot.current?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
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
  }, [])

  return (
    <div className={`vt-bg${off ? ' is-off' : ''}`} aria-hidden="true">
      <svg className="vt-bg-route" viewBox={`0 0 ${BG.W} ${BG.H}`} preserveAspectRatio="xMidYMid meet">
        {bgPaths.map((d, i) => (
          <g key={i} className={i === 0 ? 'is-ascent' : 'is-descent'}>
            <path d={d} className="vt-bg-base" vectorEffect="non-scaling-stroke" />
            <path d={d} pathLength="1000" className="vt-bg-done" strokeDasharray="0 1000" ref={(el) => (doneRefs.current[i] = el)} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <circle ref={dot} r="4" className="vt-bg-dot" />
      </svg>
    </div>
  )
}

/* ---------- Route mode: map, stats, profile ---------- */
const MAP = { W: 800, H: 600 }
const mapGeo = projectTracks(TRACKS, MAP.W, MAP.H, 50)
const mapPaths = mapGeo.paths.map(toPath)

const PROF = { W: 800, H: 240, l: 46, r: 14, t: 12, b: 28 }
const cls = (i) => (i === 0 ? 'is-ascent' : 'is-descent')

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
        return (
          <g key={i} className={cls(i)}>
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
            return <circle key={i} cx={X(km)} cy={Y(valueAt(TRACKS[i].points, km, 2))} r="4.5" className="vt-scrub-dot" />
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

function LineSample({ index }) {
  return (
    <svg className="vt-sample" viewBox="0 0 28 6" aria-hidden="true">
      <line x1="1" x2="27" y1="3" y2="3" className={cls(index)} />
    </svg>
  )
}

function StatsCard({ index }) {
  const t = TRACKS[index]
  const s = t.stats
  const rec = MINUTES[t.id]
  const dateLabel = DATE_FMT.format(new Date(t.start))
  return (
    <section className="vt-card">
      <h3><span className="vt-card-name"><LineSample index={index} />{t.label}</span><span>{dateLabel}</span></h3>
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
          <p key={i}>
            <b><LineSample index={i} />{t.label}</b> {km.toFixed(2)} km · {Math.round(valueAt(t.points, km, 2)).toLocaleString('en-US')} m · {gradeAt(t.points, km).toFixed(0)}% · {clock(t.start, valueAt(t.points, km, 4))}
          </p>
        )
      })}
    </div>
  )
}

/** The flat vector map: shown while the terrain loads or when WebGL / the elevation file is unavailable. */
function FlatMap({ shown, scrub }) {
  const scale = mapGeo.kmPx
  return (
    <svg className="vt-map" viewBox={`0 0 ${MAP.W} ${MAP.H}`} role="img" aria-label="Route map, north up">
      {mapPaths.map((d, i) => (
        <path key={i} d={d} className={`vt-map-line ${cls(i)}${shown.includes(i) ? ' is-on' : ''}`} />
      ))}
      {shown.map((i) => {
        if (shown.length > 1 && i === 1) return null
        const p = mapGeo.paths[i]
        const a = p[0], b = p[p.length - 1]
        return (
          <g key={i}>
            <circle cx={a[0]} cy={a[1]} r="6" className="vt-end" />
            <text x={a[0] + 11} y={a[1] + 4} className="vt-label">{i === 0 ? 'Start' : 'Top'}</text>
            <circle cx={b[0]} cy={b[1]} r="6" className="vt-end is-fill" />
            <text x={b[0] + 11} y={b[1] + 4} className="vt-label">{i === 0 ? 'Top' : 'Bottom'}</text>
          </g>
        )
      })}
      {scrub != null && shown.map((i) => {
        const km = Math.min(scrub, TRACKS[i].stats.km)
        const [x, y] = xyAt(mapGeo.paths[i], TRACKS[i].points, km)
        return <circle key={i} cx={x} cy={y} r="8" className="vt-scrub-dot" />
      })}
      <g transform={`translate(${MAP.W - 40 - scale} ${MAP.H - 28})`} className="vt-scale">
        <line x1="0" x2={scale} y1="0" y2="0" />
        <line x1="0" x2="0" y1="-5" y2="5" />
        <line x1={scale} x2={scale} y1="-5" y2="5" />
        <text x={scale / 2} y="-9" textAnchor="middle">1 km</text>
      </g>
      <text x="24" y="34" className="vt-label">N ↑</text>
    </svg>
  )
}

function RouteView({ photos, onOpen, ctl, setMapSlot, sceneFailed }) {
  const { which, setWhich, scrub, view, setView, playing, setPlaying, onProfile, terrain } = ctl
  const shown = useMemo(() => (which === 'both' ? [0, 1] : [which === 'ascent' ? 0 : 1]), [which])

  return (
    <div className="vt-route">
      <div className="vt-toolbar">
        <div className="vt-tabs" role="group" aria-label="Which track">
          {[['ascent', 'Ascent · 1 Aug'], ['descent', 'Descent · 2 Aug'], ['both', 'Both']].map(([k, label]) => (
            <button key={k} className={which === k ? 'is-on' : ''} aria-pressed={which === k} onClick={() => { setWhich(k); setPlaying(false) }}>{label}</button>
          ))}
        </div>
        <div className="vt-tools">
          {!sceneFailed && (
            <div className="vt-tabs" role="group" aria-label="Map view">
              {[['2d', '2D'], ['3d', '3D']].map(([k, label]) => (
                <button key={k} className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
              ))}
            </div>
          )}
          {!sceneFailed && <button className="vt-btn" onClick={() => terrain.current?.reset()} aria-label="Reset the view">Reset view</button>}
          <button className="vt-btn" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>{playing ? 'Pause' : 'Fly along'}</button>
        </div>
      </div>

      <div className="vt-grid-main">
        <div className="vt-map-wrap">
          {sceneFailed ? (
            <FlatMap shown={shown} scrub={scrub} />
          ) : (
            <div className="vt-3d vt-3d-slot" ref={setMapSlot}>
              <div className="vt-3d-loading">Loading terrain…</div>
            </div>
          )}
          <p className="vt-attrib">
            Relief: AWS Terrain Tiles (SRTM, EU-DEM, national sources) · names © OpenStreetMap contributors · contours every 25 m, bold every 250 m
          </p>
        </div>
        <div className="vt-side">
          {shown.map((i) => <StatsCard key={i} index={i} />)}
        </div>
      </div>

      <Profile shown={shown} scrub={scrub} setScrub={onProfile} />
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
        Routes are the AllTrails recordings (ascent 1 Aug, descent 2 Aug 2026), draped on the terrain model; the ascent is the black line and the descent the grey one.
        Climb and descent are summed with a 10 m filter, so they differ slightly from AllTrails' own totals.
        Photos are not placed on the route: the scans carry no capture time.
      </p>
    </div>
  )
}

/** Weak or battery-conscious devices keep the flat hairline backdrop (the 3D map is still there in Route mode). */
const lowPower = () => {
  const n = navigator
  return (n.hardwareConcurrency || 8) <= 2 || (n.deviceMemory || 8) <= 2 || !!n.connection?.saveData
}

/* ---------- Page ---------- */
export default function ValsoreyTrack() {
  const [mode, setMode] = useState('photos')
  const { photos, failed } = useAlbum()
  const [active, setActive] = useState(null)
  const items = useMemo(() => (photos || []).map((photo, index) => ({ photo, index })), [photos])
  const total = items.length

  // Route-mode state lives up here because the 3D scene outlives the mode switch.
  const [which, setWhich] = useState('both')
  const [scrub, setScrub] = useState(null)
  const [view, setView] = useState('3d')
  const [playing, setPlaying] = useState(false)
  const terrain = useRef(null)
  const shown = useMemo(() => (which === 'both' ? [0, 1] : [which === 'ascent' ? 0 : 1]), [which])
  const maxKm = Math.max(...shown.map((i) => TRACKS[i].stats.km))
  const onProfile = useCallback((v) => { setPlaying(false); setScrub(v) }, [])

  // "Fly along": advance the marker; the terrain follows it. Any touch of the map or profile stops it.
  const scrubRef = useRef(null)
  scrubRef.current = scrub
  useEffect(() => {
    if (!playing) return undefined
    let raf = 0, last = performance.now()
    let km = scrubRef.current != null && scrubRef.current < maxKm - 0.05 ? scrubRef.current : 0
    const step = (now) => {
      km += ((now - last) / 1000) * (maxKm / 30)
      last = now
      if (km >= maxKm) { setScrub(maxKm); setPlaying(false); return }
      setScrub(km)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, maxKm])
  const stopFly = useCallback(() => setPlaying(false), [])

  // The 3D scene: loaded only after the photos are on screen (idle time), or at once if Route is opened first.
  const [want, setWant] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [bgSlot, setBgSlot] = useState(null)
  const [mapSlot, setMapSlot] = useState(null)
  const bg3d = useMemo(() => !lowPower(), [])
  useEffect(() => { if (mode === 'route') setWant(true) }, [mode])
  useEffect(() => {
    if (!photos || want || !bg3d) return undefined
    let id = 0, t = 0
    const start = () => {
      cleanupInput()
      if (window.requestIdleCallback) id = window.requestIdleCallback(() => setWant(true), { timeout: 3000 })
      else setWant(true)
    }
    // The backdrop is decoration: it starts once the page has loaded and gone quiet (2.5 s), or at the first scroll or touch, whichever is first.
    const events = ['scroll', 'pointerdown', 'keydown']
    const cleanupInput = () => events.forEach((e) => window.removeEventListener(e, start))
    const go = () => {
      t = setTimeout(start, 2500)
      events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }))
    }
    if (document.readyState === 'complete') go()
    else window.addEventListener('load', go, { once: true })
    return () => {
      window.removeEventListener('load', go)
      cleanupInput()
      if (id) window.cancelIdleCallback?.(id)
      clearTimeout(t)
    }
  }, [photos, want, bg3d])
  const onFail = useCallback(() => setSceneFailed(true), [])
  const onReady = useCallback(() => setSceneReady(true), [])

  const open = useCallback((i) => setActive(i), [])
  const close = useCallback(() => setActive(null), [])
  const next = useCallback(() => setActive((i) => (i == null ? i : (i + 1) % total)), [total])
  const prev = useCallback(() => setActive((i) => (i == null ? i : (i - 1 + total) % total)), [total])

  useLayoutEffect(() => { window.scrollTo(0, 0) }, [mode])

  const backdrop3d = bg3d && sceneReady && !sceneFailed
  return (
    <div className={`vt vt-${mode}`}>
      {mode === 'photos' && <Background off={backdrop3d} />}
      <div className="vt-bgslot" ref={setBgSlot} aria-hidden="true" />
      {want && !sceneFailed && (
        <Suspense fallback={null}>
          <Scene
            ref={terrain}
            tracks={TRACKS}
            mode={mode}
            bgSlot={bg3d ? bgSlot : null}
            mapSlot={mapSlot}
            shown={shown}
            view={view}
            scrub={scrub}
            fly={playing}
            onUserMove={stopFly}
            onFail={onFail}
            onReady={onReady}
          />
        </Suspense>
      )}
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
        </header>
        {mode === 'photos' ? (
          failed ? (
            <p className="notice">Couldn't load the photos.</p>
          ) : photos ? (
            <Gallery items={items} onOpen={open} gutterScale={1.7} />
          ) : (
            <GallerySkeleton count={18} gutterScale={1.7} />
          )
        ) : (
          <RouteView
            photos={photos}
            onOpen={open}
            ctl={{ which, setWhich, scrub, view, setView, playing, setPlaying, onProfile, terrain }}
            setMapSlot={setMapSlot}
            sceneFailed={sceneFailed}
          />
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
