'use strict'
// Unit tests for Karen's rule engine and the LLM-reply sanitiser. Run: npm run test:unit
const assert = require('node:assert/strict')
const { interpret, normaliseReminder } = require('../renderer/karen.js')
const { sanitize, pickModel, brief } = require('../karen-llm.js')

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

// unknown goes to the LLM
assert.equal(say('write me a poem about tacos').unknown, true)
assert.equal(say('cpu', { ...ctx, stats: undefined }).unknown, true)

// LLM sanitiser: only whitelisted, clamped actions get through
assert.deepEqual(sanitize('{"say":"On it.","action":{"type":"remind","minutes":99999,"text":"x"}}'), { say: 'On it.', action: { type: 'remind', raw: 'in 1440m x' } })
assert.deepEqual(sanitize('noise {"say":"hi","action":{"type":"timer","op":"focus"}} trailing').action, { type: 'timer', op: 'focus' })
assert.equal(sanitize('{"say":"x","action":{"type":"kill","name":"explorer"}}').action, null, 'model cannot kill processes')
assert.equal(sanitize('{"say":"x","action":{"type":"timer","op":"rm -rf"}}').action, null)
assert.equal(sanitize('plain words, not json').say, 'plain words, not json')
assert.equal(pickModel(['mistral:7b', 'qwen2.5:1.5b', 'llama3.2:3b'], ''), 'qwen2.5:1.5b')
assert.equal(pickModel(['mistral:7b'], ''), 'mistral:7b')
assert.equal(pickModel([], ''), '')
assert.match(brief({ stats, battery }), /cpu 12%, ram 97%, disk 82%.*chrome 1703MB.*ping 38ms.*battery 80% charging/)

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

// web-capture intent
assert.deepEqual(interpret('take a screenshot', ctx).action, { type: 'capture' })
assert.deepEqual(interpret('web capture', ctx).action, { type: 'capture' })
assert.deepEqual(interpret('make a comic panel', ctx).action, { type: 'capture' })
console.log('karen capture: ALL PASS')

// manual
assert.deepEqual(interpret('open the manual', ctx).action, { type: 'help-window' })
assert.deepEqual(interpret('what can you do', ctx).action, { type: 'help-window' })
assert.equal(interpret('help', ctx).action, undefined, 'plain help stays a quick list')
console.log('karen manual: ALL PASS')

// voice
for (const q of ['speak to me', 'talk to me', 'read it aloud', 'turn on the voice', 'enable voice']) assert.deepEqual(interpret(q, ctx).action, { type: 'voice', on: true }, q)
for (const q of ['stop talking', 'stop speaking', 'turn off the voice', 'voice off', 'be silent']) assert.deepEqual(interpret(q, ctx).action, { type: 'voice', on: false }, q)
for (const q of ['say hello', 'test your voice', 'can you hear me', 'let me hear you']) assert.deepEqual(interpret(q, ctx).action, { type: 'speak-test' }, q)
assert.deepEqual(interpret('mute', ctx).action, { type: 'sound', on: false }, 'mute still means the chirp')
assert.deepEqual(interpret('be quiet', ctx).action, { type: 'sound', on: false })
console.log('karen voice: ALL PASS')

// choosing the voice
for (const [q, pick] of [['use david', 'david'], ['switch to zira', 'zira'], ['use the female voice', 'female'], ['change to male voice', 'male'], ['use the default voice', 'auto'], ['zira voice', 'zira'], ['speak in david', 'david']]) assert.deepEqual(interpret(q, ctx).action, { type: 'voice-pick', pick }, q)
for (const q of ['change voice', 'switch the voice', 'try another voice', 'different voice', 'next voice']) assert.deepEqual(interpret(q, ctx).action, { type: 'voice-pick', pick: 'next' }, q)
for (const q of ['list voices', 'what voices do you have', 'show the voices']) assert.deepEqual(interpret(q, ctx).action, { type: 'voice-list' }, q)
assert.deepEqual(interpret('speak to me', ctx).action, { type: 'voice', on: true }, 'speak to me still turns the voice on')
console.log('karen voice picking: ALL PASS')


