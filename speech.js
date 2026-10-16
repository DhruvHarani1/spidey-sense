'use strict'
/**
 * Karen's voice. Chromium inside Electron exposes no speech voices, so the browser speech API stays silent;
 * instead we use the speech engine Windows already ships (System.Speech / SAPI voices such as Zira and David).
 * The text goes in through stdin, never into the command line, so nothing a reply contains can be run as code.
 */
const { spawn } = require('node:child_process')

const SCRIPT = [
  'Add-Type -AssemblyName System.Speech',
  '$t = [Console]::In.ReadToEnd()',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
  "$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en*' }",
  "$p = $v | Where-Object { $_.VoiceInfo.Name -match 'Zira|Aria|Jenny' } | Select-Object -First 1",
  'if (-not $p) { $p = $v | Select-Object -First 1 }',
  'if ($p) { $s.SelectVoice($p.VoiceInfo.Name) }',
  '$s.Rate = 1',
  '$s.Volume = 90',
  '$s.Speak($t)'
].join('; ')

const MAX_CHARS = 400

/** plain sentence case text, no control characters, bounded length */
function clean(text) {
  // eslint-disable-next-line no-control-regex
  const t = String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  return lower.length > MAX_CHARS ? lower.slice(0, MAX_CHARS) : lower
}

let current = null

function stop() {
  if (current && current.exitCode === null) {
    try {
      current.kill()
    } catch {
      /* already gone */
    }
  }
  current = null
}

/** @returns {Promise<{ok:boolean, ms:number, error?:string}>} resolves when the speech has finished (or was cut off) */
function speak(text) {
  stop()
  const t = clean(text)
  if (!t) return Promise.resolve({ ok: true, ms: 0 })
  return new Promise((resolve) => {
    const t0 = Date.now()
    let child
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] })
    } catch (e) {
      resolve({ ok: false, ms: 0, error: e.message })
      return
    }
    current = child
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => resolve({ ok: false, ms: Date.now() - t0, error: e.message }))
    child.on('close', (code) => resolve({ ok: code === 0 || code === null, ms: Date.now() - t0, error: code ? err.trim().slice(0, 200) : undefined }))
    child.stdin.on('error', () => {})
    child.stdin.end(t)
  })
}

module.exports = { speak, stop, clean, SCRIPT, MAX_CHARS }
