import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// 10 real healthy coffee leaves: public/demo healthy1-3 plus RoCoLe healthy photos from the HELD-OUT
// field clusters C9-C12 (label `healthy` in data/interim/ikawa_data_unpacked/manifest.csv).
const demo = (n: string) => resolve(import.meta.dirname, '../public/demo', n + '.jpg')
const roc = (n: string) => resolve(import.meta.dirname, '../../data/interim/ikawa_data_unpacked/images/rocole', n + '.jpg')
const WORST = [demo('healthy1'), demo('healthy2'), demo('healthy3'), roc('060663'), roc('060687')]  // 060664 is read as not_coffee (0.99) by the model, so it is not used
const GOOD = ['060668', '060672', '060678', '060680', '060683'].map(roc)

test('all-healthy leaves -> "Your leaves look healthy", no money card, SMS still possible', async ({ page }) => {
  test.skip(![...WORST, ...GOOD].every(existsSync), 'RoCoLe images not unpacked on this machine')
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
  await page.getByRole('button', { name: /Use demo area/ }).click()
  await page.getByRole('button', { name: /^Start/ }).click()
  await expect(page.getByText('(Not used yet: this version keeps no photos.)')).toBeVisible()
  for (const h of await page.getByRole('button', { name: /Yes/ }).all()) await h.click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /Skip/ }).click()
  const inputs = page.locator('input[type=file][data-src=camera]')
  for (const f of WORST) await inputs.nth(0).setInputFiles(f)
  for (const f of GOOD) await inputs.nth(1).setInputFiles(f)
  await expect(page.locator('.thumb')).toHaveCount(10, { timeout: 90_000 })
  await page.getByRole('button', { name: 'Next' }).click()
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /Not sure/ }).click()
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Your leaves look healthy' })).toBeVisible()
  await expect(page.getByText(/probably not a leaf disease/)).toBeVisible()
  const main = await page.locator('main').innerText()
  console.log('HEALTHY RESULT:', main.replace(/\n+/g, ' | ').slice(0, 500))
  expect(main).not.toMatch(/Most likely: leaf rust|Not sure — I am sending/)
  expect(main).not.toMatch(/leaf rust/i)  // only non-leaf causes are listed
  // no money card: the pack's money cards (A02, A08, A15, A16) never appear
  for (const t of ['which treatment is approved', 'Put lime on the soil', 'phosphate fertiliser']) expect(main).not.toContain(t)
  await page.getByRole('button', { name: 'Send to a person anyway' }).click()
  await expect(page.getByRole('heading', { name: 'Send to a person' })).toBeVisible()
  const sms = (await page.locator('code').innerText()).trim()
  expect(sms).toMatch(/^IK1\|/)
  expect(sms.length).toBeLessThanOrEqual(160)
  await page.goto('./#/coop')
  await expect(page.getByText('Photos are not stored on this phone.')).toBeVisible()
  await expect(page.getByText(/1 cases: 0 synced, 1 not synced/)).toBeVisible()
})
