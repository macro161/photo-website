import { useEffect, useState } from 'react'

/**
 * Below-the-fold photos wait for the photos on screen.
 *
 * Native loading="lazy" starts fetching everything within ~1250-2500 px of the viewport at once, so on a slow connection a
 * dozen images compete with the one that fills the first screen (the LCP image). Here only that one image (the largest on the
 * first screen) loads at once; every other photo starts after it has been painted (or after a short fallback delay, or at the
 * first scroll/touch), and then only when it is near the viewport.
 */
let open = false
const waiting = new Set()
let armed = false

function release() {
  if (open) return
  open = true
  waiting.forEach((fn) => fn())
  waiting.clear()
}

/**
 * Call when the main first-screen image (the LCP candidate) has loaded: the rest may start once it has been painted.
 * The browser reports that paint as a largest-contentful-paint entry for an image; without that API, a couple of frames later.
 */
export function firstScreenLoaded() {
  if (open) return
  let seen = false
  try {
    const po = new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.url)) {
        seen = true
        po.disconnect()
        setTimeout(release, 0)
      }
    })
    po.observe({ type: 'largest-contentful-paint', buffered: true })
    setTimeout(() => { if (!seen) { po.disconnect(); release() } }, 1000)
  } catch {
    requestAnimationFrame(() => requestAnimationFrame(release))
  }
}

/** Runs `fn` as soon as below-the-fold images may start loading; returns a cleanup function. */
export function whenGateOpen(fn) {
  if (open) {
    fn()
    return () => {}
  }
  waiting.add(fn)
  if (!armed && typeof window !== 'undefined') {
    armed = true
    // Fallbacks so a failed or very slow first image never holds the rest back.
    const events = ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown']
    const go = () => {
      events.forEach((e) => window.removeEventListener(e, go))
      release()
    }
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }))
    setTimeout(release, 3000)
  }
  return () => waiting.delete(fn)
}

/** True once below-the-fold work may start (first-screen image painted, or the fallbacks fired). Pass `now` to skip the wait. */
export function useAfterFirstScreen(now = false) {
  const [ok, setOk] = useState(open || now)
  useEffect(() => {
    if (ok) return undefined
    return whenGateOpen(() => setOk(true))
  }, [ok])
  return ok || now
}
