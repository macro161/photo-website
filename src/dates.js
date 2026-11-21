/**
 * Album/catalog dates and the date-range filter.
 *
 * src/albumDates.json maps "catalogSlug" and "catalogSlug/albumSlug" to
 * { start, end (ISO dates, or null), approx, source, hike? }. Film has no
 * reliable per-photo dates, so dates live at album level.
 */
import raw from './albumDates.json'

export const DATES = raw

export function dateFor(catalogSlug, albumSlug) {
  // An album with no date of its own stays undated (it must not borrow the catalog's range).
  const entry = DATES[albumSlug ? `${catalogSlug}/${albumSlug}` : catalogSlug]
  return entry && entry.start ? entry : null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m - 1, d }
}
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** "28 Jun 2026", "6–8 Mar 2026", "28 Feb – 3 Mar 2026", "Jun 2026" (whole month). */
export function formatRange(entry) {
  if (!entry || !entry.start) return ''
  const a = parts(entry.start)
  const b = parts(entry.end || entry.start)
  const sameMonth = a.y === b.y && a.m === b.m
  const wholeMonth = sameMonth && a.d === 1 && b.d === lastDay(b.y, b.m)
  let text
  if (wholeMonth) text = `${MONTHS[a.m]} ${a.y}`
  else if (a.y === b.y && sameMonth && a.d === b.d) text = `${a.d} ${MONTHS[a.m]} ${a.y}`
  else if (sameMonth) text = `${a.d}–${b.d} ${MONTHS[a.m]} ${a.y}`
  else if (a.y === b.y) text = `${a.d} ${MONTHS[a.m]} – ${b.d} ${MONTHS[b.m]} ${a.y}`
  else text = `${a.d} ${MONTHS[a.m]} ${a.y} – ${b.d} ${MONTHS[b.m]} ${b.y}`
  return entry.approx && !wholeMonth ? `c. ${text}` : text
}

function hikes(entry) {
  if (!entry || !entry.hike) return []
  return Array.isArray(entry.hike) ? entry.hike : [entry.hike]
}

/** "13.7 km · +1,198 m", summed when an album covers several hikes. */
export function formatHike(entry) {
  const list = hikes(entry)
  if (!list.length) return ''
  const km = list.reduce((s, h) => s + (h.km || 0), 0)
  const gain = list.reduce((s, h) => s + (h.gain || 0), 0)
  return `${km.toFixed(1)} km · +${gain.toLocaleString('en-US')} m`
}

/** Does the entry's range overlap [from, to]? Open ends are unbounded. */
export function inRange(entry, from, to) {
  if (!from && !to) return true
  if (!entry || !entry.start) return false
  const end = entry.end || entry.start
  if (from && end < from) return false
  if (to && entry.start > to) return false
  return true
}

/** Years covered by the given entries, newest first (for the year shortcuts). */
export function yearsFor(entries) {
  const years = new Set()
  for (const e of entries) {
    if (!e || !e.start) continue
    for (let y = +e.start.slice(0, 4); y <= +(e.end || e.start).slice(0, 4); y++) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

/** Sort entries (anything with a `date`) by date; undated entries always go last. */
export function sortByDate(list, dir) {
  const key = (x) => x.date && x.date.start
  return [...list].sort((a, b) => {
    if (!key(a) || !key(b)) return key(a) ? -1 : key(b) ? 1 : 0
    if (dir === 'oldest') {
      return a.date.start < b.date.start ? -1 : a.date.start > b.date.start ? 1 : (a.date.end || a.date.start) < (b.date.end || b.date.start) ? -1 : 1
    }
    const ea = a.date.end || a.date.start
    const eb = b.date.end || b.date.start
    return ea < eb ? 1 : ea > eb ? -1 : a.date.start < b.date.start ? 1 : -1
  })
}
