/**
 * Builds src/swissPlaces.json: where each Swiss album is on the map (#/c/swiss, Map view).
 *   node scripts/build-swiss-places.mjs
 * Hike albums (src/lab/hikeAlbums.json) get the start of their recording from src/route/<slug>/detail.json.
 * Other albums are listed by hand in MANUAL below, only where the place is verified (coordinates from OpenStreetMap).
 * Albums that mix several places (Tour de l'Argentine + Lavaux, Rochers de Naye + Argentine, Black Forest + Valsorey, Random)
 * are left out on purpose until they are split.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const MANUAL = {
  // Album shows the Euseigne earth pyramids and the Hérens cow-fight arena (see PHOTO_CONTEXT.md); OSM node "Euseigne".
  'cow-fights': { lat: 46.1721, lng: 7.4236, kind: 'place', note: 'Euseigne, Val d\'Hérens' },
  // The album is named after the Jura summit; OSM peak node "Hasenmatt" (1445 m).
  hasenmatt: { lat: 47.2422, lng: 7.451, kind: 'place', note: 'Hasenmatt summit, Jura' },
}

const hikes = JSON.parse(readFileSync('src/lab/hikeAlbums.json', 'utf8'))
const index = JSON.parse(readFileSync('src/generated/index.json', 'utf8'))
const swiss = index.find((c) => c.slug === 'swiss')
const out = {}
for (const [key] of Object.entries(hikes)) {
  const [cat, slug] = key.split('/')
  if (cat !== 'swiss') continue
  const d = JSON.parse(readFileSync(`src/route/${slug}/detail.json`, 'utf8'))
  const start = d.labels.find((l) => l.key === 'start') || { lat: d.tracks[0].points[0][0], lng: d.tracks[0].points[0][1] }
  out[slug] = {
    label: swiss.albums.find((a) => a.slug === slug)?.name || slug,
    kind: 'hike',
    lat: +start.lat.toFixed(4), lng: +start.lng.toFixed(4),
    km: +d.tracks.reduce((s, t) => s + t.stats.km, 0).toFixed(1),
    gain: d.tracks.reduce((s, t) => s + t.stats.gain, 0),
    date: d.tracks[0].start.slice(0, 10),
  }
}
for (const [slug, p] of Object.entries(MANUAL)) {
  out[slug] = { label: swiss.albums.find((a) => a.slug === slug)?.name || slug, ...p }
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync('src/swissPlaces.json', JSON.stringify(sorted, null, 1) + '\n')
console.log(Object.keys(sorted).length, 'places;', swiss.albums.filter((a) => !sorted[a.slug]).map((a) => a.slug).join(', '), 'have no pin')
