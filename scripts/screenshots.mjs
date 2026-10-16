// Launches the real Electron app, creates a profile with sample data and captures each page.
import { _electron as electron, chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const out = process.argv[2] ?? 'screenshots'
fs.mkdirSync(out, { recursive: true })
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-'))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const app = await electron.launch({
  executablePath: path.resolve('node_modules/electron/dist/electron'),
  args: ['.', '--no-sandbox', `--user-data-dir=${userData}`],
})
const win = await app.firstWindow()
await win.setViewportSize({ width: 1440, height: 900 }).catch(() => {})
await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1440, 900); w.center() })
const shot = async (name, settle = 1700) => { await wait(settle); await win.screenshot({ path: path.join(out, `${name}.png`) }); console.log('saved', name) }
const nav = async (label) => { await win.getByRole('button', { name: label, exact: true }).first().click() }

await win.waitForSelector('text=Create your profile')
await win.fill('input[placeholder="e.g. Alex"]', 'mij')
await shot('01-create-profile', 900)
await win.click('text=Create profile')
await win.waitForSelector('text=Let\'s set your starting point')
await shot('02-onboarding', 1200)
await win.click('text=Explore with sample data')
await win.waitForSelector('text=Today\'s nutrition')
await shot('03-dashboard', 2200)

// frame pacing during a page transition and the ring fill
const fps = await win.evaluate(() => new Promise((res) => {
  const times = []; let start = performance.now()
  const tick = (t) => { times.push(t); if (t - start < 1500) requestAnimationFrame(tick); else {
    const d = times.slice(1).map((x, i) => x - times[i]); res({ frames: times.length, avg: 1000 / (d.reduce((a, b) => a + b, 0) / d.length), worst: Math.max(...d) }) } }
  document.querySelectorAll('.nav-item')[1].click()
  requestAnimationFrame(tick)
}))
console.log('transition fps', JSON.stringify(fps))
fs.writeFileSync(path.join(out, 'frame-timing.json'), JSON.stringify(fps, null, 2))
await shot('04-workouts', 1600)

await nav('Splits')
await shot('05-splits', 1800)
await win.locator('.card.interactive').first().click()
await wait(90)
await win.screenshot({ path: path.join(out, '06-split-expanding.png') })
await shot('07-split-detail', 1400)

await nav('Workouts')
await wait(900)
await win.locator('text=Up next').first().click()
await win.waitForSelector('text=Finish workout')
await wait(1200)
const logButtons = win.getByRole('button', { name: 'Log set' })
await logButtons.nth(0).click()
await wait(2900)
await logButtons.nth(0).click()
await shot('08-live-session-rest-timer', 1500)
// push a heavier set to trigger the PR moment
const weightInputs = win.locator('input.input.sm.num:not([disabled])')
await weightInputs.nth(0).fill('120')
await logButtons.nth(0).click()
await shot('09-new-pr', 650)
await wait(2500)
await win.getByRole('button', { name: 'Skip rest' }).click()
await win.click('text=Finish workout')
await wait(600)

await nav('Meals')
await shot('10-meals', 1800)
await win.fill('textarea', '2 medium eggs scrambled, 1 tbsp butter\n1 mug coffee with 2 tsp sugar, 1 cup kanin')
await shot('10b-typed-meal', 900)
await win.locator('button', { hasText: /^Log (breakfast|lunch|snack|dinner)$/ }).click()
await shot('10c-typed-meal-saved', 900)
await win.getByRole('button', { name: 'Saved foods' }).click()
await wait(700)
await win.locator('.sheet .list-row button.grow').first().click()
await wait(300)
await win.locator('.sheet .list-row button.grow').nth(1).click()
await shot('11-manual-entry', 900)
await win.click('text=Save meal')
await shot('11b-meal-saved', 900)

await nav('Progress')
await shot('12-progress-lifts', 2000)
await win.getByRole('tab', { name: 'Body weight' }).click()
await shot('13-progress-body', 2000)
await win.getByRole('tab', { name: 'What needs work' }).click()
await shot('14-what-needs-work', 1600)

await nav('Settings')
await shot('15-settings', 1500)
await win.getByRole('tab', { name: 'Light' }).click()
await wait(300)
await nav('Dashboard')
await shot('16-dashboard-light', 2200)
await nav('Progress')
await shot('17-progress-light', 2000)
await nav('Settings')
await wait(800)
await win.getByRole('tab', { name: 'Dark' }).click()
await wait(300)

// profile picker with a second profile
await win.click('text=Switch profile')
await wait(900)
await win.locator('text=New profile').click()
await win.fill('input[placeholder="e.g. Alex"]', 'Sam')
await win.locator('button[aria-label="violet"]').click()
await win.fill('input[placeholder="Leave empty for no PIN"]', '1234')
await win.click('text=Create profile')
await wait(1500)
await win.click('text=Explore with sample data').catch(() => {})
await wait(800)
await win.click('text=Switch profile')
await shot('18-profile-picker', 1400)

await app.close()

// Photo analysis flow in the browser build (demo analyzer, no API key needed).
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/?demo')
await page.fill('input[placeholder="e.g. Alex"]', 'mij')
await page.click('text=Create profile')
await page.click('text=Explore with sample data')
await page.waitForSelector('text=Today\'s nutrition')
await page.getByRole('button', { name: 'Meals', exact: true }).click()
await wait(900)
await page.getByRole('button', { name: 'Photo', exact: true }).click()
await wait(600)
await page.setInputFiles('.sheet input[type=file]', path.resolve('scripts/sample-meal.jpg'))
await wait(900)
await page.click('text=Analyze photo')
await wait(700)
await page.screenshot({ path: path.join(out, '19-photo-analyzing.png') }); console.log('saved 19')
await wait(2600)
await page.screenshot({ path: path.join(out, '20-photo-result.png') }); console.log('saved 20')
await page.keyboard.press('Escape')
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
await wait(400)
await page.screenshot({ path: path.join(out, '21-reduced-motion-dashboard.png') }); console.log('saved 21')

// Phone and tablet layouts of the web app.
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const m = await ctx.newPage()
  await m.goto('http://localhost:4173/?demo')
  await m.fill('input[placeholder="e.g. Alex"]', 'mij')
  await m.click('text=Create profile')
  await m.click('text=Explore with sample data')
  await m.waitForSelector('text=Today\'s nutrition')
  await wait(2000)
  await m.screenshot({ path: path.join(out, `${label}-1-dashboard.png`) }); console.log('saved', label)
  await m.getByRole('button', { name: 'Workouts', exact: true }).click()
  await wait(900)
  await m.locator('text=Up next').first().click()
  await wait(1200)
  await m.getByRole('button', { name: 'Log set' }).first().click()
  await wait(1500)
  await m.screenshot({ path: path.join(out, `${label}-2-workout.png`) })
  await m.getByRole('button', { name: 'Skip rest' }).click()
  await m.getByRole('button', { name: 'Meals', exact: true }).click()
  await wait(1600)
  await m.screenshot({ path: path.join(out, `${label}-3-meals.png`) })
  await m.getByRole('button', { name: 'Progress', exact: true }).click()
  await wait(1900)
  await m.screenshot({ path: path.join(out, `${label}-4-progress.png`) })
  await ctx.close()
}
await browser.close()
