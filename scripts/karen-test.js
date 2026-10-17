'use strict'
// Unit tests for Karen's rule engine. Run: npm run test:unit
const assert = require('node:assert/strict')
const { interpret, normaliseReminder } = require('../renderer/karen.js')

const stats = { cpu: 12.4, ram: 97.2, disk: 82, latencyMs: 38, online: true, uptimeS: 90061, hog: { name: 'chrome', mb: 1703 } }
const battery = { level: 0.8, charging: true, present: true }
const timer = { mode: 'focus', left: 754, running: true }
const parseReminder = (s) => (/^(in|at)\s/i.test(s) ? { due: 1, text: 'x' } : null)
const ctx = { stats, battery, timer, parseReminder, reminders: 2 }
const say = (t, c = ctx) => interpret(t, c)

assert.match(say('cpu?').say, /CPU AT 12%/)
assert.match(say('how much RAM am I using').say, /RAM AT 97%.*CHROME/)
assert.match(say('what is eating my ram').say, /CHROME.*1703 MB/)
assert.match(say('disk space').say, /82%/)
assert.match(say('battery').say, /80%.*CHARGING/)
assert.match(say('am I online?').say, /38 MS/)
assert.match(say('uptime').say, /1D 1H/)
assert.match(say('status').say, /CPU 12%.*RAM 97%.*DISK 82%.*BATTERY 80%.*NET 38MS/)
assert.match(say('how is my pc').say, /CPU/)
assert.equal(say('net', { ...ctx, stats: { ...stats, online: false } }).say, 'WEB’S DOWN — NO CONNECTION.')

// reminders
assert.deepEqual(say('in 20m stretch').action, { type: 'remind', raw: 'in 20m stretch' })
assert.deepEqual(say('remind me to drink water in 10 minutes').action, { type: 'remind', raw: 'in 10 minutes drink water' })
assert.deepEqual(say('remind me in 5 min to call mum').action, { type: 'remind', raw: 'in 5 min call mum' })
assert.deepEqual(say('remind me at 3pm to submit report').action, { type: 'remind', raw: 'at 3pm submit report' })
assert.match(say('remind me sometime').say, /WHEN\?/)
assert.equal(normaliseReminder('Remind me to stretch at 15:30'), 'at 15:30 stretch')

assert.deepEqual(say('am i safe').action, { type: 'edith' })
assert.deepEqual(say('run a threat assessment').action, { type: 'edith' })
assert.deepEqual(say('security check').action, { type: 'edith' })
assert.deepEqual(say('show me the daily web').action, { type: 'bugle' })

// timer + ui + settings
assert.deepEqual(say('start focus').action, { type: 'timer', op: 'focus' })
assert.deepEqual(say('take a break').action, { type: 'timer', op: 'break' })
assert.deepEqual(say('pause the timer').action, { type: 'timer', op: 'pause' })
assert.deepEqual(say('reset timer').action, { type: 'timer', op: 'reset' })
assert.match(say('how much time left').say, /12M 34S LEFT/)
assert.deepEqual(say('collapse').action, { type: 'collapse' })
assert.deepEqual(say('mute').action, { type: 'sound', on: false })
assert.deepEqual(say('unmute').action, { type: 'sound', on: true })
assert.deepEqual(say('opacity 70').action, { type: 'opacity', value: 0.7 })
assert.deepEqual(say('opacity 5').action, { type: 'opacity', value: 0.3 })

// destructive: always confirm first
const k = say('kill chrome')
assert.deepEqual(k.confirm, { type: 'kill', name: 'chrome' })
assert.equal(k.action, undefined, 'must not kill before confirmation')
assert.deepEqual(say('yes', { ...ctx, pendingKill: 'chrome' }).action, { type: 'kill', name: 'chrome', confirmed: true })
assert.deepEqual(say('no', { ...ctx, pendingKill: 'chrome' }).action, { type: 'cancel-kill' })
assert.equal(say('yes').action, undefined, '"yes" alone does nothing')
assert.match(say('kill ..\\..\\evil').say, /ODD/)

// anything else is "not sure I follow" (chat lives in Jarvis)
assert.equal(say('write me a poem about tacos').unknown, true)
assert.equal(say('cpu', { ...ctx, stats: undefined }).unknown, true)


console.log('karen: ALL PASS')

// suits + locker intents
{
  const S = require('../renderer/suits.js')
  const c2 = { ...ctx, findSuit: S.findSuit }
  assert.deepEqual(interpret('wear the neon suit', c2).action, { type: 'equip', id: 'neon' })
  assert.deepEqual(interpret('switch to midnight', c2).action, { type: 'equip', id: 'midnight' })
  assert.deepEqual(interpret('show my level', c2).action, { type: 'locker' })
  assert.deepEqual(interpret('open the suit locker', c2).action, { type: 'locker' })
  assert.deepEqual(interpret('am i safe', c2).action, { type: 'edith' }, 'threat/security still wins')
  console.log('karen suits: ALL PASS')
}

// updater intents
assert.deepEqual(interpret('check for updates', ctx).action, { type: 'update-check' })
assert.deepEqual(interpret('is there an update', ctx).action, { type: 'update-check' })
assert.deepEqual(interpret('am i up to date?', ctx).action, { type: 'update-check' })
assert.deepEqual(interpret('install update', ctx).action, { type: 'update-install' })
assert.deepEqual(interpret('restart to update', ctx).action, { type: 'update-install' })
console.log('karen updater: ALL PASS')


// manual
assert.deepEqual(interpret('open the manual', ctx).action, { type: 'help-window' })
assert.deepEqual(interpret('what can you do', ctx).action, { type: 'help-window' })
assert.equal(interpret('help', ctx).action, undefined, 'plain help stays a quick list')
console.log('karen manual: ALL PASS')

// the voice / AI-brain / notification-reader / capture commands moved to Jarvis (and Spidey Lab): Karen no longer knows them
for (const q of ['speak to me', 'stop talking', 'change voice', 'list voices', 'use david', 'listen', 'conversation mode', 'turn on the wake word', 'api keys', 'new chat', 'read my notifications', 'what did i miss', 'take a screenshot', 'web capture']) {
  const r = interpret(q, ctx)
  assert.equal(r.action, undefined, `"${q}" must not be an action any more, got ${JSON.stringify(r.action)}`)
}
assert.equal(interpret('tell me a story about spiders', ctx).unknown, true)
for (const q of ['hi', 'thanks', 'how are you', 'good morning', 'who are you']) {
  const r = interpret(q, ctx)
  assert.ok(r.say && !r.chat && !r.unknown, `"${q}" gets a canned answer, not a brain`)
}
assert.match(interpret('who are you', ctx).say, /JARVIS/)
assert.equal(require('../renderer/karen.js').numberWords, undefined, 'spoken-number helpers left with the voice code')
console.log('karen without voice: ALL PASS')
