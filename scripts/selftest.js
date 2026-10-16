'use strict'
// Drives a running app (SPIDEY_TEST=1, --remote-debugging-port=9333) over CDP.
// Usage: SPIDEY_TEST=1 electron . --remote-debugging-port=9333  then  npm test
const fs = require('fs')
const path = require('path')
const PORT = process.env.CDP_PORT || 9333
const out = path.join(__dirname, '..', 'scratch')
fs.mkdirSync(out, { recursive: true })

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`)
  if (!ok) failed++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const pages = await (await fetch(`http://localhost:${PORT}/json`)).json()
  const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pend = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) pend.get(d.id)(d)
  }
  const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.result.data, 'base64'))
  }

  await sleep(4000)
  check('test hook present', await ev('!!window.__spidey'))
    await shot('calm')

  // alert
  await ev('__spidey.force({raw:{cpu:10,ram:30,disk:40,online:true,latencyMs:30},danger:[10,30,40,0,6]})')
  await sleep(600)
  check('calm with forced low', (await ev('document.getElementById("panel").dataset.level')) === 'calm')
  await ev('__spidey.force({raw:{cpu:80,ram:30,disk:40,online:true},danger:[80,30,40,0,6]})')
  await sleep(1800)
  check('alert level', (await ev('document.getElementById("panel").dataset.level')) === 'alert')
  await shot('alert')

  // tingle
  await ev('__spidey.force({raw:{cpu:96,ram:30,disk:40,online:true},danger:[96,30,40,0,6]})')
  await sleep(1800)
  check('tingle level', (await ev('document.getElementById("panel").dataset.level')) === 'tingle')
  check('caption names culprit', /CPU/.test(await ev('document.getElementById("caption").textContent')))
  await shot('tingle')

  // back to calm
  await ev('__spidey.force({raw:{cpu:10,ram:30,disk:40,online:true,latencyMs:30},danger:[10,30,40,0,6]})')
  await sleep(1500)
  check('returns to calm', (await ev('document.getElementById("panel").dataset.level')) === 'calm')

  // offline
  await ev('__spidey.force({raw:{cpu:10,ram:30,disk:40,online:false},danger:[10,30,40,0,100]})')
  await sleep(1800)
  check('offline => tingle', (await ev('document.getElementById("panel").dataset.level')) === 'tingle')
  await ev('__spidey.force({raw:{cpu:10,ram:30,disk:40,online:true,latencyMs:30},danger:[10,30,40,0,6]})')
  await sleep(1500)

  // RAM alert logic: steady 97% must stay quiet; a jump must alert
  await ev('__spidey.settings.ramMode="auto"; __spidey.ramHistory.length=0; for(let i=0;i<60;i++) __spidey.ramHistory.push(97)')
  check('steady 97% => no RAM alert', (await ev('__spidey.ramAlert(97)')) === 0)
  await ev('__spidey.ramHistory.length=0; for(let i=0;i<60;i++) __spidey.ramHistory.push(60)')
  check('jump 60->97 => RAM tingle', (await ev('__spidey.ramAlert(97)')) >= 90)
  await ev('__spidey.settings.ramMode="95"')
  check('mode 95 at 97 => alert', (await ev('__spidey.ramAlert(97)')) >= 75)
  await ev('__spidey.settings.ramMode="off"')
  check('mode off => 0', (await ev('__spidey.ramAlert(99)')) === 0)
  await ev('__spidey.settings.ramMode="auto"')

  // timer
  if ((await ev('__spidey.timer.mode')) !== 'focus') await ev('document.getElementById("tmode").click()')
  await ev('document.getElementById("tgo").click()')
  check('timer running', await ev('__spidey.timer.running'))
  await ev('document.getElementById("tgo").click()')
  await ev('document.getElementById("treset").click()')
  check('timer reset 25:00', (await ev('document.getElementById("tclock").textContent')) === '25:00')
  await ev('__spidey.finishTimer()')
  await sleep(900)
  check('timer finish -> break + tingle', (await ev('__spidey.timer.mode')) === 'break')
  await shot('timer-done')

  ws.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
