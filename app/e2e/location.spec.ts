import { test, expect } from '@playwright/test'
const open = async (page: import('@playwright/test').Page) => {
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
}
test.describe('gps inside the grid', () => {
  test.use({ geolocation: { latitude: -0.4712, longitude: 37.2288 }, permissions: ['geolocation'] })
  test('uses GPS, rounded to 2 decimals', async ({ page }) => {
    await open(page)
    await expect(page.getByText('Your location (-0.47, 37.23), inside the Kirinyaga map.')).toBeVisible()
  })
})
test.describe('gps outside the grid', () => {
  test.use({ geolocation: { latitude: 1.29, longitude: 36.82 }, permissions: ['geolocation'] })
  test('falls back to two buttons, flow not blocked', async ({ page }) => {
    await open(page)
    await expect(page.getByText(/outside the Kirinyaga map/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Use my location/ })).toBeVisible()
    await page.getByRole('button', { name: /Use demo area/ }).click()
    await expect(page.getByText(/Demo area: Mutira/)).toBeVisible()
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible()
  })
})
test('geolocation denied: message, both buttons, can still start', async ({ page }) => {
  await open(page)
  await expect(page.getByText(/could not get your location/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Use my location/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Use demo area/ })).toBeVisible()
  await page.getByRole('button', { name: /^Start/ }).click()
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible()
})
test('as-of date: default latest, demo shortcut picks the date nearest 15 May 2026', async ({ page }) => {
  await open(page)
  const sel = page.getByLabel('Rain data up to')
  await expect(sel).toHaveValue('')
  await page.getByRole('button', { name: /after the April 2026 heavy rains/ }).click()
  const v = await sel.inputValue()
  expect(Math.abs(Date.parse(v) - Date.parse('2026-05-15')) / 864e5).toBeLessThanOrEqual(8)
})
