/**
 * Map layer of the Swiss catalog page (#/c/swiss), in the minimal grey style of the hike route views.
 * Albums mode: only a calm backdrop behind the album cards (the relief of Switzerland, faint pin dots).
 * Map mode: the same canvas comes forward as a map (2D or tilted 3D) with a pin per album, labels for cities and big peaks,
 * the national border, and a side panel with the album under the pointer.
 * Data: src/swissPlaces.json (scripts/build-swiss-places.mjs), relief and names baked by scripts/bake-swiss.mjs into
 * public/swissmap/ and src/swissmap/terrain.json. The page must be a stacking context (position: relative; z-index: 1) so the
 * fixed backdrop layers (z-index: -1) sit behind its content.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import meta from './terrain.json'
import places from '../swissPlaces.json'
import Picture from '../components/Picture.jsx'
import './swissmap.css'

const DEM_URL = '/swissmap/dem.bin'
const WATER_URL = '/swissmap/water.bin'
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short', year: 'numeric' })
const fmtDate = (d) => DATE_FMT.format(new Date(d + 'T12:00:00Z'))
const fmt = (n) => Math.round(n).toLocaleString('en-US')
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

/** Weak or battery-conscious devices keep the flat map (the 3D map is not worth the battery there). */
const lowPower = () => {
  const n = navigator
  return (n.hardwareConcurrency || 8) <= 2 || (n.deviceMemory || 8) <= 2 || !!n.connection?.saveData
}
const touchOnly = () => window.matchMedia?.('(hover: none) and (pointer: coarse)').matches

/** Flat equirectangular-mercator outline of Switzerland with pins: the fallback and the backdrop until the 3D scene is ready. */
const FLAT = { W: 1000, H: 640 }
function flatProject(lat, lng) {
  const { bounds } = meta
  return [((lng - bounds.west) / (bounds.east - bounds.west)) * FLAT.W, ((mercY(lat) - mercY(bounds.north)) / (mercY(bounds.south) - mercY(bounds.north))) * FLAT.H]
}
const borderPath = (project) => meta.border.map((w) => 'M' + w.map(([lng, lat]) => project(lat, lng).map((v) => v.toFixed(1)).join(' ')).join('L')).join('')
const FLAT_BORDER = borderPath(flatProject)

function FlatMap({ active, setActive, faint }) {
  return (
    <svg className={`sm-flat${faint ? ' is-faint' : ''}`} viewBox={`0 0 ${FLAT.W} ${FLAT.H}`} preserveAspectRatio="xMidYMid meet" role={faint ? undefined : 'img'} aria-hidden={faint || undefined} aria-label="Map of Switzerland with the places photographed">
      <path d={FLAT_BORDER} className="sm-flat-border" vectorEffect="non-scaling-stroke" />
      {!faint && meta.labels.filter((l) => l.kind === 'town').map((l) => {
        const [x, y] = flatProject(l.lat, l.lng)
        return <text key={l.name} x={x + 7} y={y + 4} className="sm-flat-label">{l.name}</text>
      })}
      {Object.entries(places).map(([slug, p]) => {
        const [x, y] = flatProject(p.lat, p.lng)
        const on = active === slug
        return (
          <a key={slug} href={faint ? undefined : `#/c/swiss/${slug}`} tabIndex={faint ? -1 : 0} onMouseEnter={() => !faint && setActive(slug)} onMouseLeave={() => !faint && setActive(null)} onFocus={() => !faint && setActive(slug)} onBlur={() => !faint && setActive(null)} className="sm-flat-pin">
            <circle cx={x} cy={y} r={on ? 8 : 5.5} className={`sm-flat-dot${on ? ' is-on' : ''}`} />
            {!faint && on && <text x={x + 10} y={y - 8} className="sm-flat-pin-label">{p.label}</text>}
          </a>
        )
      })}
    </svg>
  )
}

function Info({ album, place, compact }) {
  if (!album || !place) return compact ? null : <p className="sm-hint">Hover or tap a pin to see the album.</p>
  const bits = [place.date && fmtDate(place.date), place.km && `${place.km.toFixed(1)} km`, place.gain && `+${fmt(place.gain)} m`].filter(Boolean)
  return (
    <a className={`sm-info${compact ? ' is-compact' : ''}`} href={`#/c/swiss/${album.slug}`}>
      {album.cover && (
        <span className="sm-info-img" style={album.cover.c ? { backgroundColor: album.cover.c } : undefined}>
          <Picture photo={album.cover} sizes="260px" alt="" loading="lazy" decoding="async" width={album.cover.width} height={album.cover.height} className="loaded" />
        </span>
      )}
      <b>{album.name}</b>
      <span>{bits.join(' · ') || place.note}</span>
      <i>Open album →</i>
    </a>
  )
}

/**
 * @param albums  the catalog's albums ({ name, slug, count, cover })
 * @param mode    'albums' (backdrop only) or 'map'
 */
