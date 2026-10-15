// Barcode scan flow in the browser build with a fake camera and the demo lookup.
import { chromium } from 'playwright-core'
import path from 'node:path'
const out = process.argv[2] ?? 'shots'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
for (const [label, vp, mobile] of [['22', { width: 1440, height: 900 }, false], ['phone-5', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, permissions: ['camera'] })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('pageerror', e.message))
  await p.goto('http://localhost:4173/?demo')
  await p.fill('input[placeholder="e.g. Alex"]', 'mij')
  await p.click('text=Create profile')
  await p.click('text=Explore with sample data')
  await p.waitForSelector("text=Today's nutrition")
  await p.getByRole('button', { name: 'Meals', exact: true }).click()
  await wait(900)
  await p.screenshot({ path: path.join(out, `${label}-meals-header.png`) })
  await p.click('text=Scan barcode')
  await wait(1500)
  await p.screenshot({ path: path.join(out, `${label}-scanner.png`) })
  await p.fill('input[placeholder="Or type the barcode number"]', '5201054017401')
  await p.click('text=Look up')
  await wait(1400)
  await p.screenshot({ path: path.join(out, `${label}-scanned.png`) })
  console.log('saved', label)
}
await browser.close()
