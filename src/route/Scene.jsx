/**
 * The terrain scene for the lab route pages. One WebGL canvas for the whole page: behind the photos it is a calm
 * backdrop (just the relief and the route); in Route mode the same canvas moves into the map card and brings up
 * labels, contours and controls. Nothing is rebuilt on the way, so there is no reload flash.
 * Elevation: AWS Terrain Tiles baked into dem.bin; names: OpenStreetMap (see scripts/bake-terrain.mjs).
 */
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
const fmt = (n) => Math.round(n).toLocaleString('en-US')

/** Which named places to print: the route's own landmarks (from build-routes) first, then the highest peaks around it, spaced apart. */
function pickLabels(engine, tracks, meta, landmarks) {
  const out = landmarks.map((l) => ({ key: l.key, text: l.text.replace(/[()]/g, ''), sub: `${fmt(l.ele)} m`, kind: l.kind, world: engine.toWorld(l.lat, l.lng) }))
  const lats = tracks.flatMap((t) => t.points.map((p) => p[0])), lngs = tracks.flatMap((t) => t.points.map((p) => p[1]))
  const bb = { s: Math.min(...lats) - 0.034, n: Math.max(...lats) + 0.034, w: Math.min(...lngs) - 0.052, e: Math.max(...lngs) + 0.052 }
  const peaks = meta.peaks
    .filter((p) => p.kind === 'peak' && p.ele && p.lat > bb.s && p.lat < bb.n && p.lng > bb.w && p.lng < bb.e)
    .sort((x, y) => y.ele - x.ele)
  const chosen = []
  for (const p of peaks) {
    if (out.some((o) => o.text === p.name)) continue
    const world = engine.toWorld(p.lat, p.lng)
    if ([...chosen, ...out].every((c) => Math.hypot(c.world[0] - world[0], c.world[2] - world[2]) > 1500)) chosen.push({ key: p.name, text: p.name, sub: `${fmt(p.ele)} m`, kind: 'peak', world })
    if (chosen.length >= 9) break
  }
  return [...out, ...chosen]
}

/**
 * @param mode     'photos' (backdrop) or 'route' (full map)
 * @param bgSlot   element to sit in behind the photos (null = keep the backdrop off, e.g. low-power devices)
 * @param mapSlot  element inside the map card, once Route mode has rendered it
 */
const Scene = forwardRef(function Scene({ tracks, meta, demUrl, labels: landmarks, mode, bgSlot, mapSlot, shown, view, scrub, fly, onUserMove, onFail, onReady }, ref) {
  const [host] = useState(() => {
    const wrap = document.createElement('div')
    wrap.className = 'vt-3d vt-3d-host'
    const canvas = document.createElement('canvas')
    canvas.className = 'vt-3d-canvas'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Terrain relief with the route. Drag to rotate, scroll to zoom.')
    const overlay = document.createElement('div')
    overlay.className = 'vt-3d-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    wrap.append(canvas, overlay)
    return { wrap, canvas, overlay }
  })
  const engineRef = useRef(null)
  const live = useRef({ shown, scrub, tracks })
  live.current = { shown, scrub, tracks }
  const labelEls = useRef([])
  const markerEls = useRef([])
  const [labels, setLabels] = useState([])
  const [ready, setReady] = useState(false)
  const cb = useRef({ onFail, onReady, onUserMove })
  cb.current = { onFail, onReady, onUserMove }

  /** Places labels and markers after each frame (front look only). Labels hidden by the relief or colliding with a stronger one fade out. */
  const paint = (engine) => {
    if (engine.look === 'bg') return
    const taken = []
    labelEls.current.forEach((el) => {
      const l = el && el._label
      if (!l) return
      const p = engine.project(l.world)
      const w = l.text.length * 6.4 + 16, h = 30
      const rect = { x: p.x - w / 2, y: p.y - h - 4, w, h }
      const clash = taken.some((r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y)
      const show = p.visible && !p.hidden && !clash && p.y > h && p.x - w / 2 > 4 && p.x + w / 2 < host.wrap.clientWidth - 4
      if (show) taken.push(rect)
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
      el.style.opacity = show ? '1' : '0'
    })
    const { shown: sh, scrub: sc, tracks: tr } = live.current
    markerEls.current.forEach((el, i) => {
      if (!el) return
      if (sc == null || !sh.includes(i)) { el.style.opacity = '0'; return }
      const p = engine.project(engine.pointAt(i, Math.min(sc, tr[i].stats.km)))
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
      el.style.opacity = p.visible && !p.hidden ? '1' : '0.35'
    })
  }

  // Build the engine once.
  useEffect(() => {
    let dead = false, engine = null, off = null, mq = null, onMq = null
    ;(async () => {
      try {
        const mod = await import('./terrain-gl.js')
        const [H, buildings] = await Promise.all([mod.loadElevation(demUrl, meta), mod.loadBuildings(demUrl.replace(/dem\.bin$/, 'buildings.bin'))])
        if (dead) return
        engine = await mod.createTerrain(host.canvas, meta, H, tracks, buildings)
        if (dead) { engine.dispose(); engine = null; return }
        engineRef.current = engine
        host.canvas._engine = engine // debug handle (headless screenshots, console)
        engine.onUserMove(() => cb.current.onUserMove?.())
        mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        engine.setReducedMotion(mq.matches)
        onMq = () => engine.setReducedMotion(mq.matches)
        mq.addEventListener?.('change', onMq)
        setLabels(pickLabels(engine, tracks, meta, landmarks))
        off = engine.onFrame(paint)
        setReady(true)
        cb.current.onReady?.()
      } catch (e) {
        if (!dead) cb.current.onFail?.(e)
      }
    })()
    return () => {
      dead = true
      off?.()
      mq?.removeEventListener?.('change', onMq)
      engine?.dispose()
      engineRef.current = null
      host.wrap.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Put the canvas where the page wants it, crossfading, and switch the engine's look.
  const lastMode = useRef(null)
  useLayoutEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const target = mode === 'route' ? mapSlot : bgSlot
    if (!target) { host.wrap.remove(); return }
    const front = mode === 'route'
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

  // Backdrop: the camera swings a little and the route draws on as the page scrolls. Skipped for reduced motion.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || mode !== 'photos' || !bgSlot) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) { engine.setScroll(0.35); return undefined }
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

  useEffect(() => { if (mode === 'route') engineRef.current?.setMode(view) }, [view, mode, ready])
  useEffect(() => { engineRef.current?.setShown(mode === 'route' ? shown : tracks.map((_, i) => i)) }, [shown, mode, ready])
  useEffect(() => {
    const e = engineRef.current
    if (!e || mode !== 'route') return
    e.setProgress(scrub)
    if (scrub != null && fly) e.follow(e.pointAt(shown[0], Math.min(scrub, tracks[shown[0]].stats.km)))
    e.redraw()
  }, [scrub, fly, shown, tracks, mode, ready])

  useImperativeHandle(ref, () => ({ reset: () => engineRef.current?.resetView() }), [])

  return createPortal(
    <>
      {labels.map((l, i) => (
        <span key={l.key} className={`vt-pin vt-pin-${l.kind}`} ref={(el) => { labelEls.current[i] = el; if (el) el._label = l }}>
          <b>{l.text}</b>
          <i>{l.sub}</i>
        </span>
      ))}
      {tracks.map((t, i) => (
        <span key={t.id} className={`vt-marker vt-marker-${t.id}`} ref={(el) => (markerEls.current[i] = el)} />
      ))}
    </>,
    host.overlay,
  )
})

export default Scene
