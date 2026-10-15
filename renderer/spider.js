'use strict'
/* Canvas drawing: an original stylised spider emblem and the sagging "web radar". */
;(function () {
  const TAU = Math.PI * 2

  // leg polylines in emblem units (right side; mirrored for the left)
  const LEGS = [
    [[0.16, -0.18], [0.55, -0.88], [0.94, -0.64]],
    [[0.2, -0.05], [0.82, -0.4], [1.04, 0.02]],
    [[0.2, 0.08], [0.82, 0.3], [1.0, 0.76]],
    [[0.16, 0.2], [0.5, 0.8], [0.74, 1.06]]
  ]

  /** Black spider silhouette, centred on (x, y); `size` ~ radius of the leg spread. */
  function drawSpider(ctx, x, y, size) {
    ctx.save()
    ctx.translate(x, y)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#05060d'
    ctx.lineWidth = Math.max(1.6, size * 0.1)
    for (const side of [1, -1]) {
      for (const leg of LEGS) {
        ctx.beginPath()
        leg.forEach(([px, py], i) => (i ? ctx.lineTo(side * px * size, py * size) : ctx.moveTo(side * px * size, py * size)))
        ctx.stroke()
      }
    }
    ctx.fillStyle = '#05060d'
    // abdomen (teardrop) + head
    ctx.beginPath()
    ctx.moveTo(0, -0.02 * size)
    ctx.bezierCurveTo(0.3 * size, 0.1 * size, 0.24 * size, 0.62 * size, 0, 0.7 * size)
    ctx.bezierCurveTo(-0.24 * size, 0.62 * size, -0.3 * size, 0.1 * size, 0, -0.02 * size)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, -0.26 * size, 0.15 * size, 0.17 * size, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  function pointAt(cx, cy, r, i, n) {
    const a = -Math.PI / 2 + (i * TAU) / n
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, a]
  }

  /** a ring segment that sags toward the centre like real silk */
  function sagTo(ctx, cx, cy, from, to, sag) {
    const mx = (from[0] + to[0]) / 2
    const my = (from[1] + to[1]) / 2
    ctx.quadraticCurveTo(cx + (mx - cx) * sag, cy + (my - cy) * sag, to[0], to[1])
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{values:number[], labels:string[], level:'calm'|'alert'|'tingle', t:number, hot:number[]}} s
   */
  function drawWeb(ctx, w, h, s) {
    const cx = w / 2
    const cy = h / 2 + 2
    const R = 84
    const disc = 29
    const n = s.values.length
    ctx.clearRect(0, 0, w, h)

    // spokes
    ctx.lineWidth = 1.3
    ctx.strokeStyle = 'rgba(214, 224, 255, 0.42)'
    for (let i = 0; i < n; i++) {
      const [x, y] = pointAt(cx, cy, R, i, n)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    // sagging rings
    for (let k = 1; k <= 4; k++) {
      const r = (R * k) / 4
      ctx.strokeStyle = k === 4 ? 'rgba(232, 238, 255, 0.78)' : 'rgba(214, 224, 255, 0.34)'
      ctx.lineWidth = k === 4 ? 1.8 : 1.1
      ctx.beginPath()
      const first = pointAt(cx, cy, r, 0, n)
      ctx.moveTo(first[0], first[1])
      for (let i = 1; i <= n; i++) sagTo(ctx, cx, cy, pointAt(cx, cy, r, i - 1, n), pointAt(cx, cy, r, i % n, n), 0.9)
      ctx.stroke()
    }

    // value polygon
    const pts = s.values.map((v, i) => pointAt(cx, cy, disc + ((R - disc) * Math.max(2, Math.min(100, v))) / 100, i, n))
    const hotColor = s.level === 'tingle' ? '#ff3b3b' : s.level === 'alert' ? '#ffd83a' : '#4a7bff'
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i <= n; i++) sagTo(ctx, cx, cy, pts[i - 1], pts[i % n], 0.97)
    ctx.closePath()
    const g = ctx.createRadialGradient(cx, cy, disc, cx, cy, R)
    g.addColorStop(0, 'rgba(255, 59, 59, 0.55)')
    g.addColorStop(1, 'rgba(212, 32, 42, 0.22)')
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = 2.6
    ctx.strokeStyle = '#ff3b3b'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // vertices (hot ones pulse)
    pts.forEach(([x, y], i) => {
      const hot = s.hot[i] > 0
      const pulse = hot ? 1 + 0.35 * Math.sin(s.t * 9 + i) : 1
      ctx.beginPath()
      ctx.arc(x, y, (hot ? 5 : 3.6) * pulse, 0, TAU)
      ctx.fillStyle = hot ? hotColor : '#4a7bff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#05060d'
      ctx.stroke()
    })

    // tingle lines radiating from the emblem
    if (s.level !== 'calm') {
      const count = s.level === 'tingle' ? 14 : 8
      ctx.lineCap = 'round'
      ctx.strokeStyle = s.level === 'tingle' ? '#fff6c8' : '#ffd83a'
      ctx.lineWidth = 2.4
      for (let i = 0; i < count; i++) {
        const a = (i * TAU) / count + Math.sin(s.t * 3) * 0.05
        const jitter = s.level === 'tingle' ? Math.abs(Math.sin(s.t * 22 + i * 1.7)) * 9 : Math.abs(Math.sin(s.t * 5 + i)) * 4
        const r0 = disc + 6
        const r1 = disc + 11 + jitter
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.stroke()
      }
    }

    // emblem disc
    const dg = ctx.createRadialGradient(cx - 8, cy - 9, 4, cx, cy, disc)
    dg.addColorStop(0, '#ff5a5a')
    dg.addColorStop(1, '#a50f1a')
    ctx.beginPath()
    ctx.arc(cx, cy, disc, 0, TAU)
    ctx.fillStyle = dg
    ctx.fill()
    ctx.lineWidth = 3.2
    ctx.strokeStyle = '#05060d'
    ctx.stroke()
    drawSpider(ctx, cx, cy - 0.5, disc * 0.74)

    // axis labels
    ctx.font = "italic 900 10px 'Arial Black', Impact, sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    s.labels.forEach((text, i) => {
      const [x, y] = pointAt(cx, cy, R + 17, i, n)
      const tw = ctx.measureText(text).width + 10
      ctx.fillStyle = s.hot[i] > 0 ? hotColor : '#05060d'
      ctx.strokeStyle = '#05060d'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x - tw / 2, y - 8, tw, 16, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = s.hot[i] > 0 && s.level !== 'calm' ? '#05060d' : '#f4f1e6'
      ctx.fillText(text, x, y + 0.5)
    })
  }

  window.Spider = { drawSpider, drawWeb }
})()
