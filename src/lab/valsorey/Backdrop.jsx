/**
 * The route backdrop behind a hike album's photos on its normal gallery page (#/c/<catalog>/<album>):
 * the same calm greyscale terrain with the route as on the lab route page, loaded lazily and only for albums that have a route.
 * Starts once the page has loaded and gone quiet (2.5 s), or at the first scroll or touch; a flat hairline route stands in until then.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { RouteCtx, Background, buildModel, lowPower, detailFiles, terrainFiles } from './model.jsx'

const Scene = lazy(() => import('./Scene.jsx'))

function Inner({ model }) {
  const { TRACKS, detail, meta, demUrl } = model
  const [want, setWant] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [bgSlot, setBgSlot] = useState(null)
  const bg3d = useMemo(() => !lowPower(), [])
  const shown = useMemo(() => TRACKS.map((_, i) => i), [TRACKS])

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
  const noop = useCallback(() => {}, [])
  const backdrop3d = bg3d && sceneReady && !sceneFailed

  return (
    <RouteCtx.Provider value={model}>
      <Background off={backdrop3d} />
      <div className="vt-bgslot" ref={setBgSlot} aria-hidden="true" />
      {want && !sceneFailed && (
        <Suspense fallback={null}>
          <Scene
            tracks={TRACKS}
            meta={meta}
            demUrl={demUrl}
            labels={detail.labels}
            mode="photos"
            bgSlot={bg3d ? bgSlot : null}
            mapSlot={null}
            shown={shown}
            view="3d"
            scrub={null}
            fly={false}
            onUserMove={noop}
            onFail={onFail}
            onReady={onReady}
          />
        </Suspense>
      )}
    </RouteCtx.Provider>
  )
}

export default function RouteBackdrop({ slug }) {
  const [model, setModel] = useState(null)
  useEffect(() => {
    let live = true
    const d = detailFiles[`../routes/${slug}/detail.json`], t = terrainFiles[`../routes/${slug}/terrain.json`]
    if (!d || !t) return undefined
    Promise.all([d(), t()]).then(([a, b]) => live && setModel(buildModel(a.default || a, b.default || b, slug)), () => {})
    return () => { live = false }
  }, [slug])
  return model ? <Inner key={slug} model={model} /> : null
}
