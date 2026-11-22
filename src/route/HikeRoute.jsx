/**
 * The route layer of a hike album page (#/c/<catalog>/<album>), for albums with a GPS recording.
 * Photos mode: only a backdrop behind the photos (calm greyscale terrain with the route; a flat hairline route until the 3D scene is ready or where it can't run).
 * Route mode: the same canvas comes forward as a map with labels, stats, an elevation profile you can scrub, and the photos as a strip (this component then renders it in flow).
 * Data per album (track stats, baked relief, landmark names) is built by scripts/build-routes.mjs into src/route/<album>/.
 * The page must be a stacking context (position: relative; z-index: 1) so the fixed backdrop layers (z-index: -1) sit behind its content.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RouteCtx, Background, buildModel, lowPower, detailFiles, terrainFiles } from './model.jsx'
import RouteView, { showing } from './RouteView.jsx'

const Scene = lazy(() => import('./Scene.jsx'))

function Inner({ model, mode, photos, onOpen }) {
  const { TRACKS, detail, meta, demUrl } = model

  // Route-mode state lives here because the 3D scene outlives the mode switch.
  const [which, setWhich] = useState('both')
  const [scrub, setScrub] = useState(null)
  const [view, setView] = useState('3d')
  const [playing, setPlaying] = useState(false)
  const terrain = useRef(null)
  const shown = useMemo(() => showing(which, TRACKS.length), [which, TRACKS.length])
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

  // The 3D scene starts once the page has loaded and gone quiet (2.5 s), or at the first scroll or touch, or at once when Route is opened.
  const [want, setWant] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [bgSlot, setBgSlot] = useState(null)
  const [mapSlot, setMapSlot] = useState(null)
  const bg3d = useMemo(() => !lowPower(), [])
  useEffect(() => { if (mode === 'route') setWant(true) }, [mode])
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

  const onFail = useCallback(() => setSceneFailed(true), [])
  const onReady = useCallback(() => setSceneReady(true), [])
  const backdrop3d = bg3d && sceneReady && !sceneFailed

  return (
    <RouteCtx.Provider value={model}>
      {mode === 'photos' && <Background off={backdrop3d} />}
      <div className="vt-bgslot" ref={setBgSlot} aria-hidden="true" />
      {want && !sceneFailed && (
        <Suspense fallback={null}>
          <Scene
            ref={terrain}
            tracks={TRACKS}
            meta={meta}
            demUrl={demUrl}
            labels={detail.labels}
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
      {mode === 'route' && (
        <RouteView
          photos={photos}
          onOpen={onOpen}
          ctl={{ which, setWhich, scrub, view, setView, playing, setPlaying, onProfile, terrain }}
          setMapSlot={setMapSlot}
          sceneFailed={sceneFailed}
        />
      )}
    </RouteCtx.Provider>
  )
}

export default function HikeRoute({ slug, mode, photos, onOpen }) {
  const [model, setModel] = useState(null)
  useEffect(() => {
    let live = true
    const d = detailFiles[`./${slug}/detail.json`], t = terrainFiles[`./${slug}/terrain.json`]
    if (!d || !t) return undefined
    Promise.all([d(), t()]).then(([a, b]) => live && setModel(buildModel(a.default || a, b.default || b, slug)), () => {})
    return () => { live = false }
  }, [slug])
  return model ? <Inner key={slug} model={model} mode={mode} photos={photos} onOpen={onOpen} /> : null
}
