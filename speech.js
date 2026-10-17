'use strict'
/**
 * Karen's voice. Chromium inside Electron exposes no speech voices, so the browser speech API stays silent;
 * instead we use the speech engine Windows already ships (System.Speech / SAPI voices such as Zira and David).
 * The text goes in through stdin, never into the command line, so nothing a reply contains can be run as code.
 *
 * speak(text)                    interrupts whatever is playing and speaks now
 * speak(text, {queue: true})     waits its turn (used for notifications); a short queue, oldest dropped first
 * speak(text, {urgent: true})    jumps to the front of the queue
 * stop()                         silence + clear the queue
 */
const { spawn: realSpawn } = require('node:child_process')

const SCRIPT = [
  'Add-Type -AssemblyName System.Speech',
  '$t = [Console]::In.ReadToEnd()',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
  "$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en*' }",
  '$want = $env:SPIDEY_VOICE',
  '$p = $null',
  'if ($want) { $p = $v | Where-Object { $_.VoiceInfo.Name -eq $want } | Select-Object -First 1 }',
  "if (-not $p) { $p = $v | Where-Object { $_.VoiceInfo.Name -match 'Zira|Aria|Jenny' } | Select-Object -First 1 }",
  'if (-not $p) { $p = $v | Select-Object -First 1 }',
  'if ($p) { $s.SelectVoice($p.VoiceInfo.Name) }',
  '$s.Rate = 1',
  '$s.Volume = 90',
  '$s.Speak($t)'
].join('; ')

const MAX_CHARS = 420
const MAX_QUEUE = 8

/** plain lower-case text, no control characters, bounded length */
function clean(text) {
  // eslint-disable-next-line no-control-regex
  const t = String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  return lower.length > MAX_CHARS ? lower.slice(0, MAX_CHARS) : lower
}

const LIST_SCRIPT = [
  'Add-Type -AssemblyName System.Speech',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
  "$s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { '{0}|{1}|{2}' -f $_.VoiceInfo.Name, $_.VoiceInfo.Gender, $_.VoiceInfo.Culture.Name }"
].join('; ')

let voice = '' // '' = automatic (a friendly female English voice if there is one)
let voices = null // [{name, gender, culture}], filled by listVoices()

/** "Microsoft Zira Desktop" -> "Zira" */
const shortName = (full) => String(full).replace(/^Microsoft\s+/i, '').replace(/\s+(Desktop|Mobile|Online).*$/i, '').trim()

function setVoice(name) {
  voice = /^[\w .()-]{1,80}$/.test(String(name || '')) ? String(name) : ''
}
const getVoice = () => voice

/** installed English voices (cached after the first call) */
function listVoices() {
  if (voices) return Promise.resolve(voices)
  return new Promise((resolve) => {
    let out = ''
    let child
    try {
      child = spawnFn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', LIST_SCRIPT], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      return resolve([])
    }
    child.stdout.on('data', (d) => (out += d))
    child.on('error', () => resolve([]))
    child.on('close', () => {
      voices = out
        .split(/\r?\n/)
        .map((l) => l.trim().split('|'))
        .filter((p) => p.length === 3 && /^en/i.test(p[2]))
        .map(([name, gender, culture]) => ({ name, gender: gender.toLowerCase(), culture, short: shortName(name) }))
      resolve(voices)
    })
  })
}

/** "zira" | "david" | "male" | "female" | "next" | "auto" -> an installed voice (or null) */
function resolveVoice(pick, current = voice) {
  const list = voices || []
  const p = String(pick || '').toLowerCase().trim()
  if (!list.length) return null
  if (p === 'auto' || p === 'default') return { name: '', short: 'automatic' }
  if (p === 'next' || p === 'other' || p === 'switch') {
    const i = list.findIndex((v) => v.name === current)
    return list[(i + 1) % list.length]
  }
  if (p === 'male' || p === 'female') return list.find((v) => v.gender === p) || null
  return list.find((v) => v.name.toLowerCase() === p || v.short.toLowerCase() === p || v.name.toLowerCase().includes(p)) || null
}

let spawnFn = realSpawn
let current = null // the running powershell child
let queue = [] // [{text, tag, resolve}]
let busy = false
let onStart = null

/** tests inject a fake spawn */
function _setSpawn(fn) {
  spawnFn = fn || realSpawn
}
/** main.js: be told when an item starts playing (so the caption can show what is being read) */
function setOnStart(fn) {
  onStart = fn
}

function killCurrent() {
  if (current && current.exitCode === null) {
    try {
      current.kill()
    } catch {
      /* already gone */
    }
  }
  current = null
}

function stop() {
  const dropped = queue
  queue = []
  killCurrent()
  for (const q of dropped) q.resolve({ ok: true, ms: 0, skipped: true })
}

function run(item) {
  busy = true
  return new Promise((done) => {
    const t0 = Date.now()
    // test harness only: write what WOULD be spoken to a file instead of making sound
    if (process.env.SPIDEY_TEST && process.env.SPIDEY_SPEECH_LOG) {
      try {
        require('node:fs').appendFileSync(process.env.SPIDEY_SPEECH_LOG, JSON.stringify({ text: item.text, voice, tag: item.tag || null }) + '\n')
      } catch {
        /* ignore */
      }
      if (onStart && item.tag) onStart(item.tag)
      return setTimeout(() => {
        item.resolve({ ok: true, ms: 150 })
        done()
      }, 150)
    }
    let child
    try {
      child = spawnFn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'], env: { ...process.env, SPIDEY_VOICE: voice } })
    } catch (e) {
      item.resolve({ ok: false, ms: 0, error: e.message })
      return done()
    }
    current = child
    if (onStart && item.tag) onStart(item.tag)
    let err = ''
    child.stderr && child.stderr.on('data', (d) => (err += d))
    let finished = false
    const finish = (res) => {
      if (finished) return
      finished = true
      if (current === child) current = null
      item.resolve(res)
      done()
    }
    child.on('error', (e) => finish({ ok: false, ms: Date.now() - t0, error: e.message }))
    child.on('close', (code) => finish({ ok: code === 0 || code === null, ms: Date.now() - t0, error: code ? err.trim().slice(0, 200) : undefined }))
    child.stdin.on('error', () => {})
    child.stdin.end(item.text)
  })
}

async function pump() {
  if (busy) return
  while (queue.length) {
    const item = queue.shift()
    await run(item)
  }
  busy = false
}

/**
 * @param {string} text
 * @param {{queue?:boolean, urgent?:boolean, tag?:string}} [opts]
 * @returns {Promise<{ok:boolean, ms:number, skipped?:boolean, error?:string}>} resolves when this item has finished (or was dropped)
 */
function speak(text, opts = {}) {
  const t = clean(text)
  if (!opts.queue && !opts.urgent) stop() // plain speak() = interrupt everything and talk now
  if (!t) return Promise.resolve({ ok: true, ms: 0 })
  return new Promise((resolve) => {
    const item = { text: t, tag: opts.tag, resolve }
    if (opts.urgent && opts.queue) {
      queue.unshift(item)
      // an urgent item also cuts off the sentence in progress, so a ringing call is not announced late
      if (busy) killCurrent()
    } else queue.push(item)
    while (queue.length > MAX_QUEUE) queue.shift().resolve({ ok: true, ms: 0, skipped: true })
    void pump()
  })
}

module.exports = { speak, stop, clean, setOnStart, setVoice, getVoice, listVoices, resolveVoice, shortName, _setSpawn, _setVoices: (v) => (voices = v), SCRIPT, MAX_CHARS, MAX_QUEUE }
