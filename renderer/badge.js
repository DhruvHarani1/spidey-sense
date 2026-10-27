'use strict'
/*
 * The badge: a Spider-Man mask dangling on a thread. The swing and shake are CSS transforms (free); this file draws the mask,
 * its expression, the spider-sense shock waves and the little effects, and only redraws when something actually changes.
 */
;(function () {
  if (typeof window === 'undefined' || !window.Mask || !window.Core) return
  const M = window.Mask
  const $ = (id) => document.getElementById(id)
  const cv = $('bcanvas')
  const body = $('bbody')
  const wob = $('bwob')
  const badge = $('badge')
  const W = 112
  const H = 140
  const CX = 56
  const CY = 84
  const R = 25
  const dpr = window.devicePixelRatio || 1
  cv.width = W * dpr
  cv.height = H * dpr
  const ctx = cv.getContext('2d')
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }
  const T = () => performance.now() / 1000

  let motion = 'full' // 'full' | 'auto' (follow Windows) | 'reduced'
  let ex = 0 // wobble spring (radians) and its velocity
  let ev = 0
  let blinkAt = T() + 2
  let blinkT = -9
  let glintAt = T() + 6
  let glintT = -9
  let twirlT = -9
  let twirlAt = T() + 70 + Math.random() * 70
  let popT = -9
  let shieldT = -9
  let flipAngle = 0
  let look = [0, 0]
  let lookTo = [0, 0]
  let lookAt = T() + 3
  let lastPointer = -9
  let lastSig = ''
  let forced = null // test hook: {level, idle, moods}
  let last = T()

  const reduced = () => motion === 'reduced' || (motion === 'auto' && mq.matches)
  function applyReduce() {
    document.body.dataset.reduce = reduced() ? '1' : '0'
    lastSig = ''
  }
  if (mq.addEventListener) mq.addEventListener('change', applyReduce)

  // ---------------------------------------------------------------- state from the rest of the app
  function readState() {
    if (forced) return forced
    const level = body.dataset.level === 'tingle' ? 'tingle' : body.dataset.level === 'alert' ? 'alert' : 'calm'
    return { level, idle: document.body.dataset.idle === '1', moods: window.Core.moods ? window.Core.moods() : {} }
  }

  // ---------------------------------------------------------------- drawing
  function draw(now, s) {
    const rm = reduced()
    const ep = M.eyeParams(s.level, s.idle, s.moods)
    const pal = M.maskFor(document.body.dataset.suit)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const gl = now - glintT < 0.9 ? (now - glintT) / 0.9 : 0
    let blink = 1
    if (now - blinkT < 0.18 && !ep.nap && !rm) blink = Math.abs((now - blinkT) / 0.09 - 1) * 0.95 + 0.05
    let tw = 1
    if (now - twirlT < 1.2) tw = Math.cos(((now - twirlT) / 1.2) * Math.PI * 4)
    const o = {
      face: pal.face,
      hi: pal.hi,
      web: pal.web,
      lens: ep.pure ? '#ffffff' : pal.lens,
      open: Math.max(0.05, ep.open * blink),
      ang: ep.ang,
      wide: ep.wide,
      off: !!s.moods.offline,
      look,
      glint: gl,
      rot: flipAngle
    }
    // shock waves ripple out behind the head
    M.drawWaves(ctx, CX, CY, R * 0.88, R, s.level, now, rm, { positions: s.level === 'tingle' ? [-165, -125, -90, -55, -15, 15, 165, 195] : [-150, -90, -30, 160, 20], travel: 8, len: 10, gap: 4 })
    ctx.save()
    if (ep.nap) ctx.globalAlpha = 0.82
    ctx.translate(CX, CY)
    ctx.scale(Math.abs(tw) < 0.12 ? 0.12 : tw, 1)
    ctx.translate(-CX, -CY)
    if (ep.ring) {
      ctx.beginPath()
      ctx.ellipse(CX, CY, R * 0.88 + 3, R + 3, 0, 0, Math.PI * 2)
      ctx.lineWidth = 3
      ctx.strokeStyle = ep.ring
      ctx.stroke()
    }
    if (s.moods.focus != null) {
      ctx.beginPath()
      ctx.ellipse(CX, CY, R * 0.88 + 7, R + 7, 0, -Math.PI / 2, -Math.PI / 2 + Math.max(0.05, s.moods.focus) * Math.PI * 2)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = pal.hi
      ctx.stroke()
    }
    M.drawMask(ctx, CX, CY, R, o)
    ctx.restore()
    // moods
    if (s.moods.hot) {
      const p = rm ? 0.3 : (now * 0.9) % 1
      const sx = CX + R * 0.72
      const sy = CY - R * 0.5 + p * R * 0.9
      ctx.save()
      ctx.globalAlpha = 1 - p * 0.7
      ctx.fillStyle = '#7fd4ff'
      ctx.beginPath()
      ctx.moveTo(sx, sy - 6)
      ctx.quadraticCurveTo(sx + 5, sy + 2, sx, sy + 5)
      ctx.quadraticCurveTo(sx - 5, sy + 2, sx, sy - 6)
      ctx.fill()
      ctx.restore()
    }
    if (s.moods.lowbat) {
      ctx.strokeStyle = '#ff6b6b'
      ctx.fillStyle = '#ff6b6b'
      ctx.lineWidth = 1.6
      ctx.strokeRect(CX + R * 0.55, CY + R * 0.78, 15, 8)
      ctx.fillRect(CX + R * 0.55 + 2, CY + R * 0.78 + 2, 3, 4)
      ctx.fillRect(CX + R * 0.55 + 15, CY + R * 0.78 + 2.5, 2, 3)
    }
    if (s.moods.offline) {
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 2
      const ox = CX - R * 0.8
      const oy = CY - R * 0.72
      ctx.beginPath()
      ctx.moveTo(ox - 5, oy - 5)
      ctx.lineTo(ox + 5, oy + 5)
      ctx.moveTo(ox + 5, oy - 5)
      ctx.lineTo(ox - 5, oy + 5)
      ctx.stroke()
    }
    // one-shot effects
    if (now - popT < 0.75) {
      const p = (now - popT) / 0.75
      M.webRing(ctx, CX, CY, R * (0.8 + p * 1.5), 1 - p)
    }
    if (now - shieldT < 1.8) {
      const p = (now - shieldT) / 1.8
      const q = p < 0.3 ? p / 0.3 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3
      const tx = W - 14
      const ty = H - 14
      ctx.strokeStyle = '#e8eeff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(CX, CY)
      ctx.lineTo(CX + (tx - CX) * q, CY + (ty - CY) * q)
      ctx.stroke()
      if (p > 0.2 && p < 0.9) {
        ctx.strokeStyle = '#ffd83a'
        ctx.beginPath()
        ctx.arc(tx, ty, 8, 0, Math.PI * 2)
        ctx.stroke()
        M.webRing(ctx, tx, ty, 12, 0.9)
      }
    }
  }

  // ---------------------------------------------------------------- the loop: slow when nothing moves, quick when something does
  function frame() {
    const now = T()
    const dt = Math.min(2, now - last) // real elapsed time: a throttled window (hidden, occluded) must still end up in the right pose
    last = now
    const hidden = document.hidden || document.body.dataset.view !== 'badge'
    let delay = 400
    if (!hidden) {
      const s = readState()
      const rm = reduced()
      const ep = M.eyeParams(s.level, s.idle, s.moods)
      // wobble spring (nudge, drag release)
      if (Math.abs(ex) > 0.0005 || Math.abs(ev) > 0.005) {
        for (let left = dt; left > 0; left -= 0.016) {
          const h = Math.min(0.016, left)
          ev += (-18 * ex - 1.6 * ev) * h
          ex += ev * h
        }
        wob.style.transform = `rotate(${((rm ? 0 : ex) * 180) / Math.PI}deg)`
      } else if (ex !== 0 || ev !== 0) {
        ex = 0
        ev = 0
        wob.style.transform = ''
      }
      // sleeping badges hang upside down
      const flipTo = ep.nap ? Math.PI : 0
      const flipping = flipAngle !== flipTo // still turning (or just arrived: that last frame must be drawn too)
      if (rm) flipAngle = flipTo // reduced motion: no turning, just the final pose
      else flipAngle += (flipTo - flipAngle) * (1 - Math.exp(-5 * dt))
      if (Math.abs(flipTo - flipAngle) < 0.01) flipAngle = flipTo
      // blink, glint, twirl, look around
      if (!rm && !ep.nap) {
        if (now > blinkAt) {
          blinkT = now
          blinkAt = now + 2.5 + Math.random() * 4
        }
        if (s.level === 'calm' && now > glintAt) {
          glintT = now
          glintAt = now + 9 + Math.random() * 8
        }
        if (s.level === 'calm' && now > twirlAt) {
          twirlT = now
          twirlAt = now + 70 + Math.random() * 70
        }
        if (now - lastPointer > 4 && now > lookAt) {
          lookTo = [(Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8]
          lookAt = now + 2 + Math.random() * 3
        }
      } else lookTo = [0, 0]
      look = [look[0] + (lookTo[0] - look[0]) * 0.3, look[1] + (lookTo[1] - look[1]) * 0.3]
      const animating =
        !rm && (s.level !== 'calm' || now - blinkT < 0.2 || now - glintT < 1 || now - twirlT < 1.3 || flipping || Math.abs(look[0] - lookTo[0]) > 0.02 || Math.abs(look[1] - lookTo[1]) > 0.02 || !!s.moods.hot) ||
        now - popT < 0.8 ||
        now - shieldT < 1.9 ||
        Math.abs(ex) > 0.0005
      const sig = [s.level, s.idle, document.body.dataset.suit, s.moods.lowbat, s.moods.offline, s.moods.hot, s.moods.focus == null ? '' : Math.round(s.moods.focus * 60), rm].join('|')
      if (animating || sig !== lastSig) {
        lastSig = sig
        draw(now, s)
      }
      delay = animating ? (s.level === 'tingle' ? 40 : 55) : 250
    }
    setTimeout(frame, delay)
  }

  // ---------------------------------------------------------------- sound: a short "thwip" (generated, follows the sound setting)
  let actx = null
  function thwip() {
    if (!window.Core.getSettings().sound) return
    try {
      actx = actx || new AudioContext()
      const t0 = actx.currentTime
      const len = Math.floor(actx.sampleRate * 0.14)
      const buf = actx.createBuffer(1, len, actx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
      const src = actx.createBufferSource()
      src.buffer = buf
      const f = actx.createBiquadFilter()
      f.type = 'bandpass'
      f.Q.value = 3
      f.frequency.setValueAtTime(2200, t0)
      f.frequency.exponentialRampToValueAtTime(500, t0 + 0.14)
      const g = actx.createGain()
      g.gain.value = 0.06
      src.connect(f).connect(g).connect(actx.destination)
      src.start(t0)
    } catch {
      /* no audio */
    }
  }

  // ---------------------------------------------------------------- pointer: eyes follow the cursor inside the window
  document.addEventListener('pointermove', (e) => {
    if (reduced() || document.body.dataset.view !== 'badge') return
    const r = body.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy) || 1
    lookTo = [(dx / d) * Math.min(1, d / 40), (dy / d) * Math.min(1, d / 40)]
    lastPointer = T()
  })

  // ---------------------------------------------------------------- API used by app.js and friends
  window.Badge = {
    setMotion(m) {
      motion = m === 'reduced' || m === 'auto' ? m : 'full'
      applyReduce()
    },
    click() {
      popT = T()
      thwip()
    },
    shieldShot() {
      shieldT = T()
    },
    nudge(v) {
      ev += v
    },
    dragEnd() {
      popT = T()
      ev += (Math.random() < 0.5 ? -1 : 1) * 2.4
    },
    glint() {
      glintT = T()
    },
    twirl() {
      if (!reduced()) twirlT = T()
    },
    levelUp() {
      popT = T()
      glintT = T()
      lastSig = ''
    },
    dropIn() {
      if (reduced()) return
      badge.classList.remove('dropin')
      void badge.offsetWidth
      badge.classList.add('dropin')
      badge.addEventListener('animationend', (e) => e.animationName === 'bdrop' && badge.classList.remove('dropin'), { once: true })
    },
    redraw() {
      lastSig = ''
    }
  }
  if (window.Core.test) window.__badge = { force: (v) => ((forced = v), (lastSig = '')), draw: () => draw(T(), readState()), flip: () => flipAngle, canvas: cv, Badge: window.Badge }

  badge.classList.add('dropin')
  badge.addEventListener('animationend', (e) => e.animationName === 'bdrop' && badge.classList.remove('dropin'), { once: true })
  frame()
})()
