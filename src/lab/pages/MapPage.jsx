import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../map/map.css'
import photos from '../../generated/manifest.json'
import config from '../../../site.config.json'
import { imageUrl } from '../../imageUrl.js'
import activities from '../activities.json'
import hikeAlbums from '../hikeAlbums.json'
import trailheads from '../map/trailheads.json'

// Real GPS tracks (made by scripts/gpx-to-json.mjs), keyed by AllTrails activity number.
const tracks = new Map(
  Object.values(import.meta.glob('../tracks/*.json', { eager: true }))
    .map((m) => m.default || m)
    .filter((t) => t && Array.isArray(t.points) && t.points.length > 1)
    .map((t) => [t.activity, t]),
)

// Pin colours by year (both pass contrast on light and dark tiles).
const YEAR_COLORS = { 2025: '#2a7f8e', 2026: '#d2562b' }
const colorFor = (date) => YEAR_COLORS[Number(date.slice(0, 4))] || '#6a6a6a'

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function pinIcon(color, small, real) {
  const size = small ? (real ? 18 : 12) : 26
  const html = small && real
    ? `<span class="lm-tdot" style="background:${color}"></span>`
    : small
    ? `<span class="lm-dot" style="background:${color}"></span>`
    : `<span class="lm-pin" style="background:${color}"><i></i></span>`
  return L.divIcon({
    className: 'lm-icon',
    html,
    iconSize: [size, small ? size : size + 6],
    iconAnchor: small ? [size / 2, size / 2] : [size / 2, size + 6],
    popupAnchor: [0, small ? -8 : -(size + 8)],
  })
}

function findCover(albumPhotos) {
  const first = albumPhotos[0]
  if (!first) return null
  const key = `${first.catalog}/${first.album}`
  const name = config.gallery?.covers?.[key]
  return (name && albumPhotos.find((p) => p.file === `${key}/${name}`)) || first
}

