import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Each build gets an id; the app compares it with dist/version.json online to offer updates.
// The commit time, so the web and Windows builds of the same commit share one id.
const commitTime = (() => { try { return new Date(Number(execSync('git log -1 --format=%ct', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) * 1000) } catch { return new Date() } })()
const BUILD = (isNaN(+commitTime) ? new Date() : commitTime).toISOString().replace(/\D/g, '').slice(0, 14)
const versionFile = { name: 'version-file', generateBundle(this: any) { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }) } }

export default defineConfig({
  plugins: [react(), versionFile],
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
} as any)
