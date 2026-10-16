'use strict'
// Silent unit tests for Karen's voice plumbing. (SPEECH_LIVE=1 also speaks one short sentence through your speakers.)
const assert = require('node:assert/strict')
const { clean, SCRIPT, MAX_CHARS, speak, stop } = require('../speech')

assert.equal(clean('  HELLO,   I’M  KAREN.\n\nTHWIP!  '), 'hello, i’m karen. thwip!')
assert.equal(clean('a\u0000b\u001bc\u007fd'), 'a b c d', 'control characters never reach the speech engine')
assert.equal(clean(''), '')
assert.equal(clean(null), '')
assert.equal(clean(undefined), '')
assert.equal(clean('x'.repeat(5000)).length, MAX_CHARS)

// the text travels on stdin: the PowerShell script must read it from there and must not embed any user text
assert.match(SCRIPT, /\[Console\]::In\.ReadToEnd\(\)/)
assert.match(SCRIPT, /\$s\.Speak\(\$t\)/)
assert.ok(!/\$\{|`/.test(SCRIPT), 'script has no interpolation hooks')

;(async () => {
  assert.deepEqual(await speak(''), { ok: true, ms: 0 }, 'empty text is a silent no-op')
  stop()
  if (process.env.SPEECH_LIVE) {
    const r = await speak('Hello. Karen here. Can you hear me?')
    assert.ok(r.ok, r.error)
    assert.ok(r.ms > 800, `real speech takes time, took ${r.ms} ms`)
    console.log(`live speech finished in ${r.ms} ms`)
  }
  console.log('speech: ALL PASS')
})()
