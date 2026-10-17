'use strict'
// Unit tests for the failover brain (fake network, fake clock, fake encryption).
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const B = require('../brain')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-test-'))
const mk = (name) => path.join(tmp, name + '.json')
// reversible "encryption" that is obviously not the plaintext
const crypt = { available: () => true, enc: (s) => Buffer.from([...s].reverse().join('') + '#enc').toString('base64'), dec: (s) => [...Buffer.from(s, 'base64').toString().replace(/#enc$/, '')].reverse().join('') }

/** a scripted fake provider network: handler(url, key, body) -> {status, body, headers} or throws */
function fakeNet(handler) {
  const calls = []
  const fn = async (url, init = {}) => {
    const key = (init.headers?.Authorization || '').replace('Bearer ', '')
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url, key, body, method: init.method })
    const r = await handler(url, key, body, init)
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers || {} })
  }
  fn.calls = calls
  return fn
}
const answer = (text) => ({ status: 200, body: { choices: [{ message: { content: text } }] } })
const models = (...ids) => ({ status: 200, body: { data: ids.map((id) => ({ id })) } })

const msgs = [{ role: 'user', content: 'hi' }]
let clock = 1_000_000
const now = () => clock

;(async () => {
  // ---------- keys are encrypted at rest and never listed
  {
    const net = fakeNet(() => answer('x'))
    const b = B.createBrain({ file: mk('enc'), fetch: net, now, crypt })
    const id = b.add({ provider: 'groq', key: 'gsk_SECRETKEY123456', label: 'my groq' })
    const raw = fs.readFileSync(mk('enc'), 'utf8')
    assert.ok(!raw.includes('SECRETKEY'), 'plaintext key must not be on disk')
    assert.ok(!JSON.stringify(b.list()).includes('SECRETKEY'), 'public list never contains the key')
    assert.equal(b.list()[0].keyHint, '…3456')
    // survives a restart
    const b2 = B.createBrain({ file: mk('enc'), fetch: net, now, crypt })
    assert.equal(b2.list().length, 1)
    assert.equal(b2.list()[0].id, id)
    // no encryption available => refuse to store
    const noCrypt = B.createBrain({ file: mk('nocrypt'), fetch: net, now, crypt: { ...crypt, available: () => false } })
    assert.throws(() => noCrypt.add({ provider: 'groq', key: 'gsk_abcdefgh1234' }), /encryption/i)
    assert.ok(!fs.existsSync(mk('nocrypt')), 'nothing was written')
  }

  // ---------- validation
  {
    const b = B.createBrain({ file: mk('val'), fetch: fakeNet(() => answer('x')), now, crypt })
    assert.throws(() => b.add({ provider: 'nope', key: 'abcdefgh1234' }), /unknown provider/)
    assert.throws(() => b.add({ provider: 'groq', key: 'short' }), /API key/)
    assert.throws(() => b.add({ provider: 'groq', key: 'has space in it 12345' }), /API key/)
    assert.throws(() => b.add({ provider: 'custom', key: 'abcdefgh1234', baseUrl: 'http://evil.example.com/v1' }), /https/)
    assert.throws(() => b.add({ provider: 'custom', key: 'abcdefgh1234', baseUrl: 'https://user:pw@x.com/v1' }), /https/)
    assert.doesNotThrow(() => b.add({ provider: 'custom', key: 'abcdefgh1234', baseUrl: 'http://127.0.0.1:8080/v1/' }))
    assert.equal(b.list()[0].baseUrl, 'http://127.0.0.1:8080/v1', 'trailing slash removed; localhost http allowed')
    assert.equal(B.cleanBaseUrl('https://api.mistral.ai/v1'), 'https://api.mistral.ai/v1')
    assert.equal(B.cleanBaseUrl('ftp://x.com'), '')
  }

  // ---------- happy path: first key answers, model auto-detected from the key's own model list
  {
    const net = fakeNet((url, key) => (url.endsWith('/models') ? models('openai/gpt-oss-20b', 'llama-3.3-70b-versatile') : answer('{"say":"Hello!","do":""}')))
    const b = B.createBrain({ file: mk('happy'), fetch: net, now, crypt })
    b.add({ provider: 'groq', key: 'gsk_aaaaaaaa1111', label: 'groq 1' })
    const r = await b.chat(msgs)
    assert.equal(r.ok, true)
    assert.equal(r.text, '{"say":"Hello!","do":""}')
    assert.match(r.via, /groq 1 \(llama-3\.3-70b-versatile\)/, 'prefers the first preferred model the key can see')
    const post = net.calls.find((c) => c.method === 'POST')
    assert.equal(post.url, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(post.key, 'gsk_aaaaaaaa1111')
    assert.equal(post.body.stream, false)
    assert.deepEqual(post.body.messages, msgs)
    assert.equal(b.list()[0].status, 'ok')
  }

  // ---------- failover: key 1 rate-limited -> key 2 answers; key 1 is then skipped during its cooldown, and returns afterwards
  {
    let n1 = 0
    const net = fakeNet((url, key) => {
      if (url.endsWith('/models')) return models('llama-3.3-70b-versatile', 'meta/llama-3.3-70b-instruct', 'gemini-2.5-flash')
      if (key === 'KEY1_aaaaaaaa') {
        n1++
        return { status: 429, body: { error: { message: 'rate limit' } }, headers: { 'retry-after': '30' } }
      }
      return answer('from key two')
    })
    const b = B.createBrain({ file: mk('fail1'), fetch: net, now, crypt })
    b.add({ provider: 'nvidia', key: 'KEY1_aaaaaaaa', label: 'nvidia' })
    b.add({ provider: 'groq', key: 'KEY2_bbbbbbbb', label: 'groq' })
    let r = await b.chat(msgs)
    assert.equal(r.ok, true)
    assert.equal(r.text, 'from key two')
    assert.deepEqual(r.chain, ['nvidia: rate limit reached', 'groq: ok'])
    assert.equal(b.list()[0].status, 'cooling')
    assert.equal(b.list()[0].cooldownS, 30, 'honours Retry-After')
    r = await b.chat(msgs)
    assert.equal(n1, 1, 'key 1 is not hammered while cooling')
    assert.deepEqual(r.chain, ['groq: ok'])
    clock += 31_000
    r = await b.chat(msgs)
    assert.equal(n1, 2, 'key 1 gets another chance after the cooldown')
  }

  // ---------- a rejected key is marked bad and not retried, until it is replaced
  {
    let hits = 0
    const net = fakeNet((url, key) => {
      if (url.endsWith('/models')) return models('gemini-2.5-flash')
      if (key === 'BADKEY_aaaaaaaa') { hits++; return { status: 401, body: { error: { message: 'bad key' } } } }
      return answer('fine')
    })
    const b = B.createBrain({ file: mk('bad'), fetch: net, now, crypt })
    const bad = b.add({ provider: 'gemini', key: 'BADKEY_aaaaaaaa', label: 'bad' })
    b.add({ provider: 'gemini', key: 'GOODKEY_bbbbbbbb', label: 'good' })
    await b.chat(msgs)
    await b.chat(msgs)
    assert.equal(hits, 1, 'a 401 key is never retried')
    assert.equal(b.list()[0].status, 'bad')
    assert.equal(b.list()[0].lastError, 'the key was rejected')
    clock += 3600_000
    await b.chat(msgs)
    assert.equal(hits, 1, 'still bad an hour later')
    b.update(bad, { key: 'GOODKEY_cccccccc' })
    assert.equal(b.list()[0].status, 'untested', 'replacing the key clears the bad mark')
  }

  // ---------- three tries, then local
  {
    const attempts = []
    const net = fakeNet((url, key) => {
      if (url.endsWith('/models')) return models('m')
      if (url.includes('127.0.0.1:11434')) return answer('{"say":"from the local model","do":""}')
      attempts.push(key)
      return { status: 503, body: 'down' }
    })
    const ollama = { status: async () => ({ available: true, model: 'qwen2.5:1.5b' }) }
    const b = B.createBrain({ file: mk('three'), fetch: net, now, crypt, ollama })
    for (const [i, p] of ['nvidia', 'groq', 'gemini', 'openrouter'].entries()) b.add({ provider: p, key: `KEY${i}_xxxxxxxx`, label: `k${i}` })
    const r = await b.chat(msgs)
    assert.equal(r.ok, true)
    assert.deepEqual(attempts, ['KEY0_xxxxxxxx', 'KEY1_xxxxxxxx', 'KEY2_xxxxxxxx'], 'exactly three online attempts, in order, the fourth key is not tried')
    assert.match(r.via, /local Ollama \(qwen2\.5:1\.5b\)/)
    assert.equal(r.chain.at(-1), 'local Ollama: ok')
    assert.equal(net.calls.find((c) => c.url.includes('11434')).body.model, 'qwen2.5:1.5b')
    // next question: the three failed keys are cooling, so the 4th key gets its turn
    const r2 = await b.chat(msgs)
    assert.ok(attempts.includes('KEY3_xxxxxxxx'), 'the next question reaches key 4')
  }

  // ---------- nothing works at all
  {
    const net = fakeNet(() => ({ status: 500, body: 'x' }))
    const b = B.createBrain({ file: mk('none'), fetch: net, now, crypt, ollama: { status: async () => ({ available: false, model: '' }) } })
    let r = await b.chat(msgs)
    assert.equal(r.ok, false)
    assert.match(r.error, /no AI keys/)
    b.add({ provider: 'groq', key: 'gsk_abcdefgh1234' })
    r = await b.chat(msgs)
    assert.equal(r.ok, false)
    assert.match(r.error, /every key failed/)
  }

  // ---------- network errors and timeouts count as failures, then the next key answers
  {
    let first = true
    const net = fakeNet((url, key) => {
      if (url.endsWith('/models')) return models('gemini-2.5-flash')
      if (key === 'KEY0_xxxxxxxx') throw Object.assign(new Error('fetch failed'), { name: 'TypeError' })
      if (key === 'KEY1_xxxxxxxx' && first) { first = false; throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) }
      return answer('third time lucky')
    })
    const b = B.createBrain({ file: mk('net'), fetch: net, now, crypt })
    for (let i = 0; i < 3; i++) b.add({ provider: 'gemini', key: `KEY${i}_xxxxxxxx`, label: `g${i}` })
    const r = await b.chat(msgs)
    assert.equal(r.text, 'third time lucky')
    assert.deepEqual(r.chain, ['g0: could not reach the server', 'g1: no answer in time', 'g2: ok'])
  }

  // ---------- exponential back-off on repeated rate limits, success resets it
  {
    const net = fakeNet((url, key) => (url.endsWith('/models') ? models('m') : { status: 429, body: 'slow down' }))
    const b = B.createBrain({ file: mk('backoff'), fetch: net, now, crypt })
    b.add({ provider: 'openrouter', key: 'KEY0_xxxxxxxx' })
    await b.chat(msgs)
    assert.equal(b.list()[0].cooldownS, 60)
    clock += 61_000
    await b.chat(msgs)
    assert.equal(b.list()[0].cooldownS, 120, 'second failure doubles the wait')
    for (let i = 0; i < 8; i++) { clock += 16 * 60_000; await b.chat(msgs) }
    assert.ok(b.list()[0].cooldownS <= 15 * 60, 'but never more than 15 minutes')
  }

  // ---------- test() button
  {
    const net = fakeNet((url, key) => (url.endsWith('/models') ? models('llama-3.3-70b-versatile') : key === 'GOOD_aaaaaaaa' ? answer('ready') : { status: 401, body: { error: { message: 'nope' } } }))
    const b = B.createBrain({ file: mk('test'), fetch: net, now, crypt })
    const g = b.add({ provider: 'groq', key: 'GOOD_aaaaaaaa' })
    const x = b.add({ provider: 'groq', key: 'BAD_aaaaaaaaa' })
    const rg = await b.test(g)
    assert.equal(rg.ok, true)
    assert.equal(rg.model, 'llama-3.3-70b-versatile')
    const rx = await b.test(x)
    assert.equal(rx.ok, false)
    assert.equal(rx.kind, 'auth')
    assert.equal(b.list()[1].status, 'bad')
    assert.equal((await b.test('nope')).ok, false)
  }

  // ---------- ordering, disabling, removing
  {
    const net = fakeNet((url, key) => (url.endsWith('/models') ? models('m') : answer(`answered by ${key}`)))
    const b = B.createBrain({ file: mk('order'), fetch: net, now, crypt })
    const a = b.add({ provider: 'groq', key: 'AAAA_aaaaaaaa', label: 'A' })
    const c = b.add({ provider: 'groq', key: 'CCCC_cccccccc', label: 'C' })
    assert.equal((await b.chat(msgs)).text, 'answered by AAAA_aaaaaaaa')
    b.move(c, -1)
    assert.deepEqual(b.list().map((e) => e.label), ['C', 'A'])
    assert.equal((await b.chat(msgs)).text, 'answered by CCCC_cccccccc')
    b.update(c, { enabled: false })
    assert.equal((await b.chat(msgs)).text, 'answered by AAAA_aaaaaaaa', 'disabled keys are skipped')
    b.remove(a)
    assert.equal(b.list().length, 1)
    assert.ok(!fs.readFileSync(mk('order'), 'utf8').includes('AAAA_aaaaaaaa'))
  }

  // ---------- ready(): natural chat needs a key or a local model, and respects the switch
  {
    const net = fakeNet(() => answer('x'))
    let local = false
    const b = B.createBrain({ file: mk('ready'), fetch: net, now, crypt, ollama: { status: async () => ({ available: local, model: 'm' }) } })
    assert.equal(await b.ready(), false)
    local = true
    assert.equal(await b.ready(), true)
    local = false
    const id = b.add({ provider: 'groq', key: 'gsk_abcdefgh1234' })
    assert.equal(await b.ready(), true)
    b.setNaturalChat(false)
    assert.equal(await b.ready(), false)
    assert.equal(b.getSettings().naturalChat, false)
  }

  // ---------- content-parts replies and classification helpers
  assert.equal(B.extractText({ choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }] }), 'ab')
  assert.equal(B.extractText({}), '')
  assert.equal(B.classify(429, { get: () => '5' }, '').retryAfterMs, 5000)
  assert.equal(B.classify(404, null, '{"error":{"message":"model not found"}}').kind, 'model')
  assert.equal(B.classify(400, null, 'bad model name').kind, 'model')
  assert.equal(B.classify(403, null, '').kind, 'auth')

  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('brain: ALL PASS')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
