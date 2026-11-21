# Performance benchmark: baseline-live

- Target: https://www.matassavickis.com
- Test date: 2026-11-21T01:41:50.132Z
- Chrome: Chrome/158.0.8127.36
- Lighthouse: 11.7.1
- Git commit of the repo at test time: `8d1428f38a5a3fbdcc3d7ac3e3a929229de01c30` (tracked files modified)
- Machine: AMD Ryzen 7 5825U with Radeon Graphics x16, 13.5 GB RAM, linux 7.0.0-43-generic, node v18.19.1; load avg at start 0.59 0.51 0.54
- Runs per scenario: 5; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.
- Setup: Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.
- Lighthouse: Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.

## Home `/#/`

URL: `https://www.matassavickis.com/#/`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **74** (74 – 74) | **119.98 s** (119.86 s – 120.48 s) | **1.80 s** (1.76 s – 1.82 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **2.68 s** (2.45 s – 2.76 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **75** (75 – 75) | **25.66 s** (17.43 s – 25.85 s) | **529 ms** (524 ms – 547 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **964 ms** (926 ms – 965 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **36.18 MB** (36.18 MB – 36.18 MB) | **35.98 MB** (35.98 MB – 35.98 MB) | **15** (15 – 15) | **8** (8 – 8) | **0** (0 – 0) | **616 ms** (582 ms – 772 ms) | **2.91 s** (2.81 s – 3.12 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2 KB** (2 KB – 2 KB) | **0 KB** (0 KB – 0 KB) | **14** (14 – 14) | **8** (8 – 8) | **11** (11 – 11) | **149 ms** (144 ms – 153 ms) | **1.68 s** (1.67 s – 1.68 s) |

## Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom

URL: `https://www.matassavickis.com/#/c/london-2026`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **69** (69 – 70) | **103.75 s** (71.25 s – 143.64 s) | **2.95 s** (2.95 s – 2.96 s) | **0.000** (0.000 – 0.000) | **4 ms** (3 ms – 6 ms) | **3.47 s** (2.95 s – 3.72 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **73** (72 – 74) | **22.67 s** (15.64 s – 24.95 s) | **818 ms** (810 ms – 820 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.41 s** (1.17 s – 1.69 s) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **399.29 MB** (399.29 MB – 399.29 MB) | **399.09 MB** (399.09 MB – 399.09 MB) | **102** (102 – 102) | **95** (95 – 95) | **0** (0 – 0) | **649 ms** (409 ms – 792 ms) | **13.37 s** (13.00 s – 14.20 s) |

## Album index `/#/c/swiss` (18 album cards)

URL: `https://www.matassavickis.com/#/c/swiss`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **74** (73 – 74) | **24.85 s** (18.78 s – 76.43 s) | **1.78 s** (1.76 s – 1.81 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **2.45 s** (2.25 s – 3.55 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **75** (75 – 75) | **19.96 s** (13.23 s – 20.59 s) | **500 ms** (495 ms – 509 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **961 ms** (911 ms – 1.05 s) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **68.77 MB** (68.77 MB – 68.77 MB) | **68.57 MB** (68.57 MB – 68.57 MB) | **22** (22 – 22) | **15** (15 – 15) | **0** (0 – 0) | **553 ms** (473 ms – 719 ms) | **3.92 s** (3.60 s – 4.04 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2 KB** (2 KB – 2 KB) | **0 KB** (0 KB – 0 KB) | **21** (21 – 21) | **15** (15 – 15) | **18** (18 – 18) | **199 ms** (188 ms – 212 ms) | **1.77 s** (1.76 s – 1.79 s) |

## Mid album `/#/c/swiss/le-grammot` (16 photos)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **74** (74 – 74) | **105.02 s** (29.61 s – 105.09 s) | **1.78 s** (1.75 s – 1.80 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **2.50 s** (2.38 s – 2.79 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **75** (74 – 75) | **27.97 s** (21.67 s – 31.75 s) | **517 ms** (487 ms – 536 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.08 s** (916 ms – 1.32 s) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **69.79 MB** (69.79 MB – 69.79 MB) | **69.59 MB** (69.59 MB – 69.59 MB) | **23** (23 – 23) | **16** (16 – 16) | **0** (0 – 0) | **725 ms** (520 ms – 758 ms) | **3.91 s** (3.83 s – 4.23 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2 KB** (2 KB – 2 KB) | **0 KB** (0 KB – 0 KB) | **22** (22 – 22) | **16** (16 – 16) | **19** (19 – 19) | **186 ms** (181 ms – 202 ms) | **1.76 s** (1.76 s – 1.78 s) |

## Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lightbox steps** (5 runs; time = click/keypress until `img.complete && naturalWidth>0`)

| Step | Time | Image bytes | Already requested before action |
|---|---|---|---|
| Click first photo (grid already fetched this file) | **6 ms** (5 ms – 6 ms) | **4.54 MB** (4.54 MB – 4.54 MB) | 5/5 |
| ArrowRight (next; also fetched by grid) | **5 ms** (5 ms – 5 ms) | **3.62 MB** (3.62 MB – 3.62 MB) | 5/5 |
| Browser cache cleared, click 3rd photo | **63.86 s** (63.85 s – 63.88 s) | **4.56 MB** (4.56 MB – 4.56 MB) | 5/5 |
| Cache cleared, ArrowRight (next; may be preloaded by lightbox) | **458 ms** (433 ms – 484 ms) | **4.70 MB** (4.70 MB – 4.70 MB) | 5/5 |

## Deep link to a photo `/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a` (throttled 1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **70** (65 – 70) | **106.02 s** (105.42 s – 106.18 s) | **1.77 s** (1.75 s – 2.94 s) | **0.128** (0.128 – 0.129) | **0 ms** (0 ms – 0 ms) | **1.85 s** (1.80 s – 2.94 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **57** (57 – 76) | **8.07 s** (6.19 s – 9.94 s) | **771 ms** (489 ms – 802 ms) | **0.361** (0.000 – 0.365) | **0 ms** (0 ms – 0 ms) | **811 ms** (634 ms – 843 ms) |

**Deep link, cold cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | All image bytes (whole page, see note) | Total transferred | Requests | Image requests |
|---|---|---|---|---|
| **137.77 s** (137.76 s – 137.78 s) | **16.35 MB** (16.35 MB – 16.35 MB) | **16.55 MB** (16.55 MB – 16.55 MB) | **23** (23 – 23) | **16** (16 – 16) |

**Deep link, warm cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | All image bytes (whole page, see note) | Total transferred | Requests | Image requests |
|---|---|---|---|---|
| **395 ms** (389 ms – 420 ms) | **0 KB** (0 KB – 87 KB) | **2 KB** (2 KB – 89 KB) | **22** (22 – 22) | **16** (16 – 16) |

## Notes and caveats (added by hand after the run)

- Deep link: the album grid renders behind the lightbox, so all 16 grid images (about 70 MB at full size) compete with the lightbox image on the 1.6 Mbps link. That is why the cold deep link takes about 138 s and 16 MB of images had arrived by then; this is a genuine property of the current site (grid thumbs = full scans). The "Lightbox image bytes" column in this baseline file is the total of all images in the page (a labelling bug fixed in run.mjs afterwards; later runs report both).
- Lightbox: the first two steps are about 5 ms because the grid already downloaded the same file as its "thumbnail". The cache-cleared steps show the real cost of fetching a full scan on Slow 4G (about 64 s for 4.5 MB while neighbour preloads compete).
- Lighthouse LCP is inflated by the full-size scans (about 120 s mobile on Home); LCP varies a lot between runs on heavy pages (min – max is wide), score is stable. Lighthouse transfers were all successful (no HTTP errors/429s seen).
- Desktop deep-link CLS/score varies (57 – 76) between runs.
- CDP network scenarios use the machine's real internet connection (not throttled), so byte counts are reliable but timings depend on the link.
- The grid-scroll scenario has no warm-cache pass (about 400 MB per pass).
- The live site may differ from the recorded git commit if the last deploy is older than HEAD.

## Noise / reliability flags

- none: no HTTP errors, 429s or failed runs observed.
