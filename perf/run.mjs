#!/usr/bin/env node
// Photo-site performance benchmark (Phase 0 of OPTIMIZATION_PLAN.md).
//
//   node perf/run.mjs --label baseline-live [--url https://www.matassavickis.com] [--runs 5]
//                     [--out perf/results] [--md PERF_BASELINE.md] [--only home,deeplink]
//                     [--skip-lh] [--skip-cdp] [--note "text"] [--chrome /usr/bin/google-chrome]
//
// Scenarios run strictly sequentially. Every run uses a fresh Chrome profile (cold cache);
// "warm" is a second load in the same profile. Reported value = MEDIAN over runs (min/max kept).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// ---------- args ----------
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf('--' + name)
  if (i < 0) return def
  const v = argv[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const BASE = String(opt('url', 'https://www.matassavickis.com')).replace(/\/+$/, '')
const LABEL = String(opt('label', 'run'))
const RUNS = Number(opt('runs', 5))
const OUT = path.resolve(ROOT, String(opt('out', 'perf/results')))
const MD = opt('md', null)
const ONLY = opt('only', null) ? String(opt('only')).split(',') : null
const SKIP_LH = !!opt('skip-lh', false)
const SKIP_CDP = !!opt('skip-cdp', false)
const NOTE = String(opt('note', ''))
const CHROME = String(opt('chrome', '/usr/bin/google-chrome'))
const MAX_RETRIES = 2
const SLOW4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (750 * 1e3) / 8 }

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/generated/manifest.json'), 'utf8'))
const DEEP = manifest.find((p) => p.catalogSlug === 'swiss' && p.albumSlug === 'le-grammot')
const ALBUM = '/#/c/swiss/le-grammot'

const SCENARIOS = [
  { id: 'home', title: 'Home `/#/`', path: '/#/', kind: 'load', lh: true },
  { id: 'london-grid', title: 'Largest photo grid `/#/c/london-2026` (95 photos), scrolled to bottom', path: '/#/c/london-2026', kind: 'scroll', lh: true },
  { id: 'swiss-index', title: 'Album index `/#/c/swiss` (18 album cards)', path: '/#/c/swiss', kind: 'load', lh: true },
  { id: 'album', title: 'Mid album `/#/c/swiss/le-grammot` (16 photos)', path: ALBUM, kind: 'load', lh: true },
  { id: 'lightbox', title: 'Lightbox on throttled Slow-4G-like network (1.6 Mbps, 150 ms RTT)', path: ALBUM, kind: 'lightbox', lh: false },
  { id: 'deeplink', title: `Deep link to a photo \`${ALBUM}/p/${DEEP.id}\` (throttled 1.6 Mbps, 150 ms RTT)`, path: `${ALBUM}/p/${DEEP.id}`, kind: 'deeplink', lh: true },
]

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const median = (a) => {
  const s = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y)
  if (!s.length) return null
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const stat = (a) => {
  const v = a.filter((x) => x != null && !Number.isNaN(x))
  return { median: median(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, n: v.length }
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-profile-'))
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: dir,
    defaultViewport: { width: 1366, height: 900 },
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--mute-audio'],
  })
  return { browser, close: async () => { try { await browser.close() } catch {} fs.rmSync(dir, { recursive: true, force: true }) } }
}

