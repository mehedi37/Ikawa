import { test, expect, type Page } from '@playwright/test'
const unlock = async (page: Page) => {
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
}
test('language switcher: persists, machine-drafted badge, Swahili audio plays, English fallback', async ({ page }) => {
  await page.goto('./#/home')
  await unlock(page)
  const sel = page.getByLabel('Language')
  await expect(sel).toBeVisible()
  await sel.selectOption('sw')
  await expect(page.getByRole('note')).toContainText('Machine-drafted translation — not checked by a native speaker')
  await expect(page.getByRole('button', { name: 'Anza' })).toBeVisible()   // sw 'start'
  await page.reload()
  await unlock(page)
  await expect(page.getByLabel('Language')).toHaveValue('sw')
  await expect(page.getByRole('button', { name: 'Anza' })).toBeVisible()
  // English fallback: 'asof_latest' has no Swahili text, so the English string is shown
  await expect(page.locator('option', { hasText: /^Latest \(/ })).toHaveCount(1)
  // audio plays for Swahili ids (consent clip C01)
  await page.getByRole('button', { name: 'Anza' }).click()
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /audio\/(sw\/)?C01\.opus/.test(r.url()) && r.request().method() === 'GET'),
    page.getByRole('button', { name: 'Sikiliza' }).first().click(),
  ])
  expect(resp.status()).toBe(200)
  expect(resp.headers()['content-type']).toMatch(/audio|ogg|opus|octet/)
  await expect(page.getByText(/not available yet/)).toHaveCount(0)
  // switching back to English: no English clip exists, so the button says so instead of playing Swahili
  await page.getByLabel('Language').selectOption('en')
  await page.getByRole('button', { name: 'Play audio' }).first().click()
  await expect(page.getByText(/not available yet/)).toBeVisible()
})
