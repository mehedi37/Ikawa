import { test, expect } from '@playwright/test'
import { walk } from './flow'

test('whole flow works offline after one online load', async ({ page, context }) => {
  // 1. online load: service worker installs and precache fills
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBe(true)
  const cached = await page.evaluate(async () => {
    const out: { url: string; size: number }[] = []
    for (const name of await caches.keys()) {
      const c = await caches.open(name)
      for (const req of await c.keys()) { const r = await c.match(req); out.push({ url: req.url, size: r ? (await r.clone().blob()).size : 0 }) }
    }
    return out
  })
  const wasm = cached.filter((x) => x.url.split('?')[0].endsWith('.wasm'))
  const onnx = cached.filter((x) => x.url.includes('.onnx'))
  console.log('PRECACHE entries:', cached.length, 'wasm:', wasm.map((w) => `${w.url.split('/').pop()} ${(w.size / 1048576).toFixed(1)}MB`), 'onnx:', onnx.map((w) => `${w.url.split('/').pop()} ${(w.size / 1048576).toFixed(1)}MB`))
  expect(wasm.length, 'onnxruntime wasm precached').toBeGreaterThan(0)
  expect(wasm[0].size).toBeGreaterThan(10 * 1048576)
  expect(cached.some((x) => x.url.includes('plot_grid.json')), 'plot grid precached').toBe(true)

  // 2. offline: reload and run the entire flow
  await context.setOffline(true)
  await page.reload()
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(String(e)))
  const sms = await walk(page)
  expect(sms).toMatch(/^IK1\|F\d{4}\|R:/)
  expect(errs).toEqual([])
})
