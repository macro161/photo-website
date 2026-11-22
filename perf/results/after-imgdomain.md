# Performance benchmark: after-imgdomain

- Target: https://www.matassavickis.com
- Test date: 2026-11-22T12:00:08.254Z
- Chrome: Chrome/158.0.8127.36
- Lighthouse: 11.7.1
- Git commit of the repo at test time: `27f16d506601c6da2900d4a5a050a7b7b798d7cf` (clean (tracked))
- Machine: AMD Ryzen 7 5825U with Radeon Graphics x16, 13.5 GB RAM, linux 7.0.0-43-generic, node v22.23.5; load avg at start 1.26 0.70 0.66
- Runs per scenario: 3; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.
- Setup: Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.
- Lighthouse: Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.

## Home `/#/`

URL: `https://www.matassavickis.com/#/`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **91** (90 – 91) | **3.51 s** (3.46 s – 3.57 s) | **1.47 s** (1.44 s – 1.50 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 2 ms) | **1.47 s** (1.44 s – 1.50 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **850 ms** (837 ms – 852 ms) | **467 ms** (462 ms – 475 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **467 ms** (462 ms – 475 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **389 KB** (389 KB – 389 KB) | **228 KB** (228 KB – 228 KB) | **14** (14 – 14) | **8** (8 – 8) | **0** (0 – 0) | **137 ms** (122 ms – 164 ms) | **1.70 s** (1.70 s – 1.71 s) |

**Network (CDP), warm cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **13** (13 – 13) | **8** (8 – 8) | **12** (12 – 12) | **62 ms** (59 ms – 66 ms) | **1.65 s** (1.64 s – 1.65 s) |

## Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom

URL: `https://www.matassavickis.com/#/c/london-2026`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **89** (89 – 90) | **3.73 s** (3.59 s – 3.73 s) | **1.57 s** (1.56 s – 1.58 s) | **0.000** (0.000 – 0.000) | **3 ms** (2 ms – 9 ms) | **1.84 s** (1.77 s – 1.87 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **945 ms** (920 ms – 946 ms) | **535 ms** (517 ms – 539 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **575 ms** (553 ms – 578 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **3.93 MB** (3.93 MB – 3.93 MB) | **3.77 MB** (3.77 MB – 3.77 MB) | **102** (102 – 102) | **95** (95 – 95) | **0** (0 – 0) | **174 ms** (173 ms – 184 ms) | **7.18 s** (7.17 s – 7.18 s) |

## Album index `/#/c/swiss` (18 album cards)

URL: `https://www.matassavickis.com/#/c/swiss`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **90** (89 – 90) | **3.63 s** (3.63 s – 3.66 s) | **1.46 s** (1.43 s – 1.47 s) | **0.000** (0.000 – 0.000) | **6 ms** (4 ms – 8 ms) | **1.46 s** (1.43 s – 1.47 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 100) | **827 ms** (795 ms – 851 ms) | **465 ms** (453 ms – 491 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **465 ms** (453 ms – 491 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **416 KB** (416 KB – 416 KB) | **256 KB** (256 KB – 256 KB) | **18** (18 – 18) | **12** (12 – 12) | **0** (0 – 0) | **120 ms** (108 ms – 143 ms) | **1.69 s** (1.68 s – 1.71 s) |

**Network (CDP), warm cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **17** (17 – 17) | **12** (12 – 12) | **16** (16 – 16) | **65 ms** (65 ms – 93 ms) | **1.64 s** (1.64 s – 1.67 s) |

## Mid album `/#/c/swiss/le-grammot` (16 photos)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **91** (90 – 91) | **3.43 s** (3.42 s – 3.48 s) | **1.45 s** (1.44 s – 1.58 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 5 ms) | **1.78 s** (1.75 s – 1.88 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **864 ms** (843 ms – 895 ms) | **466 ms** (464 ms – 481 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **545 ms** (513 ms – 545 ms) |

**Network (CDP), cold cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **520 KB** (520 KB – 520 KB) | **352 KB** (352 KB – 352 KB) | **23** (23 – 23) | **16** (16 – 16) | **0** (0 – 0) | **164 ms** (149 ms – 170 ms) | **1.69 s** (1.68 s – 1.78 s) |

**Network (CDP), warm cache** (3 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **1 KB** (1 KB – 1 KB) | **0 KB** (0 KB – 0 KB) | **22** (22 – 22) | **16** (16 – 16) | **21** (21 – 21) | **85 ms** (85 ms – 87 ms) | **1.65 s** (1.65 s – 1.66 s) |

## Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lightbox steps** (3 runs; time = click/keypress until `img.complete && naturalWidth>0`)

| Step | Time | Image bytes | Already requested before action |
|---|---|---|---|
| Click first photo (grid already fetched this file) | **1.79 s** (1.79 s – 1.81 s) | **129 KB** (129 KB – 129 KB) | 0/3 |
| ArrowRight (next; also fetched by grid) | **6 ms** (6 ms – 6 ms) | **68 KB** (68 KB – 68 KB) | 3/3 |
| Browser cache cleared, click 3rd photo | **1.47 s** (1.46 s – 1.49 s) | **85 KB** (85 KB – 85 KB) | 3/3 |
| Cache cleared, ArrowRight (next; may be preloaded by lightbox) | **7 ms** (5 ms – 7 ms) | **110 KB** (110 KB – 110 KB) | 3/3 |

## Deep link to a photo `/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a` (throttled 1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a`

**Lighthouse mobile** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **85** (85 – 87) | **4.25 s** (4.02 s – 4.26 s) | **1.45 s** (1.45 s – 1.46 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.75 s** (1.72 s – 1.76 s) |

**Lighthouse desktop** (3 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (94 – 99) | **994 ms** (993 ms – 1.00 s) | **459 ms** (458 ms – 466 ms) | **0.000** (0.000 – 0.127) | **0 ms** (0 ms – 0 ms) | **610 ms** (603 ms – 640 ms) |

**Deep link, cold cache** (3 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **5.12 s** (5.12 s – 5.13 s) | **129 KB** (129 KB – 129 KB) | **767 KB** (767 KB – 767 KB) | **936 KB** (936 KB – 936 KB) | **27** (27 – 27) | **20** (20 – 20) |

**Deep link, warm cache** (3 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **230 ms** (223 ms – 236 ms) | **0 KB** (0 KB – 0 KB) | **0 KB** (0 KB – 0 KB) | **1 KB** (1 KB – 1 KB) | **26** (26 – 26) | **20** (20 – 20) |

## Noise / reliability flags

- none: no HTTP errors, 429s or failed runs observed.
