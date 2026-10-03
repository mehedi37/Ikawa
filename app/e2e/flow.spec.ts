import { test } from '@playwright/test'
import { walk, SHOTS } from './flow'
test('full flow online with screenshots + layout audit', async ({ page }) => {
  const errs: string[] = []
  const issues: string[] = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await walk(page, async (n) => {
    await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true })
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      small: [...document.querySelectorAll('button,a.btn,input:not([hidden]),select,textarea')].map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && (x.r.height < 44 || x.r.width < 44)).map((x) => `${x.e.tagName}:${(x.e.textContent || (x.e as HTMLInputElement).ariaLabel || '').slice(0, 20)} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
    }))
    if (r.overflow > 0) issues.push(`${n}: horizontal overflow ${r.overflow}px`)
    if (r.small.length) issues.push(`${n}: small targets ${r.small.join(' | ')}`)
  })
  console.log('LAYOUT ISSUES', issues, 'CONSOLE ERRORS', errs)
})
