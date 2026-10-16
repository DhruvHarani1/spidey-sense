'use strict'
/*
 * Comic-book filter for screenshots: posterised colour, black ink outlines and halftone shading.
 * Pure array maths on RGBA pixels (no DOM), so it is unit-tested in plain Node and reused by the capture window.
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.Comic = factory()
})(this, function () {
  const luma = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255

  /**
   * @param {Uint8ClampedArray} px RGBA pixels, modified in place
   * @param {number} w
   * @param {number} h
   * @param {{levels?:number, edge?:number, dot?:number, boost?:number}} [o]
   */
  function apply(px, w, h, o = {}) {
    const levels = Math.max(2, Math.min(8, o.levels ?? 4))
    const edgeThr = o.edge ?? 0.5 // Sobel magnitude (0..~4) above which a pixel becomes ink
    const dot = o.dot ?? Math.max(5, Math.round(Math.min(w, h) / 120)) // halftone cell size in px
    const boost = o.boost ?? 1.25 // saturation

    // luminance drives edges and halftone
    const L = new Float32Array(w * h)
    for (let i = 0, p = 0; i < L.length; i++, p += 4) L[i] = luma(px[p], px[p + 1], px[p + 2])

    // auto-levels: stretch the 2nd..98th luminance percentiles so dark (or washed-out) screens keep their contrast
    const hist = new Uint32Array(256)
    for (let i = 0; i < L.length; i++) hist[Math.min(255, Math.round(L[i] * 255))]++
    const pct = (q) => {
      let acc = 0
      const target = q * L.length
      for (let v = 0; v < 256; v++) {
        acc += hist[v]
        if (acc >= target) return v / 255
      }
      return 1
    }
    const lo = pct(0.02)
    const hi = Math.max(lo + 0.08, pct(0.98))
    const median = pct(0.5)
    if (hi - lo >= 0.15) {
      // (a nearly flat image has nothing to stretch)
      const gain = 1 / (hi - lo)
      for (let p = 0; p < px.length; p += 4) {
        for (let c = 0; c < 3; c++) px[p + c] = Math.max(0, Math.min(255, (px[p + c] / 255 - lo) * gain * 255))
      }
      for (let i = 0, p = 0; i < L.length; i++, p += 4) L[i] = luma(px[p], px[p + 1], px[p + 2])
    }
    const ink = median < 0.3 ? 238 : 12 // dark screens get light ink lines so the outlines stay visible

    // 1) saturate + posterise
    const step = 255 / (levels - 1)
    for (let p = 0; p < px.length; p += 4) {
      const g = luma(px[p], px[p + 1], px[p + 2]) * 255
      for (let c = 0; c < 3; c++) {
        const v = Math.max(0, Math.min(255, g + (px[p + c] - g) * boost))
        px[p + c] = Math.round(v / step) * step
      }
      // pure black reads as a hole in a comic: print shadows in deep ink-blue instead
      if (px[p] < 20 && px[p + 1] < 20 && px[p + 2] < 20) {
        px[p] = 16
        px[p + 1] = 22
        px[p + 2] = 60
      }
    }

    // 2) halftone: darker areas get dots whose size grows with darkness (screen rotated 45 degrees)
    const cos = Math.SQRT1_2
    const sin = Math.SQRT1_2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = L[y * w + x]
        if (l > 0.62 || l < 0.12) continue // no dots in pure shadow: they would only crush the picture to black
        const u = (x * cos + y * sin) / dot
        const v = (-x * sin + y * cos) / dot
        const du = u - Math.round(u)
        const dv = v - Math.round(v)
        const d = Math.sqrt(du * du + dv * dv) // 0 at a dot centre .. ~0.7 between dots
        const radius = (0.62 - l) * 1.15
        if (d < radius) {
          const p = (y * w + x) * 4
          px[p] *= 0.55
          px[p + 1] *= 0.55
          px[p + 2] *= 0.55
        }
      }
    }

    // 3) ink: Sobel edges become black lines
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1]
        const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]
        if (Math.sqrt(gx * gx + gy * gy) > edgeThr) {
          const p = i * 4
          px[p] = px[p + 1] = px[p + 2] = ink
        }
      }
    }
    for (let p = 3; p < px.length; p += 4) px[p] = 255
    return px
  }

  return { apply }
})
