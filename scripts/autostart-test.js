'use strict'
// Tests autostart against a throwaway registry key (HKCU\Software\SpideySenseTest), never the real Run key.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { sync, parseValue, command } = require('../autostart')

assert.equal(parseValue('\r\nHKEY_CURRENT_USER\\X\r\n    SpideySense    REG_SZ    "C:\\a b\\Spidey Sense.exe" --autostart\r\n'), '"C:\\a b\\Spidey Sense.exe" --autostart')
assert.equal(parseValue('ERROR: The system was unable to find the specified registry key or value.'), null)
assert.equal(parseValue(''), null)
assert.equal(command('C:\\x\\Spidey Sense.exe'), '"C:\\x\\Spidey Sense.exe" --autostart')

;(async () => {
  const key = String.raw`HKCU\Software\SpideySenseTest`
  const name = 'T'
  const exe = 'C:\\Test Dir\\Spidey Sense.exe'
  const del = () => { try { execFileSync('reg.exe', ['delete', key, '/f'], { stdio: 'ignore' }) } catch { /* not there */ } }
  del()
  try {
    // turning off when nothing is there is a no-op
    assert.deepEqual(await sync({ enable: false, exe, key, name }), { ok: true, changed: false, state: 'off' })
    // enable writes + verifies
    let r = await sync({ enable: true, exe, key, name })
    assert.equal(r.ok, true)
    assert.equal(r.changed, true)
    assert.equal(r.state, 'on')
    // enabling again changes nothing
    r = await sync({ enable: true, exe, key, name })
    assert.equal(r.changed, false)
    // folder moved after an update: entry is repaired
    r = await sync({ enable: true, exe: 'D:\\Moved\\Spidey Sense.exe', key, name })
    assert.equal(r.changed, true)
    const raw = execFileSync('reg.exe', ['query', key, '/v', name]).toString()
    assert.equal(parseValue(raw, name), '"D:\\Moved\\Spidey Sense.exe" --autostart')
    // disable removes it
    r = await sync({ enable: false, exe, key, name })
    assert.deepEqual({ ok: r.ok, changed: r.changed, state: r.state }, { ok: true, changed: true, state: 'off' })
    console.log('autostart: ALL PASS')
  } finally {
    del()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