// Network capture over CDP. bytes = encodedDataLength (what went over the wire, incl. headers).
async function startCapture(page) {
  const cdp = await page.createCDPSession()
  await cdp.send('Network.enable')
  const reqs = new Map()
  let inflight = 0
  let lastActivity = Date.now()
  const touch = () => { lastActivity = Date.now() }
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.startsWith('data:')) return
    if (e.redirectResponse && reqs.has(e.requestId)) { inflight-- }
    reqs.set(e.requestId, { url: e.request.url, type: e.type, t0: Date.now(), bytes: 0, status: null, done: false, failed: null, cached: false, ct: null })
    inflight++; touch()
  })
  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId); if (!r) return
    r.status = e.response.status; r.type = e.type
    r.cached = !!(e.response.fromDiskCache || e.response.fromServiceWorker)
    r.ct = e.response.headers?.['content-length'] ?? e.response.headers?.['Content-Length'] ?? null
    touch()
  })
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId); if (!r || r.done) return
    r.done = true; r.t1 = Date.now(); inflight--
    r.bytes = r.cached ? 0 : e.encodedDataLength || (r.ct ? Number(r.ct) : 0)
    touch()
  })
  cdp.on('Network.loadingFailed', (e) => {
    const r = reqs.get(e.requestId); if (!r || r.done) return
    r.done = true; r.t1 = Date.now(); inflight--; r.failed = e.errorText + (e.canceled ? ' (canceled)' : '')
    touch()
  })
  return {
    cdp, reqs,
    async idle(quietMs = 1500, capMs = 120000) {
      const t = Date.now()
      while (Date.now() - t < capMs) {
        if (inflight <= 0 && Date.now() - lastActivity >= quietMs) return true
        await sleep(100)
      }
      return false
    },
    summary(isImage) {
      const all = [...reqs.values()]
      const img = all.filter(isImage)
      const errors = all.filter((r) => (r.status >= 400) || (r.failed && !/ERR_ABORTED|canceled/.test(r.failed)))
      return {
        totalBytes: all.reduce((s, r) => s + r.bytes, 0),
        imageBytes: img.reduce((s, r) => s + r.bytes, 0),
        requests: all.length,
        imageRequests: img.length,
        cachedRequests: all.filter((r) => r.cached).length,
        errors: errors.map((r) => ({ url: r.url.slice(0, 140), status: r.status, failed: r.failed })),
        http429: all.filter((r) => r.status === 429).length,
      }
    },
  }
}
const isImage = (r) => r.type === 'Image' || /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(r.url)

const FIRST_IMG = () => {
  // records the first time any <img> in the viewport has finished loading
  const poll = () => {
    if (window.__firstImg == null) {
      for (const i of document.images) {
        const b = i.getBoundingClientRect()
        if (i.complete && i.naturalWidth > 0 && b.width > 0 && b.bottom > 0 && b.top < innerHeight) { window.__firstImg = performance.now(); break }
      }
    }
    requestAnimationFrame(poll)
  }
  requestAnimationFrame(poll)
}


// in-page: resolves with ms until the lightbox image is complete+decoded-size>0 (relative to t0), or null on timeout
function lbWait(page, prevSrc, t0, capMs) {
  return page.evaluate((prevSrc, t0, capMs) => new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      const el = document.querySelector('.lb-full')
      if (el && el.complete && el.naturalWidth > 0 && el.getAttribute('src') !== prevSrc) {
        return resolve({ ms: performance.now() - t0, src: el.currentSrc || el.src })
      }
      if (performance.now() - start > capMs) return resolve({ ms: null, src: el ? el.currentSrc || el.src : null })
      setTimeout(tick, 25)
    }
    tick()
  }), prevSrc, t0, capMs)
}

async function imageInfo(cap, src, t0wall) {
  await sleep(400)
  const rs = [...cap.reqs.values()].filter((r) => r.url === src)
  return {
    imageBytes: Math.max(0, ...rs.map((r) => r.bytes)), // largest single response (the image can be requested twice: preload + <img>)
    requestCount: rs.length,
    requestedBeforeAction: rs.some((r) => r.t0 < t0wall),
    fromCache: rs.length > 0 && rs.every((r) => r.cached),
    status: rs.map((r) => r.status),
  }
}

async function scrollToBottom(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const step = Math.round(innerHeight * 0.7)
    const t = setInterval(() => {
      window.scrollBy(0, step)
      if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2) { clearInterval(t); setTimeout(resolve, 600) }
    }, 400)
  }))
}

