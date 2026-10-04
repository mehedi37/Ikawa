import { expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'
const demo = (n: string) => resolve(import.meta.dirname, '../public/demo', n + '.jpg')
export const SHOTS = resolve(import.meta.dirname, '../qa/screens')

/** Walks the whole farmer flow; `snap` takes screenshots when provided. */
export async function walk(page: Page, snap?: (name: string) => Promise<void>) {
  const s = async (n: string) => { if (snap) await snap(n) }
  const btn = (name: RegExp | string) => page.getByRole('button', { name })
  await page.goto('./#/home')
  await expect(page.getByRole('heading', { name: /PIN/ })).toBeVisible()
  await s('01-pin')
  await page.getByLabel('PIN').fill('4821')
  await btn('Set PIN').or(btn('Unlock')).click()
  await expect(page.getByRole('heading', { name: /Ikawa/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Use demo area/ })).toBeVisible()
  await btn(/Use demo area/).click()
  await expect(page.getByText(/Demo area: Mutira, Kirinyaga, Kenya \(-0\.47, 37\.23\)/)).toBeVisible()
  await s('02-home')
  await btn(/^Start/).click()
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible()
  for (const h of await page.getByRole('button', { name: /Yes/ }).all()) await h.click()
  await s('03-consent')
  await btn('Next').click()
  // voice: skip first path is covered in flow spec; here record all 6 clips
  await expect(page.getByRole('heading', { name: 'Voice setup' })).toBeVisible()
  await s('04-voice')
  for (const w of ['Say YES', 'Say NO', 'Say NOT SURE']) for (let i = 0; i < 2; i++) {
    await btn(new RegExp(w + '$')).click()
    await expect(btn(/Listening/)).toHaveCount(0, { timeout: 15_000 })
  }
  await s('05-voice-done')
  await btn('Next').click()
  await expect(page.getByRole('heading', { name: 'Leaf photos' })).toBeVisible()
  const inputs = page.locator('input[type=file][data-src=camera]')
  for (const n of ['rust1', 'rust2', 'rust3']) await inputs.nth(0).setInputFiles(demo(n))
  for (const n of ['healthy1', 'healthy2', 'healthy3']) await inputs.nth(1).setInputFiles(demo(n))
  await expect(page.locator('.thumb')).toHaveCount(6, { timeout: 60_000 })
  await s('06-photos')
  await btn('Next').click()
  for (let i = 1; i <= 6; i++) {
    await expect(page.getByText(`Question ${i} of 6`)).toBeVisible()
    if (i === 1) await s('07-question')
    await btn(i % 2 ? /Yes$|Whole farm$/ : /No$|One area$/).click()
  }
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 20_000 })
  await s('08-result')
  await expect(page.getByText(/Demo area: Mutira/)).toBeVisible()
  const evid = await page.locator('.card', { hasText: /What I used|Evidence I used/ }).first().innerText()
  expect(evid, 'evidence is plain language, no raw ids').not.toMatch(/[a-z]_[a-z]|leaf:|contrast:/)
  await btn(/Ask a person anyway|Send to a person/).click()
  await expect(page.getByRole('heading', { name: 'Send to a person' })).toBeVisible()
  await page.getByLabel('Officer phone number').fill('0788000000')
  const sms = (await page.locator('code').innerText()).trim()
  expect(sms).toMatch(/^IK1\|/)
  const link = page.getByRole('link', { name: /SMS/ })
  const href = await link.getAttribute('href')
  expect(href).toContain('sms:0788000000?body=')
  await s('09-escalate')
  // click without navigating away
  await link.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()))
  await link.click()
  await expect(page.getByText('Saved in outbox')).toBeVisible()
  await page.goto('./#/officer')
  await page.getByLabel('Case SMS').fill(sms)
  await expect(page.getByText('Farmer')).toBeVisible()
  await s('10-officer')
  await page.goto('./#/coop')
  await expect(page.getByText(/not synced/)).toBeVisible()
  await s('11-coop')
  return sms
}
