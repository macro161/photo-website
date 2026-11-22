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
 * Opens on the browser's largest-contentful-paint entry for an image when that arrives, and at the latest 600 ms after
 * the call (time to decode, fade in and paint), so a missing entry can never hold the page back.
 */
export function firstScreenLoaded() {
  if (open) return
  let po = null
  const go = () => {
    po?.disconnect()
    release()
  }
  try {
    po = new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.url)) setTimeout(go, 0)
    })
    po.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    po = null
  }
  setTimeout(go, 600)
}

/** True once below-the-fold work has been released. */
export const gateIsOpen = () => open

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
    // Only real input counts: a programmatic scroll (the page resetting its scroll position) must not open the gate early.
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    const go = (e) => {
      if (e && e.isTrusted === false) return
      events.forEach((n) => window.removeEventListener(n, go))
      release()
    }
    events.forEach((e) => window.addEventListener(e, go, { passive: true }))
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
