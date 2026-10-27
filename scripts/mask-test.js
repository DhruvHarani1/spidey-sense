'use strict'
// Unit tests for the mask's pure parts: expressions, shock-wave maths, squiggle shape, per-suit colours. Run: npm run test:unit
const assert = require('node:assert/strict')
const M = require('../renderer/mask.js')
const Suits = require('../renderer/suits.js')

// ---- expressions
const calm = M.eyeParams('calm', false)
assert.deepEqual(calm, { open: 1, ang: 0, wide: false, pure: false, ring: null, nap: false })
const alert = M.eyeParams('alert', false)
assert.ok(alert.open < calm.open && alert.ang > calm.ang, 'alert narrows and slants the lenses')
assert.equal(alert.ring, '#ffd83a')
const tingle = M.eyeParams('tingle', false)
assert.ok(tingle.open > 1 && tingle.wide && tingle.pure, 'tingle flares the lenses wide and pure white')
assert.equal(tingle.ring, '#ff3b3b')
assert.equal(M.eyeParams('calm', true).nap, true, 'idle + calm = asleep')
assert.ok(M.eyeParams('calm', true).open < 0.1)
assert.equal(M.eyeParams('tingle', true).nap, false, 'an alert wakes it up whatever the idle state')
assert.equal(M.eyeParams('alert', true).nap, false)
const droop = M.eyeParams('calm', false, { lowbat: true })
assert.ok(droop.open < 1 && droop.ang < 0, 'low battery: droopy half-closed eyes')
assert.equal(M.eyeParams('tingle', false, { lowbat: true }).open, tingle.open, 'a tingle is never droopy')

// ---- the squiggle (spider-sense mark)
const pts = M.squigglePoints(14, 3, 0.7)
assert.equal(pts.length, 13)
assert.deepEqual(pts[0], [0, 0].map((v, i) => (i ? 0 : v)).map((v) => v), 'starts at the origin')
assert.ok(Math.abs(pts[0][1]) < 1e-9 && Math.abs(pts[12][1]) < 1e-9, 'tapers to nothing at both ends')
assert.ok(Math.abs(pts[12][0] - 14) < 1e-9, 'ends at its length')
assert.ok(pts.every(([, y]) => Math.abs(y) <= 3 + 1e-9), 'never sways more than amp')
assert.ok(pts.some(([, y]) => Math.abs(y) > 1.5), 'it really waves')

// ---- shock waves: staggered, repeating, fading
for (const t of [0, 0.3, 1.7, 99.2]) {
  for (let k = 0; k < 3; k++) {
    const w = M.waveState(t, k, 3, 0.95)
    assert.ok(w.p >= 0 && w.p < 1, 'progress in range')
    assert.ok(w.alpha >= 0 && w.alpha <= 1, 'alpha in range')
  }
}
const a = M.waveState(0, 0, 3, 1).p
const b = M.waveState(0, 1, 3, 1).p
assert.ok(Math.abs(b - a - 1 / 3) < 1e-9, 'waves are evenly staggered')
assert.ok(Math.abs(M.waveState(0.25, 0, 3, 1).p - M.waveState(1.25, 0, 3, 1).p) < 1e-9, 'periodic')
assert.ok(M.waveState(0.001, 0, 1, 1).alpha < 0.05, 'a wave fades in at the head')
assert.ok(M.waveState(0.999, 0, 1, 1).alpha < 0.05, 'and fades out far away')

// ---- the print colours behind a squiggle (alert colours never depend on the suit)
assert.equal(M.SQ.tingle.b, '#ff3b3b')
assert.equal(M.SQ.alert.b, '#ffd83a')

// ---- every suit has mask colours, all valid hex; unknown suits fall back to classic
for (const s of Suits.SUITS) {
  const m = M.MASKS[s.id]
  assert.ok(m, `suit ${s.id} has a mask`)
  for (const k of ['face', 'hi', 'web', 'lens']) assert.match(m[k], /^#[0-9a-f]{6}$/i, `${s.id}.${k}`)
  assert.notEqual(m.face.toLowerCase(), m.web.toLowerCase(), `${s.id}: web strands must be visible on the face`)
}
assert.equal(M.maskFor('nonsense'), M.MASKS.classic)

// ---- the drawing code can run against a recording fake context (no exceptions, balanced save/restore)
{
  const calls = []
  let depth = 0
  const c = new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === 'save') return () => (depth++, calls.push('save'))
        if (name === 'restore') return () => (depth--, calls.push('restore'))
        return () => calls.push(String(name))
      },
      set: () => true
    }
  )
  global.Path2D = class {
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
    closePath() {}
  }
  M.drawWaves(c, 56, 84, 22, 25, 'tingle', 1.2, false)
  M.drawWaves(c, 56, 84, 22, 25, 'alert', 1.2, true)
  M.drawWaves(c, 56, 84, 22, 25, 'calm', 1.2, false)
  M.drawMask(c, 56, 84, 25, { ...M.maskFor('classic'), open: 1, ang: 0, wide: false, look: [0.5, 0], glint: 0.5, rot: 0 })
  M.webRing(c, 10, 10, 20, 0.5)
  assert.equal(depth, 0, 'every save has its restore')
  assert.ok(calls.length > 100)
  const before = calls.length
  M.drawWaves(c, 56, 84, 22, 25, 'calm', 1.2, false)
  assert.equal(calls.length, before, 'calm draws no shock waves')
}

console.log('mask: ALL PASS')