// ---------- CDP scenarios ----------
async function loadOnce(page, scn, { throttle } = {}) {
  const cap = await startCapture(page)
  if (throttle) await cap.cdp.send('Network.emulateNetworkConditions', throttle)
  await page.goto('about:blank')
  const tStart = Date.now()
  await page.goto(BASE + scn.path, { waitUntil: 'domcontentloaded' })
  let extra = {}
  if (scn.kind === 'scroll') {
    await page.waitForSelector('.gallery .thumb', { timeout: 60000 })
    await scrollToBottom(page)
  }
  const settled = await cap.idle(1500, scn.kind === 'scroll' ? 240000 : 120000)
  const loadMs = Date.now() - tStart
  const firstImg = await page.evaluate(() => window.__firstImg ?? null).catch(() => null)
  const sum = cap.summary(isImage)
  await cap.cdp.detach().catch(() => {})
  return { ...sum, firstImageMs: firstImg, settleMs: loadMs, settled, ...extra }
}

async function runLightbox(page) {
  const cap = await startCapture(page)
  await page.goto('about:blank')
  await page.goto(BASE + ALBUM, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.gallery .thumb', { timeout: 60000 })
  await cap.idle(1500, 120000) // grid settles on the real network first
  await cap.cdp.send('Network.emulateNetworkConditions', SLOW4G)
  const res = {}
  const step = async (name, action, prevSrc, arg) => {
    const t0wall = Date.now()
    const t0 = await page.evaluate(action, arg)
    const r = await lbWait(page, prevSrc, t0, 150000)
    const info = r.src ? await imageInfo(cap, r.src, t0wall) : {}
    res[name] = { ms: r.ms, ...info }
    return r.src
  }
  // 1) first photo (already fetched by the grid when thumb === src)
  const first = await step('openFirst', () => { const t = performance.now(); document.querySelector('.gallery .thumb').click(); return t }, null)
  // 2) ArrowRight
  await step('arrowRight', () => { const t = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return t }, first)
  // 3) browser cache cleared (grid thumbnails are the same files today, so the steps above hit the cache):
  //    open the 3rd photo and step ArrowRight with nothing cached = true cost of fetching the lightbox image.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await sleep(500)
  await cap.cdp.send('Network.clearBrowserCache')
  const cold = await step('coldOpen', () => { const t = performance.now(); document.querySelectorAll('.gallery .thumb')[2].click(); return t }, null)
  await step('coldArrowRight', () => { const t = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return t }, cold)
  const sum = cap.summary(isImage)
  await cap.cdp.detach().catch(() => {})
  return { steps: res, errors: sum.errors, http429: sum.http429 }
}

async function runDeepLink(page, scn) {
  const cap = await startCapture(page)
  await cap.cdp.send('Network.emulateNetworkConditions', SLOW4G)
  await page.goto('about:blank')
  const t0wall = Date.now()
  await page.goto(BASE + scn.path, { waitUntil: 'domcontentloaded' })
  const r = await lbWait(page, null, 0, 150000) // performance.now() is relative to navigation start
  const info = r.src ? await imageInfo(cap, r.src, 0) : {}
  await cap.idle(1500, 3000) // short grace; neighbour preloads keep downloading on the slow link, so totals are 'at image loaded + ~3 s'
  const settled = true
  const sum = cap.summary(isImage)
  await cap.cdp.detach().catch(() => {})
  return { lightboxImageMs: r.ms, ...info, lightboxImageBytes: info.imageBytes ?? null, totalBytes: sum.totalBytes, imageBytes: sum.imageBytes, requests: sum.requests, imageRequests: sum.imageRequests, errors: sum.errors, http429: sum.http429, settled }
}

async function cdpScenario(scn) {
  const { browser, close } = await launch()
  try {
    const version = await browser.version()
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(FIRST_IMG)
    const out = { version }
    if (scn.kind === 'lightbox') out.cold = await runLightbox(page)
    else if (scn.kind === 'deeplink') { out.cold = await runDeepLink(page, scn); out.warm = await runDeepLink(page, scn) }
    else {
      out.cold = await loadOnce(page, scn)
      if (scn.kind !== 'scroll') out.warm = await loadOnce(page, scn) // scroll warm skipped: ~430 MB per pass
    }
    return out
  } finally { await close() }
}

// ---------- Lighthouse ----------
async function lhRun(url, preset) {
  const { browser, close } = await launch()
  try {
    const port = Number(new URL(browser.wsEndpoint()).port)
    const flags = { port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] }
    const res = await lighthouse(url, flags, preset === 'desktop' ? desktopConfig : undefined)
    const l = res.lhr
    if (l.runtimeError) throw new Error('LH runtimeError: ' + l.runtimeError.message)
    const a = (id) => l.audits[id]?.numericValue ?? null
    const reqs = l.audits['network-requests']?.details?.items || []
    const errs = reqs.filter((r) => r.statusCode >= 400).map((r) => ({ url: r.url.slice(0, 140), status: r.statusCode }))
    return {
      score: l.categories.performance.score == null ? null : Math.round(l.categories.performance.score * 100),
      lcp: a('largest-contentful-paint'), fcp: a('first-contentful-paint'), cls: a('cumulative-layout-shift'),
      tbt: a('total-blocking-time'), si: a('speed-index'),
      lhTotalBytes: a('total-byte-weight'),
      errors: errs, http429: errs.filter((e) => e.status === 429).length,
      warnings: l.runWarnings || [], lhVersion: l.lighthouseVersion,
    }
  } finally { await close() }
}

