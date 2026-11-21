# Performance benchmark: after-phase3

- Target: https://www.matassavickis.com
- Test date: 2026-11-21T03:05:32.596Z
- Chrome: Chrome/158.0.8127.36
- Lighthouse: 11.7.1
- Git commit of the repo at test time: `062c61235b1fbfc48707bf9e7cb306652e6a63be` (clean (tracked))
- Machine: AMD Ryzen 7 5825U with Radeon Graphics x16, 13.5 GB RAM, linux 7.0.0-43-generic, node v18.19.1; load avg at start 0.56 1.24 4.03
- Runs per scenario: 5; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.
- Setup: Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.
- Lighthouse: Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.

## Home `/#/`

URL: `https://www.matassavickis.com/#/`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **83** (82 – 84) | **4.61 s** (4.35 s – 4.62 s) | **1.80 s** (1.68 s – 1.84 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **1.80 s** (1.76 s – 1.84 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **99** (99 – 99) | **936 ms** (920 ms – 956 ms) | **528 ms** (511 ms – 540 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **542 ms** (532 ms – 554 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **434 KB** (434 KB – 434 KB) | **228 KB** (228 KB – 228 KB) | **15** (15 – 15) | **8** (8 – 8) | **0** (0 – 0) | **223 ms** (203 ms – 242 ms) | **1.81 s** (1.81 s – 1.82 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2 KB** (2 KB – 2 KB) | **0 KB** (0 KB – 0 KB) | **14** (14 – 14) | **8** (8 – 8) | **11** (11 – 11) | **97 ms** (90 ms – 173 ms) | **1.67 s** (1.66 s – 1.73 s) |

## Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom

URL: `https://www.matassavickis.com/#/c/london-2026`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **73** (73 – 73) | **6.06 s** (5.96 s – 6.06 s) | **2.95 s** (2.93 s – 2.95 s) | **0.000** (0.000 – 0.000) | **21 ms** (20 ms – 22 ms) | **2.95 s** (2.93 s – 2.95 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **97** (97 – 98) | **1.12 s** (1.04 s – 1.18 s) | **802 ms** (794 ms – 826 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **802 ms** (794 ms – 826 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2.94 MB** (2.94 MB – 2.94 MB) | **2.73 MB** (2.73 MB – 2.73 MB) | **102** (102 – 102) | **95** (95 – 95) | **0** (0 – 0) | **203 ms** (199 ms – 220 ms) | **9.59 s** (9.58 s – 9.60 s) |

## Album index `/#/c/swiss` (18 album cards)

URL: `https://www.matassavickis.com/#/c/swiss`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **82** (81 – 82) | **4.81 s** (4.79 s – 4.83 s) | **1.77 s** (1.75 s – 1.80 s) | **0.000** (0.000 – 0.000) | **2 ms** (2 ms – 5 ms) | **1.77 s** (1.75 s – 1.80 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **98** (98 – 98) | **1.07 s** (1.05 s – 1.08 s) | **515 ms** (494 ms – 526 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **527 ms** (505 ms – 528 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **627 KB** (627 KB – 627 KB) | **421 KB** (421 KB – 421 KB) | **22** (22 – 22) | **15** (15 – 15) | **0** (0 – 0) | **242 ms** (223 ms – 260 ms) | **1.91 s** (1.80 s – 1.93 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2 KB** (2 KB – 2 KB) | **0 KB** (0 KB – 0 KB) | **21** (21 – 21) | **15** (15 – 15) | **18** (18 – 18) | **115 ms** (106 ms – 123 ms) | **1.67 s** (1.66 s – 1.68 s) |

## Mid album `/#/c/swiss/le-grammot` (16 photos)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **80** (79 – 80) | **5.17 s** (5.17 s – 5.29 s) | **1.76 s** (1.74 s – 1.81 s) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 1 ms) | **1.76 s** (1.74 s – 1.81 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **98** (98 – 98) | **1.08 s** (1.06 s – 1.10 s) | **516 ms** (468 ms – 518 ms) | **0.000** (0.000 – 0.000) | **0 ms** (0 ms – 0 ms) | **521 ms** (518 ms – 550 ms) |

**Network (CDP), cold cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **558 KB** (558 KB – 558 KB) | **352 KB** (352 KB – 352 KB) | **23** (23 – 23) | **16** (16 – 16) | **0** (0 – 0) | **202 ms** (197 ms – 206 ms) | **1.82 s** (1.81 s – 1.92 s) |

**Network (CDP), warm cache** (5 runs)

| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |
|---|---|---|---|---|---|---|
| **2 KB** (2 KB – 2 KB) | **0 KB** (0 KB – 0 KB) | **22** (22 – 22) | **16** (16 – 16) | **19** (19 – 19) | **95 ms** (85 ms – 120 ms) | **1.67 s** (1.66 s – 1.69 s) |

## Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot`

**Lightbox steps** (5 runs; time = click/keypress until `img.complete && naturalWidth>0`)

| Step | Time | Image bytes | Already requested before action |
|---|---|---|---|
| Click first photo (grid already fetched this file) | **1.67 s** (1.67 s – 1.68 s) | **108 KB** (108 KB – 108 KB) | 0/5 |
| ArrowRight (next; also fetched by grid) | **5 ms** (5 ms – 6 ms) | **57 KB** (57 KB – 57 KB) | 5/5 |
| Browser cache cleared, click 3rd photo | **1.27 s** (1.27 s – 1.27 s) | **70 KB** (70 KB – 70 KB) | 5/5 |
| Cache cleared, ArrowRight (next; may be preloaded by lightbox) | **5 ms** (5 ms – 5 ms) | **91 KB** (91 KB – 91 KB) | 5/5 |

## Deep link to a photo `/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a` (throttled 1.6 Mbps, 150 ms RTT)

URL: `https://www.matassavickis.com/#/c/swiss/le-grammot/p/swiss-le-grammot-r1-04887-032a`

**Lighthouse mobile** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **73** (69 – 75) | **5.54 s** (5.37 s – 5.89 s) | **1.77 s** (1.75 s – 2.95 s) | **0.131** (0.131 – 0.131) | **2 ms** (0 ms – 3 ms) | **1.77 s** (1.75 s – 2.95 s) |

**Lighthouse desktop** (5 runs)

| Score | LCP | FCP | CLS | TBT | Speed Index |
|---|---|---|---|---|---|
| **97** (92 – 97) | **1.28 s** (1.27 s – 1.29 s) | **531 ms** (485 ms – 770 ms) | **0.000** (0.000 – 0.131) | **0 ms** (0 ms – 0 ms) | **583 ms** (562 ms – 770 ms) |

**Deep link, cold cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **4.31 s** (4.30 s – 4.34 s) | **108 KB** (108 KB – 108 KB) | **706 KB** (706 KB – 706 KB) | **912 KB** (912 KB – 912 KB) | **27** (27 – 27) | **20** (20 – 20) |

**Deep link, warm cache** (5 runs; totals counted until ~3 s after the lightbox image loaded)

| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |
|---|---|---|---|---|---|
| **377 ms** (376 ms – 378 ms) | **0 KB** (0 KB – 0 KB) | **0 KB** (0 KB – 0 KB) | **2 KB** (2 KB – 2 KB) | **26** (26 – 26) | **20** (20 – 20) |

## Noise / reliability flags

- none: no HTTP errors, 429s or failed runs observed.
