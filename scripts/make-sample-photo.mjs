// Renders a stylised plate image used only to demo the photo flow.
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: 800, height: 800 } })
await p.setContent(`<body style="margin:0;background:radial-gradient(circle at 30% 20%,#7a5a3c,#3b2a1c)">
<div style="position:absolute;left:80px;top:80px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,#f4f1ea 60%,#d9d3c7 61%,#efebe3 70%);box-shadow:0 30px 60px rgba(0,0,0,.45)"></div>
<div style="position:absolute;left:190px;top:330px;width:300px;height:230px;border-radius:48% 52% 45% 55%;background:radial-gradient(circle at 40% 35%,#fffdf7,#ece6d6);box-shadow:inset 0 -10px 20px rgba(0,0,0,.08)"></div>
${[0,1,2,3,4].map(i=>`<div style="position:absolute;left:${300+i*28}px;top:${190+i*14}px;width:150px;height:70px;border-radius:30px;transform:rotate(${18+i*4}deg);background:linear-gradient(160deg,#d89a5b,#a4602b 60%,#7d4519);box-shadow:0 6px 10px rgba(0,0,0,.25)"></div>`).join('')}
${[0,1,2,3].map(i=>`<div style="position:absolute;left:${440+i*40}px;top:${420+i*30}px;width:90px;height:58px;border-radius:50% 50% 45% 45%;transform:rotate(${-20+i*12}deg);background:radial-gradient(circle at 40% 40%,#d8e78a,#8fb23c 55%,#3f6d1f)"></div>`).join('')}
${Array.from({length:14},(_,i)=>`<div style="position:absolute;left:${230+(i*37)%240}px;top:${260+(i*53)%120}px;width:14px;height:14px;border-radius:50%;background:#2f6b2a;opacity:.8"></div>`).join('')}
</body>`)
await p.screenshot({ path: 'scripts/sample-meal.jpg', type: 'jpeg', quality: 88 })
await b.close()
