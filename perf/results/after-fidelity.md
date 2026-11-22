# Performance benchmark: after-fidelity

- Target: https://www.matassavickis.com
- Test date: 2026-11-22T11:08:56.508Z
- Chrome: Chrome/158.0.8127.36
- Lighthouse: 11.7.1
- Git commit of the repo at test time: `b395970c7ce97189de64f09f69bdd7e08c503a58` (clean (tracked))
- Machine: AMD Ryzen 7 5825U with Radeon Graphics x16, 13.5 GB RAM, linux 7.0.0-43-generic, node v22.23.5; load avg at start 0.20 3.19 8.59
- Runs per scenario: 3; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.
- Setup: Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.
- Lighthouse: Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.

## Home `/#/`

URL: `https://www.matassavickis.com/#/`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **83** (83 – 85) | **4.60 s** (4.28 s – 4.66 s) | **1.42 s** (1.29 s – 1.42 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 5 ms) | **1.42 s** (1.42 s – 1.43 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **985 ms** (956 ms – 998 ms) | **479 ms** (462 ms – 500 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **479 ms** (462 ms – 500 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **389 KB** (389 KB – 389 KB) | **228 KB** (228 KB – 228 KB) | **14** (14 – 14) | **8** (8 – 8) | **0** (0 – 0) | **166 ms** (157 ms – 176 ms) | **1.80 s** (1.80 s – 1.82 s) |

**Network (CDP), warm cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **13** (13 – 13) | **8** (8 – 8) | **12** (12 – 12) | **63 ms** (54 ms – 76 ms) | **1.65 s** (1.65 s – 1.66 s) |

## Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom

URL: `https://www.matassavickis.com/#/c/london-2026`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **74** (74 – 74) | **6.21 s** (6.17 s – 6.24 s) | **1.54 s** (1.53 s – 1.56 s) | **0.000** (0.000 – 0.000) | **1 ms** (0 ms – 2 ms) | **4.78 s** (4.73 s – 4.94 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **98** (98 – 98) | **1.06 s** (1.05 s – 1.09 s) | **493 ms** (468 ms – 507 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **618 ms** (596 ms – 669 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **3.92 MB** (3.92 MB – 3.92 MB) | **3.76 MB** (3.76 MB – 3.76 MB) | **102** (102 – 102) | **95** (95 – 95) | **0** (0 – 0) | **211 ms** (196 ms – 221 ms) | **7.18 s** (7.17 s – 7.19 s) |

## Album index `/#/c/swiss` (18 album cards)

URL: `https://www.matassavickis.com/#/c/swiss`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (82 – 83) | **4.75 s** (4.71 s – 4.77 s) | **1.43 s** (1.40 s – 1.43 s) | **0.000** (0.000 – 0.000) | **5 ms** (3 ms – 13 ms) | **1.43 s** (1.40 s – 1.43 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **976 ms** (970 ms – 991 ms) | **423 ms** (411 ms – 434 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **423 ms** (411 ms – 434 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **416 KB** (416 KB – 416 KB) | **255 KB** (255 KB – 255 KB) | **18** (18 – 18) | **12** (12 – 12) | **0** (0 – 0) | **175 ms** (171 ms – 181 ms) | **1.81 s** (1.79 s – 1.81 s) |

**Network (CDP), warm cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **17** (17 – 17) | **12** (12 – 12) | **16** (16 – 16) | **71 ms** (65 ms – 86 ms) | **1.65 s** (1.64 s – 1.67 s) |

## Mid album `/#/c/swiss/le-grammot` (16 photos)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (82 – 82) | **4.66 s** (4.65 s – 4.66 s) | **1.40 s** (1.40 s – 1.40 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 1 ms) | **3.63 s** (3.61 s – 3.78 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **969 ms** (947 ms – 975 ms) | **408 ms** (400 ms – 447 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **610 ms** (586 ms – 636 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **520 KB** (520 KB – 520 KB) | **352 KB** (352 KB – 352 KB) | **23** (23 – 23) | **16** (16 – 16) | **0** (0 – 0) | **210 ms** (195 ms – 242 ms) | **1.90 s** (1.89 s – 1.94 s) |

**Network (CDP), warm cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **22** (22 – 22) | **16** (16 – 16) | **21** (21 – 21) | **77 ms** (75 ms – 80 ms) | **1.65 s** (1.64 s – 1.65 s) |

## Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lightbox steps** (3 runs; time = click/keypress until `img.complete && naturalWidth>0`)

| Step | Time | Image bytes | Already requested before action |
|---|---|---|---|
| Click first photo (grid already fetched this file) | **1.80 s** (1.80 s – 1.82 s) | **129 KB** (129 KB – 129 KB) | 0/3 |
| ArrowRight (next; also fetched by grid) | **5 ms** (5 ms – 7 ms) | **68 KB** (68 KB – 68 KB) | 3/3 |
| Browser cache cleared, click 3rd photo | **1.47 s** (1.46 s – 1.47 s) | **85 KB** (85 KB – 85 KB) | 3/3 |
| Cache cleared, ArrowRight (next; may be preloaded by lightbox) | **5 ms** (5 ms – 5 ms) | **110 KB** (110 KB – 110 KB) | 3/3 |

## Deep link to a photo `/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a` (throttled 1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **83** (83 – 83) | **4.64 s** (4.61 s – 4.72 s) | **1.40 s** (1.39 s – 1.42 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **2.47 s** (1.76 s – 2.56 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **97** (97 – 98) | **1.23 s** (1.20 s – 1.26 s) | **398 ms** (396 ms – 486 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **614 ms** (591 ms – 639 ms) |

**Deep link, cold cache** (3 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **4.52 s** (4.50 s – 4.80 s) | **129 KB** (129 KB – 129 KB) | **767 KB** (767 KB – 767 KB) | **935 KB** (935 KB – 935 KB) | **27** (27 – 27) | **20** (20 – 20) |

**Deep link, warm cache** (3 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **226 ms** (221 ms – 227 ms) | **0 KB** (0 KB – 0 KB) | **0 KB** (0 KB – 0 KB) | **1 KB** (1 KB – 1 KB) | **26** (26 – 26) | **20** (20 – 20) |

## Noise / reliability flags

- none: no HTTP errors, 429s or failed runs observed.
