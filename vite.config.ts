import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import { build as buildEsbuild } from 'esbuild'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import manifest from './src/manifest.json' with { type: 'json' }

const INSTANT_WALLPAPER_BOOT_ROUTE = '/instant-wallpaper-boot.js'
const INSTANT_WALLPAPER_BOOT_ENTRY = 'src/newtab/instant-wallpaper-boot.ts'
const NEWTAB_BOOKMARK_PREBOOT_ROUTE = '/newtab-bookmark-preboot.js'
const NEWTAB_BOOKMARK_PREBOOT_ENTRY = 'src/newtab/newtab-bookmark-preboot-entry.ts'
const POPUP_PREBOOT_ROUTE = '/popup-preboot.js'
const POPUP_PREBOOT_ENTRY = 'src/popup/popup-preboot.ts'
const NEWTAB_MODULE_PRELOAD_TAG_PATTERN = /^[ \t]*<link\b(?=[^>]*\brel=(["'])modulepreload\1)[^>]*>[^\S\r\n]*(?:\r?\n)?/gim

function removeCrossWorldNewtabModulePreloads(html: string): string {
  // A chrome://newtab override is loaded through a different extension world.
  // Chromium rejects Vite's document-level modulepreload entries for reuse and
  // records one extension error per chunk, so they add work without warming the
  // module graph. Static imports from the entry module still load every chunk.
  return html.replace(NEWTAB_MODULE_PRELOAD_TAG_PATTERN, '')
}

function instantWallpaperBootPlugin(minify: boolean): Plugin {
  return {
    name: 'curator-instant-wallpaper-boot',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.path.endsWith('/src/newtab/newtab.html')) {
          return html
        }
        let transformedHtml = html
        if (!transformedHtml.includes(INSTANT_WALLPAPER_BOOT_ROUTE)) {
          const stylesheetIndex = transformedHtml.indexOf('<link rel="stylesheet"')
          if (stylesheetIndex >= 0) {
            const stylesheetLineStart = transformedHtml.lastIndexOf('\n', stylesheetIndex) + 1
            transformedHtml = `${transformedHtml.slice(0, stylesheetLineStart)}    <script src="${INSTANT_WALLPAPER_BOOT_ROUTE}"></script>\n${transformedHtml.slice(stylesheetLineStart)}`
          } else {
            transformedHtml = transformedHtml.replace(
              '</head>',
              `    <script src="${INSTANT_WALLPAPER_BOOT_ROUTE}"></script>\n  </head>`
            )
          }
        }
        if (!transformedHtml.includes(NEWTAB_BOOKMARK_PREBOOT_ROUTE)) {
          transformedHtml = transformedHtml.replace(
            '<body>',
            `<body>\n    <script src="${NEWTAB_BOOKMARK_PREBOOT_ROUTE}"></script>`
          )
        }
        return removeCrossWorldNewtabModulePreloads(transformedHtml)
      }
    },
    configureServer(server) {
      server.middlewares.use(INSTANT_WALLPAPER_BOOT_ROUTE, async (_request, response, next) => {
        try {
          const source = await buildInstantWallpaperBootScript(minify)
          response.statusCode = 200
          response.setHeader('content-type', 'text/javascript; charset=utf-8')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
      server.middlewares.use(NEWTAB_BOOKMARK_PREBOOT_ROUTE, async (_request, response, next) => {
        try {
          const source = await buildNewtabBookmarkPrebootScript(minify)
          response.statusCode = 200
          response.setHeader('content-type', 'text/javascript; charset=utf-8')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      const source = await buildInstantWallpaperBootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: INSTANT_WALLPAPER_BOOT_ROUTE.slice(1),
        source
      })
      const bookmarkPrebootSource = await buildNewtabBookmarkPrebootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: NEWTAB_BOOKMARK_PREBOOT_ROUTE.slice(1),
        source: bookmarkPrebootSource
      })
    }
  }
}

function popupPrebootPlugin(minify: boolean): Plugin {
  return {
    name: 'curator-popup-preboot',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.path.endsWith('/src/popup/popup.html') || html.includes(POPUP_PREBOOT_ROUTE)) {
          return html
        }
        return html.replace('</body>', `    <script src="${POPUP_PREBOOT_ROUTE}"></script>\n  </body>`)
      }
    },
    configureServer(server) {
      server.middlewares.use(POPUP_PREBOOT_ROUTE, async (_request, response, next) => {
        try {
          const source = await buildPopupPrebootScript(minify)
          response.statusCode = 200
          response.setHeader('content-type', 'text/javascript; charset=utf-8')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      const source = await buildPopupPrebootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: POPUP_PREBOOT_ROUTE.slice(1),
        source
      })
    }
  }
}

async function buildInstantWallpaperBootScript(minify: boolean): Promise<string> {
  return buildBrowserIifeScript(INSTANT_WALLPAPER_BOOT_ENTRY, minify)
}

async function buildNewtabBookmarkPrebootScript(minify: boolean): Promise<string> {
  return buildBrowserIifeScript(NEWTAB_BOOKMARK_PREBOOT_ENTRY, minify)
}

async function buildPopupPrebootScript(minify: boolean): Promise<string> {
  return buildBrowserIifeScript(POPUP_PREBOOT_ENTRY, minify)
}

async function buildBrowserIifeScript(entryPoint: string, minify: boolean): Promise<string> {
  const result = await buildEsbuild({
    bundle: true,
    entryPoints: [entryPoint],
    format: 'iife',
    logLevel: 'silent',
    minify,
    platform: 'browser',
    target: 'es2022',
    write: false
  })
  return result.outputFiles[0]?.text || ''
}

export default defineConfig(({ mode }) => {
  const debugSourcemap = mode === 'debug' || process.env.CURATOR_DEBUG_SOURCEMAP === '1'

  return {
    plugins: [react(), tailwindcss(), instantWallpaperBootPlugin(!debugSourcemap), popupPrebootPlugin(!debugSourcemap), crx({ manifest })],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      modulePreload: false,
      sourcemap: debugSourcemap,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/src/shared/search/pinyin.ts')) {
              return 'shared-pinyin'
            }
            if (id.includes('/src/shared/text.ts')) {
              return 'shared-text'
            }
            if (id.includes('/src/newtab/content-state.ts')) {
              return 'newtab-content-state'
            }
            if (id.includes('/src/newtab/interactions.ts')) {
              return 'newtab-interactions'
            }
            if (id.includes('/src/newtab/icon-settings.ts')) {
              return 'newtab-icon-settings'
            }
            if (id.includes('/src/newtab/folder-settings.ts')) {
              return 'newtab-folder-settings'
            }
            if (id.includes('/src/newtab/search-engines.ts')) {
              return 'newtab-search-engines'
            }
            if (id.includes('/src/shared/newtab-workspace-settings.ts')) {
              return 'newtab-workspace-settings'
            }
            if (id.includes('/src/newtab/favicon-cache.ts')) {
              return 'newtab-favicon-cache'
            }
            return undefined
          }
        }
      }
    }
  }
})
