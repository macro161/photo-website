import { useState } from 'react'
import activities from '../activities.json'
import hikeAlbums from '../hikeAlbums.json'
import manifest from '../../generated/manifest.json'
import { imageUrl } from '../../imageUrl.js'
import '../strip/strip.css'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const fmtDate = (d) => { const [y, m, day] = d.split('-'); return `${+day} ${MONTHS[+m - 1]} ${y}` }
const fmtTime = (min) => `${Math.floor(min / 60)}H${String(min % 60).padStart(2, '0')}`
const fmtGain = (g) => `+${g.toLocaleString('en-US')} M`
const searchUrl = (t) => `https://www.alltrails.com/search?q=${encodeURIComponent(t)}`

const byN = new Map(activities.map((a) => [a.n, a]))

const strips = Object.entries(hikeAlbums).map(([key, ns]) => {
  const [catalogSlug, albumSlug] = key.split('/')
  const photos = manifest.filter((p) => p.catalogSlug === catalogSlug && p.albumSlug === albumSlug)
  const acts = ns.map((n) => byN.get(n)).filter(Boolean)
  return { key, catalogSlug, albumSlug, photos, acts, album: photos[0]?.album || albumSlug }
}).filter((s) => s.acts.length)

function edgeText(acts) {
  const one = acts
    .map((a) => `${a.km} KM · ${fmtGain(a.gain)} · ${fmtTime(a.minutes)} · ${fmtDate(a.date)} · ${a.title.toUpperCase()}`)
    .join('  ▸  ')
  return Array(8).fill(one).join('   ◂▸   ')
}

function Strip({ s }) {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((o) => !o)
  const text = edgeText(s.acts)
  return (
    <div className="fs-item">
      <div
        className="fs-strip"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${s.album}: ${open ? 'hide' : 'show'} details`}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
      >
        <div className="fs-track">
          <div className="fs-holes" />
          <div className="fs-edge" aria-hidden="true">{text}</div>
          <div className="fs-frames">
            {s.photos.length === 0 && <div className="fs-empty">NO FRAMES SCANNED</div>}
            {s.photos.map((p) => (
              <div className="fs-cell" key={p.id}>
                <div className="fs-frame">
                  <img src={imageUrl(p.thumb)} alt={p.description || ''} loading="lazy" decoding="async" draggable="false" />
                </div>
              </div>
            ))}
          </div>
          <div className="fs-nums" aria-hidden="true">
            {s.photos.map((p, i) => <span key={p.id}>{i + 1} ▸ {i + 1}A</span>)}
          </div>
          <div className="fs-holes" />
        </div>
      </div>
      {open && (
        <div className="fs-panel">
          <h3>{s.album}</h3>
          {s.acts.map((a) => (
            <div key={a.n}>
              <div className="fs-act">
                <strong>{a.title}</strong>
                <dl>
                  <div><dt>Distance</dt><dd>{a.km} km</dd></div>
                  <div><dt>Gain</dt><dd>{a.gain.toLocaleString('en-US')} m</dd></div>
                  <div><dt>Time</dt><dd>{fmtTime(a.minutes)}</dd></div>
                  <div><dt>Date</dt><dd>{fmtDate(a.date)}</dd></div>
                </dl>
              </div>
              <p className="fs-note"><a href={searchUrl(a.title)} target="_blank" rel="noreferrer">Search AllTrails for this title</a> (search link, not a verified trail page)</p>
            </div>
          ))}
          <div className="fs-links">
            <a href={`#/c/${s.catalogSlug}/${s.albumSlug}`}>Open album ({s.photos.length} frames)</a>
          </div>
          <p className="fs-note">Activity-to-album matches are unverified guesses. Frame numbers are scan order, not the roll's real numbering.</p>
        </div>
      )}
    </div>
  )
}

export default function StripPage() {
  return (
    <section className="fs-page">
      <h2>Film-edge stat strips</h2>
      <p className="fs-intro">Each hike album as a strip of negatives, with its stats printed along the edge. Scroll a strip sideways; tap it for details.</p>
      {strips.map((s) => <Strip key={s.key} s={s} />)}
    </section>
  )
}
