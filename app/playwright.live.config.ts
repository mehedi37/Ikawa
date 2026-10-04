// Runs the same browser tests against a deployed URL (no local server):
//   LIVE_URL=https://ikawa-meek-0s-projects.vercel.app npx playwright test -c playwright.live.config.ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const url = process.env.LIVE_URL
if (!url) throw new Error('set LIVE_URL')
export default defineConfig({ ...base, webServer: undefined, use: { ...base.use, baseURL: url } })
