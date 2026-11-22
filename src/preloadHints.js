/**
 * First-screen preload hints. Everything the first screen needs is otherwise discovered late: the page's JS has to download and run
 * before React renders the grid and the browser learns which image to fetch. The build (vite.config.js) computes, for every
 * route, the image that will be the main one on the first screen (see src/firstScreenTable.js) and inlines this code plus that table
 * into index.html, so the image (and the catalog's photo list) start downloading together with the JS.
 *
 * `run()` is bundled into an inline <script>. The choices here must match what the app renders: same sort order, same
 * layout (src/layout.js), same srcset/sizes as <Picture>, otherwise the preloaded file is simply not used.
 */
import { layoutBoxes, galleryWidth } from './layout.js'

const CARD_SIZES = '(max-width: 700px) 100vw, 480px'

/** [file, v, widths] -> the srcset <Picture> builds for AVIF (widths up to 1600, as in imageUrl.js). */
function avifSrcSet(base, [file, v, w]) {
  if (!w.length) return ''
  const all = [...w].sort((a, b) => a - b)
  const inside = all.filter((x) => x <= 1600)
  const use = inside.length ? inside : [all[0]]
  const path = encodeURI(file.replace(/\.[^.]+$/, ''))
  return use.map((x) => `${base}/generated/${x}/${path}.avif${v ? `?v=${v}` : ''} ${x}w`).join(', ')
}

/** Which links to add for `hash` ("#/c/london-2026"): { images: [{srcset, sizes}], modules: [href] }. Pure, for testing. */
export function hintsFor(table, hash, viewportWidth, sortDir) {
  const out = { images: [], modules: [] }
  const filtered = hash.includes('?')
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean)
  const lightbox = parts.includes('p')
  const key = (lightbox ? parts.slice(0, parts.indexOf('p')) : parts).join('/')
  const r = table.routes[key]
  if (!r) return out
  if (r.m) out.modules.push(r.m)
  if (filtered || lightbox) return out
  if (r.k === 'c') {
    const p = r[sortDir === 'oldest' ? 'o' : 'n']
    if (p && p[2].length) out.images.push({ srcset: avifSrcSet(table.base, p), sizes: CARD_SIZES })
  } else if (r.k === 'g') {
    const { boxes, critical } = layoutBoxes(r.r.map((x) => x / 10000), galleryWidth(viewportWidth), r.gs || 1, viewportWidth)
    if (critical >= 0 && r.p[critical] && r.p[critical][2].length) out.images.push({ srcset: avifSrcSet(table.base, r.p[critical]), sizes: `${Math.ceil(boxes[critical].w)}px` })
  }
  return out
}

/** Runs in the page head: adds <link rel=preload> / <link rel=modulepreload> for this route. */
export function run(table) {
  try {
    let sortDir = 'newest'
    try {
      sortDir = localStorage.getItem('sortDir') === 'oldest' ? 'oldest' : 'newest'
    } catch (e) {
      /* storage blocked: default order */
    }
    const h = hintsFor(table, location.hash, document.documentElement.clientWidth, sortDir)
    const add = (attrs) => {
      const l = document.createElement('link')
      for (const k in attrs) l.setAttribute(k, attrs[k])
      document.head.appendChild(l)
    }
    h.images.forEach((i) => add({ rel: 'preload', as: 'image', type: 'image/avif', imagesrcset: i.srcset, imagesizes: i.sizes, fetchpriority: 'high' }))
    h.modules.forEach((m) => add({ rel: 'modulepreload', href: m }))
  } catch (e) {
    /* hints are an optimisation only */
  }
}