// run fn with up to MAX_RETRIES retries on exceptions or "noisy" results (429 / HTTP errors)
async function withRetry(label, fn, noisy) {
  const attempts = []
  let last = null
  for (let a = 0; a <= MAX_RETRIES; a++) {
    try {
      const r = await fn()
      const reasons = noisy(r)
      last = { ...r, attempt: a + 1 }
      attempts.push({ attempt: a + 1, noisy: reasons })
      if (!reasons.length) { last.noisy = []; last.attempts = attempts; return last }
      log(`  ${label}: noisy attempt ${a + 1}: ${reasons.join('; ')}`)
    } catch (e) {
      attempts.push({ attempt: a + 1, error: String(e.message || e).slice(0, 300) })
      log(`  ${label}: FAILED attempt ${a + 1}: ${String(e.message || e).slice(0, 200)}`)
    }
    await sleep(3000)
  }
  if (last) { last.noisy = attempts[attempts.length - 1].noisy || ['see attempts']; last.attempts = attempts; return last }
  return { failed: true, attempts, noisy: ['all attempts failed'] }
}
const noisyLH = (r) => (r.errors?.length ? [`${r.errors.length} HTTP errors (${r.http429} x 429)`] : [])
const noisyCDP = (r) => {
  const out = []
  for (const k of ['cold', 'warm']) {
    const x = r[k]; if (!x) continue
    if (x.errors?.length) out.push(`${k}: ${x.errors.length} HTTP errors/failures (${x.http429} x 429)`)
    if (x.settled === false) out.push(`${k}: network never went idle`)
    if (x.steps) for (const [n, s] of Object.entries(x.steps)) if (s && s.ms === null) out.push(`${k}.${n}: timed out`)
    if (x.lightboxImageMs === null) out.push(`${k}: lightbox image never loaded`)
  }
  return out
}

// ---------- main ----------
fs.mkdirSync(OUT, { recursive: true })
const gitSha = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim() } catch { return 'n/a' } })()
const gitDirty = (() => { try { return execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim() ? 'tracked files modified' : 'clean (tracked)' } catch { return '' } })()
const meta = {
  label: LABEL, baseUrl: BASE, date: new Date().toISOString(), runs: RUNS, gitCommit: gitSha, gitTree: gitDirty,
  machine: `${os.cpus()[0].model} x${os.cpus().length}, ${(os.totalmem() / 2 ** 30).toFixed(1)} GB RAM, ${os.platform()} ${os.release()}, node ${process.version}; load avg at start ${os.loadavg().map((x) => x.toFixed(2)).join(' ')}`,
  note: NOTE, chrome: null, lighthouse: null,
  cdpSetup: 'Desktop 1366x900 headless Chrome, real (unthrottled) network except lightbox/deeplink (1.6 Mbps down, 750 kbps up, 150 ms RTT); fresh profile per run.',
  lhSetup: 'Lighthouse performance category only; mobile = default (simulated Slow 4G + 4x CPU), desktop = lighthouse desktop preset; fresh profile per run.',
  deepLinkPhotoId: DEEP.id,
}
const results = { meta, scenarios: {} }
const save = () => fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(results, null, 2))