// notification reading
for (const q of ['read my notifications', 'read notifications aloud', 'announce my messages', 'read all notifications out loud', 'turn on notification reading', 'start notification reading']) assert.deepEqual(interpret(q, ctx).action, { type: 'reader', on: true }, q)
for (const q of ['stop reading notifications', 'stop reading my notifications', "don't read my messages", 'turn off notification reading', 'no more reading notifications']) assert.deepEqual(interpret(q, ctx).action, { type: 'reader', on: false }, q)
for (const q of ['read notifications privately', 'private mode', 'only tell me who']) assert.deepEqual(interpret(q, ctx).action, { type: 'reader-mode', mode: 'private' }, q)
for (const q of ['read everything', 'full mode', 'public mode']) assert.deepEqual(interpret(q, ctx).action, { type: 'reader-mode', mode: 'full' }, q)
assert.deepEqual(interpret("don't read youtube", ctx).action, { type: 'reader-mute', app: 'youtube', on: true })
assert.deepEqual(interpret('stop reading whatsapp notifications', ctx).action, { type: 'reader-mute', app: 'whatsapp', on: true })
assert.deepEqual(interpret('ignore teams', ctx).action, { type: 'reader-mute', app: 'teams', on: true })
assert.deepEqual(interpret('read whatsapp again', ctx).action, { type: 'reader-mute', app: 'whatsapp', on: false })
assert.deepEqual(interpret('start reading mail', ctx).action, { type: 'reader-mute', app: 'mail', on: false })
assert.deepEqual(interpret('call me Dhruv sir', ctx).action, { type: 'call-me', name: 'Dhruv sir' }, 'the name keeps its capital letters')
assert.deepEqual(interpret('you can call me Boss.', ctx).action, { type: 'call-me', name: 'Boss' })
assert.deepEqual(interpret("don't call me by name", ctx).action, { type: 'call-me', name: '' })
for (const q of ['what did i miss', 'any new messages', 'read my unread notifications', 'do i have any notifications']) assert.deepEqual(interpret(q, ctx).action, { type: 'missed' }, q)
for (const q of ['repeat that', 'say that again', 'what was that', 'read it again']) assert.deepEqual(interpret(q, ctx).action, { type: 'repeat' }, q)
for (const q of ['skip', 'next', 'enough', 'shh']) assert.deepEqual(interpret(q, ctx).action, { type: 'speech-stop' }, q)
assert.deepEqual(interpret('are you reading my notifications', ctx).action, { type: 'reader-status' })
assert.deepEqual(interpret('speak to me', ctx).action, { type: 'voice', on: true }, 'speak to me is still the reply voice')
assert.deepEqual(interpret('mute', ctx).action, { type: 'sound', on: false }, 'mute is still the chirp')
console.log('karen reader: ALL PASS')


// brain
for (const q of ['api keys', 'open the ai settings', 'set up the ai', 'add an api key', 'brain settings']) assert.deepEqual(interpret(q, ctx).action, { type: 'brain-open' }, q)
for (const q of ['new chat', 'start over', 'forget this conversation']) assert.deepEqual(interpret(q, ctx).action, { type: 'brain-reset' }, q)
assert.deepEqual(interpret('which ai are you using', ctx).action, { type: 'brain-status' })
for (const q of ['hi', 'thanks', 'how are you', "what's up", 'good morning', 'who are you']) assert.equal(interpret(q, ctx).chat, true, q + ' is small talk the brain may answer')
assert.equal(interpret('status', ctx).chat, undefined, 'real commands never go to the brain')
assert.equal(interpret('tell me a story about spiders', ctx).unknown, true)
console.log('karen brain: ALL PASS')
