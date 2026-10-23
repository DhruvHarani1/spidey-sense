'use strict'
// Unit tests for the Daily Web composer and the per-day counters. Run: npm run test:unit
const assert = require('node:assert/strict')
const { compose, fmtDur } = require('../renderer/bugle.js')
const Day = require('../renderer/daystats.js')

const date = new Date(2026, 9, 16, 21, 0, 0)
const day = (n = {}, peak = {}, hog = null) => ({ n, peak, hog })

assert.equal(fmtDur(75), '1H 15M')
assert.equal(fmtDur(45), '45M')

let c = compose(day({ guardian: 2 }), date)
assert.match(c.headline, /STRANGE VISITOR/)
assert.match(c.deck, /2 security alerts/)

c = compose(day({ 'tingle:ram': 5, tingle: 0 }, { ram: 99 }, { name: 'chrome', mb: 1740 }), date)
assert.match(c.headline, /^CHROME HOARDS MEMORY/)
assert.match(c.deck, /5 times.*1\.7 GB/)
assert.ok(c.lines.some((l) => /PEAK RAM: 99% — CHROME 1\.7 GB/.test(l)))
assert.ok(c.lines.some((l) => /TINGLES: 5 \(RAM 5\)/.test(l)))

assert.match(compose(day({ 'tingle:cpu': 4 }), date).headline, /CPU MELTDOWN/)
c = compose(day({ focusMin: 125, focusSessions: 5 }), date)
assert.match(c.headline, /2H 05M OF PURE FOCUS/)
assert.ok(c.lines.includes('FOCUS: 2H 05M (5 ★)'))
assert.match(compose(day({ focusMin: 25, focusSessions: 1 }), date).headline, /1 FOCUS SESSION$/)
assert.match(compose(day({ activeS: 9 * 3600 }), date).headline, /DOES ANYONE SLEEP/)
assert.match(compose(day(), date).headline, /QUIET DAY/)
assert.deepEqual(compose(day(), date).lines, ['NO DATA YET — THE REPORTERS JUST CLOCKED IN.'])
assert.match(compose(day({ 'tingle:net': 1 }), date).headline, /1 TINGLE, ALL HANDLED/)
assert.match(c.dateLine, /FRIDAY, OCTOBER 16, 2026/i)
assert.ok(c.quote.length > 10)

// day counters (no storage in node: in-memory only)
Day.add('focusMin', 25)
Day.add('focusMin', 25)
Day.peak('ram', 90, { name: 'a', mb: 1 })
Day.peak('ram', 80, { name: 'b', mb: 2 })
Day.peak('ram', 97, { name: 'c', mb: 3 })
const t = Day.today()
assert.equal(t.n.focusMin, 50)
assert.equal(t.peak.ram, 97)
assert.deepEqual(t.hog, { name: 'c', mb: 3 })
Day.peak('cpu', NaN)
assert.equal(t.peak.cpu, undefined)

console.log('bugle: ALL PASS')

// ---- headlines from what Auto-Shield really did
{
  const { compose } = require('../renderer/bugle.js')
  const d = new Date(2026, 9, 16)
  const day = (n) => ({ n, peak: {}, hog: null })
  assert.match(compose(day({ 'shield:block': 1, guardian: 1, shield: 1 }), d).headline, /SHIELD FOILS/, 'a blocked intruder beats everything')
  assert.match(compose(day({ 'shield:tame': 2, shield: 2 }), d).headline, /2 RUNAWAY PROGRAMS TAMED/)
  assert.match(compose(day({ 'shield:tame': 1 }), d).headline, /^RUNAWAY PROGRAM TAMED/)
  assert.match(compose(day({ 'shield:takedown': 1 }), d).headline, /ENDS A MEMORY MENACE/)
  assert.ok(compose(day({ 'shield:tame': 2, 'shield:block': 1 }), d).lines.includes('SHIELD: 2 TAMED · 1 BLOCKED'))
  assert.match(compose(day({ guardian: 1 }), d).headline, /STRANGE VISITOR/, 'guardian alone is unchanged')
  console.log('bugle shield headlines: ALL PASS')
}
