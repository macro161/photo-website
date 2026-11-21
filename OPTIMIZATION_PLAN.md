# Website optimization plan

Status: **plan only, nothing has been changed yet.** Drafted 2026-11-21.

**Scope:** the existing, working site: catalog index, catalog/album grids, lightbox, about page,
deep links. The `#/lab/*` experiments are out of scope (they are lazy-loaded, so they do not
affect the main bundle) and must keep working.

**Goal:** make the site load much faster while the photos still look good, and prove it with
the same measurements before and after.

## 1. What we found (measured 2026-11-21, read-only)

| Finding | Number |
|---|---|
| Photos in the manifest | 620, all JPEG |
| Total size in `photos-web` | **2.7 GB** |
| Median / max file | 4.6 MB / 7.0 MB |
| Long edge (min / median / max) | 2433 / 3587 / 4570 px |
| `src` and `thumb` | the same file, so grid thumbnails are full 3-7 MB scans |
| Biggest catalogs | Swiss 247 photos (1.1 GB), London 95 (0.4 GB), 30th Birthday 65 (0.34 GB) |
| Image host | `pub-*.r2.dev`: rate-limited, not CDN-cached (DEPLOY.md says so); response has no `Cache-Control` |
| Site host | Cloudflare Workers/Pages; HTML and the hashed JS/CSS both served `max-age=0, must-revalidate` |
| Main JS bundle | 402 KB raw (about 73 KB gzipped); includes the 288 KB (16 KB gz) manifest |
| Fonts | Google Fonts (Fraunces + Inter): two third-party connections, render-blocking CSS |
| `photos-originals` bucket | exists (private), so full-resolution archives are safe to keep |

"Raw" images here are 3600 px JPEG scans, not camera RAW. Opening one catalog such as Swiss
can ask the browser for hundreds of MB, so image weight dominates everything else. The JS and
font work is small by comparison.

## 2. Measure first (Phase 0)

Run the same benchmark before any change and after each phase, on the same machine. Record the
results in `PERF_BASELINE.md` and tag the commit that was measured.

**Tooling:** Lighthouse CLI (add as a dev dependency, mobile preset with simulated 4G + 4x CPU
slowdown, plus a desktop run) driving the installed Chrome. A small Playwright or Chrome-DevTools
script adds what Lighthouse can't: total transferred bytes and image request count per
scenario. 5 runs each, report the median. Warm and cold cache are both recorded.

**Scenarios (all on the live site, and again on a local build for A/B):**
1. Home / catalog index (`#/`)
2. Largest grid: `#/c/swiss` (247 photos), scrolled to the bottom
3. A mid album: e.g. `#/c/swiss/le-grammot`
4. Lightbox: open a photo, time to full image; step to the next photo
5. Deep link straight to a photo (`#/c/.../p/<id>`)

**Metrics:** LCP, CLS, TBT/INP, Lighthouse performance score, total bytes transferred, image
bytes, number of requests, time until the first photo is visible, time until the lightbox
image is sharp. Note that LCP on the r2.dev host is noisy because of rate limits, so we also
record the median of repeated runs.

**Budgets (targets, to be confirmed after the baseline):**
- Home page: under 1.5 MB transferred
- Initial view of any grid: under 3 MB; scrolling the full Swiss grid under about 25 MB
- Lightbox image: 300-500 KB
- Mobile LCP under 2.5 s on simulated 4G; CLS under 0.05; Lighthouse mobile score 90+

## 3. The work, in order of impact

### A. Image pipeline (the big win)

1. **Derivatives, not the originals.** Generate from the full-resolution originals (Google Drive
   is the source of truth, `photos-originals` is the private archive):
   - grid thumbnail: 480 and 960 px wide
   - lightbox: 1600 px wide (main view), 2400 px only for zoom on large screens
   - tiny blurred placeholder (about 20 px, inlined in the manifest) or a dominant colour
2. **Format.** AVIF as the main format with WebP as the fallback, served through `<picture>` or
   `srcset` with `type`. Film grain compresses badly, so quality needs a test, not a guess:
   encode about 12 representative frames (night shots, high-grain, portraits, landscapes) at a
   quality ladder, compare side by side at 100% and look for smearing of grain and banding in
   skies. Expected result: about 80-95% smaller than today (roughly 150-300 KB for a 1600 px
   lightbox image, 40-120 KB for a thumbnail).
