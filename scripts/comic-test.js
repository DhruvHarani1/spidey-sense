'use strict'
// Unit tests for the comic filter. Run: npm run test:unit
const assert = require('node:assert/strict')
const Comic = require('../renderer/comic.js')

function image(w, h, fn) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y)
      const p = (y * w + x) * 4
      px[p] = r
      px[p + 1] = g
      px[p + 2] = b
      px[p + 3] = 255
    }
  return px
}

// 1) bright flat image: posterised, no ink, no dots, fully opaque
{
  const px = image(40, 40, () => [250, 250, 250])
  Comic.apply(px, 40, 40)
  for (let i = 0; i < px.length; i += 4) {
    assert.equal(px[i], 255)
    assert.equal(px[i + 3], 255)
  }
}

// 2) a hard vertical edge gets a black ink line along it
{
  const w = 60
  const h = 30
  const px = image(w, h, (x) => (x < 30 ? [240, 240, 240] : [30, 60, 160]))
  Comic.apply(px, w, h)
  const row = 15
  const ink = []
  for (let x = 1; x < w - 1; x++) { const v = px[(row * w + x) * 4]; if (v === 12 || v === 238) ink.push(x) }
  assert.ok(ink.length >= 1, 'edge becomes ink')
  assert.ok(ink.every((x) => x >= 28 && x <= 31), `ink hugs the edge, got ${ink}`)
}

// 3) posterise: a smooth gradient collapses to a few colour levels
{
  const w = 128
  const px = image(w, 8, (x) => [x * 2, 120, 200 - x])
  Comic.apply(px, w, 8, { levels: 4, edge: 99 })
  const reds = new Set()
  for (let x = 0; x < w; x++) reds.add(px[x * 4])
  assert.ok(reds.size <= 8, `4 levels + their halftone-dimmed twins, got ${reds.size}`)
}

// 4) dark regions get halftone dots (some pixels darker than their neighbours), bright ones do not
{
  const w = 60
  const dark = image(w, w, () => [70, 70, 70])
  Comic.apply(dark, w, w, { edge: 99, dot: 6 })
  const vals = new Set()
  for (let i = 0; i < dark.length; i += 4) vals.add(dark[i])
  assert.ok(vals.size >= 2, 'dots create a pattern in dark areas')
  const bright = image(w, w, () => [220, 220, 220])
  Comic.apply(bright, w, w, { edge: 99, dot: 6 })
  const bv = new Set()
  for (let i = 0; i < bright.length; i += 4) bv.add(bright[i])
  assert.equal(bv.size, 1, 'no dots on bright areas')
}

// 5) deterministic, no NaN, size preserved
{
  const mk = () => image(50, 37, (x, y) => [(x * 5) % 256, (y * 7) % 256, (x * y) % 256])
  const a = mk()
  const b = mk()
  Comic.apply(a, 50, 37)
  Comic.apply(b, 50, 37)
  assert.deepEqual(a, b)
  assert.equal(a.length, 50 * 37 * 4)
  assert.ok(a.every((v) => Number.isFinite(v) && v >= 0 && v <= 255))
}
console.log('comic: ALL PASS')