export default function SwissMap({ albums, mode }) {
  const bySlug = useMemo(() => Object.fromEntries(albums.map((a) => [a.slug, a])), [albums])
  const pinned = useMemo(() => Object.keys(places).filter((s) => bySlug[s]).sort((a, b) => (places[b].date || '').localeCompare(places[a].date || '')), [bySlug])
  const [active, setActive] = useState(null)
  const [view, setView] = useState('3d')
  const [want, setWant] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [bgSlot, setBgSlot] = useState(null)
  const [mapSlot, setMapSlot] = useState(null)
  const bg3d = useMemo(() => !lowPower(), [])
  const touch = useMemo(() => touchOnly(), [])

  const [host] = useState(() => {
    const wrap = document.createElement('div')
    wrap.className = 'sm-host'
    const canvas = document.createElement('canvas')
    canvas.className = 'sm-canvas'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Relief of Switzerland with the places photographed. Drag to rotate, scroll to zoom.')
    const overlay = document.createElement('div')
    overlay.className = 'sm-overlay'
    wrap.append(canvas, overlay)
    return { wrap, canvas, overlay }
  })
  const engineRef = useRef(null)
  const pinEls = useRef({})
  const labelEls = useRef([])
  const borderEl = useRef(null)
  const activeRef = useRef(null)
  activeRef.current = active

  // The 3D scene starts once the page has gone quiet (2.5 s), at the first scroll or touch, or at once in map mode.
  useEffect(() => { if (mode === 'map') setWant(true) }, [mode])
  useEffect(() => {
    if (want || !bg3d) return undefined
    let id = 0, t = 0
    const events = ['scroll', 'pointerdown', 'keydown']
    const cleanupInput = () => events.forEach((e) => window.removeEventListener(e, start))
    function start() {
      cleanupInput()
      if (window.requestIdleCallback) id = window.requestIdleCallback(() => setWant(true), { timeout: 3000 })
      else setWant(true)
    }
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
  }, [want, bg3d])

  /** Moves pins, labels and the border to where the relief is on screen. */
  const paint = useCallback((engine) => {
    const front = engine.look !== 'bg'
    const w = host.wrap.clientWidth
    const taken = []
    // Pins: the dot always, the name only where it does not collide with one already placed (the hovered pin goes first).
    const order = Object.keys(pinEls.current).sort((a, b) => (b === activeRef.current) - (a === activeRef.current))
    for (const slug of order) {
      const el = pinEls.current[slug]
      if (!el) continue
      const p = engine.project(places[slug].lat, places[slug].lng)
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
      el.style.opacity = p.visible ? '1' : '0'
      if (front && p.visible) {
        const lw = places[slug].label.length * 6.3 + 12, rect = { x: p.x - lw / 2, y: p.y - 24, w: lw, h: 16 }
        const clash = slug !== activeRef.current && taken.some((r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y)
        el.classList.toggle('no-label', clash)
        if (!clash) taken.push(rect)
      }
    }
    if (front) {
      for (const el of labelEls.current) {
        const l = el && el._label
        if (!l) continue
        const p = engine.project(l.lat, l.lng)
        const lw = l.name.length * 6.2 + 14, lh = 16
        const rect = { x: p.x - lw / 2, y: p.y - lh, w: lw, h: lh }
        const clash = taken.some((r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y)
        const show = p.visible && !clash && rect.x > 2 && rect.x + lw < w - 2
        if (show) taken.push(rect)
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
        el.style.opacity = show ? '1' : '0'
      }
    }
    if (borderEl.current) {
      borderEl.current.setAttribute('d', front ? borderPath((lat, lng) => { const p = engine.project(lat, lng); return [p.x, p.y] }) : '')
    }
  }, [host])

  // Build the engine once, when wanted.
  useEffect(() => {
    if (!want || failed) return undefined
    let dead = false, engine = null, off = null, mq = null, onMq = null
    ;(async () => {
      try {
        const mod = await import('./swiss-gl.js')
        const grid = await mod.loadGrid(DEM_URL, WATER_URL, meta)
        if (dead) return
        engine = mod.createSwissTerrain(host.canvas, meta, grid)
        engineRef.current = engine
        mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        engine.setReducedMotion(mq.matches)
        onMq = () => engine.setReducedMotion(mq.matches)
        mq.addEventListener?.('change', onMq)
        off = engine.onFrame(paint)
        setReady(true)
      } catch {
        if (!dead) setFailed(true)
      }
    })()
    return () => {
      dead = true
      off?.()
      mq?.removeEventListener?.('change', onMq)
      engine?.dispose()
      engineRef.current = null
      host.wrap.remove()
      setReady(false)
    }
  }, [want, failed, host, paint])

  // Put the canvas where the page wants it (behind the cards, or in the map card), crossfading, and set the look.
  const lastMode = useRef(null)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const front = mode === 'map'
    const target = front ? mapSlot : bgSlot
    if (!target) { host.wrap.remove(); return }
    host.wrap.classList.toggle('is-front', front)
    host.wrap.classList.toggle('is-bg', !front)
    const first = lastMode.current === null
    if (host.wrap.parentNode !== target) {
      host.wrap.style.transition = 'none'
      host.wrap.style.opacity = '0'
      target.appendChild(host.wrap)
      void host.wrap.offsetWidth
      host.wrap.style.transition = first ? 'opacity 1.4s ease' : 'opacity 0.55s ease'
      host.wrap.style.opacity = '1'
    }
    lastMode.current = mode
    engine.setLook(front ? 'front' : 'bg', first)
    engine.setMode(view)
    engine.redraw()
  }, [ready, mode, bgSlot, mapSlot]) // eslint-disable-line react-hooks/exhaustive-deps

  // Backdrop: the camera swings a little as the page scrolls (not for reduced motion).
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || mode !== 'albums' || !bgSlot) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { engine.setScroll(0.3); return undefined }
    let raf = 0
    const update = () => {
      raf = 0
      const room = document.documentElement.scrollHeight - window.innerHeight
      engine.setScroll(room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0, engine.frames < 3)
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
  }, [ready, mode, bgSlot])

  useEffect(() => { if (mode === 'map') engineRef.current?.setMode(view) }, [view, mode, ready])
  useEffect(() => { engineRef.current?.redraw() }, [active])

  const onPinClick = (e, slug) => {
    // Touch screens have no hover: the first tap shows the album, the second opens it.
    if (touch && active !== slug) { e.preventDefault(); setActive(slug) }
  }

  const front3d = mode === 'map' && !failed
  const overlay = createPortal(
    <>
      <svg className="sm-border" aria-hidden="true"><path ref={borderEl} /></svg>
      {meta.labels.map((l, i) => (
        <span key={l.name} className={`sm-label sm-label-${l.kind}`} ref={(el) => { labelEls.current[i] = el; if (el) el._label = l }}>
          <b>{l.name}</b>{l.ele ? <i>{fmt(l.ele)} m</i> : null}
        </span>
      ))}
      {pinned.map((slug) => (
        <a key={slug} href={`#/c/swiss/${slug}`} className={`sm-pin${active === slug ? ' is-on' : ''}`} ref={(el) => (pinEls.current[slug] = el)} aria-label={places[slug].label}
          tabIndex={mode === 'map' ? 0 : -1}
          onClick={(e) => onPinClick(e, slug)}
          onMouseEnter={() => !touch && setActive(slug)} onMouseLeave={() => !touch && setActive(null)}
          onFocus={() => !touch && setActive(slug)} onBlur={() => !touch && setActive(null)}>
          <b>{places[slug].label}</b>
        </a>
      ))}
    </>,
    host.overlay,
  )

  return (
    <>
      {mode === 'albums' && !(bg3d && ready && !failed) && <div className="sm-bg" aria-hidden="true"><FlatMap faint /></div>}
      <div className="sm-bgslot" ref={setBgSlot} aria-hidden="true" />
      {want && !failed && overlay}
      {mode === 'map' && (
        <div className="sm-map-view">
          <div className="sm-toolbar">
            <div className="sm-tabs" role="group" aria-label="Map view">
              {front3d && [['2d', '2D'], ['3d', '3D']].map(([k, label]) => (
                <button key={k} className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
              ))}
            </div>
            {front3d && <button className="sm-btn" onClick={() => engineRef.current?.resetView()}>Reset view</button>}
          </div>
          <div className="sm-grid">
            <div className="sm-map-wrap">
              {failed ? (
                <div className="sm-slot sm-slot-flat"><FlatMap active={active} setActive={setActive} /></div>
              ) : (
                <div className="sm-slot" ref={setMapSlot}>{!ready && <div className="sm-loading">Loading terrain…</div>}</div>
              )}
              {touch && active && <div className="sm-float"><Info compact album={bySlug[active]} place={places[active]} /></div>}
              <p className="sm-attrib">Relief: AWS Terrain Tiles (SRTM, EU-DEM, national sources) · names and border © OpenStreetMap contributors · contours every 100 m, bold every 500 m</p>
            </div>
            <div className="sm-side">
              {!touch && <Info album={active && bySlug[active]} place={active && places[active]} />}
              <ul className="sm-list">
                {pinned.map((slug) => (
                  <li key={slug}>
                    <a href={`#/c/swiss/${slug}`} className={active === slug ? 'is-on' : ''} onMouseEnter={() => !touch && setActive(slug)} onMouseLeave={() => !touch && setActive(null)}>
                      <span>{places[slug].label}</span>
                      <small>{places[slug].date ? fmtDate(places[slug].date) : ''}</small>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="sm-note">Pins mark the start of each hike. Albums that mix several outings have no pin yet.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
