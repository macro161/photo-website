/**
 * The route map for the Valsorey page: greyscale relief with contour lines, the tracks draped over it,
 * place labels, and a marker that follows the elevation profile. Falls back (via onFail) to the flat SVG
 * map when WebGL2 or the baked elevation file isn't available.
 * Elevation: AWS Terrain Tiles baked into dem.bin; names: OpenStreetMap (see scripts/bake-terrain.mjs).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import meta from './terrain.json'

const DEM_URL = '/lab/valsorey/dem.bin'
const fmt = (n) => Math.round(n).toLocaleString('en-US')

/** Which named places to print: the route's own landmarks first, then the highest peaks around it, spaced apart. */
function pickLabels(engine, tracks) {
  const a = tracks[0].points, first = a[0], last = a[a.length - 1]
  const out = [
    { key: 'start', text: 'Bourg-Saint-Pierre', sub: `${fmt(first[2])} m`, kind: 'place', world: engine.pointAt(0, 0), rank: 0 },
    { key: 'hut', text: 'Cabane de Valsorey', sub: `${fmt(last[2])} m`, kind: 'hut', world: engine.pointAt(0, 1e9), rank: 0 },
  ]
  const lats = tracks.flatMap((t) => t.points.map((p) => p[0])), lngs = tracks.flatMap((t) => t.points.map((p) => p[1]))
  const bb = { s: Math.min(...lats) - 0.034, n: Math.max(...lats) + 0.034, w: Math.min(...lngs) - 0.052, e: Math.max(...lngs) + 0.052 }
  const peaks = meta.peaks
    .filter((p) => p.kind === 'peak' && p.ele && p.lat > bb.s && p.lat < bb.n && p.lng > bb.w && p.lng < bb.e)
    .sort((x, y) => y.ele - x.ele)
  const chosen = []
  for (const p of peaks) {
    const world = engine.toWorld(p.lat, p.lng)
    if ([...chosen, ...out].every((c) => Math.hypot(c.world[0] - world[0], c.world[2] - world[2]) > 1500)) chosen.push({ key: p.name, text: p.name, sub: `${fmt(p.ele)} m`, kind: 'peak', world, rank: 1 })
    if (chosen.length >= 9) break
  }
  return [...out, ...chosen]
}

const Terrain3D = forwardRef(function Terrain3D({ tracks, shown, view, scrub, fly, onUserMove, onFail }, ref) {
  const wrap = useRef(null)
  const canvas = useRef(null)
  const engineRef = useRef(null)
  const live = useRef({ shown, scrub, tracks })
  live.current = { shown, scrub, tracks }
  const labelEls = useRef([])
  const markerEls = useRef([])
  const [labels, setLabels] = useState([])
  const [ready, setReady] = useState(false)
  const failed = useRef(onFail)
  failed.current = onFail
  const userMove = useRef(onUserMove)
  userMove.current = onUserMove

  useEffect(() => {
    let dead = false, engine = null, off = null
    ;(async () => {
      try {
        const mod = await import('./terrain-gl.js')
        const H = await mod.loadElevation(DEM_URL, meta)
        if (dead) return
        engine = mod.createTerrain(canvas.current, meta, H, tracks)
        engineRef.current = engine
        engine.onUserMove(() => userMove.current?.())
        setLabels(pickLabels(engine, tracks))
        off = engine.onFrame(paint)
        engine.setMode(view)
        engine.setShown(shown)
        setReady(true)
      } catch (e) {
        if (!dead) failed.current?.(e)
      }
    })()
    return () => { dead = true; off?.(); engine?.dispose(); engineRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Places the labels and markers after every frame. Labels that are hidden by the relief or collide with a stronger label fade out. */
  const paint = (engine) => {
    const taken = []
    const items = labelEls.current.map((el, i) => ({ el, i })).filter((x) => x.el)
    items.forEach(({ el, i }) => {
      const l = el._label
      if (!l) return
      const p = engine.project(l.world)
      const w = l.text.length * 6.4 + 16, h = 30
      const rect = { x: p.x - w / 2, y: p.y - h - 4, w, h }
      const clash = taken.some((r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y)
      const show = p.visible && !p.hidden && !clash && p.y > h && p.x - w / 2 > 4 && p.x + w / 2 < el.parentElement.clientWidth - 4
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

  useEffect(() => { engineRef.current?.setMode(view) }, [view, ready])
  useEffect(() => { engineRef.current?.setShown(shown) }, [shown, ready])
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    e.setProgress(scrub)
    if (scrub != null && fly) e.follow(e.pointAt(shown[0], Math.min(scrub, tracks[shown[0]].stats.km)))
    e.redraw()
  }, [scrub, fly, shown, tracks, ready])

  useImperativeHandle(ref, () => ({ reset: () => engineRef.current?.resetView() }), [])

  return (
    <div className="vt-3d" ref={wrap} data-ready={ready ? '1' : '0'}>
      <canvas ref={canvas} className="vt-3d-canvas" aria-label="Terrain relief with the route. Drag to rotate, scroll to zoom." role="img" />
      <div className="vt-3d-overlay" aria-hidden="true">
        {labels.map((l, i) => (
          <span key={l.key} className={`vt-pin vt-pin-${l.kind}`} ref={(el) => { labelEls.current[i] = el; if (el) el._label = l }}>
            <b>{l.text}</b>
            <i>{l.sub}</i>
          </span>
        ))}
        {tracks.map((t, i) => (
          <span key={t.id} className={`vt-marker vt-marker-${t.id}`} ref={(el) => (markerEls.current[i] = el)} />
        ))}
      </div>
      {!ready && <div className="vt-3d-loading">Loading terrain…</div>}
    </div>
  )
})

export default Terrain3D
