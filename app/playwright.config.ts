import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e', timeout: 180_000, workers: 1, reporter: 'list',
  webServer: { command: 'node e2e/prepare-qa.mjs && npx vite preview --outDir dist-qa --port 4173 --strictPort', url: 'http://localhost:4173', timeout: 240_000, reuseExistingServer: false },
  use: {
    baseURL: 'http://localhost:4173', viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true,
    permissions: ['camera', 'microphone'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
})
