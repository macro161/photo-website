/**
 * Checks that the first-screen preload hints pick the same main image as the Gallery layout, for every photo grid on the site
 * and phone-to-desktop widths. Run after `npm run index`: node scripts/check-hints.mjs
 * (Compares the layout with exact aspect ratios against the table's ratios rounded to 4 decimals.)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { layoutBoxes, galleryWidth, ratioOf } from '../src/layout.js'

const dir = new URL('../src/generated/catalogs/', import.meta.url)
const hike = JSON.parse(readFileSync(new URL('../src/lab/hikeAlbums.json', import.meta.url), 'utf8'))
let checked = 0
let bad = 0
for (const f of readdirSync(dir)) {
  const photos = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
  const lists = new Map()
  for (const p of photos) {
    const k = p.albumSlug ? `${p.catalogSlug}/${p.albumSlug}` : p.catalogSlug
    if (!lists.has(k)) lists.set(k, [])
    lists.get(k).push(p)
  }
  for (const [key, list] of lists) {
    const exact = list.map(ratioOf)
    const rounded = exact.map((r) => Math.round(r * 10000) / 10000)
    const gs = hike[key] ? 2.3 : 1
    for (let vw = 320; vw <= 1920; vw += 8) {
      const a = layoutBoxes(exact, galleryWidth(vw), gs, vw).critical
      const b = layoutBoxes(rounded, galleryWidth(vw), gs, vw).critical
      checked++
      if (a !== b) {
        bad++
        console.log('MISMATCH', key, vw, a, b)
      }
      if (a >= 12) console.log('critical beyond the 12 stored photos', key, vw, a)
    }
  }
}
console.log(`${checked} layouts checked, ${bad} mismatches`)
process.exit(bad ? 1 : 0)