for (const scn of SCENARIOS) {
  if (ONLY && !ONLY.includes(scn.id)) continue
  log(`== ${scn.id}`)
  const S = (results.scenarios[scn.id] = { title: scn.title, url: BASE + scn.path, kind: scn.kind, lighthouse: { mobile: [], desktop: [] }, cdp: [] })
  for (let i = 1; i <= RUNS; i++) {
    if (scn.lh && !SKIP_LH) {
      for (const preset of ['mobile', 'desktop']) {
        log(`  run ${i}/${RUNS} lighthouse ${preset}`)
        const r = await withRetry(`LH ${preset}`, () => lhRun(BASE + scn.path, preset), noisyLH)
        S.lighthouse[preset].push(r)
        if (r.lhVersion) meta.lighthouse = r.lhVersion
      }
    }
    if (!SKIP_CDP) {
      log(`  run ${i}/${RUNS} cdp ${scn.kind}`)
      const r = await withRetry('CDP', () => cdpScenario(scn), noisyCDP)
      if (r.version) meta.chrome = r.version
      S.cdp.push(r)
    }
    save()
  }
}
meta.finished = new Date().toISOString()
save()

// ---------- summary ----------
const ok = (r) => r && !r.failed
const f = {
  ms: (v) => (v == null ? 'n/a' : v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms'),
  mb: (v) => (v == null ? 'n/a' : v >= 1e6 ? (v / 1e6).toFixed(2) + ' MB' : (v / 1e3).toFixed(0) + ' KB'),
  n: (v) => (v == null ? 'n/a' : String(Math.round(v))),
  cls: (v) => (v == null ? 'n/a' : v.toFixed(3)),
}
const cell = (vals, fmt) => { const s = stat(vals); return s.n ? `**${fmt(s.median)}** (${fmt(s.min)} – ${fmt(s.max)})` : 'n/a' }
function mdOf() {
  const L = []
  L.push(`# Performance benchmark: ${LABEL}`, '')
  L.push(`- Target: ${BASE}`, `- Test date: ${meta.date}`, `- Chrome: ${meta.chrome}`, `- Lighthouse: ${meta.lighthouse}`)
  L.push(`- Git commit of the repo at test time: \`${gitSha}\` (${gitDirty})`, `- Machine: ${meta.machine}`)
  if (NOTE) L.push(`- Note: ${NOTE}`)
  L.push(`- Runs per scenario: ${RUNS}; every cell is **median** (min – max). Fresh Chrome profile per run (cold); warm = second load in same profile.`)
  L.push(`- Setup: ${meta.cdpSetup}`, `- Lighthouse: ${meta.lhSetup}`, '')
  const flagged = []
  for (const [id, S] of Object.entries(results.scenarios)) {
    L.push(`## ${S.title}`, '', `URL: \`${S.url}\``, '')
    for (const preset of ['mobile', 'desktop']) {
      const runs = S.lighthouse[preset].filter(ok)
      if (!runs.length) continue
      L.push(`**Lighthouse ${preset}** (${runs.length} runs)`, '', '| Score | LCP | FCP | CLS | TBT | Speed Index |', '|---|---|---|---|---|---|')
      L.push(`| ${cell(runs.map((r) => r.score), f.n)} | ${cell(runs.map((r) => r.lcp), f.ms)} | ${cell(runs.map((r) => r.fcp), f.ms)} | ${cell(runs.map((r) => r.cls), f.cls)} | ${cell(runs.map((r) => r.tbt), f.ms)} | ${cell(runs.map((r) => r.si), f.ms)} |`, '')
      S.lighthouse[preset].forEach((r, i) => { if (r.noisy?.length) flagged.push(`${id} LH ${preset} run ${i + 1}: ${r.noisy.join('; ')}`) })
    }
    const cdp = S.cdp.filter(ok)
    if (S.kind === 'load' || S.kind === 'scroll') {
      for (const temp of ['cold', 'warm']) {
        const x = cdp.map((r) => r[temp]).filter(Boolean)
        if (!x.length) continue
        L.push(`**Network (CDP), ${temp} cache** (${x.length} runs)`, '', '| Total transferred | Image bytes | Requests | Image requests | From cache | First image visible | Time to network idle |', '|---|---|---|---|---|---|---|')
        L.push(`| ${cell(x.map((r) => r.totalBytes), f.mb)} | ${cell(x.map((r) => r.imageBytes), f.mb)} | ${cell(x.map((r) => r.requests), f.n)} | ${cell(x.map((r) => r.imageRequests), f.n)} | ${cell(x.map((r) => r.cachedRequests), f.n)} | ${cell(x.map((r) => r.firstImageMs), f.ms)} | ${cell(x.map((r) => r.settleMs), f.ms)} |`, '')
      }
    } else if (S.kind === 'deeplink') {
      for (const temp of ['cold', 'warm']) {
        const x = cdp.map((r) => r[temp]).filter(Boolean)
        if (!x.length) continue
        L.push(`**Deep link, ${temp} cache** (${x.length} runs; totals counted until ~3 s after the lightbox image loaded)`, '', '| Time to lightbox image loaded | Lightbox image bytes | All image bytes | Total transferred | Requests | Image requests |', '|---|---|---|---|---|---|')
        L.push(`| ${cell(x.map((r) => r.lightboxImageMs), f.ms)} | ${cell(x.map((r) => r.lightboxImageBytes ?? r.imageBytes), f.mb)} | ${cell(x.map((r) => r.imageBytes), f.mb)} | ${cell(x.map((r) => r.totalBytes), f.mb)} | ${cell(x.map((r) => r.requests), f.n)} | ${cell(x.map((r) => r.imageRequests), f.n)} |`, '')
      }
    } else if (S.kind === 'lightbox') {
      const x = cdp.map((r) => r.cold).filter(Boolean)
      L.push(`**Lightbox steps** (${x.length} runs; time = click/keypress until \`img.complete && naturalWidth>0\`)`, '', '| Step | Time | Image bytes | Already requested before action |', '|---|---|---|---|')
      for (const [k, name] of [['openFirst', 'Click first photo (grid already fetched this file)'], ['arrowRight', 'ArrowRight (next; also fetched by grid)'], ['coldOpen', 'Browser cache cleared, click 3rd photo'], ['coldArrowRight', 'Cache cleared, ArrowRight (next; may be preloaded by lightbox)']]) {
        const st = x.map((r) => r.steps?.[k]).filter(Boolean)
        if (!st.length) continue
        L.push(`| ${name} | ${cell(st.map((s) => s.ms), f.ms)} | ${cell(st.map((s) => s.imageBytes), f.mb)} | ${st.filter((s) => s.requestedBeforeAction).length}/${st.length} |`)
      }
      L.push('')
    }
    S.cdp.forEach((r, i) => { if (r.noisy?.length) flagged.push(`${id} CDP run ${i + 1}: ${r.noisy.join('; ')}`) })
    const failed = [...S.cdp, ...S.lighthouse.mobile, ...S.lighthouse.desktop].filter((r) => r.failed).length
    if (failed) flagged.push(`${id}: ${failed} run(s) failed after retries`)
  }
  L.push('## Noise / reliability flags', '')
  L.push(flagged.length ? flagged.map((x) => `- ${x}`).join('\n') : '- none: no HTTP errors, 429s or failed runs observed.', '')
  const retried = Object.entries(results.scenarios).flatMap(([id, S]) => [...S.cdp, ...S.lighthouse.mobile, ...S.lighthouse.desktop].filter((r) => r.attempts && r.attempts.length > 1).map(() => id))
  if (retried.length) L.push(`Runs that needed retries: ${retried.length} (details in the JSON \`attempts\` fields).`, '')
  return L.join('\n')
}
const md = mdOf()
fs.writeFileSync(path.join(OUT, `${LABEL}.md`), md)
if (MD && MD !== true) fs.writeFileSync(path.resolve(ROOT, MD), md)
log('done ->', path.join(OUT, `${LABEL}.json`))
