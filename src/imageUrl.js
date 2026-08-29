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
