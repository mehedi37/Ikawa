import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
const demo = (n: string) => resolve(import.meta.dirname, '../public/demo', n + '.jpg')

// "Choose from phone": a gallery picker (no `capture`, so the phone does not force the camera) that accepts several photos at once.
test('choose several photos from the phone at once', async ({ page }) => {
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await page.getByRole('button', { name: /Set PIN|Unlock/ }).click()
  await page.goto('./#/photos')
  const worstGallery = page.locator('.bag.worst input[type=file][data-src=gallery]')
  await expect(worstGallery).toHaveAttribute('multiple', '')
  expect(await worstGallery.getAttribute('capture')).toBeNull()
  expect(await page.locator('.bag.worst input[data-src=camera]').getAttribute('capture')).toBe('environment')
  await expect(page.getByRole('button', { name: 'Choose from phone' }).first()).toBeVisible()
  await worstGallery.setInputFiles([demo('rust1'), demo('rust2'), demo('rust3')])
  await expect(page.locator('.bag.worst .thumb')).toHaveCount(3, { timeout: 60_000 })
  await expect(page.locator('.bag.good .thumb')).toHaveCount(0)
})
