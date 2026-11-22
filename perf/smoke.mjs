// Headless smoke test of the loading logic: node perf/smoke.mjs <baseUrl> [mobile]
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const base = process.argv[2].replace(/\/+$/, '')
const mobile = process.argv[3] === 'mobile'
const manifest = JSON.parse(fs.readFileSync('src/generated/manifest.json', 'utf8'))
const deep = manifest.find((p) => p.catalogSlug === 'swiss' && p.albumSlug === 'le-grammot')
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (cond, msg) => { console.log(cond ? 'ok  ' : 'FAIL', msg); if (!cond) fails++ }
async function page(hash) {
  const p = await b.newPage()
  if (mobile) await p.emulate({ viewport: { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/158 Mobile Safari/537.36' })
  else await p.setViewport({ width: 1366, height: 900 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(base + '/' + hash, { waitUntil: 'networkidle2' })
  p.errs = errs
  return p
}
async function scrollAll(p) { const h = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y <= h; y += 500) { await p.evaluate((y) => window.scrollTo(0, y), y); await sleep(250) } await sleep(1500) }
const stats = (p, sel) => p.evaluate((sel) => { const i = [...document.querySelectorAll(sel)]; return { n: i.length, loaded: i.filter((x) => x.complete && x.naturalWidth > 0).length } }, sel)

let p = await page('#/')
await scrollAll(p)
let s = await stats(p, '.catalog-card img'); ok(s.n > 0 && s.loaded === s.n, `home: ${s.loaded}/${s.n} cover images loaded after scrolling`)
const cards = await p.evaluate(() => document.querySelectorAll('.catalog-card').length); ok(cards >= s.n, `home: ${cards} cards`)
ok(p.errs.length === 0, 'home: no console errors ' + p.errs.join('|')); await p.close()

p = await page('#/c/london-2026'); await scrollAll(p)
s = await stats(p, '.gallery img'); const thumbs = await p.evaluate(() => document.querySelectorAll('.gallery .thumb').length)
ok(thumbs > 0 && s.loaded === thumbs, `london: ${s.loaded}/${thumbs} thumbs loaded after scrolling`)
// lightbox from the grid
await p.evaluate(() => window.scrollTo(0, 0)); await sleep(500)
await p.evaluate(() => document.querySelector('.gallery .thumb').click()); await sleep(2500)
let lb = await p.evaluate(() => { const i = document.querySelector('.lb-full'); return i && i.complete && i.naturalWidth > 0 })
ok(lb, 'london: lightbox opened from the grid shows its full image'); const h1 = await p.evaluate(() => location.hash)
await p.keyboard.press('ArrowRight'); await sleep(2500)
lb = await p.evaluate(() => { const i = document.querySelector('.lb-full'); return i && i.complete && i.naturalWidth > 0 }); const h2 = await p.evaluate(() => location.hash)
ok(lb && h1 !== h2, 'london: arrow key moves to the next photo and it loads'); await p.keyboard.press('Escape'); await sleep(800)
ok(!(await p.evaluate(() => !!document.querySelector('.lb-full'))), 'london: lightbox closes')
ok(p.errs.length === 0, 'london: no console errors ' + p.errs.join('|')); await p.close()

p = await page('#/c/swiss/le-grammot'); await sleep(4500); await scrollAll(p)
s = await stats(p, '.gallery img'); const t2 = await p.evaluate(() => document.querySelectorAll('.gallery .thumb').length)
ok(t2 > 0 && s.loaded === t2, `hike album: ${s.loaded}/${t2} thumbs loaded`)
ok(await p.evaluate(() => !!document.querySelector('.vt-bg, .vt-bgslot canvas, .vt-3d-host')), 'hike album: route backdrop present')
await p.evaluate(() => window.scrollTo(0, 0))
await p.evaluate(() => [...document.querySelectorAll('.hike-modes button')].find((b) => b.textContent === 'Route').click()); await sleep(6000)
ok(await p.evaluate(() => !!document.querySelector('.vt-route')), 'hike album: Route view opens')
ok(p.errs.length === 0, 'hike album: no console errors ' + p.errs.join('|')); await p.close()

p = await page(`#/c/swiss/le-grammot/p/${deep.id}`); await sleep(3000)
lb = await p.evaluate(() => { const i = document.querySelector('.lb-full'); return i && i.complete && i.naturalWidth > 0 })
ok(lb, 'deep link: photo opens with its full image'); ok(p.errs.length === 0, 'deep link: no console errors ' + p.errs.join('|'))
await p.keyboard.press('Escape'); await sleep(1500)
s = await stats(p, '.gallery img'); const t3 = await p.evaluate(() => document.querySelectorAll('.gallery .thumb').length); await scrollAll(p)
s = await stats(p, '.gallery img'); ok(s.loaded === t3 && t3 > 0, `deep link: after closing, grid ${s.loaded}/${t3} loaded`)
await p.close()

p = await page('#/c/swiss'); await scrollAll(p)
s = await stats(p, '.catalog-card img'); ok(s.n > 0 && s.loaded === s.n, `swiss: ${s.loaded}/${s.n} album covers loaded`); await p.close()
p = await page('#/c/swiss'); await sleep(5000)
ok(await p.evaluate(() => !!document.querySelector('[class*="sm-"], [class*="swissmap"], .sm')), 'swiss: map layer present after the first screen')
await p.evaluate(() => [...document.querySelectorAll('.hike-modes button')].find((b) => b.textContent === 'Map').click()); await sleep(5000)
ok(await p.evaluate(() => !!document.querySelector('canvas, svg[class*="sm-"], [class*="sm-pin"]')), 'swiss: Map view opens')
ok(p.errs.length === 0, 'swiss: no console errors ' + p.errs.join('|')); await p.close()
await b.close()
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0)
