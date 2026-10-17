'use strict'
// Silent unit tests for Karen's voice plumbing (fake spawn: nothing is spoken). SPEECH_LIVE=1 also speaks one sentence.
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const speech = require('../speech')
const { clean, SCRIPT, MAX_CHARS, MAX_QUEUE } = speech

assert.equal(clean('  HELLO,   I’M  KAREN.\n\nTHWIP!  '), 'hello, i’m karen. thwip!')
assert.equal(clean('a\u0000b\u001bc\u007fd'), 'a b c d', 'control characters never reach the speech engine')
assert.equal(clean(''), '')
assert.equal(clean(null), '')
assert.equal(clean(undefined), '')
assert.equal(clean('x'.repeat(5000)).length, MAX_CHARS)
assert.match(SCRIPT, /\[Console\]::In\.ReadToEnd\(\)/)
assert.match(SCRIPT, /\$s\.Speak\(\$t\)/)
assert.ok(!/\$\{|`/.test(SCRIPT), 'script has no interpolation hooks')

/** fake powershell: records what was "spoken", finishes after `ms` unless killed */
function fakeEngine(ms = 15) {
  const log = { spoken: [], started: 0, killed: 0 }
  const fn = () => {
    const child = new EventEmitter()
    child.exitCode = null
    child.stderr = new EventEmitter()
    let text = ''
    child.stdin = { on() {}, end(t) { text = t; log.spoken.push(t); const timer = setTimeout(() => { if (child.exitCode === null) { child.exitCode = 0; child.emit('close', 0) } }, ms); child._t = timer } }
    child.kill = () => { if (child.exitCode === null) { log.killed++; clearTimeout(child._t); child.exitCode = 1; child.emit('close', null) } }
    log.started++
    return child
  }
  return { fn, log }
}

;(async () => {
  // plain speak(): empty is a silent no-op
  assert.deepEqual(await speech.speak(''), { ok: true, ms: 0 })

  // queue: items play one after another, in order, never overlapping
  {
    const { fn, log } = fakeEngine(20)
    speech._setSpawn(fn)
    const tags = []
    speech.setOnStart((t) => tags.push(t))
    const a = speech.speak('First one', { queue: true, tag: 'A' })
    const b = speech.speak('Second one', { queue: true, tag: 'B' })
    const c = speech.speak('Third one', { queue: true, tag: 'C' })
    await Promise.all([a, b, c])
    assert.deepEqual(log.spoken, ['first one', 'second one', 'third one'])
    assert.deepEqual(tags, ['A', 'B', 'C'], 'caption tags are announced as each item starts')
    assert.equal(log.killed, 0)
  }

  // plain speak() interrupts the current sentence and clears the queue
  {
    const { fn, log } = fakeEngine(60)
    speech._setSpawn(fn)
    const first = speech.speak('long sentence one', { queue: true })
    const second = speech.speak('queued two', { queue: true })
    await new Promise((r) => setTimeout(r, 10))
    const now = speech.speak('stop everything and say this')
    const r2 = await second
    assert.equal(r2.skipped, true, 'queued item was dropped')
    await Promise.all([first, now])
    assert.deepEqual(log.spoken, ['long sentence one', 'stop everything and say this'])
    assert.equal(log.killed, 1)
  }

  // urgent (a ringing call) cuts the current sentence and goes first
  {
    const { fn, log } = fakeEngine(60)
    speech._setSpawn(fn)
    const a = speech.speak('some chat message', { queue: true })
    const b = speech.speak('another chat message', { queue: true })
    await new Promise((r) => setTimeout(r, 10))
    const u = speech.speak('x is calling you', { queue: true, urgent: true })
    await Promise.all([a, b, u])
    assert.equal(log.spoken[1], 'x is calling you', 'urgent item plays right after the one it interrupted')
    assert.ok(log.spoken.includes('another chat message'), 'normal items still play afterwards')
    assert.equal(log.killed, 1)
  }

  // stop() silences and empties everything
  {
    const { fn, log } = fakeEngine(80)
    speech._setSpawn(fn)
    const a = speech.speak('one', { queue: true })
    const b = speech.speak('two', { queue: true })
    await new Promise((r) => setTimeout(r, 10))
    speech.stop()
    await Promise.all([a, b])
    assert.deepEqual(log.spoken, ['one'])
  }

  // the queue is bounded: the oldest items are dropped when too many pile up
  {
    const { fn, log } = fakeEngine(5)
    speech._setSpawn(fn)
    const all = []
    for (let i = 0; i < MAX_QUEUE + 5; i++) all.push(speech.speak(`item ${i}`, { queue: true }))
    const res = await Promise.all(all)
    assert.ok(res.filter((r) => r.skipped).length >= 4, 'overflow dropped the oldest')
    assert.ok(log.spoken.length <= MAX_QUEUE + 1)
  }

  // voices: pick by short name / gender / next / auto, and the chosen voice travels in the environment (never in the text)
  {
    speech._setVoices([
      { name: 'Microsoft David Desktop', short: 'David', gender: 'male', culture: 'en-US' },
      { name: 'Microsoft Zira Desktop', short: 'Zira', gender: 'female', culture: 'en-US' }
    ])
    assert.equal(speech.resolveVoice('zira').short, 'Zira')
    assert.equal(speech.resolveVoice('DAVID').name, 'Microsoft David Desktop')
    assert.equal(speech.resolveVoice('male').short, 'David')
    assert.equal(speech.resolveVoice('female').short, 'Zira')
    assert.equal(speech.resolveVoice('next', 'Microsoft David Desktop').short, 'Zira')
    assert.equal(speech.resolveVoice('next', 'Microsoft Zira Desktop').short, 'David', 'cycles back round')
    assert.equal(speech.resolveVoice('next', '').short, 'David')
    assert.equal(speech.resolveVoice('auto').name, '')
    assert.equal(speech.resolveVoice('klingon'), null)
    assert.equal(speech.shortName('Microsoft Zira Desktop - English (United States)'), 'Zira')
    speech.setVoice('Microsoft David Desktop')
    assert.equal(speech.getVoice(), 'Microsoft David Desktop')
    speech.setVoice("x'; Remove-Item C:\ -Recurse #")
    assert.equal(speech.getVoice(), '', 'a hostile voice name is rejected')
    let seenEnv = null
    const { fn } = fakeEngine(5)
    speech._setSpawn((c, a2, o) => { seenEnv = o.env.SPIDEY_VOICE; return fn(c, a2, o) })
    speech.setVoice('Microsoft Zira Desktop')
    await speech.speak('hi')
    assert.equal(seenEnv, 'Microsoft Zira Desktop')
    speech.setVoice('')
  }

  speech._setSpawn(null)
  if (process.env.SPEECH_LIVE) {
    const r = await speech.speak('Hello. Karen here. Can you hear me?')
    assert.ok(r.ok, r.error)
    assert.ok(r.ms > 800, `real speech takes time, took ${r.ms} ms`)
    console.log(`live speech finished in ${r.ms} ms`)
  }
  console.log('speech: ALL PASS')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