3. **Pipeline script** (`npm run optimize`), idempotent and cached by content hash: reads originals,
   honours EXIF orientation, converts to sRGB, strips metadata, writes derivatives to
   `photos-web/generated/<width>/<key>.<ext>`. `scripts/index.mjs` already ignores the
   `generated/` prefix, so derivatives won't appear as catalogs.
4. **Manifest.** Add widths/variants and the placeholder per photo; keep `src` for the original
   path so old links still resolve. Drop unused fields (`size`, `modTime`, null captions) from what
   ships to the browser.
5. **Safe migration:** additive first. Upload derivatives next to the originals, switch the
   manifest, verify, and only then consider removing the originals from the public bucket (they
   stay in `photos-originals`). Rollback is reverting the manifest commit.
6. **Pilot** on one small catalog (Netherlands Breda 2026, 21 photos) before running all 620.

### B. Image delivery

- Connect the custom domain `img.matassavickis.com` to `photos-web` (planned in DEPLOY.md) so
  images go through Cloudflare's CDN cache instead of the rate-limited r2.dev URL; update
  `imageBaseUrl`.
- Cache rule: derivatives get `Cache-Control: public, max-age=31536000, immutable`. They are
  content-addressed by key, so a changed image gets a new name.
- Alternative to pre-generating: Cloudflare Image Transformations. Simpler, but metered
  (free tier is limited), so pre-generation is the default recommendation.

### C. Front end (existing features only)

- `srcset` + `sizes` in the grid and the catalog cards, matched to the real CSS column counts.
- Show the placeholder first, then fade the real image in (replaces today's empty box).
- Loading priority: the first row of images and the covers load eagerly (`fetchpriority="high"` for
  the likely LCP image); everything else stays lazy. Check whether the scroll-reveal animation
  delays LCP, because images start at `opacity: 0` until they load.
- Lightbox: load the 1600 px version, keep preloading the neighbours (already in the new
  lightbox), fetch 2400 px only when the user zooms.
- Self-host the two fonts as subsetted `woff2` with `font-display: swap` and a preload; remove the
  Google Fonts connections.
- Add a `_headers` file: `/assets/*` immutable for a year (filenames are hashed), HTML short.
- Manifest: split per catalog and load on demand if the slimmed file is still large after A.
- `preconnect` to the image origin.

### D. Verify, then report

- Re-run the full Phase 0 benchmark after each phase and compare against the baseline.
- Visual QA page: original vs. derivative side by side for a sample from every catalog, checked at
  100% zoom on a desktop and a phone, looking at grain, shadows, skies and colour.
- Check the lightbox on touch devices and the deep links still behave the same.
- Write `PERF_REPORT.md` with the before/after table and the savings in MB and seconds.

## 4. Phases

| Phase | What | Risk | Rollback |
|---|---|---|---|
| 0 | Baseline benchmark, record results, tag commit | none | n/a |
| 1 | Quick wins: cache headers, self-hosted fonts, loading priority, slimmer manifest | low | revert commit |
| 2 | Quality ladder test, then pilot on one catalog | low | delete `generated/` files, revert manifest |
| 3 | Pipeline on all photos, manifest switch, srcset in the UI | medium | revert manifest |
| 4 | Custom image domain + cache rules | medium (DNS) | switch `imageBaseUrl` back |
| 5 | Re-measure, visual QA, report | none | n/a |

## 5. Decisions needed from the owner

1. **Format and quality:** OK with AVIF + WebP fallback? We choose the quality after you look at the
   side-by-side comparison.
2. **Maximum size:** is a 2400 px zoom enough, or should the site offer a full-resolution
   download?
3. **Custom image domain:** is `img.matassavickis.com` OK, and is the domain's DNS on Cloudflare?
4. **Source of the originals:** the pipeline needs the full-resolution files on this machine.
   The Drive connector can't bulk-download (see `DRIVE_SYNC_PLAN.md`), so the files have to be downloaded from
   Drive in the browser or come from the zips already in `~/Downloads`. This is the same step the
   "add new Drive photos to the site" task needs, so one ingest pipeline can serve both.
5. **Tooling:** OK to add Lighthouse and a small Playwright script as dev dependencies?
