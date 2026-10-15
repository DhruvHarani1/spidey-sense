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

  const settings = { sound: true, opacity: 1 }
  const state = {
    target: [0, 0, 0, 0, 0], // 0-100 "danger" per axis
    shown: [0, 0, 0, 0, 0],
    raw: null,
    level: 'calm',
    streak: { dir: 0, n: 0 },
    battery: { level: 1, charging: true, present: false },
    timerAlert: 0,
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
    state.target.forEach((v, i) => {
      if (v > state.target[best]) best = i
    })
    const r = raw
    switch (AXES[best]) {
      case 'cpu':
        return `CPU REDLINING AT ${Math.round(r.cpu)}%!`
      case 'ram':
        return `MEMORY AT ${Math.round(r.ram)}% — SOMETHING’S HOARDING!`
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

  function onStats(raw) {
    if (override) raw = { ...raw, ...override.raw }
    state.raw = raw
    state.target = dangerFrom(raw)
    if (override && override.danger) override.danger.forEach((v, i) => v != null && (state.target[i] = v))

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
      li.dataset.hot = state.target[i] >= TINGLE_AT ? '2' : state.target[i] >= ALERT_AT ? '1' : '0'
    })

    updateLevel()
    schedule()
  }

  function rawLevel() {
    const max = Math.max(...state.target)
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
    if (level === 'tingle' && prev !== 'tingle') onTingle()
    refreshCaption(true)
    schedule()
  }

  function refreshCaption(force) {
    let text
    if (state.timerAlert > Date.now()) text = timer.mode === 'focus' ? 'TIME! BREAK SWING — YOU EARNED IT!' : 'BREAK OVER — BACK TO THE WEB!'
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

  function onTingle() {
    chirp()
    if (state.timerAlert > Date.now()) return
    const kind = AXES[state.target.indexOf(Math.max(...state.target))]
    window.spidey.notify(kind, 'Spider-sense tingling!', culprit(state.raw || { cpu: 0, ram: 0, disk: 0, online: true }).replace(/!$/, '.'))
  }

  // ------------------------------------------------------------ web timer
  const timer = { mode: 'focus', left: 25 * 60, running: false, last: 0 }
  const MODES = { focus: 25 * 60, break: 5 * 60 }
  const clock = $('tclock')
  const go = $('tgo')
  const modeBtn = $('tmode')

  function renderTimer() {
    const m = Math.floor(timer.left / 60)
    const s = timer.left % 60
    clock.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    go.textContent = timer.running ? '❚❚' : '▶'
    modeBtn.textContent = timer.mode === 'focus' ? 'FOCUS' : 'BREAK'
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
  function timerDone() {
    timer.running = false
    const finished = timer.mode
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
    const hot = state.target.map((v) => (v >= ALERT_AT ? 1 : 0))
    window.Spider.drawWeb(ctx, W, H, { values: state.shown, labels: LABELS, level: state.level, t: (now - t0) / 1000, hot })
    if (moving || state.level !== 'calm') raf = requestAnimationFrame(frame)
  }

  // ------------------------------------------------------------ wiring
  window.spidey.onStats(onStats)
  window.spidey.getSettings().then(applySettings)
  window.spidey.onSettings(applySettings)
  function applySettings(s) {
    settings.sound = !!s.sound
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
  window.addEventListener('focus', schedule)
  schedule()

  if (test) {
    window.__spidey = {
      state,
      timer,
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
