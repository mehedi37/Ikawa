// One-off: capture README screenshots from the LIVE app. Not part of the test suite.
// Run from app/:  node e2e/capture-readme.mjs   (optional: BASE=https://... ONLY=05,06)
import { chromium, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = (process.env.BASE || 'https://ikawa-meek-0s-projects.vercel.app').replace(/\/$/, '') + '/'
const OUT = resolve(import.meta.dirname, '../../docs/screenshots')
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const demo = (n) => resolve(import.meta.dirname, '../public/demo', n + '.jpg')
const roc = (n) => resolve(import.meta.dirname, '../../data/interim/ikawa_data_unpacked/images/rocole', n + '.jpg')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'], baseURL: BASE, locale: 'en-GB' }
const want = (id) => !ONLY || ONLY.includes(id)
const shot = async (page, name, fullPage = false) => {
  await page.waitForTimeout(600)
  if (!fullPage) await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log('saved', name)
}
const btn = (page, name) => page.getByRole('button', { name })
async function fresh() { const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); return { ctx, page } }
async function unlock(page) {
  await page.goto('./#/home')
  await page.getByLabel('PIN').fill('4821')
  await btn(page, /Set PIN|Unlock/).click()
  await expect(page.getByRole('heading', { name: /Ikawa/ })).toBeVisible({ timeout: 30_000 })
  await btn(page, /Use demo area/).click()
  await expect(page.getByText(/Demo area: Mutira/)).toBeVisible()
}
async function toPhotos(page) {
  await btn(page, /^Start/).click()
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible()
  for (const h of await page.getByRole('button', { name: /Yes/ }).all()) await h.click()
}
async function afterConsent(page) {
  await btn(page, 'Next').click()
  await btn(page, /Skip/).click()
  await expect(page.getByRole('heading', { name: 'Leaf photos' })).toBeVisible()
}

// 01-04, 08, 09: normal flow with real leaf photos
if (['01', '02', '03', '04', '08', '09'].some(want)) {
  const { ctx, page } = await fresh()
  await unlock(page)
  await shot(page, '01-home')
  await toPhotos(page)
  await shot(page, '02-consent', true)
  await afterConsent(page)
  const inputs = page.locator('input[type=file]')
  for (const n of ['rust1', 'rust2', 'rust3']) await inputs.nth(0).setInputFiles(demo(n))
  for (const n of ['healthy1', 'healthy2', 'healthy3']) await inputs.nth(1).setInputFiles(demo(n))
  await expect(page.locator('.thumb')).toHaveCount(6, { timeout: 90_000 })
  await shot(page, '03-photos')
  await btn(page, 'Next').click()
  let gotQ = false
  for (let i = 1; i <= 6; i++) {
    await expect(page.getByText(`Question ${i} of 6`)).toBeVisible({ timeout: 20_000 })
    const txt = (await page.locator('main').innerText()).toLowerCase()
    if (!gotQ && /antestia|bug|insect/.test(txt)) { await page.waitForLoadState('networkidle'); await shot(page, '04-question'); gotQ = true }
    await btn(page, i % 2 ? /Yes$|Whole farm$/ : /No$|One area$/).click()
  }
  if (!gotQ) console.log('WARN: no antestia question found')
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 30_000 })
  await btn(page, /Ask a person anyway|Send to a person/).click()
  await expect(page.getByRole('heading', { name: 'Send to a person' })).toBeVisible()
  await page.getByLabel('Officer phone number').fill('0788000000')
  const sms = (await page.locator('code').innerText()).trim()
  await shot(page, '08-escalate-sms', true)
  await page.goto('./#/officer')
  await page.getByLabel('Case SMS').fill(sms)
  await expect(page.getByText('Farmer')).toBeVisible()
  await shot(page, '09-officer', true)
  await ctx.close()
}

// 05 + 12: ?demo=1 result (rust)
if (want('05') || want('12')) {
  const { ctx, page } = await fresh()
  await page.goto('./?demo=1')
  await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('.thumb')).toHaveCount(6)
  await btn(page, 'Next').click()
  for (let i = 0; i < 6; i++) await btn(page, /No$|One area$/).click()
  await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Heaviest day/)).toBeVisible({ timeout: 30_000 })
  await shot(page, '05-result-rust', true)
  const area = page.locator('.facts', { hasText: /Heaviest day/ }).first()
  await area.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/12-asof-rain.png` }); console.log('saved 12-asof-rain')
  await ctx.close()
}

// 06: ?demo=1&run=mite
if (want('06')) {
  const { ctx, page } = await fresh()
  await page.goto('./?demo=1&run=mite')
  await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('.thumb')).toHaveCount(6)
  await btn(page, 'Next').click()
  for (let i = 0; i < 6; i++) await btn(page, /No$|One area$/).click()
  await expect(page.getByRole('heading', { name: 'I cannot read this leaf' })).toBeVisible({ timeout: 30_000 })
  await shot(page, '06-cannot-read', true)
  await ctx.close()
}

// 07: all-healthy photos
if (want('07')) {
  const WORST = [demo('healthy1'), demo('healthy2'), demo('healthy3'), roc('060663'), roc('060687')]
  const GOOD = ['060668', '060672', '060678', '060680', '060683'].map(roc)
  if (![...WORST, ...GOOD].every(existsSync)) console.log('SKIP 07: RoCoLe images missing')
  else {
    const { ctx, page } = await fresh()
    await unlock(page)
    await toPhotos(page)
    await afterConsent(page)
    const inputs = page.locator('input[type=file]')
    for (const f of WORST) await inputs.nth(0).setInputFiles(f)
    for (const f of GOOD) await inputs.nth(1).setInputFiles(f)
    await expect(page.locator('.thumb')).toHaveCount(10, { timeout: 90_000 })
    await btn(page, 'Next').click()
    for (let i = 0; i < 6; i++) await btn(page, /Not sure/).click()
    await expect(page.getByRole('heading', { name: 'Your leaves look healthy' })).toBeVisible({ timeout: 30_000 })
    await shot(page, '07-healthy', true)
    // send to a person -> outbox, then coop
    await btn(page, 'Send to a person anyway').click()
    await expect(page.getByRole('heading', { name: 'Send to a person' })).toBeVisible()
    await page.getByLabel('Officer phone number').fill('0788000000')
    const link = page.getByRole('link', { name: /SMS/ })
    await link.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()))
    await link.click()
    await expect(page.getByText('Saved in outbox')).toBeVisible()
    await page.goto('./#/coop')
    await expect(page.getByText(/not synced/)).toBeVisible()
    await shot(page, '10-coop-storage', true)
    await ctx.close()
  }
}

// 11: Kiswahili
if (want('11')) {
  const { ctx, page } = await fresh()
  await unlock(page)
  await page.getByLabel('Language').selectOption('sw')
  await expect(page.getByRole('note')).toContainText('Machine-drafted')
  await btn(page, 'Anza').click()
  await page.waitForTimeout(500)
  await shot(page, '11-kiswahili')
  await ctx.close()
}

await browser.close()

// Convert the PNGs to JPEG (<= 300 KB each) for the README:
//   uv run python -c "from PIL import Image; import glob,os; [ (Image.open(p).convert('RGB').save(p[:-4]+'.jpg','JPEG',quality=82,optimize=True,progressive=True), os.remove(p)) for p in glob.glob('docs/screenshots/*.png') ]"
