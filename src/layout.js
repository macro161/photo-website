/**
 * Photo-grid layout shared by the Gallery component and the build-time first-screen preload hints
 * (src/preloadHints.js): rows of frames at their true aspect ratios, and which frame is the main (LCP) one on the first screen.
 * Pure functions only: no DOM, so they also run in the inline script in index.html.
 */

/** Matches the old column gutter: clamp(12px, 2vw, 26px). */
export const gutter = (viewportWidth) => Math.min(26, Math.max(12, viewportWidth * 0.02))
export const targetHeight = (w) => (w < 560 ? 230 : w < 1000 ? 260 : 320)

/** Width of the grid container for a page `viewportWidth` px wide (main's max-width 1440 and its horizontal padding clamp(20px, 5vw, 64px)). */
export const galleryWidth = (viewportWidth) => {
  const pad = Math.min(64, Math.max(20, viewportWidth * 0.05))
  return Math.min(viewportWidth, 1440) - 2 * pad
}

export const ratioOf = (p) => (p.width && p.height ? p.width / p.height : 1.5)

/**
 * Splits `ratios` into rows for a container `width` px wide. Dynamic
 * programming over break points: cost is the squared deviation of each row's
 * height from the target, so rows stay even instead of greedy-filled. The last
 * row is free as long as it doesn't have to shrink below the target.
 */
export function justify(ratios, width, gap, target) {
  const n = ratios.length
  if (!n || width <= 0) return []
  const maxPer = Math.max(1, Math.ceil(width / (target * 0.5)))
  const cost = new Array(n + 1).fill(Infinity)
  const from = new Array(n + 1).fill(0)
  cost[0] = 0
  for (let j = 1; j <= n; j++) {
    let sum = 0
    for (let i = j - 1; i >= 0 && j - i <= maxPer; i--) {
      sum += ratios[i]
      const h = (width - gap * (j - i - 1)) / sum
      const last = j === n
      const dev = last && h >= target ? 0 : (h - target) / target
      const c = cost[i] + dev * dev
      if (c < cost[j]) {
        cost[j] = c
        from[j] = i
      }
    }
  }
  const rows = []
  for (let j = n; j > 0; j = from[j]) rows.push([from[j], j])
  rows.reverse()
  return rows.map(([i, j], k) => {
    const sum = ratios.slice(i, j).reduce((a, b) => a + b, 0)
    let h = (width - gap * (j - i - 1)) / sum
    const last = k === rows.length - 1
    if (last && h > target) h = target
    return { start: i, end: j, height: h }
  })
}

/**
 * Absolute boxes for every frame, plus `critical`: the largest frame that starts on the first screen (the LCP candidate).
 * The first screen is taken to be the first two rows: the grid starts 300-350 px down the page (header, title, dates), so on a phone
 * the second row ends near the fold and a third row is not on screen. (The row rule needs no DOM measurement, so the build-time
 * hints and the component always agree.)
 */
export const FIRST_SCREEN_ROWS = 2
export function layoutBoxes(ratios, width, gutterScale, viewportWidth) {
  const gap = width ? Math.round(gutter(viewportWidth) * gutterScale) : 0
  const rows = justify(ratios, width, gap, targetHeight(width))
  const boxes = new Array(ratios.length)
  let top = 0
  let critical = -1
  let criticalArea = 0
  rows.forEach((row, r) => {
    let left = 0
    for (let i = row.start; i < row.end; i++) {
      const w = ratios[i] * row.height
      boxes[i] = { left, top, w, h: row.height, priority: false }
      if (r < FIRST_SCREEN_ROWS && w * row.height > criticalArea) {
        critical = i
        criticalArea = w * row.height
      }
      left += w + gap
    }
    top += row.height + gap
  })
  if (critical >= 0) boxes[critical].priority = true
  return { boxes, height: rows.length ? top - gap : 0, critical }
}
