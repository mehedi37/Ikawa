import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'
const demo = (n: string) => resolve(import.meta.dirname, '../public/demo', n + '.jpg')

async function run(page: Page, worst: string[], good: string[]) {
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
  await page.getByRole('button', { name: /Use demo area/ }).click()
  await page.getByRole('button', { name: /^Start/ }).click()
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible()
  for (const h of await page.getByRole('button', { name: /Yes/ }).all()) await h.click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Voice setup' })).toBeVisible()
  await page.getByRole('button', { name: /Skip/ }).click()
  const inputs = page.locator('input[type=file]')
  for (const f of worst) await inputs.nth(0).setInputFiles(f)
  for (const f of good) await inputs.nth(1).setInputFiles(f)
  await expect(page.locator('.thumb')).toHaveCount(worst.length + good.length, { timeout: 60_000 })
  await page.getByRole('button', { name: 'Next' }).click()
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /Not sure/ }).click()   // answers carry no evidence
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 30_000 })
  return (await page.locator('main').innerText()).replace(/\n+/g, ' | ')
}
const H = ['healthy1', 'healthy2', 'healthy3'].map(demo)
const R = ['rust1', 'rust2', 'rust3'].map(demo)

test('real model: rust leaves vs healthy leaves (answers unsure)', async ({ page }) => {
  const t = await run(page, R, H)
  console.log('REAL RUST ROW:', t.slice(0, 420))
  expect(t).toMatch(/leaf rust/i)
})
test('real model: all-healthy photos do not claim leaf rust', async ({ page }) => {
  const t = await run(page, H, H)
  console.log('REAL HEALTHY ROW:', t.slice(0, 420))
  expect(t).not.toMatch(/Most likely: leaf rust/)
})
