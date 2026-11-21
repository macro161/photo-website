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
