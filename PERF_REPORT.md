# Performance report: image optimization (Phase 3)

Same benchmark (`perf/run.mjs`, 5 runs, medians, cold cache, Chrome 158 / Lighthouse 11.7.1) against the
live site, before (`PERF_BASELINE.md`, commit 8d1428f) and after (`PERF_AFTER.md`, commit 062c612).

| Scenario | Before | After |
|---|---|---|
| Home: data transferred | 36.2 MB | **434 KB** |
| Home: Lighthouse mobile score / LCP | 74 / 120 s | **83 / 4.6 s** |
| Home: Lighthouse desktop score / LCP | 75 / 25.7 s | **99 / 0.94 s** |
| London grid (95 photos, scrolled to bottom): data | 399 MB | **2.9 MB** |
| London grid: mobile score / LCP | 69 / 104 s | **73 / 6.1 s** |
| Swiss album index: data | 68.8 MB | **627 KB** |
| Le Grammot album: data | 69.8 MB | **558 KB** |
| Le Grammot: mobile score / LCP | 74 / 105 s | **80 / 5.2 s** |
| Lightbox, cache cleared, open a photo (1.6 Mbps, 150 ms RTT) | 63.9 s, 4.56 MB | **1.3 s, 70 KB** |
| Lightbox, step to next photo | 0.46 s, 4.7 MB | **5 ms** (preloaded) |
| Deep link to a photo: time to image | 137.8 s | **4.3 s** |
| Deep link: Lighthouse desktop score | 57 | **97** |

Roughly 99% fewer bytes on every page. The first image appears in about 0.2 s (was 0.4 to 0.8 s).

## What is still not good enough

- **Mobile LCP is 4.6 to 6 s, target is under 2.5 s.** Lighthouse simulates Slow 4G with a 4x CPU slowdown, and the
  site still loads two Google Fonts stylesheets (render blocking), serves images from the
  rate-limited, non-CDN `pub-*.r2.dev` host, and starts images at `opacity: 0` until they decode.
- **Deep link CLS is 0.131 (mobile)**, unchanged by this work. Something shifts when the page loads straight into a photo; not yet investigated.
- Hashed JS/CSS and HTML are all served `max-age=0, must-revalidate`.
- Mobile Lighthouse score is 73 to 83, target is 90+.

## Next steps (from OPTIMIZATION_PLAN.md)

1. Self-host the fonts (subset woff2, `font-display: swap`, preload).
2. `_headers` for long-lived caching of `/assets/*`.
3. Connect `img.matassavickis.com` to the bucket (Cloudflare dashboard, needs the owner), so images are CDN-cached.
4. Find and fix the deep link layout shift; check whether the reveal animation delays LCP.
5. Re-run `node perf/run.mjs --label after-phase<N> --runs 5 --md PERF_AFTER_<N>.md` after each step.

## Phase 4: fonts, cache headers, CLS (PERF_AFTER_4.md, commit c84d84d)

Changes: self-hosted subsetted Fraunces/Inter woff2 (85 KB total, preloaded, `font-display: swap`), removed both Google
Fonts connections, `public/_headers` (`/assets/*` and `/fonts/*` immutable for a year, HTML `max-age=0`), preconnect to the image
host, above-the-fold cards/thumbs start revealed (no fade-in delay) with `fetchpriority=high`, shorter image fade (0.35 s).

| Metric (mobile Lighthouse, median of 5) | Phase 3 | Phase 4 |
|---|---|---|
| Deep link CLS | 0.131 | **0.000** (all scenarios 0.000) |
| Home score / LCP | 83 / 4.6 s | 82 / 4.8 s |
| Home FCP | n/a | 1.58 s |
| Le Grammot score / LCP | 80 / 5.2 s | 82 / 4.8 s |
| London grid score / LCP | 73 / 6.1 s | 78 / 5.8 s |
| Deep link score / LCP | n/a / 4.3 s | 79 / 5.5 s |

Result: the layout shift is gone (it was the Google Fonts swap) and `/assets/*` is now cached for a year. Mobile LCP did not
move materially: it is dominated by downloading the first image from the rate-limited `r2.dev` host on simulated 4G, so the
remaining fix is the `img.matassavickis.com` CDN domain (needs the Cloudflare dashboard). Mobile score is still 78 to 82 (target 90+).

## Phase 5: manifest split per catalog (PERF_AFTER_5.md, commit 157d7fa)

Changes: `scripts/index.mjs` now also writes `src/generated/index.json` (13.5 KB: catalogs, albums, counts, covers) and one slimmed
`src/generated/catalogs/<slug>.json` per catalog. The app loads a catalog's photos only when a photo grid or the lightbox needs them
(home and a catalog's album cards need only the index), with a 3:2 skeleton grid while loading. Old links with the wrong catalog are
still redirected to the photo's real home. The `#/lab/*` pages still use the full `manifest.json`, now in their own lazy chunk.

| Metric | Phase 4 | Phase 5 |
|---|---|---|
| Main JS bundle (raw / gzip) | 554.9 KB / 90.7 KB | **195.6 KB / 62.4 KB** |
| Swiss album index, cold transfer | 596 KB | **412 KB** |
| Home, cold transfer | 403 KB | 385 KB |
| Mid album, cold transfer | 527 KB | 517 KB |
| Deep link, cold transfer | 881 KB | 871 KB |
| Mobile Lighthouse home / album index / album / deep link | 82 / 80 / 82 / 79 | 83 / 82 / 82 / 80 |
| Mobile LCP home | 4.8 s | 4.7 s |

Per-catalog chunks are small once compressed (Swiss, the largest, is 129 KB raw / 8.6 KB gzip), and the main bundle no longer grows with
every photo added. Mobile LCP is still set by the first image on the rate-limited `r2.dev` host, so the score is only 1-2 points up.
Verified live: home, album grid, lightbox open/next/close, cold deep link, wrong-catalog and unknown-id links, date filter, lab strip page,
no console errors.
