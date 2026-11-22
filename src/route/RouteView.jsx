/**
 * Route mode of a hike album: the map (2D or tilted 3D, drawn by the shared terrain scene), stats, an elevation profile you can scrub, and the photos as a strip.
 */
import { useContext, useMemo, useRef } from 'react'
import { valueAt, xyAt, gradeAt, clock, duration, toPath } from './geo.js'
import Picture from '../components/Picture.jsx'
import { MAP, RouteCtx } from './model.jsx'

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'long', year: 'numeric' })
const SHORT_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short' })
export const showing = (which, n) => (which === 'both' ? Array.from({ length: n }, (_, i) => i) : [Number(which)])

/* ---------- Route mode: map, stats, profile ---------- */
const PROF = { W: 800, H: 240, l: 46, r: 14, t: 12, b: 28 }
const cls = (i) => (i === 0 ? 'is-ascent' : 'is-descent')

function Profile({ shown, scrub, setScrub }) {
  const { TRACKS } = useContext(RouteCtx)
  const rawLo = Math.min(...shown.map((i) => TRACKS[i].stats.minEle)), rawHi = Math.max(...shown.map((i) => TRACKS[i].stats.maxEle))
  const eStep = rawHi - rawLo < 250 ? 50 : rawHi - rawLo < 700 ? 100 : rawHi - rawLo < 1500 ? 250 : 500
  const lo = Math.floor(rawLo / eStep) * eStep
  const hi = Math.max(Math.ceil(rawHi / eStep) * eStep, lo + eStep)
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
  for (let e = lo; e <= hi; e += eStep) eleTicks.push(e)
  const kmTicks = []
  const kStep = maxKm > 24 ? 5 : maxKm > 12 ? 2 : 1
  for (let k = 0; k <= maxKm; k += kStep) kmTicks.push(k)

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
  const { TRACKS } = useContext(RouteCtx)
  const t = TRACKS[index]
  const s = t.stats
  const rec = t.minutes
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
  const { TRACKS } = useContext(RouteCtx)
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
  const { TRACKS, mapGeo, mapPaths } = useContext(RouteCtx)
  const scale = mapGeo.kmPx
  return (
    <svg className="vt-map" viewBox={`0 0 ${MAP.W} ${MAP.H}`} role="img" aria-label="Route map, north up">
      {mapPaths.map((d, i) => (
        <path key={i} d={d} className={`vt-map-line ${cls(i)}${shown.includes(i) ? ' is-on' : ''}`} />
      ))}
      {shown.map((i) => {
        if (shown.length > 1 && i > 0) return null
        const p = mapGeo.paths[i]
        const a = p[0], b = p[p.length - 1]
        return (
          <g key={i}>
            <circle cx={a[0]} cy={a[1]} r="6" className="vt-end" />
            <text x={a[0] + 11} y={a[1] + 4} className="vt-label">Start</text>
            <circle cx={b[0]} cy={b[1]} r="6" className="vt-end is-fill" />
            <text x={b[0] + 11} y={b[1] + 4} className="vt-label">Finish</text>
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

export default function RouteView({ photos, onOpen, ctl, setMapSlot, sceneFailed }) {
  const { TRACKS } = useContext(RouteCtx)
  const { which, setWhich, scrub, view, setView, playing, setPlaying, onProfile, terrain } = ctl
  const shown = useMemo(() => showing(which, TRACKS.length), [which, TRACKS.length])
  const tabs = TRACKS.length > 1 ? [...TRACKS.map((t, i) => [String(i), `${t.label} · ${SHORT_FMT.format(new Date(t.start))}`]), ['both', 'Both']] : []

  return (
    <div className="vt-route">
      <div className="vt-toolbar">
        {tabs.length > 0 ? (
          <div className="vt-tabs" role="group" aria-label="Which track">
            {tabs.map(([k, label]) => (
              <button key={k} className={which === k ? 'is-on' : ''} aria-pressed={which === k} onClick={() => { setWhich(k); setPlaying(false) }}>{label}</button>
            ))}
          </div>
        ) : <span />}
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
            Relief: swissALTI3D © swisstopo, outside Switzerland AWS Terrain Tiles (SRTM, EU-DEM, national sources) · names and buildings © OpenStreetMap contributors (ODbL) · contours every 25 m, bold every 250 m
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
        {TRACKS.length > 1 ? 'Routes are the AllTrails recordings' : 'The route is the AllTrails recording'} ({TRACKS.map((t) => `${t.label.toLowerCase()} ${SHORT_FMT.format(new Date(t.start))}`).join(', ')}), draped on the terrain model{TRACKS.length > 1 ? '; the first is the black line and the second the grey one' : ''}.
        Climb and descent are summed with a 10 m filter, so they differ slightly from AllTrails' own totals.
        Photos are not placed on the route: the scans carry no capture time.
      </p>
    </div>
  )
}

