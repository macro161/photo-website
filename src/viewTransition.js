/**
 * Thumbnail <-> lightbox morph using the View Transitions API.
 *
 * Only one element at a time carries `view-transition-name: photo`: the grid
 * thumbnail in the "old" snapshot and the lightbox image in the "new" one (or
 * the reverse on close), so names never collide. Without API support, with
 * reduced motion, or when there is no source thumbnail on screen (deep links,
 * shuffle, a photo stepped to that is scrolled out of view) the update simply
 * runs as before.
 */
const NAME = 'photo'
const WAIT_MS = 220 // longest we hold the old frame while the new one gets ready

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const supported = () => typeof document.startViewTransition === 'function' && !reduced()

/** The grid's image for a photo, but only if it is loaded and actually visible. */
export function gridImage(id) {
  const btn = document.querySelector(`.thumb[data-photo-id="${CSS.escape(id)}"]`)
  const img = btn?.querySelector('img')
  if (!btn || !img || !img.complete || !img.naturalWidth || !btn.classList.contains('revealed')) return null
  const r = btn.getBoundingClientRect()
  if (r.bottom <= 0 || r.top >= window.innerHeight || r.width === 0) return null
  return img
}

/**
 * Resolves with `find()`'s result once it is truthy (checked on each DOM
 * mutation), or with null after `ms`. Uses a MutationObserver rather than
 * requestAnimationFrame, which does not run while a transition holds rendering.
 */
function waitFor(find, ms) {
  return new Promise((resolve) => {
    const hit = find()
    if (hit) return resolve(hit)
    let timer
    const mo = new MutationObserver(() => {
      const el = find()
      if (el) finish(el)
    })
    const finish = (el) => {
      mo.disconnect()
      clearTimeout(timer)
      resolve(el)
    }
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    timer = setTimeout(() => finish(find() || null), ms)
  })
}

const withDeadline = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))])

function run(from, update, prepareTarget) {
  from.style.viewTransitionName = NAME
  let target = null
  const vt = document.startViewTransition(async () => {
    from.style.viewTransitionName = ''
    update()
    target = await prepareTarget()
    if (target) target.style.viewTransitionName = NAME
  })
  const clear = () => {
    from.style.viewTransitionName = ''
    if (target) target.style.viewTransitionName = ''
  }
  vt.finished.then(clear, clear)
  vt.ready?.catch(() => {}) // a skipped transition is not an error
}

/** Placeholder hand-off: the exact file the grid shows is already decoded, so the lightbox can start from it. */
export const gridSources = new Map()

export function openPhoto(id, update) {
  const from = gridImage(id)
  if (from?.currentSrc) gridSources.set(id, from.currentSrc)
  if (!from || !supported()) return update()
  const start = performance.now()
  run(from, update, async () => {
    const stack = await waitFor(() => document.querySelector(`.lb-stack[data-photo-id="${CSS.escape(id)}"]`), WAIT_MS)
    if (!stack) return null
    const left = () => Math.max(0, WAIT_MS - (performance.now() - start))
    // Prefer the sharp full image if it is ready in time; otherwise the placeholder (the grid's own file).
    const full = await waitFor(() => stack.querySelector('img.lb-full:not(.pending)'), left())
    if (full) full.style.animation = 'none' // already fully shown; don't replay its fade inside the morph
    else {
      const ph = stack.querySelector('img.lb-thumb')
      if (ph?.decode) await withDeadline(ph.decode().catch(() => {}), left())
    }
    return stack
  })
}

export function closePhoto(id, update) {
  const from = document.querySelector('.lightbox .lb-stack')
  if (!from || !supported() || !document.querySelector(`.thumb[data-photo-id="${CSS.escape(id)}"]`)) return update()
  run(from, update, async () => {
    const gone = await waitFor(() => !document.querySelector('.lightbox') && document.body, WAIT_MS)
    return gone ? gridImage(id) : null
  })
}
