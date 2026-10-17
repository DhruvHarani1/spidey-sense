'use strict'
// The manual may only describe things that work. Every `try` example in help-data.js must be understood by Karen,
// every documented hotkey must be registered in main.js, every tray entry must exist, and the CLI/HTML must render it.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const D = require('../help-data')
const Karen = require('../renderer/karen.js')
const Suits = require('../renderer/suits.js')

const root = path.join(__dirname, '..')
const stats = { cpu: 12, ram: 90, disk: 80, latencyMs: 30, online: true, uptimeS: 90000, hog: { name: 'chrome', mb: 1500 } }
const ctx = {
  stats,
  battery: { level: 0.8, charging: true, present: true },
  timer: { mode: 'focus', left: 600, running: true },
  reminders: 1,
  findSuit: Suits.findSuit,
  parseReminder: (s) => (/^(in|at)\s/i.test(s) ? { due: 1, text: 'x' } : null)
}

// 1) every example works
let n = 0
for (const g of D.karen)
  for (const it of g.items) {
    assert.ok(it.try, `${it.say}: needs a try example`)
    const r = Karen.interpret(it.try, ctx)
    assert.ok(!r.unknown && (r.say || r.action || r.confirm), `Karen does not understand the documented example "${it.try}" (${it.say})`)
    for (const alt of it.aka || []) {
      const a = Karen.interpret(alt, ctx)
      assert.ok(!a.unknown, `alias "${alt}" for "${it.say}" is not understood`)
    }
    n++
  }
assert.ok(n >= 25, 'documented a decent number of commands')

// 2) hotkeys in the docs are really registered
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8')
for (const h of D.hotkeys.filter((x) => x.keys.startsWith('Ctrl+'))) {
  const accel = h.keys.replace('Ctrl', 'Control')
  assert.ok(main.includes(`'${accel}'`), `hotkey ${h.keys} is documented but not registered in main.js`)
}

// 3) tray entries in the docs exist in the menu code (match on a distinctive word)
const probes = {
  'Always on top': 'Always on top',
  'RAM alerts': 'RAM alerts',
  'Spider-sense sound': 'Spider-sense sound',
  'Eye-rest nudge': 'Eye-rest nudge',
  'Suit locker': 'Suit locker',
  'E.D.I.T.H.': 'E.D.I.T.H.',
  'Daily Web': 'Daily Web',
  'Guardian': 'Guardian',
  'Desktop notifications': 'Desktop notifications',
  'Network check': 'Network check',
  'Launch at startup': 'Launch at startup',
  'Reset position': 'Reset position',
  Quit: 'Quit Spidey Sense'
}
for (const [needle, expect] of Object.entries(probes)) {
  assert.ok(D.tray.some((t) => t.includes(needle)), `tray doc is missing "${needle}"`)
  assert.ok(main.includes(expect), `main.js has no tray entry "${expect}"`)
}

// 3b) things that moved to Jarvis / Spidey Lab must not be documented or wired any more
for (const gone of ['Ctrl+Alt+Space', 'Ctrl+Alt+C', 'Hey Karen', 'API key', 'Ollama', 'microphone', 'Web-Capture']) {
  const all = JSON.stringify(D.hotkeys) + JSON.stringify(D.tray) + JSON.stringify(D.features) + JSON.stringify(D.karen)
  assert.ok(!all.includes(gone) || gone === 'microphone', `docs still mention ${gone}`)
}
for (const gone of ['Control+Alt+Space', 'Control+Alt+C', 'speech', 'wake', 'brain', 'startCapture']) assert.ok(!main.includes(gone), `main.js still mentions ${gone}`)

// 4) the XP table in the docs matches the code
const xp = Suits.XP
const xpDoc = D.features.find((f) => f.id === 'locker').how.join(' ')
for (const [k, v] of Object.entries({ focus: 40, guardian: 10, bugle: 15, edith: 10, eye: 5, remind: 5 })) assert.equal(xp[k].xp, v, `XP for ${k} changed; update the manual`)
assert.match(xpDoc, /focus session \+40/)
for (const s of Suits.SUITS) assert.ok(xpDoc.includes(s.name), `suit ${s.name} missing from the manual`)

// 5) the CLI renders it
const cli = path.join(root, 'bin', 'spidey.js')
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } })
let r = run('help')
assert.equal(r.status, 0)
assert.match(r.stdout, /SPIDEY SENSE/i)
assert.match(r.stdout, /commands/i)
r = run('commands')
assert.equal(r.status, 0)
assert.match(r.stdout, /what is eating my ram/)
r = run('features')
assert.match(r.stdout, /Guardian/)
r = run('search', 'newspaper')
assert.equal(r.status, 0)
assert.match(r.stdout, /Daily Web/i)
r = run('search', 'zzzqqq')
assert.match(r.stdout, /No matches/i)
r = run('hotkeys')
assert.match(r.stdout, /Ctrl\+Alt\+K/)
r = run('feature', 'edith')
assert.match(r.stdout, /E.D.I.T.H/)
r = run('feature', 'capture')
assert.notEqual(r.status, 0, 'capture moved out of Spidey Sense')
r = run('nonsense-topic')
assert.notEqual(r.status, 0, 'unknown topic exits non-zero')

// 6) the generated manual is up to date with the data
const { render } = require('./build-docs')
const html = render(D)
for (const g of D.karen) for (const it of g.items) assert.ok(html.includes(escapeHtml(it.say)), `manual HTML lacks "${it.say}"`)
for (const f of D.features) assert.ok(html.includes(`id="${f.id}"`), `manual HTML lacks feature ${f.id}`)
for (const file of ['docs/index.html', 'renderer/help.html']) {
  assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), html, `${file} is stale — run: npm run docs`)
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
console.log('help: ALL PASS')
