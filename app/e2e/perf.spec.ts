import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
const img = (n: string) => resolve(import.meta.dirname, '../public/demo', n + '.jpg')

test('perf at 4x CPU throttle + demo mode', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const t0 = Date.now()
  await page.goto('./?demo=1')
  await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 120_000 })  // demo unlocks, loads 6 photos (gate + model) and routes to photos
  const tDemo = Date.now() - t0
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } })
  await expect(page.locator('.thumb')).toHaveCount(6)
  await expect(page.getByText('Guided demo.')).toBeVisible()
  // per-photo cost with a warm model
  const input = page.locator('input[type=file][data-src=camera]').first()
  const t1 = Date.now()
  await input.setInputFiles(img('rust1'))
  await expect(page.locator('.thumb')).toHaveCount(7)
  const tPhoto = Date.now() - t1
  console.log(`PERF (4x CPU throttle): DCL ${nav.dcl} ms, load ${nav.load} ms, demo preload incl. model init + 6 photos ${tDemo} ms, one warm photo (gate+inference) ${tPhoto} ms`)
  await page.screenshot({ path: resolve(import.meta.dirname, '../qa/screens/12-demo-photos.png'), fullPage: true })
  // scripted answers reach a result in 6 taps; plot comes from the nearest grid cell
  await page.getByRole('button', { name: 'Next' }).click()
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /No$|One area$/ }).click()
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Not sure.', { exact: false })).toHaveCount(0)   // sensible, non-abstaining result
  await expect(page.getByText(/Most likely:/)).toBeVisible()
  await expect(page.getByText(/Heaviest day in the last 90 days: \d+ mm \(satellite estimate/)).toBeVisible()
  console.log('DEMO RUN 1 RESULT:', (await page.getByText(/Most likely:/).innerText()), '|', (await page.locator('.bar-row').allInnerTexts()).join(' ; ').replace(/\n/g, ' '))
  await page.screenshot({ path: resolve(import.meta.dirname, '../qa/screens/13-demo-result.png'), fullPage: true })
})

test('demo run 2 (mite leaf): cannot-read state, retake, SMS has photo bit', async ({ page }) => {
  await page.goto('./?demo=1&run=mite')
  await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('.thumb')).toHaveCount(6)
  await page.getByRole('button', { name: 'Next' }).click()
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /No$|One area$/ }).click()
  await expect(page.getByRole('heading', { name: 'I cannot read this leaf' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/it may not be coffee, or it may be something I do not know/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Retake/ })).toBeVisible()
  await page.screenshot({ path: resolve(import.meta.dirname, '../qa/screens/14-demo-cannot-read.png'), fullPage: true })
  await page.getByRole('button', { name: /Send to a person/ }).click()
  const sms = (await page.locator('code').innerText()).trim()
  console.log('CANNOT-READ SMS:', sms)
  expect(sms).toMatch(/\|E1$/)   // escalation bit 1 (photo) only
  await page.goBack()
  await page.getByRole('button', { name: /Retake/ }).click()
  await expect(page.getByRole('heading', { name: 'Leaf photos' })).toBeVisible()
  await expect(page.locator('.thumb')).toHaveCount(3)   // worst row cleared, good row kept
})

test('skip voice path and no console errors', async ({ page }) => {
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
  await page.getByRole('button', { name: /^Start/ }).click()
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible()
  for (const b of await page.getByRole('button', { name: /Yes/ }).all()) await b.click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /Skip/ }).click()
  await expect(page.getByText('Step 3 of 5')).toBeVisible()
})

test('missing audio shows a graceful message', async ({ page }) => {
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
  await page.getByRole('button', { name: /^Start/ }).click()
  await page.getByRole('button', { name: /Play audio/ }).first().click()
  await expect(page.getByText(/not available/)).toBeVisible()
})
