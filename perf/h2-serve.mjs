// Serves dist/ over HTTPS + HTTP/2 with gzip, like the live site does (so Lighthouse's simulation models one multiplexed connection
// and TLS setup instead of localhost HTTP/1.1): node perf/h2-serve.mjs [port=4390]  (needs /tmp/claude-1000/h2.key and h2.crt)
import http2 from 'node:http2'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
const port = Number(process.argv[2] || 4390)
const root = path.resolve('dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.png': 'image/png' }
const server = http2.createSecureServer({ key: fs.readFileSync('/tmp/claude-1000/h2.key'), cert: fs.readFileSync('/tmp/claude-1000/h2.crt'), allowHTTP1: true })
server.on('request', (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p.endsWith('/')) p += 'index.html'
  const f = path.join(root, p)
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found') }
  const ext = path.extname(f)
  const raw = fs.readFileSync(f)
  const gz = ['.html', '.js', '.css', '.json', '.svg'].includes(ext) && /gzip/.test(req.headers['accept-encoding'] || '')
  const body = gz ? zlib.gzipSync(raw, { level: 6 }) : raw
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'content-length': body.length, ...(gz ? { 'content-encoding': 'gzip' } : {}), 'cache-control': 'public, max-age=0' })
  res.end(body)
})
server.listen(port, () => console.log('h2 on', port))
