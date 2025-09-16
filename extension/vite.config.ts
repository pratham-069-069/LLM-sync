// llm-sync/extension/vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import path from 'path'

// import your Manifest V3
import manifest from './src/manifest.json'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),           // React + HMR for your popup & options UI
      crx({ manifest })  // CRX.js: reads manifest.json, emits a valid .crx output
    ],
    define: {
      __OPENROUTER_API_KEY__: JSON.stringify(env.OPENROUTER_API_KEY || ''),
      __GEMINI_API_KEY__: JSON.stringify(env.GEMINI_API_KEY || ''),
      __EXTENSION_VERSION__: JSON.stringify(env.EXTENSION_VERSION || '1.0.0'),
      __DEBUG_MODE__: JSON.stringify(env.DEBUG_MODE || 'false')
    },
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
  }
})
