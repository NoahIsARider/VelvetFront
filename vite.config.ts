import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Public assets are referenced with root-absolute URLs (`/assets/...`) so the dev
 * server and a plain HTTP build both work. Inside the packaged desktop app the
 * bundle is loaded from `file:///.../app.asar/dist/index.html`, where a leading
 * slash points at the filesystem root and every image, panel frame and audio
 * file fails to load. Rewrite those references to `./assets/...` in the emitted
 * JS and CSS so the same build works from a file URL as well as from a web root.
 */
function relativePublicAssets() {
  const fix = (text: string) => text.replace(/(["'`(])\/assets\//g, '$1./assets/')
  return {
    name: 'relative-public-assets',
    enforce: 'post' as const,
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && typeof file.source === 'string' && file.fileName.endsWith('.css')) {
          file.source = fix(file.source)
        } else if (file.type === 'chunk' && typeof file.code === 'string') {
          file.code = fix(file.code)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), relativePublicAssets()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022' },
})
