/**
 * Optional film roll info from src/rolls.json (see README, "Film roll info").
 * Nothing renders when there is no entry, so the site looks the same until you fill some in.
 */
import raw from './rolls.json'

const FIELDS = ['film', 'camera', 'lens', 'iso', 'lab', 'notes']
const get = (key) => (key.startsWith('_') ? null : raw[key] || null)
const clean = (o) => Object.fromEntries(FIELDS.filter((f) => o[f] != null && o[f] !== '').map((f) => [f, o[f]]))

/** Merged info for a catalog, an album, or a photo (most specific wins); {} when unknown. */
export function rollInfo(catalogSlug, albumSlug, photoId) {
  return clean({
    ...get(catalogSlug),
    ...(albumSlug ? get(`${catalogSlug}/${albumSlug}`) : null),
    ...(photoId ? get(photoId) : null),
  })
}

/** Short line like "Kodak Portra 400 · ISO 400 · Nikon FM2 · 50mm f/1.8"; '' when nothing is set. */
export function rollLine(info) {
  const bits = [info.film, info.iso && `ISO ${info.iso}`, info.camera, info.lens, info.lab]
  return bits.filter(Boolean).join(' · ')
}
