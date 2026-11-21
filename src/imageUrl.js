/**
 * Where the optimized web images are served from.
 *
 * The manifest stores site-relative paths ("/generated/foo.webp"). In a
 * production build those files live in a Cloudflare R2 bucket rather than in
 * the deployed site, so we prefix them with `imageBaseUrl` from
 * site.config.json.
 *
 * During `npm run dev` the prefix is empty, so the copies in
 * public/generated/ are served straight off your own machine — the gallery
 * works offline and shows photos before you've uploaded them. Set
 * VITE_IMAGE_BASE to override either default.
 */
import config from '../site.config.json'

const configured =
  import.meta.env.VITE_IMAGE_BASE ??
  (import.meta.env.DEV ? '' : config.imageBaseUrl ?? '')

const BASE = configured.replace(/\/+$/, '')

export function imageUrl(pathname) {
  return BASE ? BASE + pathname : pathname
}

/* ---------- Web-sized variants (see scripts/optimize.mjs) ----------
 * The manifest gives each optimized photo `w` (available widths) and `c` (average colour).
 * Photos without `w` simply use the original file, so this can roll out gradually.
 */
const stripExt = (key) => key.replace(/\.[^.]+$/, '')

export const hasVariants = (photo) => Array.isArray(photo.w) && photo.w.length > 0

export function variantUrl(photo, width, fmt) {
  // `v` is a cache-bust version, set in variants.json when a photo's pixels were replaced (e.g. rotated),
  // because variants are served with an immutable one-year cache.
  const v = photo.v ? `?v=${photo.v}` : ''
  return imageUrl(`/generated/${width}/${encodeURI(stripExt(photo.file))}.${fmt}${v}`)
}

/** Widths of a photo within [min, max]; always at least the closest one available. */
export function widthsBetween(photo, min, max) {
  const all = [...photo.w].sort((a, b) => a - b)
  const inside = all.filter((w) => w >= min && w <= max)
  if (inside.length) return inside
  return [all.find((w) => w >= min) ?? all[all.length - 1]]
}

export function srcSet(photo, fmt, min = 0, max = Infinity) {
  return widthsBetween(photo, min, max)
    .map((w) => `${variantUrl(photo, w, fmt)} ${w}w`)
    .join(', ')
}

/** Largest available width not above `max` (fallback `src` for <img>). */
export function widthAtMost(photo, max) {
  const ok = photo.w.filter((w) => w <= max)
  return ok.length ? Math.max(...ok) : Math.min(...photo.w)
}

let avifSupport
/** Resolves true if this browser can decode AVIF (used so preloads fetch the same format). */
export function supportsAvif() {
  if (!avifSupport) {
    avifSupport = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.width > 0)
      img.onerror = () => resolve(false)
      img.src =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='
    })
  }
  return avifSupport
}
