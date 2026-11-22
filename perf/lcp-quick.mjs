// Quick mobile-Lighthouse LCP check: node perf/lcp-quick.mjs <baseUrl> [runs=2] [ids,comma]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import lighthouse from 'lighthouse'
const base = process.argv[2].replace(/\/+$/, '')
const runs = Number(process.argv[3] || 2)
const manifest = JSON.parse(fs.readFileSync('src/generated/manifest.json', 'utf8'))
const deep = manifest.find((p) => p.catalogSlug === 'swiss' && p.albumSlug === 'le-grammot')
const ALL = {
  home: '/#/',
  london: '/#/c/london-2026',
  swiss: '/#/c/swiss',
  album: '/#/c/swiss/le-grammot',
  deep: `/#/c/swiss/le-grammot/p/${deep.id}`,
}
const ids = (process.argv[4] ? process.argv[4].split(',') : Object.keys(ALL))
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
const out = []
for (const id of ids) {
  const lcp = [], fcp = [], score = [], cls = []
  for (let i = 0; i < runs; i++) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcpq-'))
    const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, userDataDir: dir, args: ['--no-sandbox', '--no-first-run', '--ignore-certificate-errors'] })
    const r = await lighthouse(base + ALL[id], { port: Number(new URL(b.wsEndpoint()).port), output: 'json', onlyCategories: ['performance'], logLevel: 'error' })
    const a = r.lhr.audits
    lcp.push(a['largest-contentful-paint'].numericValue); fcp.push(a['first-contentful-paint'].numericValue); cls.push(a['cumulative-layout-shift'].numericValue); score.push(r.lhr.categories.performance.score * 100)
    fs.writeFileSync('/tmp/claude-1000/lhr-' + id + '.json', JSON.stringify(r.lhr)); await b.close(); fs.rmSync(dir, { recursive: true, force: true })
  }
  out.push(`${id.padEnd(7)} score ${med(score)}  LCP ${(med(lcp) / 1000).toFixed(2)} s  FCP ${(med(fcp) / 1000).toFixed(2)} s  CLS ${med(cls).toFixed(3)}  (LCP runs ${lcp.map((x) => (x / 1000).toFixed(2)).join(' ')})`)
  console.log(out[out.length - 1])
}
