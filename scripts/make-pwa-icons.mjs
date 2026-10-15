// Resizes build/icon.png into the PWA and Apple touch icons.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const src = 'data:image/png;base64,' + fs.readFileSync('build/icon.png').toString('base64')
for (const [name, size, bg] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['apple-touch-icon.png', 180, true]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } })
  // Apple icons get a solid background because iOS rounds the corners itself.
  await p.setContent(`<body style="margin:0;background:${bg ? '#0b0c0e' : 'transparent'}"><img src="${src}" style="width:${size}px;height:${size}px;display:block;${bg ? 'transform:scale(1.12)' : ''}"></body>`)
  await p.screenshot({ path: `public/${name}`, omitBackground: !bg })
  await p.close()
}
await b.close()
