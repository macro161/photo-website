// Shows the simulated (lantern) critical path of LCP: node perf/lcp-graph.mjs <url>
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import lighthouse from 'lighthouse'
import { LanternLargestContentfulPaint } from 'lighthouse/core/computed/metrics/lantern-largest-contentful-paint.js'
import { LanternFirstContentfulPaint } from 'lighthouse/core/computed/metrics/lantern-first-contentful-paint.js'
import defaultConfig from 'lighthouse/core/config/default-config.js'
const url = process.argv[2]
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcpg-'))
const art = path.join(dir, 'art')
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, userDataDir: path.join(dir, 'p'), args: ['--no-sandbox', '--no-first-run'] })
await lighthouse(url, { port: Number(new URL(b.wsEndpoint()).port), output: 'json', onlyCategories: ['performance'], logLevel: 'error', gatherMode: art })
await b.close()
const artifacts = JSON.parse(fs.readFileSync(path.join(art, 'artifacts.json'), 'utf8'))
const devtoolsLog = JSON.parse(fs.readFileSync(path.join(art, 'defaultPass.devtoolslog.json'), 'utf8'))
const trace = JSON.parse(fs.readFileSync(path.join(art, 'defaultPass.trace.json'), 'utf8'))
const { Settings } = await import('lighthouse/core/config/constants.js').then((m) => ({ Settings: m.defaultSettings }))
const settings = { ...Settings, formFactor: 'mobile', throttlingMethod: 'simulate', throttling: Settings.throttling }
const context = { computedCache: new Map(), settings }
const data = { trace, devtoolsLog, gatherContext: { gatherMode: 'navigation' }, settings, URL: artifacts.URL, SourceMaps: [], simulator: null }
const r = await LanternLargestContentfulPaint.request(data, context)
const f = await LanternFirstContentfulPaint.request(data, context)
console.log('LCP', Math.round(r.timing), 'optimistic', Math.round(r.optimisticEstimate.timeInMs), 'pessimistic', Math.round(r.pessimisticEstimate.timeInMs), '| FCP', Math.round(f.timing))
for (const [name, est] of [['OPTIMISTIC', r.optimisticEstimate], ['PESSIMISTIC', r.pessimisticEstimate]]) {
  console.log('--', name)
  const rows = []
  for (const [node, t] of est.nodeTimings) {
    if (node.type === 'network') rows.push([Math.round(t.startTime), Math.round(t.endTime), 'NET', node.request.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 70), Math.round(node.request.transferSize / 1024) + 'KB', node.request.priority])
    else rows.push([Math.round(t.startTime), Math.round(t.endTime), 'CPU', Math.round(t.duration || 0) + 'ms', '', ''])
  }
  rows.sort((a, b) => a[0] - b[0])
  for (const x of rows.filter((x) => x[2] === 'NET' || x[1] - x[0] > 30)) console.log(x.join('\t'))
}
fs.rmSync(dir, { recursive: true, force: true })
const ev = trace.traceEvents.filter((e) => /largestContentfulPaint::Candidate|LargestImagePaint::Candidate|LargestTextPaint::Candidate/.test(e.name))
console.log('LCP trace events:', ev.map((e) => `${e.name} @${Math.round((e.ts - trace.traceEvents.find((x) => x.name === 'navigationStart')?.ts) / 1000)}ms ${JSON.stringify({u:(e.args?.data||{}).imageUrl,w:(e.args?.data||{}).frame_width,h:(e.args?.data||{}).frame_height,x:(e.args?.data||{}).frame_x,y:(e.args?.data||{}).frame_y,sz:(e.args?.data||{}).size,idx:(e.args?.data||{}).candidateIndex})}`).join('\n'))
