import { defineConfig, createServer } from 'vite'
import { build as esbuild } from 'esbuild'
import preact from '@preact/preset-vite'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Inlines first-screen preload hints into index.html (see src/preloadHints.js): per route, the main image of the first screen
 * and the catalog's photo list start downloading together with the page's JS instead of after it has run.
 * Production build only; the route table comes from the app's own modules, loaded through a throwaway Vite server.
 */
function firstScreenHints() {
  return {
    name: 'first-screen-hints',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        if (!ctx.bundle) return html
        // Built chunk of each catalog's photo list, for modulepreload.
        const chunks = {}
        for (const c of Object.values(ctx.bundle)) {
          const m = c.type === 'chunk' && c.facadeModuleId && c.facadeModuleId.match(/\/src\/generated\/catalogs\/([^/]+)\.json$/)
          if (m) chunks[m[1]] = `/${c.fileName}`
        }
        const server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } })
        let table
        try {
          const mod = await server.ssrLoadModule('/src/firstScreenTable.js')
          table = mod.firstScreenTable(chunks)
        } finally {
          await server.close()
        }
        const out = await esbuild({
          stdin: { contents: `import { run } from './src/preloadHints.js'; run(${JSON.stringify(table)})`, resolveDir: root, loader: 'js' },
          bundle: true,
          minify: true,
          format: 'iife',
          write: false,
          target: 'es2019',
        })
        // Font preloads go last in <head>: the page's own script and stylesheet are requested first, so on a slow connection they are not queued behind 57 KB of fonts.
        const fontPreloads = html.match(/^[ \t]*<link rel="preload"[^>]*href="\/fonts\/[^>]*>\r?\n?/gm) || []
        for (const l of fontPreloads) html = html.replace(l, '')
        html = html.replace('</head>', `${fontPreloads.map((l) => l.trim()).join('\n    ')}\n  </head>`)
        return { html, tags: [{ tag: 'script', children: out.outputFiles[0].text, injectTo: 'head' }] }
      },
    },
  }
}

/**
 * `virtual:public-versions/<dir>`: a { "/<dir>/<file>": "<content hash>" } map of the files under public/<dir>/ (route terrain,
 * Swiss map relief). The app appends the hash as `?v=`, so _headers can serve these unhashed files with a one-year immutable
 * cache: a re-baked file gets a new URL. One module per directory, so each lazy page only carries its own hashes.
 */
function publicVersions() {
  const PREFIX = 'virtual:public-versions/'
  const hashDir = (dir) => {
    const out = {}
    const walk = (rel) => {
      for (const e of readdirSync(join(root, 'public', rel), { withFileTypes: true })) {
        const r = `${rel}/${e.name}`
        if (e.isDirectory()) walk(r)
        else out[`/${r}`] = createHash('sha256').update(readFileSync(join(root, 'public', r))).digest('hex').slice(0, 10)
      }
    }
    walk(dir)
    return out
  }
  return {
    name: 'public-versions',
    resolveId: (id) => (id.startsWith(PREFIX) ? '\0' + id : null),
    load(id) {
      if (!id.startsWith('\0' + PREFIX)) return null
      const dir = id.slice(PREFIX.length + 1)
      if (!/^[a-z0-9-]+$/.test(dir)) throw new Error(`public-versions: bad directory ${dir}`)
      const map = hashDir(dir)
      this.addWatchFile(join(root, 'public', dir))
      return `const V = ${JSON.stringify(map)}\nexport const versioned = (url) => (V[url] ? url + '?v=' + V[url] : url)\nexport default V`
    },
  }
}

/**
 * Fills the Content-Security-Policy in dist/_headers: `'inline-script-hashes'` becomes the sha256 of every inline <script> in
 * the built index.html (the https guard and the first-screen preload hints), so script-src needs no 'unsafe-inline'.
 */
function cspHashes() {
  const TOKEN = "'inline-script-hashes'"
  let outDir
  return {
    name: 'csp-hashes',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8')
      const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .filter((m) => m[1].trim())
        .map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
      const file = join(outDir, '_headers')
      const headers = readFileSync(file, 'utf8')
      if (!headers.includes(TOKEN)) throw new Error(`csp-hashes: ${TOKEN} not found in _headers`)
      writeFileSync(file, headers.replaceAll(TOKEN, hashes.join(' ')))
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), firstScreenHints(), publicVersions(), cspHashes()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
