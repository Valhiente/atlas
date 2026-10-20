import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getNetworkConfig } from './scripts/network.mjs'

const network = getNetworkConfig()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: network.facePort,
    // An occupied port must not silently change the configured remote origin.
    strictPort: true,
    allowedHosts: network.codespaceOrigin ? [new URL(network.codespaceOrigin).hostname] : [],
    proxy: {
      '^/atlas-bridge(?:/|$)': {
        target: 'http://127.0.0.1:' + network.bridgePort,
        ws: true,
        // Preserve Origin. The bridge validates HTTP and WebSocket requests.
        changeOrigin: false,
        rewriteWsOrigin: false,
        configure(proxy) {
          const stripCredentials = (request: import('node:http').ClientRequest) => {
            request.removeHeader('cookie')
            request.removeHeader('authorization')
          }
          proxy.on('proxyReq', stripCredentials)
          proxy.on('proxyReqWs', stripCredentials)
        },
      },
    },
  },
  optimizeDeps: {
    // kokoro-js pulls in `phonemizer`, which carries espeak-ng as inline WASM.
    // Vite's dependency pre-bundler rewrites that initialisation and the
    // language table ends up empty — the symptom is
    // `Invalid language identifier: "en". Should be one of: .` at generate()
    // time, long after the model has loaded successfully. Serving these
    // untouched fixes it.
    exclude: ['kokoro-js', 'phonemizer', '@huggingface/transformers'],
  },
})
