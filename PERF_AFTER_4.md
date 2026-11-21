# Performance benchmark: after-phase4

- Target: https://www.matassavickis.com
- Test date: 2026-11-21T08:58:30.579Z
- Chrome: Chrome/158.0.8127.36
- Lighthouse: 11.7.1
- Git commit of the repo at test time: `c84d84dbad0bcd927e64e8c2c4d35ca4332eedf3` (clean (tracked))
- Machine: AMD Ryzen 7 5825U with Radeon Graphics x16, 13.5 GB RAM, linux 7.0.0-43-generic, node v18.19.1; load avg at start 0.34 0.51 0.36
- Runs per scenario: 5; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.
- Setup: Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.
- Lighthouse: Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.

## Home `/#/`

URL: `https://www.matassavickis.com/#/`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (82 – 85) | **4.76 s** (4.34 s – 4.83 s) | **1.58 s** (1.23 s – 1.61 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 11 ms) | **1.58 s** (1.23 s – 1.61 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **958 ms** (946 ms – 1.00 s) | **432 ms** (415 ms – 466 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **459 ms** (421 ms – 478 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **403 KB** (403 KB – 403 KB) | **228 KB** (228 KB – 228 KB) | **14** (14 – 14) | **8** (8 – 8) | **0** (0 – 0) | **220 ms** (171 ms – 222 ms) | **1.83 s** (1.80 s – 2.01 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **13** (13 – 13) | **8** (8 – 8) | **12** (12 – 12) | **104 ms** (79 ms – 113 ms) | **1.68 s** (1.66 s – 1.69 s) |

## Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom

URL: `https://www.matassavickis.com/#/c/london-2026`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **78** (78 – 84) | **5.79 s** (4.40 s – 5.81 s) | **1.57 s** (1.55 s – 1.66 s) | **0.000** (0.000 – 0.000) | **39 ms** (33 ms – 93 ms) | **1.57 s** (1.55 s – 1.66 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (98 – 99) | **1.04 s** (881 ms – 1.06 s) | **414 ms** (408 ms – 441 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 2 ms) | **511 ms** (463 ms – 538 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2.91 MB** (2.91 MB – 2.91 MB) | **2.73 MB** (2.73 MB – 2.73 MB) | **101** (101 – 101) | **95** (95 – 95) | **0** (0 – 0) | **213 ms** (194 ms – 235 ms) | **9.62 s** (9.61 s – 9.63 s) |

## Album index `/#/c/swiss` (18 album cards)

URL: `https://www.matassavickis.com/#/c/swiss`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **80** (80 – 87) | **5.29 s** (3.99 s – 5.36 s) | **1.59 s** (1.57 s – 1.64 s) | **0.000** (0.000 – 0.000) | **28 ms** (10 ms – 36 ms) | **1.59 s** (1.57 s – 1.64 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (98 – 99) | **998 ms** (912 ms – 1.07 s) | **400 ms** (330 ms – 441 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **455 ms** (383 ms – 510 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **596 KB** (596 KB – 596 KB) | **421 KB** (421 KB – 421 KB) | **21** (21 – 21) | **15** (15 – 15) | **0** (0 – 0) | **208 ms** (167 ms – 227 ms) | **1.84 s** (1.79 s – 1.93 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **20** (20 – 20) | **15** (15 – 15) | **19** (19 – 19) | **96 ms** (93 ms – 172 ms) | **1.66 s** (1.66 s – 1.72 s) |

## Mid album `/#/c/swiss/le-grammot` (16 photos)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (82 – 88) | **4.83 s** (3.79 s – 4.88 s) | **1.56 s** (1.54 s – 1.56 s) | **0.000** (0.000 – 0.000) | **27 ms** (10 ms – 80 ms) | **1.56 s** (1.54 s – 1.58 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **98** (98 – 99) | **1.06 s** (988 ms – 1.07 s) | **441 ms** (397 ms – 455 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 1 ms) | **524 ms** (468 ms – 664 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **527 KB** (526 KB – 527 KB) | **352 KB** (352 KB – 352 KB) | **22** (22 – 22) | **16** (16 – 16) | **0** (0 – 0) | **201 ms** (174 ms – 241 ms) | **1.92 s** (1.80 s – 1.95 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **21** (21 – 21) | **16** (16 – 16) | **20** (20 – 20) | **127 ms** (98 ms – 132 ms) | **1.68 s** (1.66 s – 1.78 s) |

## Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lightbox steps** (5 runs; time = click/keypress until `img.complete && naturalWidth>0`)

| Step | Time | Image bytes | Already requested before action |
|---|---|---|---|
| Click first photo (grid already fetched this file) | **1.70 s** (1.67 s – 1.70 s) | **108 KB** (108 KB – 108 KB) | 0/5 |
| ArrowRight (next; also fetched by grid) | **12 ms** (10 ms – 26 ms) | **57 KB** (57 KB – 57 KB) | 5/5 |
| Browser cache cleared, click 3rd photo | **1.27 s** (1.26 s – 1.27 s) | **70 KB** (70 KB – 70 KB) | 5/5 |
| Cache cleared, ArrowRight (next; may be preloaded by lightbox) | **7 ms** (7 ms – 17 ms) | **91 KB** (91 KB – 91 KB) | 5/5 |

## Deep link to a photo `/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a` (throttled 1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **79** (79 – 80) | **5.48 s** (5.34 s – 5.71 s) | **1.54 s** (1.54 s – 1.56 s) | **0.000** (0.000 – 0.000) | **11 ms** (5 ms – 46 ms) | **1.54 s** (1.54 s – 1.56 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **97** (97 – 97) | **1.28 s** (1.22 s – 1.34 s) | **435 ms** (400 ms – 490 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **637 ms** (499 ms – 869 ms) |

**Deep link, cold cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **4.08 s** (4.07 s – 4.42 s) | **108 KB** (108 KB – 108 KB) | **706 KB** (706 KB – 706 KB) | **881 KB** (880 KB – 881 KB) | **26** (26 – 26) | **20** (20 – 20) |

**Deep link, warm cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **231 ms** (207 ms – 306 ms) | **0 KB** (0 KB – 0 KB) | **0 KB** (0 KB – 0 KB) | **1 KB** (1 KB – 1 KB) | **25** (25 – 25) | **20** (20 – 20) |

## Noise / reliability flags

- none: no HTTP errors, 429s or failed runs observed.
