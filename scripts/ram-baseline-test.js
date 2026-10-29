'use strict'

const assert = require('assert')
const { baselineFor, record, createStore, createRamAlert } = require('../renderer/ram-baseline')

let baseline = []
for (let i = 0; i < 30; i++) baseline = record(baseline, i % 2, 97)
assert.strictEqual(baselineFor(baseline, 1), 97)
assert.strictEqual(baselineFor(baseline, 3), 97)
assert.strictEqual(baselineFor(record(baseline, 1, 80), 1), 97)

const persisted = new Map([['spidey.ramBaseline', JSON.stringify(baseline)]])
const storage = {
  getItem: (key) => persisted.get(key) || null,
  setItem: (key, value) => persisted.set(key, value)
}
const restarted = createStore(storage, 'spidey.ramBaseline')
const appRamAlert = createRamAlert(restarted, { ramMode: 'auto' }, [], () => 1)
assert.strictEqual(appRamAlert(97), 0)
assert.strictEqual(appRamAlert(100), 78)
appRamAlert(80)
assert.strictEqual(JSON.parse(persisted.get('spidey.ramBaseline'))[1].length, 18)

console.log('RAM baseline tests passed')
