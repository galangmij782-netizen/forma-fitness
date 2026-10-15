// Renders the app icon (512px PNG) from the brand mark.
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: 512, height: 512 } })
await p.setContent(`<body style="margin:0;background:transparent"><div style="width:512px;height:512px;border-radius:118px;background:linear-gradient(145deg,#1b1d22,#0b0c0e);display:grid;place-items:center">
<div style="width:300px;height:300px;border-radius:84px;background:#5fd99a;display:grid;place-items:center;box-shadow:0 20px 60px rgba(95,217,154,.35)">
<svg width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="#062414" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
</div></div></body>`)
await p.screenshot({ path: 'build/icon.png', omitBackground: true })
await b.close()
