import { defineConfig, createServer } from 'vite'
import { build as esbuild } from 'esbuild'
import preact from '@preact/preset-vite'
import { fileURLToPath } from 'node:url'

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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), firstScreenHints()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
