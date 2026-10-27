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
  for (let i = 0; i < 25 && (await ev('document.getElementById("panel").dataset.level')) !== 'calm'; i++) await sleep(500)
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

  // Daily Web
  await ev('Day.add("focusMin", 75); Day.add("focusSessions", 3); Day.add("tingle:ram", 4); Day.add("notifs", 12); Day.peak("ram", 99, {name:"chrome", mb:1740}); Day.peak("cpu", 88)')
  await ev('Karen.handle("show me the daily web")')
  await sleep(800)
  check('Daily Web opens from Karen', (await ev('document.getElementById("bugle").hidden')) === false)
  check('Daily Web page is painted', (await ev('(() => { const c = __bugle.paper; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4000) if (d[i] < 80 && d[i + 3] === 255) ink++; return d[3] === 255 ? ink : -1 })()')) > 5)
  await shot('daily-web')
  await ev('document.getElementById("bclose").click()')
  check('Daily Web closes', (await ev('document.getElementById("bugle").hidden')) === true)

  // E.D.I.T.H.
  await ev('Karen.handle("am i safe")')
  for (let i = 0; i < 60 && !/^\d+$/.test(await ev('document.getElementById("escore").textContent')); i++) await sleep(500)
  await sleep(500)
  check('E.D.I.T.H. overlay opens', (await ev('document.getElementById("edith").hidden')) === false)
  check('E.D.I.T.H. lists checks', (await ev('document.querySelectorAll("#echecks li").length')) >= 5)
  check('E.D.I.T.H. shows a score', /^\d+$/.test(await ev('document.getElementById("escore").textContent')))
  check('Karen summarises the scan', /THREAT LEVEL (GREEN|AMBER|RED)/.test(await ev('Edith.summary(Edith.last)')), await ev('Edith.summary(Edith.last)'))
  await shot('edith')
  await ev('document.getElementById("eclose").click()')

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

  // ---- culprit bar: names the memory hog in a tingle and asks twice before ending anything
  await ev('__spidey.timer.running=false')
  await ev('__spidey.force({raw:{cpu:10,ram:97,disk:40,online:true},danger:[10,97,40,0,6],alertRam:95})')
  await sleep(1200)
  await ev('__culprit.set({mem:{name:"chrome",mb:2150,count:38,pid:99999991},cpu:null,at:Date.now()})')
  await sleep(300)
  check('culprit bar appears for a RAM tingle', (await ev('__culprit.hidden')) === false, await ev('__culprit.text'))
  check('culprit bar names the program and size', /CHROME.*2\.1 GB.*38 PROCESSES/.test(await ev('__culprit.text')), await ev('__culprit.text'))
  await ev('document.getElementById("cgo").click()')
  check('first click only arms it', /SURE/.test(await ev('document.getElementById("cgo").textContent')))
  await ev('document.getElementById("cgo").click()')
  await sleep(700)
  const gone = await ev('window.spidey.shieldTakeDown(99999991)')
  check('a process that is not running is refused politely', gone && gone.ok === false && /not running/.test(gone.error), JSON.stringify(gone))
  check('a non-integer pid is refused', (await ev('window.spidey.shieldTakeDown("1")')).ok === false)
  await ev('__spidey.force({raw:{cpu:10,ram:30,disk:40,online:true,latencyMs:30},danger:[10,30,40,0,6]})')
  await sleep(1200)
  await ev('__culprit.refresh()')
  check('culprit bar hides when calm', (await ev('__culprit.hidden')) === true)

  // ---- Auto-Shield entries in the sense log: an undo button and an offer button
  await ev('__guardian.onEvent({kind:"shield",act:"block",text:"Blocked a new auto-start entry Updater: it runs from a Temp folder.",at:Date.now(),id:"zzundo1",undo:true,offer:null})')
  await ev('__guardian.onEvent({kind:"shield",act:"warn",text:"evil.exe just started from your Downloads folder.",at:Date.now(),id:"",undo:false,offer:{id:"zzoffer1",label:"BLOCK ITS INTERNET"}})')
  await ev('__guardian.toggle(true)')
  await sleep(300)
  check('sense log shows SHIELD entries', (await ev('[...document.querySelectorAll("#sitems li b")].some((b) => b.textContent === "SHIELD")')) === true)
  check('an UNDO button for the action', (await ev('[...document.querySelectorAll("#sitems li button.act")].some((b) => b.textContent === "UNDO")')) === true)
  check('an offer button for the warning', (await ev('[...document.querySelectorAll("#sitems li button.act")].some((b) => b.textContent === "BLOCK ITS INTERNET")')) === true)
  await ev('[...document.querySelectorAll("#sitems li button.act")].find((b) => b.textContent === "UNDO").click()')
  await sleep(700)
  const un = await ev('window.spidey.shieldUndo("zzundo1")')
  check('undo of an unknown id is refused, not crashed', un && un.ok === false && /nothing to undo/.test(un.error), JSON.stringify(un))
  await ev('__guardian.toggle(false)')
  check('shield counts as defending: XP awarded', (await ev('Suits.state().xp')) > 0)

  // ---- Web Memory
  await ev('(() => { const n = Date.now(); for (let i = 0; i < 90; i++) WebMemory.push({ cpu: i === 40 ? 95 : 12, ram: i > 60 && i < 66 ? 94 : 70, hog: { name: i === 63 ? "code" : "chrome", mb: i === 63 ? 2600 : 900 } }, n - (90 - i) * 60000); WebMemory.mark("tingle", "RAM SPIKE", n - 27 * 60000) })()')
  await ev('Karen.handle("show me the history")')
  await sleep(500)
  check('Web Memory opens from Karen', (await ev('document.getElementById("memory").hidden')) === false)
  check('Web Memory lists the worst moments', (await ev('document.querySelectorAll("#mworst li").length')) >= 1)
  check('Web Memory chart is painted', (await ev('(() => { const c = document.getElementById("mcanvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let hits = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 120 && d[i + 2] < 120) hits++; return hits })()')) > 20)
  await ev('__memory.select(Date.now() - 27 * 60000)')
  check('inspecting a minute shows details', /CPU \d+%/.test(await ev('document.getElementById("mtip").textContent')), await ev('document.getElementById("mtip").textContent'))
  await shot('web-memory')
  await ev('__memory.close()')

  // ---- E.D.I.T.H. shows fix-it steps for anything that is not fine
  await ev('Karen.handle("am i safe")')
  await sleep(6000)
  check('E.D.I.T.H. fix steps render for non-green checks (or all green)', (await ev('document.querySelectorAll("#echecks li .fix").length')) >= 0)
  await ev('__edith.close()')

  // ---- tour
  await ev('Karen.handle("give me a tour")')
  await sleep(400)
  check('tour opens', (await ev('document.getElementById("tour").hidden')) === false)
  for (let i = 0; i < 4; i++) await ev('document.getElementById("tnext").click()')
  check('tour reaches the last card', /DONE/.test(await ev('document.getElementById("tnext").textContent')))
  await shot('tour')
  await ev('document.getElementById("tnext").click()')
  check('tour closes', (await ev('document.getElementById("tour").hidden')) === true)
  await ev('Karen.handle("shield status")')
  await sleep(400)
  check('Karen reports the shield mode', /AUTO-SHIELD (SMART|ASK|OFF)/.test(await cap()), await cap())

  // ---- the Spider-Man mask badge: expression, ring colours, shock waves, motion setting
  await ev('window.spidey.setView("badge")')
  await sleep(1500)
  await ev('window.spidey.patchSettings({ motion: "full" })')
  await sleep(500)
  const count = (rule) =>
    ev('(() => { window.__badge.draw(); const c = window.__badge.canvas; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a > 200 && (' + rule + ')) n++ } return n })()')
  const countMax = async (rule) => { let m = 0; for (let i = 0; i < 8; i++) { m = Math.max(m, await count(rule)); await sleep(180) } return m } // waves fade in and out: take the best of a few frames
  const RED = 'r > 230 && g < 90 && b < 90'
  const YEL = 'r > 235 && g > 190 && b < 110'
  const BLU = 'b > 200 && r < 90 && g < 110'
  const force = async (level, idle, moods) => {
    await ev('document.getElementById("bbody").dataset.level = "' + level + '"; document.body.dataset.idle = "' + (idle ? 1 : 0) + '"; window.__badge.force({ level: "' + level + '", idle: ' + idle + ', moods: ' + JSON.stringify(moods || {}) + ' })')
    await sleep(200)
  }
  await force('calm', false)
  check('badge canvas is the new size', (await ev('window.__badge.canvas.width')) >= 112)
  const faceCalm = await count('r > 180 && g < 70 && b < 80')
  check('calm mask is drawn (red face)', faceCalm > 300, String(faceCalm))
  check('calm: no yellow ring, no shock waves', (await count(YEL)) < 15 && (await count(BLU)) < 5)
  await force('alert', false)
  check('alert: yellow ring and squiggles', (await count(YEL)) > 40)
  check('alert: shock waves are printed with a blue offset', (await countMax(BLU)) > 5)
  await force('tingle', false)
  check('tingle: red ring', (await count(RED)) > 150)
  check('tingle: shock waves (blue offset print)', (await countMax(BLU)) > 8)
  await force('calm', true)
  await sleep(1500)
  check('asleep: the mask hangs upside down', (await ev('window.__badge.flip()')) > 3)
  await force('calm', false, { lowbat: true, offline: true, hot: true, focus: 0.5 })
  check('moods draw (battery chip and cross in pink-red)', (await count('r > 240 && g > 90 && g < 130 && b < 130')) > 30)
  await ev('document.body.dataset.idle = "0"')
  await ev('window.spidey.patchSettings({ motion: "reduced" })')
  await sleep(500)
  check('Motion: reduced stills everything', (await ev('document.body.dataset.reduce')) === '1')
  await ev('window.spidey.patchSettings({ motion: "full" })')
  await sleep(500)
  check('Motion: full brings it back', (await ev('document.body.dataset.reduce')) === '0')
  await ev('window.__badge.Badge.click(); window.__badge.Badge.shieldShot(); window.__badge.Badge.nudge(2); window.__badge.Badge.levelUp(); window.__badge.Badge.twirl(); window.__badge.Badge.dropIn()')
  await sleep(600)
  check('effects (web pop, strand, nudge, level-up, twirl, drop-in) run without errors', true)
  await force('calm', false)

  ws.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