function buildData() {
  const act = new Map(activities.map((a) => [a.n, a]))
  const th = new Map(trailheads.map((t) => [t.n, t]))
  const used = new Set()
  const pins = []
  for (const [key, ns] of Object.entries(hikeAlbums)) {
    const [catalogSlug, albumSlug] = key.split('/')
    const albumPhotos = photos.filter((p) => p.catalogSlug === catalogSlug && p.albumSlug === albumSlug)
    const acts = ns.map((n) => act.get(n)).filter(Boolean)
    ns.forEach((n) => used.add(n))
    const trk = ns.map((n) => tracks.get(n)).filter(Boolean)
    const spot = trk.length
      ? { lat: trk[0].points[0][0], lng: trk[0].points[0][1], real: true }
      : ns.map((n) => th.get(n)).find((t) => t && t.lat != null)
    if (!spot || !acts.length || !albumPhotos.length) continue
    const sorted = [...acts].sort((a, b) => a.date.localeCompare(b.date))
    pins.push({
      kind: 'album', key, catalogSlug, albumSlug, title: albumPhotos[0].album,
      date: sorted[0].date, km: acts.reduce((s, a) => s + a.km, 0), gain: acts.reduce((s, a) => s + a.gain, 0),
      count: acts.length, spot, tracks: trk, cover: findCover(albumPhotos),
    })
  }
  const others = []
  for (const a of activities) {
    if (used.has(a.n)) continue
    const trk = tracks.get(a.n)
    const t = trk ? { lat: trk.points[0][0], lng: trk.points[0][1], real: true } : th.get(a.n)
    if (!t || t.lat == null) continue
    others.push({ kind: 'activity', title: a.title, date: a.date, km: a.km, gain: a.gain, spot: t, tracks: trk ? [trk] : [] })
  }
  // Spread items that share one trailhead slightly so every pin stays clickable.
  const groups = new Map()
  for (const p of [...pins, ...others]) {
    const k = `${p.spot.lat},${p.spot.lng}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(p)
  }
  for (const g of groups.values()) {
    g.forEach((p, i) => {
      const ang = (i / g.length) * Math.PI * 2
      const r = g.length > 1 && !p.spot.real ? 0.0012 : 0
      p.lat = p.spot.lat + Math.sin(ang) * r
      p.lng = p.spot.lng + (Math.cos(ang) * r) / Math.cos((p.spot.lat * Math.PI) / 180)
      p.offset = g.length > 1 && !p.spot.real
    })
  }
  return { pins, others }
}

function sparkline(t) {
  const W = 220, H = 56, pad = 3
  const pts = t.points
  const total = pts[pts.length - 1][3] || 1
  const lo = t.minEle, hi = Math.max(t.maxEle, lo + 1)
  const step = Math.max(1, Math.floor(pts.length / 120))
  const xy = []
  for (let i = 0; i < pts.length; i += step) xy.push(pts[i])
  if (xy[xy.length - 1] !== pts[pts.length - 1]) xy.push(pts[pts.length - 1])
  const c = xy.map(([, , e, km]) => `${(pad + (km / total) * (W - 2 * pad)).toFixed(1)},${(H - pad - ((e - lo) / (hi - lo)) * (H - 2 * pad)).toFixed(1)}`)
  return `<svg class="lm-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Elevation profile, ${Math.round(lo)} to ${Math.round(hi)} m over ${total.toFixed(1)} km"><polygon points="${pad},${H - pad} ${c.join(' ')} ${W - pad},${H - pad}" fill="currentColor" opacity=".15"/><polyline points="${c.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`
}

function trackHtml(t) {
  return `<p class="lm-gps">GPS track &middot; ${t.km.toFixed(1)} km &middot; ${Math.round(t.minEle)}&ndash;${Math.round(t.maxEle)} m elevation</p>${sparkline(t)}`
}

function popupHtml(p) {
  const stats = `${p.km.toFixed(1)} km &middot; ${Math.round(p.gain)} m gain${p.count > 1 ? ` (${p.count} activities)` : ''}`
  const conf = p.spot.confidence
  const real = p.spot.real
  const note = real ? '<p class="lm-note">Start position from a real GPS track (route drawn on the map). Photo frames carry no GPS.</p>' : `<p class="lm-note">Trailhead position is approximate (${esc(conf)} confidence)${p.offset ? '; nudged slightly to separate nearby pins' : ''}.</p>`
  if (p.kind === 'album') {
    const img = p.cover
      ? `<a href="#/c/${p.catalogSlug}/${p.albumSlug}"><img class="lm-cover" loading="lazy" decoding="async" alt="${esc(p.title)} cover" src="${esc(imageUrl(p.cover.thumb))}"></a>`
      : ''
    return `${img}<h3>${esc(p.title)}</h3><p>${esc(p.date)}</p><p>${stats}</p>${p.tracks[0] ? trackHtml(p.tracks[0]) : ''}${note}<a class="lm-link" href="#/c/${p.catalogSlug}/${p.albumSlug}">Open album &rarr;</a>`
  }
  return `<h3>${esc(p.title)}</h3><p>${esc(p.date)}</p><p>${stats}</p>${p.tracks[0] ? trackHtml(p.tracks[0]) : ''}<p class="lm-note">No album for this activity yet.</p>${note}`
}

export default function MapPage() {
  const el = useRef(null)
  const { pins, others } = useMemo(buildData, [])
  const trackedCount = [...pins, ...others].filter((p) => p.tracks.length).length

  useEffect(() => {
    const map = L.map(el.current, { scrollWheelZoom: true, zoomControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const all = []
    for (const p of [...others, ...pins]) {
      const color = colorFor(p.date)
      for (const t of p.tracks) {
        const ll = t.points.map((q) => [q[0], q[1]])
        const line = L.polyline(ll, { color, weight: 4, opacity: 0.9, lineJoin: 'round' }).addTo(map)
        line.bindPopup(() => popupHtml(p), { maxWidth: 260, minWidth: 220 })
        line.on('click', (e) => line.getPopup().setLatLng(e.latlng))
        ll.forEach((q) => all.push(q))
      }
      const m = L.marker([p.lat, p.lng], {
        icon: pinIcon(color, p.kind === 'activity', p.spot.real),
        title: p.title,
        keyboard: true,
        zIndexOffset: p.kind === 'album' ? 500 : 0,
      }).addTo(map)
      m.bindPopup(() => popupHtml(p), { maxWidth: 260, minWidth: 220 })
      all.push([p.lat, p.lng])
    }
    if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.12), { maxZoom: 9 })
    else map.setView([46.6, 7.5], 8)
    return () => map.remove()
  }, [pins, others])

  return (
    <section className="lm-page">
      <header className="lm-head">
        <h2>Map of everything</h2>
        <p>
          {pins.length} album pins, {others.length} other activities (small dots). {trackedCount} with a real GPS
          track (route line, ringed start marker); all other positions are approximate trailheads. The film itself has no GPS.
        </p>
        <ul className="lm-legend" aria-label="Pin colours by year">
          {Object.entries(YEAR_COLORS).map(([y, c]) => (
            <li key={y}><span style={{ background: c }} />{y}</li>
          ))}
        </ul>
      </header>
      <div ref={el} className="lm-map" role="region" aria-label="Map of hikes" />
    </section>
  )
}
