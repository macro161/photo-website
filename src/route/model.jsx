/** Shared by the route page and the album-page backdrop: the per-album route model and the flat route backdrop. */
import { createContext, useContext, useEffect, useRef } from 'react'
import hikeAlbums from '../lab/hikeAlbums.json'
import { projectTracks, toPath, xyAt } from './geo.js'
import './route.css'

const BG = { W: 1000, H: 700 }
export const MAP = { W: 800, H: 600 }

export const detailFiles = import.meta.glob('./*/detail.json')
export const terrainFiles = import.meta.glob('./*/terrain.json')
/** Albums that have a route page, as [catalog, album] by album slug. */
export const ROUTES = Object.fromEntries(Object.keys(hikeAlbums).map((k) => [k.split('/')[1], k.split('/')[0]]))

export const RouteCtx = createContext(null)

/** Everything derived from the loaded tracks, computed once per page. */
export function buildModel(detail, meta, slug) {
  const TRACKS = detail.tracks
  const bgGeo = projectTracks(TRACKS, BG.W, BG.H, 70)
  const mapGeo = projectTracks(TRACKS, MAP.W, MAP.H, 50)
  const TOTAL_KM = TRACKS.reduce((s, t) => s + t.stats.km, 0)
  /** The tracks laid end to end, as one journey: distance along it -> which track and km on it. */
  const journey = (u) => {
    let left = u
    for (let i = 0; i < TRACKS.length; i++) {
      if (left <= TRACKS[i].stats.km || i === TRACKS.length - 1) return [i, Math.min(left, TRACKS[i].stats.km)]
      left -= TRACKS[i].stats.km
    }
    return [0, 0]
  }
  return { slug, detail, meta, demUrl: `/route/${slug}/dem.bin`, TRACKS, bgGeo, bgPaths: bgGeo.paths.map(toPath), mapGeo, mapPaths: mapGeo.paths.map(toPath), TOTAL_KM, journey }
}


/* ---------- Background: the route, barely there, filling in as you scroll ---------- */
export function Background({ off }) {
  const { TRACKS, TOTAL_KM, journey, bgGeo, bgPaths } = useContext(RouteCtx)
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
  }, [TRACKS, TOTAL_KM, journey, bgGeo])

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


/** Weak or battery-conscious devices keep the flat hairline backdrop (the 3D map is still there in Route mode). */
export const lowPower = () => {
  const n = navigator
  return (n.hardwareConcurrency || 8) <= 2 || (n.deviceMemory || 8) <= 2 || !!n.connection?.saveData
}

