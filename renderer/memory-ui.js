'use strict'
/* Web Memory overlay: the last 24 hours as two lines (CPU, RAM) with the worst moments and what was running. Tap the chart to inspect a minute. */
;(function () {
  const $ = (id) => document.getElementById(id)
  const box = $('memory')
  const cv = $('mcanvas')
  const tip = $('mtip')
  const list = $('mworst')
  const dpr = window.devicePixelRatio || 1
  const W = 232
  const H = 104
  cv.width = W * dpr
  cv.height = H * dpr
  const g = cv.getContext('2d')
  g.scale(dpr, dpr)
  const M = window.WebMemory
  const DAY = 24 * 60 * 60000
  let selected = null

  const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const gb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`)

  function draw() {
    const now = Date.now()
    const t0 = now - DAY
    const x = (t) => 4 + ((t - t0) / DAY) * (W - 8)
    const y = (v) => H - 14 - (Math.min(100, Math.max(0, v)) / 100) * (H - 22)
    g.clearRect(0, 0, W, H)
    g.fillStyle = '#0a1131'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(160,180,255,0.18)'
    g.lineWidth = 1
    g.font = '7px sans-serif'
    g.fillStyle = 'rgba(200,210,255,0.6)'
    for (const v of [25, 50, 75, 100]) {
      g.beginPath()
      g.moveTo(4, y(v))
      g.lineTo(W - 4, y(v))
      g.stroke()
    }
    for (let h = 0; h <= 24; h += 6) {
      const tx = x(t0 + h * 3600000)
      g.fillText(h === 24 ? 'NOW' : `-${24 - h}H`, Math.min(W - 18, Math.max(2, tx - 6)), H - 3)
    }
    const s = M.series()
    const line = (key, color, width) => {
      g.strokeStyle = color
      g.lineWidth = width
      g.beginPath()
      let started = false
      let prev = 0
      for (const p of s) {
        if (started && p.t - prev > 5 * 60000) started = false // a gap (the PC was off): lift the pen
        const px = x(p.t)
        const py = y(p[key])
        if (!started) g.moveTo(px, py)
        else g.lineTo(px, py)
        started = true
        prev = p.t
      }
      g.stroke()
    }
    line('ramMax', 'rgba(255,90,90,0.35)', 1)
    line('cpuMax', 'rgba(74,155,255,0.35)', 1)
    line('ram', '#ff5a5a', 1.6)
    line('cpu', '#4a9bff', 1.6)
    g.fillStyle = '#ffd83a'
    for (const ev of M.events()) g.fillRect(x(ev.at) - 1, H - 14, 2, 4)
    if (selected) {
      g.strokeStyle = '#ffd83a'
      g.beginPath()
      g.moveTo(x(selected), 2)
      g.lineTo(x(selected), H - 12)
      g.stroke()
    }
  }

  function describe(t) {
    const p = M.at(t)
    if (!p) return 'NO DATA AT THAT TIME.'
    const parts = [`${hhmm(p.t)}  CPU ${Math.round(p.cpu)}% (PEAK ${Math.round(p.cpuMax)}%)  RAM ${Math.round(p.ram)}% (PEAK ${Math.round(p.ramMax)}%)`]
    if (p.hog) parts.push(`BIGGEST: ${p.hog.toUpperCase()} ${gb(p.mb)}`)
    if (p.events.length) parts.push(`HAPPENED: ${p.events.join(' · ').toUpperCase()}`)
    return parts.join('\n')
  }

  function select(t) {
    selected = t
    tip.textContent = describe(t)
    draw()
  }

  function renderWorst() {
    const w = M.worst(3)
    list.replaceChildren(
      ...(w.length
        ? w.map((m) => {
            const li = document.createElement('li')
            const b = document.createElement('b')
            b.textContent = `${hhmm(m.t)} ${m.kind.toUpperCase()} ${Math.round(m.value)}%`
            const sp = document.createElement('span')
            sp.textContent = m.hog ? `${m.hog.toUpperCase()}${m.mb ? ' ' + gb(m.mb) : ''}` : 'NO NAME RECORDED'
            li.append(b, sp)
            li.addEventListener('click', () => select(m.t))
            return li
          })
        : [Object.assign(document.createElement('li'), { className: 'empty', textContent: M.size < 5 ? 'STILL LEARNING YOUR DAY. CHECK BACK SOON.' : 'NO BAD MOMENTS. SMOOTH DAY.' })])
    )
  }

  function open() {
    window.Panels.closeOthers('memory')
    if (document.body.dataset.view !== 'panel') window.spidey.setView('panel')
    box.hidden = false
    selected = null
    tip.textContent = 'TAP THE CHART TO SEE ANY MINUTE.'
    renderWorst()
    draw()
  }
  const close = () => {
    box.hidden = true
  }

  const at = (ev) => {
    const r = cv.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * W
    return Date.now() - DAY + ((px - 4) / (W - 8)) * DAY
  }
  cv.addEventListener('click', (ev) => select(at(ev)))
  cv.addEventListener('mousemove', (ev) => {
    if (ev.buttons) select(at(ev))
  })
  $('mclose').addEventListener('click', close)
  $('membtn').addEventListener('click', () => (box.hidden ? open() : close()))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })

  window.spidey.onOpenMemory(open)
  window.Memory = { open, close, draw, select }
  if (window.Core.test) window.__memory = { open, close, select, get hidden() { return box.hidden } }
})()
