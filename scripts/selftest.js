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

  // badge <-> panel
  const view = () => ev('document.body.dataset.view')
  const click = async (x, y) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
  }
  if ((await view()) === 'panel') {
    await ev('document.getElementById("collapse").click()')
    await sleep(600)
  }
  check('collapse -> badge view', (await view()) === 'badge')
  check('badge window is small', (await ev('innerWidth')) < 120)
  await shot('badge')
  for (let i = 0; i < 5 && (await view()) !== 'panel'; i++) {
    await click(48, 80)
    await sleep(900)
  }
  check('click badge -> panel', (await view()) === 'panel')
  check('panel window is large', (await ev('innerWidth')) >= 290)
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

  // reminders
  const p1 = await ev('JSON.stringify(__reminders.parse("in 20m stretch", 0))')
  check('parse "in 20m stretch"', p1 === '{"due":1200000,"text":"stretch"}', p1)
  check('parse garbage => null', (await ev('__reminders.parse("blah")')) === null)
  check('parse "at 3pm x" valid', (await ev('__reminders.parse("at 3pm call").text')) === 'call')
  await ev('__spidey.force({raw:{cpu:10,ram:30,disk:40,online:true,latencyMs:30},danger:[10,30,40,0,6]})')
  await ev('__reminders.add("in 2s drink water")')
  check('reminder listed', (await ev('document.querySelectorAll("#rlist li").length')) === 1)
  await sleep(3500)
  check('reminder fires -> tingle + caption', (await ev('document.getElementById("panel").dataset.level')) === 'tingle' && /DRINK WATER/.test(await ev('document.getElementById("caption").textContent')))
  await shot('reminder')
  check('reminder consumed', (await ev('__reminders.items.length')) === 0)

  // idle nap + eye-rest nudge
  await ev('__spidey.trackActivity(200)')
  check('idle 200s => nap', (await ev('document.body.dataset.idle')) === '1')
  await ev('__spidey.trackActivity(0)')
  check('active => awake', (await ev('document.body.dataset.idle')) === '0')
  await ev('__spidey.activity.activeS = 1199; __spidey.trackActivity(0)')
  await sleep(300)
  check('20 min active => 20-20-20 nudge', /20-20-20/.test(await ev('document.getElementById("caption").textContent')))
  await sleep(10500)

  // guardian feed
  await ev('__guardian.onEvent({kind:"startup",text:"new auto-start entry added: Foo",at:Date.now()})')
  await sleep(300)
  check('guardian event -> tingle caption', /SPIDEY-SENSE: NEW AUTO-START ENTRY ADDED: FOO/.test(await ev('document.getElementById("caption").textContent')))
  check('guardian log has entry', (await ev('__guardian.log.length')) >= 1)
  await ev('document.getElementById("led").click()')
  check('log opens on status light click', (await ev('document.getElementById("slog").hidden')) === false)
  await shot('guardian-log')
  await ev('document.getElementById("sclose").click()')
  check('log closes', (await ev('document.getElementById("slog").hidden')) === true)
  await sleep(10500)

  // Karen
  const cap = () => ev('document.getElementById("caption").textContent')
  await ev('__spidey.force(null)')
  await sleep(1500)
  await ev('Karen.handle("status")')
  await sleep(300)
  check('Karen: status', /CPU \d+%.*RAM \d+%/.test(await cap()), await cap())
  await ev('Karen.handle("remind me in 1 hour to test karen")')
  await sleep(300)
  check('Karen: sets reminder', (await ev('__reminders.items.length')) >= 1 && /THWIP/.test(await cap()), await cap())
  await ev('__reminders.items.length = 0')
  await ev('Karen.handle("kill zzz-not-running")')
  await sleep(200)
  check('Karen: asks before kill', /SAY YES/.test(await cap()), await cap())
  await ev('Karen.handle("yes")')
  await sleep(1500)
  check('Karen: kill of missing process fails politely', /NO RUNNING PROCESS/.test(await cap()), await cap())
  await ev('Karen.handle("kill explorer")')
  await ev('Karen.handle("yes")')
  await sleep(800)
  check('Karen: refuses protected process', /PROTECTED/.test(await cap()), await cap())
  await ev('Karen.handle("mute")')
  await sleep(500)
  check('Karen: mute applies', (await ev('window.spidey.getSettings().then((x) => x.sound)')) === false)
  await ev('Karen.handle("unmute")')
  await sleep(500)
  check('Karen: unmute applies', (await ev('window.spidey.getSettings().then((x) => x.sound)')) === true)
  await ev('Karen.handle("write me a poem about tacos")')
  await sleep(1500)
  check('Karen: unknown request is handled', /NOT SURE|THINKING|LOCAL BRAIN|[A-Z]/.test(await cap()))
  await sleep(1000)

  // notification inbox
  await ev('__inbox.items.length = 0; __inbox.toggle(false)')
  await ev('__inbox.onItems([{id:900001,app:"WhatsApp",appId:"t.whatsapp",title:"Mum",body:"Dinner at 8?",at:Date.now()},{id:900002,app:"Mail",appId:"t.mail",title:"Invoice",body:"",at:Date.now()}])')
  check('inbox: badge counts unread', (await ev('document.getElementById("icount").textContent')) === '2')
  check('inbox: badge on the spider shows it too', (await ev('document.getElementById("balert").hidden')) === false)
  await ev('__inbox.onItems([{id:900001,app:"WhatsApp",appId:"t.whatsapp",title:"Mum",body:"dup",at:Date.now()}])')
  check('inbox: duplicates ignored', (await ev('__inbox.items.length')) === 2)
  await ev('document.getElementById("inboxbtn").click()')
  check('inbox: opens with entries', (await ev('document.querySelectorAll("#iitems li").length')) === 2 && (await ev('document.getElementById("inbox").hidden')) === false)
  check('inbox: opening marks read', (await ev('document.getElementById("icount").hidden')) === true)
  await shot('inbox')
  await ev('document.querySelector("#iitems li").click()')
  check('inbox: click dismisses', (await ev('__inbox.items.length')) === 1)
  await ev('document.getElementById("iclear").click()')
  check('inbox: clear empties', (await ev('__inbox.items.length')) === 0)
  await ev('document.getElementById("iclose").click()')

  // Daily Web
  await ev('Day.add("focusMin", 75); Day.add("focusSessions", 3); Day.add("tingle:ram", 4); Day.add("notifs", 12); Day.peak("ram", 99, {name:"chrome", mb:1740}); Day.peak("cpu", 88)')
  await ev('Karen.handle("show me the daily web")')
  await sleep(800)
  check('Daily Web opens from Karen', (await ev('document.getElementById("bugle").hidden')) === false)
  check('Daily Web page is painted', (await ev('(() => { const c = __bugle.paper; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4000) if (d[i] < 80 && d[i + 3] === 255) ink++; return d[3] === 255 ? ink : -1 })()')) > 5)
  await shot('daily-web')
  await ev('document.getElementById("bclose").click()')
  check('Daily Web closes', (await ev('document.getElementById("bugle").hidden')) === true)

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
  check('focus streak shown', /★1/.test(await ev('document.getElementById("tmode").textContent')) || /★/.test(await ev('document.getElementById("tmode").textContent')))
  await ev('__spidey.timer.mode="focus"; __spidey.timer.running=true')
  check('focus timer => system alerts quiet', await ev('__spidey.focusQuiet()'))
  await ev('__spidey.timer.running=false')
  await shot('timer-done')

  ws.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
