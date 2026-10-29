'use strict'
;(function () {
  const AXES = ['cpu', 'ram', 'disk', 'bat', 'net']
  const LABELS = ['CPU', 'RAM', 'DISK', 'BAT', 'NET']
  const ALERT_AT = 75
  const TINGLE_AT = 90
  const UP_STREAK = 3
  const DOWN_STREAK = 5

  const $ = (id) => document.getElementById(id)
  const panel = $('panel')
  const canvas = $('web')
  const ctx = canvas.getContext('2d')
  const caption = $('caption')
  const readout = $('readout')

  // crisp on HiDPI
  const dpr = window.devicePixelRatio || 1
  const W = 260
  const H = 248
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const settings = { sound: true, opacity: 1, ramMode: 'auto', eyeBreak: true }
  const activity = { activeS: 0 }
  const EYE_AFTER_S = 20 * 60
  const ramHistory = []
  const RAM_BASELINE_KEY = 'spidey.ramBaseline'
  const ramBaseline = require('./ram-baseline')
  const ramAlert = ramBaseline.createRamAlert(
    ramBaseline.createStore(localStorage, RAM_BASELINE_KEY),
    settings,
    ramHistory,
    () => new Date().getHours()
  )
  const state = {
    target: [0, 0, 0, 0, 0], // 0-100 value drawn per axis
    alert: [0, 0, 0, 0, 0], // what actually drives alert levels (RAM is baseline-aware)
    shown: [0, 0, 0, 0, 0],
    raw: null,
    level: 'calm',
    streak: { dir: 0, n: 0 },
    battery: { level: 1, charging: true, present: false },
    timerAlert: 0,
    say: null, // Karen's latest reply, shown in the caption for a while
    sayUntil: 0,
    note: null, // one-off message that overrides the caption while a reminder fires
    lastChirp: 0
  }
  const test = new URLSearchParams(location.search).has('test')
  let override = null

  // ------------------------------------------------------------ copy
  const CALM = ['ALL QUIET… FOR NOW.', 'NO TINGLE. SMOOTH SWINGING.', 'WITH GREAT POWER COMES… STABLE FPS.', 'YOUR FRIENDLY NEIGHBOURHOOD CPU.', 'WEB’S HOLDING STRONG.']
  const ALERT = ['SOMETHING’S OFF…', 'HOLD ON — A FAINT TINGLE.', 'KEEPING AN EYE ON THINGS.']
  let calmIdx = Math.floor(Math.random() * CALM.length)

  function culprit(raw) {
    // the axis with the highest danger
    let best = 0
    state.alert.forEach((v, i) => {
      if (v > state.alert[best]) best = i
    })
    const r = raw
    switch (AXES[best]) {
      case 'cpu':
        return `CPU REDLINING AT ${Math.round(r.cpu)}%!`
      case 'ram':
        return r.hog ? `MEMORY SPIKE (${Math.round(r.ram)}%) — ${r.hog.name.toUpperCase()} HOARDING ${r.hog.mb} MB!` : `MEMORY SPIKE AT ${Math.round(r.ram)}%!`
      case 'disk':
        return `DISK ${Math.round(r.disk)}% FULL — TIME TO CLEAN UP!`
      case 'bat':
        return `BATTERY ${Math.round(state.battery.level * 100)}% — SWING TO A CHARGER!`
      default:
        return r.online ? `LAG ${Math.round(r.latencyMs || 0)} ms — THE WEB’S STICKY!` : 'WEB’S DOWN — NO CONNECTION!'
    }
  }

  // ------------------------------------------------------------ stats → danger
  function dangerFrom(raw) {
    const bat = state.battery
    const batDanger = bat.present && !bat.charging ? 100 - bat.level * 100 : 0
    let net = 0
    if (!raw.online) net = 100
    else if (raw.latencyMs != null) net = Math.min(100, raw.latencyMs / 5)
    return [raw.cpu, raw.ram, raw.disk, batDanger, net]
  }

  /** idle => badge naps; 20 min of continuous use => look-away nudge; a 2 min pause counts as a real break */
  function trackActivity(idleS) {
    if (!Number.isFinite(idleS)) return
    document.body.dataset.idle = idleS >= 180 ? '1' : '0'
    if (idleS < 60) {
      activity.activeS++
      window.Day.add('activeS')
    }
    else if (idleS >= 120) activity.activeS = 0
    if (settings.eyeBreak && activity.activeS >= EYE_AFTER_S) {
      activity.activeS = 0
      fireNote('20-20-20! LOOK 20 FT AWAY FOR 20 SECONDS.', 'eye')
    }
  }

  function onStats(raw) {
    if (override) raw = { ...raw, ...override.raw }
    state.raw = raw
    trackActivity(raw.idleS)
    if (!override) window.WebMemory.push(raw)
    window.Day.peak('cpu', raw.cpu)
    window.Day.peak('ram', raw.ram, raw.hog)
    window.Day.peak('disk', raw.disk)
    window.Day.peak('latency', raw.latencyMs)
    state.target = dangerFrom(raw)
    if (override && override.danger) override.danger.forEach((v, i) => v != null && (state.target[i] = v))
    state.alert = state.target.slice()
    // a filling disk changes slowly; only worry when it is really close to full
    if (!(override && override.danger && override.danger[2] != null)) state.alert[2] = raw.disk >= 95 ? 92 : raw.disk >= 90 ? 78 : 0
    state.alert[1] = override && override.alertRam != null ? override.alertRam : ramAlert(raw.ram)

    // readout chips
    const bat = state.battery
    const text = [
      `${Math.round(raw.cpu)}%`,
      `${Math.round(raw.ram)}%`,
      `${Math.round(raw.disk)}%`,
      bat.present ? `${Math.round(bat.level * 100)}%${bat.charging ? '⚡' : ''}` : 'AC',
      !raw.online ? 'OFF' : raw.latencyMs != null ? `${Math.round(raw.latencyMs)}ms` : raw.probing ? '…' : 'ON'
    ]
    readout.querySelectorAll('li').forEach((li, i) => {
      li.querySelector('span').textContent = text[i]
      li.dataset.hot = state.alert[i] >= TINGLE_AT ? '2' : state.alert[i] >= ALERT_AT ? '1' : '0'
    })

    updateLevel()
    schedule()
  }

  function rawLevel() {
    const max = Math.max(...state.alert)
    return max >= TINGLE_AT ? 'tingle' : max >= ALERT_AT ? 'alert' : 'calm'
  }
  const RANK = { calm: 0, alert: 1, tingle: 2 }

  function updateLevel() {
    let want = rawLevel()
    if (state.timerAlert > Date.now()) want = 'tingle'
    const diff = Math.sign(RANK[want] - RANK[state.level])
    if (diff === 0) {
      state.streak = { dir: 0, n: 0 }
    } else {
      state.streak = state.streak.dir === diff ? { dir: diff, n: state.streak.n + 1 } : { dir: diff, n: 1 }
      const need = diff > 0 ? UP_STREAK : DOWN_STREAK
      if (test || state.streak.n >= need) setLevel(want)
    }
    refreshCaption()
  }

  function setLevel(level) {
    const prev = state.level
    state.level = level
    state.streak = { dir: 0, n: 0 }
    panel.dataset.level = level
    $('bbody').dataset.level = level
    if (level === 'tingle' && prev !== 'tingle') onTingle()
    refreshCaption(true)
    schedule()
  }

  function refreshCaption(force) {
    let text
    if (state.note && state.timerAlert > Date.now()) text = state.note
    else if (state.timerAlert > Date.now()) text = timer.mode === 'focus' ? 'TIME! BREAK SWING — YOU EARNED IT!' : 'BREAK OVER — BACK TO THE WEB!'
    else if (state.say && state.sayUntil > Date.now()) text = state.say
    else if (state.level === 'tingle') text = culprit(state.raw || { cpu: 0, ram: 0, disk: 0, online: true })
    else if (state.level === 'alert') text = ALERT[calmIdx % ALERT.length]
    else text = CALM[calmIdx % CALM.length]
    if (force || caption.textContent !== text) caption.textContent = text
  }
  setInterval(() => {
    if (state.level !== 'tingle') {
      calmIdx++
      refreshCaption(true)
    }
  }, 30000)

  // ------------------------------------------------------------ spider-sense effects
  let audio = null
  function chirp() {
    if (!settings.sound) return
    const now = Date.now()
    if (now - state.lastChirp < 45000 && !test) return
    state.lastChirp = now
    try {
      audio = audio || new AudioContext()
      const t0 = audio.currentTime
      for (let k = 0; k < 3; k++) {
        const o = audio.createOscillator()
        const g = audio.createGain()
        o.type = 'triangle'
        o.frequency.setValueAtTime(1100, t0 + k * 0.13)
        o.frequency.exponentialRampToValueAtTime(1900, t0 + k * 0.13 + 0.09)
        g.gain.setValueAtTime(0.0001, t0 + k * 0.13)
        g.gain.exponentialRampToValueAtTime(0.09, t0 + k * 0.13 + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.13 + 0.11)
        o.connect(g).connect(audio.destination)
        o.start(t0 + k * 0.13)
        o.stop(t0 + k * 0.13 + 0.12)
      }
    } catch {
      /* audio unavailable */
    }
  }

  /** during a running focus timer, system alerts stay visual only (reminders and the timer itself still speak up) */
  const focusQuiet = () => timer.running && timer.mode === 'focus'

  function onTingle() {
    window.Day.add('tingle:' + AXES[state.alert.indexOf(Math.max(...state.alert))])
    window.WebMemory.mark('tingle', culprit(state.raw || { cpu: 0, ram: 0, disk: 0, online: true }).replace(/!$/, ''))
    if (focusQuiet()) return
    chirp()
    if (state.timerAlert > Date.now()) return
    const kind = AXES[state.alert.indexOf(Math.max(...state.alert))]
    window.spidey.notify(kind, 'Spider-sense tingling!', culprit(state.raw || { cpu: 0, ram: 0, disk: 0, online: true }).replace(/!$/, '.'))
  }

  // ------------------------------------------------------------ web timer
  const timer = { mode: 'focus', left: 25 * 60, running: false, last: 0 }
  const MODES = { focus: 25 * 60, break: 5 * 60 }
  const todayKey = () => new Date().toDateString()
  let streak = { day: todayKey(), n: 0 }
  try {
    const s = JSON.parse(localStorage.getItem('spidey.streak') || 'null')
    if (s && s.day === todayKey() && Number.isInteger(s.n)) streak = s
  } catch {
    /* ignore */
  }
  const clock = $('tclock')
  const go = $('tgo')
  const modeBtn = $('tmode')

  function renderTimer() {
    const m = Math.floor(timer.left / 60)
    const s = timer.left % 60
    clock.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    go.textContent = timer.running ? '❚❚' : '▶'
    if (streak.day !== todayKey()) streak = { day: todayKey(), n: 0 }
    modeBtn.textContent = (timer.mode === 'focus' ? 'FOCUS' : 'BREAK') + (streak.n ? ' ★' + streak.n : '')
    modeBtn.dataset.mode = timer.mode
  }
  function timerTick() {
    if (!timer.running) return
    const now = Date.now()
    const dt = Math.round((now - timer.last) / 1000)
    if (dt < 1) return
    timer.last += dt * 1000
    timer.left = Math.max(0, timer.left - dt)
    if (timer.left === 0) timerDone()
    renderTimer()
  }
  /** Make the widget tingle for a few seconds with a custom caption (used by reminders). */
  function fireNote(text, kind) {
    window.Day.add('note:' + String(kind).split(':')[0])
    const base = String(kind).split(':')[0]
    if (base === 'eye' || base === 'remind') window.Suits.award(base)
    if (String(kind) === 'level' && window.Badge) window.Badge.levelUp()
    state.note = text
    state.timerAlert = Date.now() + 10000
    chirp()
    window.spidey.notify(kind, 'Spider-sense tingling!', text)
    setLevel('tingle')
    setTimeout(() => {
      if (state.timerAlert > Date.now()) return
      state.note = null
      updateLevel()
      setLevel(rawLevel())
    }, 10200)
  }
  /** Karen speaks: a caption for a few seconds */
  function say(text, ms = 12000) {
    state.say = text
    state.sayUntil = Date.now() + ms
    refreshCaption(true)
    setTimeout(() => refreshCaption(true), ms + 100)
  }

  function timerOp(op) {
    if (op === 'pause') {
      if (timer.running) go.click()
    } else if (op === 'reset') {
      $('treset').click()
    } else if (op === 'focus' || op === 'break') {
      if (timer.mode !== op) modeBtn.click()
      if (!timer.running) go.click()
    }
  }

  function snapshot() {
    return { stats: state.raw, battery: state.battery, timer: { mode: timer.mode, left: timer.left, running: timer.running }, level: state.level }
  }

  /** the badge count: Guardian alerts that you have not looked at yet */
  const unread = { guardian: 0 }
  function setUnread(kind, n) {
    unread[kind] = n
    const total = unread.guardian
    const b = $('balert')
    b.hidden = total === 0
    b.textContent = total > 99 ? '99+' : String(total)
    document.body.dataset.unread = total ? '1' : '0'
  }

  /** which of the five axes is worst right now ('cpu' | 'ram' | 'disk' | 'bat' | 'net') */
  const hotAxis = () => AXES[state.alert.indexOf(Math.max(...state.alert))]

  /** what the badge's face should show besides the level (low battery, offline, CPU hot, focus progress) */
  function moods() {
    const bat = state.battery
    const raw = state.raw
    return {
      lowbat: !!(bat.present && !bat.charging && bat.level < 0.2),
      offline: !!(raw && raw.online === false),
      hot: state.level !== 'calm' && hotAxis() === 'cpu',
      focus: timer.running && timer.mode === 'focus' ? 1 - timer.left / MODES.focus : null
    }
  }

  window.Core = { fireNote, say, timerOp, snapshot, setUnread, hotAxis, moods, repaint: () => schedule(), getSettings: () => settings, test }

  function timerDone() {
    state.note = null
    timer.running = false
    const finished = timer.mode
    if (finished === 'focus') {
      window.Day.add('focusMin', 25)
      window.Day.add('focusSessions')
      window.Suits.award('focus')
      if (streak.day !== todayKey()) streak = { day: todayKey(), n: 0 }
      streak.n++
      try {
        localStorage.setItem('spidey.streak', JSON.stringify(streak))
      } catch {
        /* ignore */
      }
    }
    timer.mode = finished === 'focus' ? 'break' : 'focus'
    timer.left = MODES[timer.mode]
    state.timerAlert = Date.now() + 8000
    chirp()
    window.spidey.notify('timer', finished === 'focus' ? 'Web timer: focus done!' : 'Web timer: break over!', finished === 'focus' ? 'Time for a break — swing away from the screen.' : 'Back to work, web-head.')
    updateLevel()
    setLevel('tingle')
    setTimeout(() => {
      state.timerAlert = 0
      updateLevel()
    }, 8200)
  }
  go.addEventListener('click', () => {
    timer.running = !timer.running
    timer.last = Date.now()
    renderTimer()
  })
  $('treset').addEventListener('click', () => {
    timer.running = false
    timer.left = MODES[timer.mode]
    renderTimer()
  })
  modeBtn.addEventListener('click', () => {
    timer.mode = timer.mode === 'focus' ? 'break' : 'focus'
    timer.running = false
    timer.left = MODES[timer.mode]
    renderTimer()
  })
  setInterval(timerTick, 250)
  renderTimer()

  // ------------------------------------------------------------ drawing loop (only runs while something moves)
  let raf = 0
  let t0 = performance.now()
  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame)
  }
  function frame(now) {
    raf = 0
    let moving = false
    for (let i = 0; i < state.shown.length; i++) {
      const d = state.target[i] - state.shown[i]
      if (Math.abs(d) > 0.15) {
        state.shown[i] += d * 0.14
        moving = true
      } else state.shown[i] = state.target[i]
    }
    const hot = state.alert.map((v) => (v >= ALERT_AT ? 1 : 0))
    window.Spider.drawWeb(ctx, W, H, { values: state.shown, labels: LABELS, level: state.level, t: (now - t0) / 1000, hot, reduce: document.body.dataset.reduce === '1' })
    if (moving || state.level !== 'calm') raf = requestAnimationFrame(frame)
  }

  // ------------------------------------------------------------ badge: click opens, drag moves
  {
    const badge = $('badge')
    let down = null
    badge.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      badge.setPointerCapture(e.pointerId)
      down = { x: e.screenX, y: e.screenY, moved: false }
    })
    badge.addEventListener('pointermove', (e) => {
      if (!down) return
      const dx = e.screenX - down.x
      const dy = e.screenY - down.y
      if (!down.moved && Math.hypot(dx, dy) < 5) return
      if (!down.moved) window.spidey.drag.start()
      down.moved = true
      window.spidey.drag.move(dx, dy)
      if (window.Badge) window.Badge.nudge(Math.max(-0.4, Math.min(0.4, e.movementX * 0.04)))
    })
    const finish = () => {
      if (!down) return
      if (down.moved) {
        window.spidey.drag.end()
        if (window.Badge) window.Badge.dragEnd()
      } else {
        if (window.Badge) window.Badge.click()
        window.spidey.setView('panel')
      }
      down = null
    }
    badge.addEventListener('pointerup', finish)
    badge.addEventListener('pointercancel', () => {
      if (down && down.moved) window.spidey.drag.end()
      down = null
    })
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') window.spidey.setView('panel')
    })
    $('collapse').addEventListener('click', () => window.spidey.setView('badge'))
  }

  // ------------------------------------------------------------ wiring
  window.spidey.onStats(onStats)
  window.spidey.getSettings().then(applySettings)
  window.spidey.onSettings(applySettings)
  function applySettings(s) {
    settings.sound = !!s.sound
    settings.ramMode = s.ramMode || 'auto'
    settings.eyeBreak = s.eyeBreak !== false
    settings.shield = s.shield || 'smart'
    if (window.Badge) window.Badge.setMotion(s.motion)
    document.body.dataset.view = s.view === 'panel' ? 'panel' : 'badge'
    schedule()
  }
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      const read = () => {
        state.battery = { level: b.level, charging: b.charging, present: !(b.charging && b.level === 1 && b.chargingTime === 0 && b.dischargingTime === Infinity) }
      }
      read()
      b.addEventListener('levelchange', read)
      b.addEventListener('chargingchange', read)
    })
  }
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    if (!(e.target instanceof HTMLInputElement)) window.spidey.showMenu()
  })
  window.addEventListener('focus', schedule)
  schedule()

  if (test) {
    window.__spidey = {
      state,
      timer,
      activity,
      trackActivity,
      focusQuiet: () => focusQuiet(),
      ramAlert,
      ramHistory,
      settings,
      /** force readings: { raw: {cpu, ram, ...}, danger: [..] } or null to release */
      force(o) {
        override = o
      },
      setBattery(b) {
        state.battery = { ...state.battery, ...b }
      },
      finishTimer() {
        timer.left = 1
        timer.running = true
        timer.last = Date.now() - 1100
      }
    }
  }
})()
