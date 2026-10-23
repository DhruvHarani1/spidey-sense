'use strict'
// Unit tests for Web Memory (24 h history). Run: npm run test:unit
const assert = require('node:assert/strict')
const H = require('../renderer/history.js')

const MIN = 60000
const T0 = Date.UTC(2026, 9, 18, 8, 0, 0)

// one point per minute: samples inside a minute are averaged, maxima and the biggest program at the RAM peak are kept
{
  const m = H.create()
  m.push({ cpu: 10, ram: 70, hog: { name: 'chrome', mb: 1500 } }, T0)
  m.push({ cpu: 30, ram: 74, hog: { name: 'code', mb: 1700 } }, T0 + 20_000)
  m.push({ cpu: 20, ram: 72, hog: { name: 'chrome', mb: 1600 } }, T0 + 40_000)
  m.push({ cpu: 50, ram: 80 }, T0 + MIN + 1000)
  assert.equal(m.size, 2)
  assert.deepEqual(m.series()[0], { t: T0, cpu: 20, ram: 72, cpuMax: 30, ramMax: 74 })
  const p = m.at(T0 + 10_000)
  assert.equal(p.hog, 'code', 'the program that was biggest when RAM peaked')
  assert.equal(p.mb, 1700)
  assert.equal(m.at(T0 + 30 * MIN), null, 'no data that far away')
  m.push({ cpu: NaN, ram: 1 }, T0)
  m.push(null, T0)
  assert.equal(m.size, 2, 'junk is ignored')
}

// keeps 24 hours, no more
{
  const m = H.create()
  for (let i = 0; i < 24 * 60 + 100; i++) m.push({ cpu: 1, ram: 50 }, T0 + i * MIN)
  assert.ok(m.size <= 24 * 60 + 1, 'size ' + m.size)
  assert.ok(m.series()[0].t >= T0 + 99 * MIN - MIN, 'oldest points dropped')
}

// worst moments: a CPU burst and a RAM jump above this PC's usual level, far apart, with the culprit
{
  const m = H.create()
  for (let i = 0; i < 120; i++) {
    const cpu = i === 30 ? 95 : 10
    const ram = i >= 80 && i <= 82 ? 93 : 70
    m.push({ cpu, ram, hog: i === 81 ? { name: 'chrome', mb: 2400 } : { name: 'x', mb: 100 } }, T0 + i * MIN)
  }
  const w = m.worst(3)
  assert.equal(w.length, 2)
  assert.deepEqual(w.map((x) => x.kind), ['cpu', 'ram'])
  const ram = w.find((x) => x.kind === 'ram')
  assert.equal(ram.value, 93)
  assert.ok(['chrome', 'x'].includes(ram.hog))
  // a PC that always sits at 97% RAM has no "bad moments" from RAM alone
  const calm = H.create()
  for (let i = 0; i < 60; i++) calm.push({ cpu: 5, ram: 97 }, T0 + i * MIN)
  assert.deepEqual(calm.worst(3), [])
}

// events are attached to the minute they happened in, and survive a save/load round trip
{
  const m = H.create()
  m.push({ cpu: 5, ram: 50 }, T0)
  m.mark('shield', 'Tamed miner', T0 + 20_000)
  assert.deepEqual(m.at(T0).events, ['Tamed miner'])
  const copy = H.create()
  assert.equal(copy.load(JSON.parse(JSON.stringify(m))), true)
  assert.equal(copy.size, 0, 'data older than 24 hours is dropped on load')
  assert.equal(H.create().load({ v: 2 }), false)
  assert.equal(H.create().load(null), false)
}
{
  const now = Date.now()
  const m = H.create()
  m.push({ cpu: 12, ram: 60, hog: { name: 'a', mb: 5 } }, now - 5 * MIN)
  m.mark('tingle', 'RAM spike', now - 5 * MIN)
  const copy = H.create()
  assert.equal(copy.load(JSON.parse(JSON.stringify(m))), true)
  assert.equal(copy.size, 1)
  assert.equal(copy.events().length, 1)
  assert.equal(copy.series()[0].cpu, 12)
  // corrupt entries are dropped, not trusted
  const bad = H.create()
  bad.load({ v: 1, b: [{ t: 'x' }, { t: now, n: 1, c: 1, cm: 1, r: 1, rm: 1 }], e: [{ at: 'no' }] })
  assert.equal(bad.size, 1)
  assert.equal(bad.events().length, 0)
}

console.log('history: ALL PASS')
