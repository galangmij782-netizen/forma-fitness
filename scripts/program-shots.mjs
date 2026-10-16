// Program import and timed sets, phone and desktop, in the web build.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
const out = process.argv[2] ?? 'screenshots'
fs.mkdirSync(out, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch())
const PROGRAM = `Push
Incline bench press 3x8-12
Overhead press 4x6, rest 2 min
Lateral raises 3 sets of 15
Tricep pushdown 3x12

Pull
Pull ups 4xAMRAP
Barbell row 4x8-10
Hammer curl 3x10

Legs
Squat 5x5
Romanian deadlift 3x8
Leg press 3x12-15`
for (const [label, vp, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  const m = await ctx.newPage()
  m.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await m.goto('http://localhost:4173/?demo')
  await m.fill('input[placeholder="e.g. Alex"]', 'mij')
  await m.click('text=Create profile')
  await m.click('text=Explore with sample data')
  await m.waitForSelector('text=Today\'s nutrition')
  await m.getByRole('button', { name: 'Splits', exact: true }).click()
  await wait(900)
  await m.getByRole('button', { name: /Type your program/ }).first().click()
  await wait(700)
  await m.screenshot({ path: path.join(out, `${label}-p1-program-empty.png`) })
  await m.fill('textarea.program-text', PROGRAM)
  await wait(700)
  await m.screenshot({ path: path.join(out, `${label}-p2-program-typed.png`) })
  if (mobile) { await m.locator('.sheet').evaluate((el) => el.scrollTo(0, 99999)); await wait(400); await m.screenshot({ path: path.join(out, `${label}-p3-program-preview.png`) }) }
  await m.getByRole('button', { name: /^Create split/ }).click()
  await wait(1500)
  await m.screenshot({ path: path.join(out, `${label}-p4-split-created.png`) })
  await m.getByRole('button', { name: 'Workouts', exact: true }).click()
  await wait(900)
  await m.locator('text=Up next').first().click()
  await wait(1200)
  await m.getByRole('button', { name: /Start set 1/ }).first().click()
  await wait(3200)
  await m.screenshot({ path: path.join(out, `${label}-p5-set-running.png`) })
  await m.getByRole('button', { name: /Finish set 1/ }).first().click()
  await wait(1500)
  await m.screenshot({ path: path.join(out, `${label}-p6-resting.png`) })
  console.log(label, 'done')
  await ctx.close()
}
await browser.close()
