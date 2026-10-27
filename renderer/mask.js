'use strict'
/*
 * The Spider-Man mask: an egg-shaped head with web strands and slanted lenses, and the "spider-sense" shock waves
 * (wavy comic squiggles that ripple out from the head when something is wrong).
 * eyeParams / squigglePoints / waveState / MASKS are pure (unit-tested); the draw functions take a canvas context.
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.Mask = factory()
})(this, function () {
  const TAU = Math.PI * 2

  /** per-suit mask colours: face, highlight, web strands, lens tint (alert colours are fixed elsewhere) */
  const MASKS = {
    classic: { face: '#d4202a', hi: '#ff6b6b', web: '#0b0b12', lens: '#eef4ff' },
    midnight: { face: '#3b4163', hi: '#9aa3cc', web: '#05060d', lens: '#e6ebff' },
    gold: { face: '#b5121b', hi: '#ffd34d', web: '#3a1200', lens: '#fff3c4' },
    neon: { face: '#0b8f86', hi: '#19ffe1', web: '#2a0a5a', lens: '#f2fffd' },
    pop: { face: '#e6007e', hi: '#ff6ec7', web: '#16004d', lens: '#f0fbff' },
    miles: { face: '#14161f', hi: '#565b78', web: '#e11d48', lens: '#ffffff' },
    prism: { face: '#7c3aed', hi: '#a78bfa', web: '#0b1020', lens: '#f3efff' },
    noir: { face: '#3a3a3a', hi: '#d1d5db', web: '#050505', lens: '#f3f4f6' },
    spider2099: { face: '#c026d3', hi: '#f0abfc', web: '#070324', lens: '#e9f9ff' },
    iron: { face: '#b91c1c', hi: '#fbbf24', web: '#2a0707', lens: '#fff6dd' }
  }
  const maskFor = (id) => MASKS[id] || MASKS.classic

  /**
   * Expression for a state.
   * @param {'calm'|'alert'|'tingle'} level
   * @param {boolean} idle   away from the PC: the mask sleeps
   * @param {{lowbat?:boolean}} [moods]
   * @returns {{open:number, ang:number, wide:boolean, pure:boolean, ring:string|null, nap:boolean}}
   */
  function eyeParams(level, idle, moods = {}) {
    if (idle && level === 'calm') return { open: 0.06, ang: 0, wide: false, pure: false, ring: null, nap: true }
    let p
    if (level === 'tingle') p = { open: 1.15, ang: -0.35, wide: true, pure: true, ring: '#ff3b3b', nap: false }
    else if (level === 'alert') p = { open: 0.7, ang: 0.55, wide: false, pure: false, ring: '#ffd83a', nap: false }
    else p = { open: 1, ang: 0, wide: false, pure: false, ring: null, nap: false }
    if (moods.lowbat && level !== 'tingle') {
      p.open *= 0.62
      p.ang -= 0.4
    }
    return p
  }

  /** points of one wavy squiggle (spider-sense mark): along +x for `len`, swaying by `amp`; tapers to nothing at the ends */
  function squigglePoints(len, amp, phase, n = 12) {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const s = i / n
      const taper = Math.sin(s * Math.PI) ** 0.6
      pts.push([s * len, Math.sin(s * Math.PI * 3 + phase) * amp * taper])
    }
    return pts
  }

  /** shock-wave k of `waves`: progress 0..1 (outward travel) and opacity */
  function waveState(t, k, waves, speed) {
    const p = (((t * speed + k / waves) % 1) + 1) % 1
    return { p, alpha: Math.min(1, p * 5) * (1 - p) ** 0.8 }
  }

  /** the two print colours that are offset behind a squiggle (blue + red, like a misregistered comic print) */
  const SQ = {
    tingle: { a: '#2a4de0', b: '#ff3b3b' },
    alert: { a: '#2a4de0', b: '#ffd83a' }
  }

  // ------------------------------------------------------------ drawing
  /** one squiggle starting at (x, y) pointing along `ang` */
  function squiggle(c, x, y, ang, len, amp, phase, lw, cols, alpha) {
    const pts = squigglePoints(len, amp, phase)
    const co = Math.cos(ang)
    const si = Math.sin(ang)
    const path = () => {
      c.beginPath()
      pts.forEach(([px, py], i) => {
        const X = x + px * co - py * si
        const Y = y + px * si + py * co
        if (i) c.lineTo(X, Y)
        else c.moveTo(X, Y)
      })
    }
    c.save()
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.globalAlpha = alpha
    for (const [dx, dy, col, w] of [
      [1.3, 1.3, cols.a, lw],
      [-1.3, -1.3, cols.b, lw],
      [0, 0, '#05060d', lw * 0.7]
    ]) {
      c.save()
      c.translate(dx, dy)
      path()
      c.lineWidth = w
      c.strokeStyle = col
      c.stroke()
      c.restore()
    }
    c.restore()
  }

  /**
   * The shock waves: squiggles ripple out from an ellipse (the head) and fade.
   * @param {{waves?:number, travel?:number, len?:number, amp?:number, lw?:number, gap?:number, positions?:number[], speed?:number}} [o]
   *        positions = angles in degrees (0 = right, -90 = up)
   */
  function drawWaves(c, cx, cy, rx, ry, level, t, reduce, o = {}) {
    if (level === 'calm') return
    const tingle = level === 'tingle'
    const waves = o.waves || (tingle ? 3 : 2)
    const speed = o.speed || (tingle ? 0.95 : 0.5)
    const travel = o.travel ?? 11
    const len = o.len || (tingle ? 13 : 10)
    const amp = o.amp || (tingle ? 3 : 2.3)
    const lw = o.lw || (tingle ? 2.7 : 2.2)
    const gap = o.gap ?? 5
    const cols = SQ[level]
    const pos = o.positions || (tingle ? [-160, -125, -90, -55, -20, 20, 160, 200] : [-150, -90, -30, 20, 160])
    for (let k = 0; k < waves; k++) {
      const w = reduce ? { p: 0.35 + k * 0.3, alpha: 0.9 } : waveState(t, k, waves, speed)
      if (reduce && k > 0) break
      pos.forEach((deg, i) => {
        const a = (deg * Math.PI) / 180
        const d = gap + w.p * travel
        const x = cx + Math.cos(a) * (rx + d)
        const y = cy + Math.sin(a) * (ry + d)
        squiggle(c, x, y, a, len * (0.6 + 0.5 * w.p), amp, reduce ? i : t * 9 + i * 1.3 + k, lw, cols, w.alpha)
      })
    }
  }

  function headPath(c) {
    c.beginPath()
    c.moveTo(0, -1)
    c.bezierCurveTo(0.62, -1, 0.9, -0.55, 0.88, -0.05)
    c.bezierCurveTo(0.86, 0.5, 0.5, 0.95, 0, 1)
    c.bezierCurveTo(-0.5, 0.95, -0.86, 0.5, -0.88, -0.05)
    c.bezierCurveTo(-0.9, -0.55, -0.62, -1, 0, -1)
    c.closePath()
  }

  /** the slanted lens, in head units; `s` = -1 (left) / +1 (right) */
  function lensPath(s, ang, wide) {
    const p = new Path2D()
    const oy = -0.2 - ang * 0.13 - (wide ? 0.05 : 0)
    const iy = 0.13 + ang * 0.12
    p.moveTo(s * 0.86, oy)
    p.lineTo(s * 0.1, iy)
    p.quadraticCurveTo(s * 0.3, 0.36, s * 0.62, 0.33)
    p.quadraticCurveTo(s * 0.93, 0.27, s * 0.86, oy)
    p.closePath()
    return p
  }

  /**
   * @param {{face:string,hi:string,web:string,lens:string,open:number,ang:number,wide:boolean,off?:boolean,look?:number[],glint?:number,rot?:number}} o
   */
  function drawMask(c, cx, cy, R, o) {
    const look = o.look || [0, 0]
    c.save()
    c.translate(cx, cy)
    c.rotate(o.rot || 0)
    c.scale(R, R)
    const lw = Math.max(0.075, 1.7 / R)
    headPath(c)
    c.fillStyle = o.face
    c.fill()
    c.save()
    headPath(c)
    c.clip()
    c.globalAlpha = 0.38
    c.fillStyle = o.hi
    c.beginPath()
    c.ellipse(-0.3, -0.55, 0.5, 0.28, -0.55, 0, TAU)
    c.fill()
    c.globalAlpha = 1
    c.strokeStyle = o.web
    c.lineWidth = Math.max(0.04, 1 / R)
    c.lineCap = 'round'
    if (o.off) c.setLineDash([0.07, 0.06])
    const y0 = 0.34
    for (let a = 0; a < 18; a++) {
      const t = a * 0.349 + 0.05
      c.beginPath()
      c.moveTo(Math.cos(t) * 0.07, y0 + Math.sin(t) * 0.07)
      c.lineTo(Math.cos(t) * 1.3, y0 + Math.sin(t) * 1.3)
      c.stroke()
    }
    for (const r of [0.34, 0.6, 0.86, 1.12]) {
      c.beginPath()
      const n = 18
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * TAU
        const x = Math.cos(t) * r
        const y = y0 + Math.sin(t) * r
        if (i === 0) c.moveTo(x, y)
        else {
          const tm = ((i - 0.5) / n) * TAU
          c.quadraticCurveTo(Math.cos(tm) * r * 0.93, y0 + Math.sin(tm) * r * 0.93, x, y)
        }
      }
      c.stroke()
    }
    c.setLineDash([])
    for (const s of [-1, 1]) {
      if (o.open < 0.1) {
        // asleep: a clear closed-eye curve instead of a hairline lens
        c.beginPath()
        c.moveTo(s * 0.86, -0.12)
        c.quadraticCurveTo(s * 0.5, 0.34, s * 0.1, 0.12)
        c.lineWidth = lw * 1.5
        c.strokeStyle = '#05060d'
        c.lineCap = 'round'
        c.stroke()
        continue
      }
      c.save()
      c.translate(s * 0.5, 0.1)
      c.translate(look[0] * 0.05, look[1] * 0.04)
      c.scale(1, Math.max(0.04, o.open))
      c.translate(-s * 0.5, -0.1)
      const p = lensPath(s, o.ang, o.wide)
      c.fillStyle = o.lens
      c.fill(p)
      if (o.glint > 0) {
        c.save()
        c.clip(p)
        c.fillStyle = '#ffffff'
        c.globalAlpha = 0.9
        c.translate(-1.4 + o.glint * 2.8, 0)
        c.rotate(0.5)
        c.fillRect(-0.06, -1, 0.12, 2)
        c.fillRect(0.1, -1, 0.05, 2)
        c.restore()
      }
      c.lineWidth = lw
      c.strokeStyle = '#05060d'
      c.lineJoin = 'round'
      c.stroke(p)
      c.restore()
    }
    c.restore()
    headPath(c)
    c.lineWidth = Math.max(0.09, 2 / R)
    c.strokeStyle = '#05060d'
    c.lineJoin = 'round'
    c.stroke()
    c.restore()
  }

  /** an expanding web ring (the "web pop") */
  function webRing(c, x, y, r, alpha) {
    c.save()
    c.globalAlpha = alpha
    c.strokeStyle = '#e8eeff'
    c.lineWidth = 1.5
    for (let i = 0; i < 8; i++) {
      const t = i * (TAU / 8)
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r)
      c.stroke()
    }
    for (const k of [0.5, 1]) {
      c.beginPath()
      for (let i = 0; i <= 8; i++) {
        const t = i * (TAU / 8)
        const px = x + Math.cos(t) * r * k
        const py = y + Math.sin(t) * r * k
        if (i === 0) c.moveTo(px, py)
        else {
          const tm = (i - 0.5) * (TAU / 8)
          c.quadraticCurveTo(x + Math.cos(tm) * r * k * 0.86, y + Math.sin(tm) * r * k * 0.86, px, py)
        }
      }
      c.stroke()
    }
    c.restore()
  }

  return { MASKS, maskFor, eyeParams, squigglePoints, waveState, SQ, squiggle, drawWaves, drawMask, webRing, headPath }
})
