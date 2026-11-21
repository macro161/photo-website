/**
 * Trail walkthrough. Hikes with a real GPS track (src/lab/tracks) draw the real
 * route and elevation; others use a SCHEMATIC path generated deterministically
 * from the album key (only distance and gain totals are real). Frame positions are estimated by
 * spreading photos evenly along the route.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import manifest from '../../generated/manifest.json'
import activities from '../activities.json'
import hikeAlbums from '../hikeAlbums.json'
import { imageUrl } from '../../imageUrl.js'
import { TRACKS, prepareTrack, stateAt } from '../walkthrough/track.js'
import '../walkthrough/walkthrough.css'

const W = 400
const H = 560

function rng(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Schematic route: smoothly wandering heading, scaled to fit the box.
function buildRoute(key, km) {
  const r = rng(key)
  let x = 0, y = 0, ang = r() * Math.PI * 2, turn = 0
  const pts = [[0, 0]]
  const wiggle = 0.15 + Math.min(km, 20) / 60
  for (let i = 0; i < 90; i++) {
    turn = turn * 0.85 + (r() - 0.5) * wiggle
    ang += turn
    x += Math.cos(ang)
    y += Math.sin(ang)
    pts.push([x, y])
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY
  const s = Math.min((W - 80) / (w || 1), (H - 80) / (h || 1))
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2
  return 'M' + pts.map(([px, py]) => `${(ox + (px - minX) * s).toFixed(1)} ${(oy + (py - minY) * s).toFixed(1)}`).join('L')
}

// Schematic elevation: noisy climb whose total ascent equals `gain`.
function buildProfile(key, gain) {
  const r = rng(key + ':e')
  const steps = []
  for (let i = 0; i < 60; i++) steps.push((r() < 0.72 ? 1 : -0.6) * (0.4 + r()))
  const up = steps.filter((s) => s > 0).reduce((a, b) => a + b, 0) || 1
  const k = gain / up
  const asc = [0], elev = [0]
  steps.forEach((s) => {
    asc.push(asc[asc.length - 1] + Math.max(s, 0) * k)
    elev.push(elev[elev.length - 1] + s * k)
  })
  return { asc, elev }
}

const at = (arr, t) => {
  const f = Math.min(Math.max(t, 0), 1) * (arr.length - 1)
  const i = Math.floor(f)
  return arr[i] + (arr[Math.min(i + 1, arr.length - 1)] - arr[i]) * (f - i)
}

const line = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')

const HIKES = Object.entries(hikeAlbums)
  .map(([key, ns]) => {
    const [catalogSlug, albumSlug] = key.split('/')
    const photos = manifest
      .filter((p) => p.catalogSlug === catalogSlug && p.albumSlug === albumSlug)
      .sort((a, b) => a.file.localeCompare(b.file))
    const acts = ns.map((n) => activities.find((a) => a.n === n)).filter(Boolean)
    if (!photos.length || !acts.length) return null
    const km = acts.reduce((s, a) => s + a.km, 0)
    const gain = acts.reduce((s, a) => s + a.gain, 0)
    const track = ns.length === 1 ? TRACKS.find((t) => t.activity === ns[0]) : null
    return { key, name: photos[0].album || albumSlug, catalog: photos[0].catalog, photos, km, gain, track }
  })
  .filter(Boolean)

// Tracks with no album: TEST entries using stand-in photos.
const STAND_IN = 'swiss/pointe-de-bellevue'
const usedN = new Set(Object.values(hikeAlbums).flat())
const standPhotos = manifest
  .filter((p) => p.catalogSlug === 'swiss' && p.albumSlug === 'pointe-de-bellevue')
  .sort((a, b) => a.file.localeCompare(b.file))
TRACKS.filter((t) => !usedN.has(t.activity) && standPhotos.length).forEach((t) => {
  HIKES.push({
    key: 'track/' + t.activity, name: t.name.replace(/^Afternoon hike at /, ''), catalog: 'no album', photos: standPhotos,
    km: t.km, gain: t.gain, track: t, test: true,
  })
})
HIKES.sort((a, b) => a.name.localeCompare(b.name))

export default function Walkthrough() {
  const [key, setKey] = useState(HIKES[0]?.key)
  const hike = HIKES.find((h) => h.key === key)
  const [prog, setProg] = useState(0) // 0 = first frame centered, 1 = last
  const bodyRef = useRef(null)
  const pathRef = useRef(null)
  const [pos, setPos] = useState([0, 0])
  const [dots, setDots] = useState([])

  const N = hike?.photos.length || 0
  const geo = useMemo(() => (hike?.track ? prepareTrack(hike.track, W, H) : null), [hike])
  const d = useMemo(() => (!hike ? '' : geo ? line(geo.xy) : buildRoute(hike.key, hike.km)), [hike, geo])
  const prof = useMemo(() => (hike && !geo ? buildProfile(hike.key, hike.gain) : null), [hike, geo])
  const tOf = useCallback((i) => (i + 0.5) / N, [N])
  const routeT = N ? (0.5 + prog * (N - 1)) / N : 0
  const active = N ? Math.round(prog * (N - 1)) : 0

  useEffect(() => {
    let raf = 0
    const calc = () => {
      raf = 0
      const frames = bodyRef.current?.querySelectorAll('.wt-frame')
      if (!frames || frames.length < 2) return setProg(0)
      const c = (e) => e.getBoundingClientRect().top + e.offsetHeight / 2
      const a = c(frames[0]), b = c(frames[frames.length - 1])
      setProg(Math.min(Math.max((window.innerHeight / 2 - a) / (b - a), 0), 1))
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(calc) }
    calc()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [key])

  useEffect(() => {
    const p = pathRef.current
    if (geo) { setDots(Array.from({ length: N }, (_, i) => { const q = stateAt(geo, geo.total * tOf(i)); return [q.x, q.y] })); return }
    if (!p) return
    const L = p.getTotalLength()
    setDots(Array.from({ length: N }, (_, i) => { const q = p.getPointAtLength(L * tOf(i)); return [q.x, q.y] }))
  }, [d, N, tOf, geo])

  useEffect(() => {
    if (geo) { const q = stateAt(geo, geo.total * routeT); setPos([q.x, q.y]); return }
    const p = pathRef.current
    if (!p) return
    const q = p.getPointAtLength(p.getTotalLength() * routeT)
    setPos([q.x, q.y])
  }, [routeT, d, geo])

  const goto = useCallback((i) => {
    const f = bodyRef.current?.querySelectorAll('.wt-frame')[Math.max(0, Math.min(N - 1, i))]
    if (f) f.scrollIntoView({ block: 'center' })
  }, [N])

  if (!hike) return <section className="wt"><p className="wt-empty">No hike albums with photos.</p></section>

  const totalKm = geo ? geo.total : hike.km
  const km = totalKm * routeT
  let profPts, doneN, climbed = 0, eleNow = 0, donePts, doneD = ''
  if (geo) {
    const st = stateAt(geo, km)
    eleNow = st.ele
    const step = Math.max(1, Math.floor(geo.kms.length / 300))
    profPts = []
    for (let i = 0; i < geo.kms.length; i += step) profPts.push([i])
    if (profPts[profPts.length - 1][0] !== geo.kms.length - 1) profPts.push([geo.kms.length - 1])
    const proj = (i) => [(geo.kms[i] / geo.total) * 300, 50 - ((geo.eles[i] - geo.lo) / (geo.hi - geo.lo || 1)) * 44]
    profPts = profPts.map(([i]) => proj(i))
    const upTo = []
    for (let i = 0; i <= st.i; i += step) upTo.push(proj(i))
    upTo.push([(km / geo.total) * 300, 50 - ((st.ele - geo.lo) / (geo.hi - geo.lo || 1)) * 44])
    donePts = upTo
    doneD = line(geo.xy.slice(0, st.i + 1).concat([[st.x, st.y]]))
  } else {
    climbed = at(prof.asc, routeT)
    const lo = Math.min(...prof.elev), hi = Math.max(...prof.elev)
    profPts = prof.elev.map((e, i) => [(i / (prof.elev.length - 1)) * 300, 50 - ((e - lo) / (hi - lo || 1)) * 44])
    doneN = Math.round(routeT * (profPts.length - 1))
    donePts = profPts.slice(0, Math.max(doneN, 1) + 1)
  }

  return (
    <section className="wt">
      <div className="wt-head">
        <h2>Trail walkthrough</h2>
        <p>Scroll along a hike. Hikes with a GPS track show the real route and elevation; the others use a schematic drawing where only the distance and gain totals come from AllTrails. Where the frames fall on the route is always an estimate.</p>
        <label>
          <span style={{ position: 'absolute', left: -9999 }}>Hike</span>
          <select className="wt-select" value={key} onChange={(e) => { setKey(e.target.value); window.scrollTo(0, 0) }}>
            {HIKES.map((h) => <option key={h.key} value={h.key}>{h.name} ({h.catalog}){h.track ? ' · GPS' : ''}{h.test ? ' · TEST' : ''} · {h.km.toFixed(1)} km · {h.photos.length} frames</option>)}
          </select>
        </label>
      </div>
      {hike.test && <div className="wt-banner" role="note">TEST: photos are from Pointe de Bellevue, not from this hike</div>}
      <div className="wt-body" ref={bodyRef}>
        <div className="wt-panel">
          <div className="wt-svgwrap">
            <svg className="wt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${geo ? 'GPS' : 'Schematic'} route for ${hike.name}, ${hike.km.toFixed(1)} km`}>
              <path ref={pathRef} className="wt-route-bg" d={d} />
              {geo
                ? <path className="wt-route" d={doneD} />
                : <path className="wt-route" d={d} pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - routeT} />}
              {dots.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === active ? 7 : 4} className={'wt-dot' + (tOf(i) <= routeT ? ' is-seen' : '') + (i === active ? ' is-active' : '')} />
              ))}
              <circle className="wt-marker" cx={pos[0]} cy={pos[1]} r="8" />
              <text className="wt-start" x="10" y="20">{geo ? 'GPS track (frame positions estimated)' : 'schematic route, not to scale'}</text>
            </svg>
          </div>
          <svg className="wt-profile" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
            <path className="wt-prof-line" d={line(profPts)} vectorEffect="non-scaling-stroke" />
            <path className="wt-prof-done" d={line(donePts)} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="wt-bar"><div style={{ width: `${routeT * 100}%` }} /></div>
          <div className="wt-stats">
            <span>{km.toFixed(1)} / {totalKm.toFixed(1)} km</span>
            {geo
              ? <span>{Math.round(eleNow)} m above sea level so far</span>
              : <span>≈ +{Math.round(climbed)} of {hike.gain} m</span>}
            <span>frame {active + 1}/{N}</span>
          </div>
          <div className="wt-ctrl">
            <button type="button" onClick={() => goto(active - 1)} disabled={active === 0} aria-label="Previous frame">←</button>
            <input className="wt-slider" type="range" min="1" max={N} value={active + 1} aria-label="Frame along the route" aria-valuetext={`Frame ${active + 1} of ${N}, about ${km.toFixed(1)} km`} onChange={(e) => goto(Number(e.target.value) - 1)} />
            <button type="button" onClick={() => goto(active + 1)} disabled={active === N - 1} aria-label="Next frame">→</button>
          </div>
          <p className="wt-note">Positions estimated: frames are spread evenly along the route, since film has no GPS. {geo ? `Route and elevation are from a real GPS track (${geo.lo.toFixed(0)} to ${geo.hi.toFixed(0)} m).` : `Elevation is a schematic estimate scaled to the ${hike.gain} m total gain.`}</p>
        </div>
        <div className="wt-frames">
          {hike.photos.map((p, i) => (
            <figure key={p.id} className={'wt-frame' + (i === active ? ' is-active' : '')}>
              <a href={`#/c/${p.catalogSlug}/${p.albumSlug}/p/${p.id}`}>
                <img src={imageUrl(p.thumb)} width={p.width} height={p.height} loading="lazy" decoding="async" alt={p.description || `${hike.name}, frame ${i + 1} of ${N}`} />
              </a>
              <figcaption>Frame {i + 1} · about km {(totalKm * tOf(i)).toFixed(1)} (estimated)</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
