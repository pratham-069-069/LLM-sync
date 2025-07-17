// llm-sync/extension/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import path from 'path'

// import your Manifest V3
import manifest from './src/manifest.json'

export default defineConfig({
  plugins: [
    react(),           // React + HMR for your popup & options UI
    crx({ manifest })  // CRX.js: reads manifest.json, emits a valid .crx output
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',    // emit your extension bundle into extension/dist
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        options: 'src/options/index.html',
      }
    }
  }
})
