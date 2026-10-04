/// <reference types="vitest/config" />
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  // QA only: build with the smoke model copied into a temp public dir (see e2e/prepare-qa.mjs)
  publicDir: process.env.QA_PUBLIC ?? 'public',
  build: { outDir: process.env.QA_OUT ?? 'dist' },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg'],
      manifest: {
        name: 'Ikawa',
        short_name: 'Ikawa',
        description: 'Offline coffee-farm yield detective',
        theme_color: '#1e3a2b',
        background_color: '#f3f5f1',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // app shell + model + grid + prices + audio + onnx wasm, all precached for offline use
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,wasm,onnx,json,opus,mjs,woff2}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
