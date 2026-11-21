import { useEffect, useMemo, useRef, useState } from 'react'
import activities from '../activities.json'
import hikeAlbums from '../hikeAlbums.json'
import manifest from '../../generated/manifest.json'
import config from '../../../site.config.json'
import { imageUrl } from '../../imageUrl.js'
import '../vertical/vertical.css'

const SCALE = 0.28 // px per metre of gain
const PAD_TOP = 150
const PAD_BOTTOM = 90
const GAP = 14
const H_TEXT = 70
const H_PHOTO = 132
const H_PLAIN = H_TEXT
const H_COVER = H_TEXT + H_PHOTO

const REFS = [
  { m: 330, label: 'Eiffel Tower', sub: '330 m' },
  { m: 4478, label: 'Matterhorn', sub: '4,478 m' },
  { m: 4806, label: 'Mont Blanc', sub: '4,806 m' },
  { m: 8849, label: 'Everest from sea level', sub: '8,849 m' },
  { m: 8849 * 2, label: 'Everest x2', sub: '17,698 m' },
  { m: 8849 * 3, label: 'Everest x3', sub: '26,547 m' },
]

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const fmtDate = (d) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** album key -> { cover photo, count, name } using the same cover rule as the gallery */
function buildAlbumInfo() {
  const groups = new Map()
  for (const p of manifest) {
    if (!p.albumSlug) continue
    const key = `${p.catalogSlug}/${p.albumSlug}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }
  const covers = config.gallery?.covers || {}
  const info = {}
  for (const [key, list] of groups) {
    const first = list[0]
    const wanted = covers[`${first.catalog}/${first.album}`] || covers[first.album]
    const cover = (wanted && list.find((p) => p.file.split('/').pop() === wanted)) || first
    info[key] = { key, cover, count: list.length, name: first.album, catalogSlug: first.catalogSlug, albumSlug: first.albumSlug }
  }
  return info
}

function buildTower() {
  const albumInfo = buildAlbumInfo()
  const byN = {}
  for (const [key, ns] of Object.entries(hikeAlbums)) for (const n of ns) byN[n] = albumInfo[key]
  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date) || b.n - a.n) // oldest = base
  let cum = 0
  const segs = sorted.map((a) => {
    const seg = { ...a, base: cum, album: byN[a.n] || null }
    cum += a.gain
    return seg
  })
  // Stack labels upward from the base so they never overlap
  let nextFree = 0
  for (const s of segs) {
    s.h = s.album ? H_COVER : H_PLAIN
    const desired = (s.base + s.gain / 2) * SCALE - s.h / 2
    s.labelBottom = Math.max(desired, nextFree, 0)
    nextFree = s.labelBottom + s.h + GAP
  }
  const towerH = cum * SCALE
  const height = Math.max(towerH, nextFree - GAP) + PAD_TOP + PAD_BOTTOM
  const yOf = (px) => height - PAD_BOTTOM - px // px above the base -> y from wrapper top
  const albumsUsed = new Set(segs.filter((s) => s.album).map((s) => s.album.key))
  const photoTotal = [...albumsUsed].reduce((t, k) => t + albumInfo[k].count, 0)
  return { segs, total: cum, height, yOf, albumsUsed: albumsUsed.size, photoTotal }
}

function useReveal() {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px 120px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen]
}

function Card({ s, yOf }) {
  const [ref, seen] = useReveal()
  const top = yOf(s.labelBottom + s.h)
  const cover = s.album?.cover
  const href = cover ? `#/c/${s.album.catalogSlug}/${s.album.albumSlug}/p/${cover.id}` : null
  return (
    <div ref={ref} className={'v-card' + (seen ? ' is-in' : '')} style={{ top, height: s.h }}>
      {cover && (
        <a className="v-card-photo" href={href} aria-label={`Open ${s.album.name}`}>
          {seen && <img src={imageUrl(cover.thumb)} alt={s.album.name} loading="lazy" decoding="async" />}
        </a>
      )}
      <div className="v-card-text">
        <div className="v-card-gain">+{fmt(s.gain)} m</div>
        <div className="v-card-title">{s.title}</div>
        <div className="v-card-meta">
          {fmtDate(s.date)} · {s.km} km
          {s.album && ` · ${s.album.count} photos in "${s.album.name}" (match unverified)`}
        </div>
      </div>
    </div>
  )
}

function Stats({ tower, hours }) {
  const items = [
    [fmt(tower.total) + ' m', 'total gain'],
    [fmt(activities.reduce((t, a) => t + a.km, 0)) + ' km', 'distance'],
    [fmt(hours) + ' h', 'on foot'],
    [String(activities.length), 'hikes'],
    [String(tower.photoTotal), `photos in ${tower.albumsUsed} hike albums`],
  ]
  return (
    <dl className="v-stats">
      {items.map(([v, l]) => (
        <div key={l}>
          <dt>{l}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Vertical() {
  const tower = useMemo(buildTower, [])
  const hours = useMemo(() => activities.reduce((t, a) => t + a.minutes, 0) / 60, [])
  const wrapRef = useRef(null)
  const [alt, setAlt] = useState(0)
  const [stickyTop, setStickyTop] = useState(64)
  const { segs, total, height, yOf } = tower

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const header = document.querySelector('.site-header')
      if (header) setStickyTop(Math.round(header.getBoundingClientRect().height))
      const wrap = wrapRef.current
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const probe = window.innerHeight * 0.55 - rect.top // px below wrapper top
      const meters = (height - PAD_BOTTOM - probe) / SCALE
      setAlt(Math.min(total, Math.max(0, Math.round(meters / 5) * 5)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [height, total])

  const jump = (to) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const y =
      to === 'base'
        ? wrap.getBoundingClientRect().top + window.scrollY + height - window.innerHeight * 0.7
        : 0
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' })
  }

  const everests = alt / 8849
  const nearest = [...REFS].reverse().find((r) => alt >= r.m)

  return (
    <section className="v-page" style={{ '--v-top': stickyTop + 'px' }}>
      <header className="v-intro">
        <p className="v-kicker">Lab / Vertical meters</p>
        <h2>{fmt(total)} metres, one tower</h2>
        <p className="v-lede">
          Every one of the {activities.length} logged hikes, stacked in date order by elevation gain. Start at the
          base and scroll up. This is cumulative climbing, not altitude: each segment is one hike, its height
          proportional to metres gained. In total that is {(total / 8849).toFixed(1)} Everests from sea level.
        </p>
        <Stats tower={tower} hours={hours} />
        <button className="v-btn" onClick={() => jump('base')}>
          Go to the base
        </button>
      </header>

      <div className="v-hud">
        <div className="v-hud-main">
          <span className="v-hud-num">{fmt(alt)}</span>
          <span className="v-hud-unit">m climbed</span>
        </div>
        <div className="v-hud-bar">
          <i style={{ width: (alt / total) * 100 + '%' }} />
        </div>
        <div className="v-hud-sub">
          {nearest ? `past ${nearest.label} (${nearest.sub})` : 'below the Eiffel Tower'} · {everests.toFixed(2)}{' '}
          Everests
        </div>
      </div>

      <div className="v-wrap" ref={wrapRef} style={{ height }}>
        {REFS.filter((r) => r.m <= total).map((r) => (
          <div key={r.label} className="v-ref" style={{ top: yOf(r.m * SCALE) }}>
            <span>
              <b>{r.label}</b> {r.sub}
            </span>
          </div>
        ))}
        <div className="v-summit" style={{ top: yOf(total * SCALE) - 34 }}>
          Summit: {fmt(total)} m
        </div>
        <div className="v-base" style={{ top: yOf(0) }}>
          Base: 0 m gained
        </div>

        <div className="v-tower">
          {segs.map((s) => {
            const fill = Math.min(1, Math.max(0, (alt - s.base) / s.gain))
            return (
              <div
                key={s.n}
                className="v-seg"
                style={{ top: yOf((s.base + s.gain) * SCALE), height: s.gain * SCALE }}
                title={`${s.title}: +${s.gain} m`}
              >
                <i style={{ transform: `scaleY(${fill})` }} />
              </div>
            )
          })}
        </div>

        <svg className="v-conn" height={height} aria-hidden="true">
          {segs.map((s) => {
            const y1 = yOf((s.base + s.gain / 2) * SCALE)
            const y2 = yOf(s.labelBottom + s.h / 2)
            return <path key={s.n} d={`M0 ${y1} C 18 ${y1}, 18 ${y2}, 36 ${y2}`} />
          })}
        </svg>

        {segs.map((s) => (
          <Card key={s.n} s={s} yOf={yOf} />
        ))}
      </div>

      <footer className="v-outro">
        <h3>The whole climb</h3>
        <Stats tower={tower} hours={hours} />
        <p className="v-note">
          Gain, distance and time come from the AllTrails export. Photo counts and covers use guessed hike-to-album
          matches (unverified); hikes without an album have no photos here yet. Reference heights are well-known
          approximate figures.
        </p>
        <button className="v-btn" onClick={() => jump('top')}>
          Back to the top
        </button>
      </footer>
    </section>
  )
}
