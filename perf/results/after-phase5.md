# Performance benchmark: after-phase5

- Target: https://www.matassavickis.com
- Test date: 2026-11-21T17:33:54.006Z
- Chrome: Chrome/158.0.8127.36
- Lighthouse: 11.7.1
- Git commit of the repo at test time: `157d7fa340b74ebe59072c60926d93e760a112b5` (clean (tracked))
- Machine: AMD Ryzen 7 5825U with Radeon Graphics x16, 13.5 GB RAM, linux 7.0.0-43-generic, node v18.19.1; load avg at start 0.68 0.67 0.57
- Runs per scenario: 5; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.
- Setup: Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.
- Lighthouse: Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.

## Home `/#/`

URL: `https://www.matassavickis.com/#/`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **83** (83 – 83) | **4.66 s** (4.63 s – 4.71 s) | **1.44 s** (1.42 s – 1.45 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.44 s** (1.42 s – 1.45 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **934 ms** (912 ms – 969 ms) | **450 ms** (423 ms – 469 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **450 ms** (423 ms – 469 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **385 KB** (385 KB – 385 KB) | **228 KB** (228 KB – 228 KB) | **14** (14 – 14) | **8** (8 – 8) | **0** (0 – 0) | **167 ms** (152 ms – 213 ms) | **1.80 s** (1.79 s – 1.83 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **13** (13 – 13) | **8** (8 – 8) | **12** (12 – 12) | **74 ms** (66 ms – 88 ms) | **1.66 s** (1.65 s – 1.68 s) |

## Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom

URL: `https://www.matassavickis.com/#/c/london-2026`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **79** (79 – 79) | **5.65 s** (5.60 s – 5.70 s) | **1.50 s** (1.47 s – 1.54 s) | **0.000** (0.000 – 0.000) | **13 ms** (12 ms – 16 ms) | **1.51 s** (1.48 s – 2.27 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **1.01 s** (999 ms – 1.04 s) | **458 ms** (435 ms – 475 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **486 ms** (458 ms – 512 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2.89 MB** (2.89 MB – 2.89 MB) | **2.73 MB** (2.73 MB – 2.73 MB) | **102** (102 – 102) | **95** (95 – 95) | **0** (0 – 0) | **239 ms** (208 ms – 245 ms) | **9.61 s** (9.57 s – 10.45 s) |

## Album index `/#/c/swiss` (18 album cards)

URL: `https://www.matassavickis.com/#/c/swiss`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (82 – 83) | **4.75 s** (4.70 s – 4.79 s) | **1.41 s** (1.39 s – 1.45 s) | **0.000** (0.000 – 0.000) | **4 ms** (3 ms – 4 ms) | **1.41 s** (1.39 s – 1.45 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **944 ms** (927 ms – 956 ms) | **401 ms** (394 ms – 413 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **401 ms** (394 ms – 413 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **412 KB** (412 KB – 413 KB) | **255 KB** (255 KB – 255 KB) | **18** (18 – 18) | **12** (12 – 12) | **0** (0 – 0) | **169 ms** (152 ms – 179 ms) | **1.79 s** (1.78 s – 1.80 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **17** (17 – 17) | **12** (12 – 12) | **16** (16 – 16) | **65 ms** (65 ms – 79 ms) | **1.64 s** (1.64 s – 1.65 s) |

## Mid album `/#/c/swiss/le-grammot` (16 photos)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (82 – 82) | **4.81 s** (4.77 s – 4.86 s) | **1.41 s** (1.39 s – 1.42 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.41 s** (1.39 s – 1.42 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **949 ms** (919 ms – 969 ms) | **402 ms** (392 ms – 420 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **434 ms** (419 ms – 439 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **517 KB** (517 KB – 517 KB) | **352 KB** (352 KB – 352 KB) | **23** (23 – 23) | **16** (16 – 16) | **0** (0 – 0) | **191 ms** (174 ms – 204 ms) | **1.88 s** (1.88 s – 1.89 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **22** (22 – 22) | **16** (16 – 16) | **21** (21 – 21) | **87 ms** (78 ms – 98 ms) | **1.65 s** (1.64 s – 1.67 s) |

## Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lightbox steps** (5 runs; time = click/keypress until `img.complete && naturalWidth>0`)

| Step | Time | Image bytes | Already requested before action |
|---|---|---|---|
| Click first photo (grid already fetched this file) | **1.69 s** (1.67 s – 1.69 s) | **108 KB** (108 KB – 108 KB) | 0/5 |
| ArrowRight (next; also fetched by grid) | **5 ms** (5 ms – 7 ms) | **57 KB** (57 KB – 57 KB) | 5/5 |
| Browser cache cleared, click 3rd photo | **1.26 s** (1.26 s – 1.29 s) | **70 KB** (70 KB – 70 KB) | 5/5 |
| Cache cleared, ArrowRight (next; may be preloaded by lightbox) | **5 ms** (5 ms – 9 ms) | **91 KB** (91 KB – 91 KB) | 5/5 |

## Deep link to a photo `/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a` (throttled 1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **80** (79 – 81) | **5.35 s** (5.00 s – 5.66 s) | **1.40 s** (1.40 s – 1.48 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.40 s** (1.40 s – 1.48 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **97** (97 – 98) | **1.23 s** (1.14 s – 1.26 s) | **432 ms** (424 ms – 470 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **584 ms** (575 ms – 649 ms) |

**Deep link, cold cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **4.34 s** (4.14 s – 4.56 s) | **108 KB** (108 KB – 108 KB) | **706 KB** (706 KB – 706 KB) | **871 KB** (871 KB – 871 KB) | **27** (27 – 27) | **20** (20 – 20) |

**Deep link, warm cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **222 ms** (220 ms – 224 ms) | **0 KB** (0 KB – 0 KB) | **0 KB** (0 KB – 0 KB) | **1 KB** (1 KB – 1 KB) | **26** (26 – 26) | **20** (20 – 20) |

## Noise / reliability flags

- none: no HTTP errors, 429s or failed runs observed.
