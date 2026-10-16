#!/usr/bin/env node
'use strict'
/*
 * spidey — the command-line manual for Spidey Sense.
 *   spidey help | commands | features | feature <id> | hotkeys | tray | privacy | data | troubleshoot | search <word> | docs | version
 * Works from a checkout (node bin/spidey.js …) and from the installed app (spidey.cmd).
 */
const path = require('node:path')
const fs = require('node:fs')
const D = require('../help-data')

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR)
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s)
const bold = (s) => c('1', s)
const dim = (s) => c('2', s)
const red = (s) => c('91', s)
const yellow = (s) => c('93', s)
const blue = (s) => c('94', s)
const green = (s) => c('92', s)
const cyan = (s) => c('96', s)

const WIDTH = Math.max(60, Math.min(100, process.stdout.columns || 90))
const out = (s = '') => process.stdout.write(s + '\n')
// eslint-disable-next-line no-control-regex
const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')

function wrap(text, indent = 0, width = WIDTH) {
  const pad = ' '.repeat(indent)
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    if (visible(line + ' ' + w).length > width - indent && line) {
      lines.push(pad + line)
      line = w
    } else line = line ? `${line} ${w}` : w
  }
  if (line) lines.push(pad + line)
  return lines.join('\n')
}

function banner() {
  out()
  out(red('  ╔═══════════════════════════════════════════════╗'))
  out(red('  ║') + bold(yellow(' SPIDEY SENSE')) + dim(' — command-line manual'.padEnd(47 - 13)) + red('║'))
  out(red('  ╚═══════════════════════════════════════════════╝'))
  out(dim('  ' + D.tagline))
  out()
}

const h = (s) => out('\n' + bold(blue('▌ ' + s.toUpperCase())) + '\n')

function version() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version
  } catch {
    return 'unknown'
  }
}

// ------------------------------------------------------------ topics
function help() {
  banner()
  out(wrap(D.intro, 2))
  h('Start here')
  D.quickstart.forEach((q, i) => out(wrap(`${green(String(i + 1) + '.')} ${q}`, 2)))
  h('Topics  (spidey <topic>)')
  const rows = [
    ['commands', 'Everything you can type to Karen, with examples'],
    ['features', 'All features in short; "spidey feature <id>" for the full story'],
    ['hotkeys', 'Global keyboard shortcuts'],
    ['tray', 'Every item in the tray (right-click) menu'],
    ['privacy', 'What it reads, what it stores, what touches the network'],
    ['data', 'Where your files live'],
    ['troubleshoot', 'Common problems and fixes'],
    ['search <word>', 'Find any word across the whole manual'],
    ['docs', 'Open the illustrated web manual in your browser'],
    ['version', 'Print the version']
  ]
  for (const [k, v] of rows) out(`  ${yellow(k.padEnd(16))} ${v}`)
  out('\n  ' + dim(D.repo) + '\n')
}

function commands(only) {
  banner()
  out(dim('  Press Ctrl+Alt+K anywhere, type, press Enter. Words in quotes are examples; many variations work.\n'))
  for (const g of D.karen) {
    if (only && !g.group.toLowerCase().includes(only.toLowerCase())) continue
    h(g.group)
    for (const it of g.items) {
      out('  ' + yellow(it.say))
      out(wrap(it.does, 6))
      if (it.aka && it.aka.length) out(dim(wrap('also: ' + it.aka.join(' · '), 6)))
      if (it.note) out(red(wrap(it.note, 6)))
    }
  }
  h('About Karen')
  D.karenNotes.forEach((n) => out(wrap('• ' + n, 2) + '\n'))
}

function features() {
  banner()
  for (const f of D.features) out(`  ${f.icon}  ${yellow(f.id.padEnd(10))} ${bold(f.name)}\n${' '.repeat(18)}${dim(f.summary)}`)
  out('\n  ' + dim('Details: spidey feature <id>   e.g. spidey feature guardian') + '\n')
}

function feature(id) {
  const f = D.features.find((x) => x.id === String(id || '').toLowerCase() || x.name.toLowerCase().includes(String(id || '').toLowerCase()))
  if (!f) {
    out(red(`No feature "${id}".`) + ' Try: ' + D.features.map((x) => x.id).join(', '))
    process.exitCode = 1
    return
  }
  banner()
  out(`  ${f.icon}  ${bold(yellow(f.name))}`)
  out(dim('  ' + f.summary) + '\n')
  f.how.forEach((s) => out(wrap('• ' + s, 2) + '\n'))
  if (f.reads) {
    out(bold('  What it reads:'))
    out(wrap(f.reads, 4) + '\n')
  }
}

function hotkeys() {
  banner()
  for (const k of D.hotkeys) out(`  ${yellow(k.keys.padEnd(14))} ${k.does}`)
  out()
}

function tray() {
  banner()
  out(dim('  Right-click the badge, the open panel, or the red spider by the clock (click ^ first if Windows hid it):\n'))
  D.tray.forEach((t) => out('  ▸ ' + t))
  out()
}

function privacy() {
  banner()
  D.privacy.forEach((p) => out(wrap('• ' + p, 2) + '\n'))
}

function data() {
  banner()
  for (const d of D.data) {
    out('  ' + yellow(d.what))
    out('    ' + d.where)
    out(dim('    ' + d.note))
  }
  out()
}

function troubleshoot() {
  banner()
  for (const t of D.troubleshooting) {
    out('  ' + red('Q: ') + bold(t.q))
    out(wrap(green('A: ') + t.a, 2) + '\n')
  }
}

function search(term) {
  if (!term) {
    out(red('Usage: spidey search <word>'))
    process.exitCode = 1
    return
  }
  const q = term.toLowerCase()
  const hits = []
  for (const g of D.karen) for (const it of g.items) if ([it.say, it.does, ...(it.aka || [])].join(' ').toLowerCase().includes(q)) hits.push(['command', it.say, it.does])
  for (const f of D.features) if ([f.name, f.summary, ...f.how, f.reads || ''].join(' ').toLowerCase().includes(q)) hits.push(['feature', f.name, f.summary])
  for (const k of D.hotkeys) if ((k.keys + ' ' + k.does).toLowerCase().includes(q)) hits.push(['hotkey', k.keys, k.does])
  for (const t of D.tray) if (t.toLowerCase().includes(q)) hits.push(['tray', t, ''])
  for (const t of D.troubleshooting) if ((t.q + ' ' + t.a).toLowerCase().includes(q)) hits.push(['help', t.q, t.a])
  for (const p of D.privacy) if (p.toLowerCase().includes(q)) hits.push(['privacy', p.slice(0, 70) + '…', ''])
  banner()
  if (!hits.length) {
    out(`  No matches for "${term}".`)
    return
  }
  out(dim(`  ${hits.length} match${hits.length === 1 ? '' : 'es'} for "${term}":\n`))
  for (const [kind, title, body] of hits) {
    out(`  ${cyan(kind.padEnd(8))} ${yellow(title)}`)
    if (body) out(wrap(body, 11))
  }
  out()
}

function docs() {
  const candidates = [process.env.SPIDEY_RES && path.join(process.env.SPIDEY_RES, 'help.html'), path.join(__dirname, '..', 'docs', 'index.html'), path.join(__dirname, '..', 'renderer', 'help.html')]
  const file = candidates.filter(Boolean).find((f) => fs.existsSync(f))
  if (!file || file.includes('.asar')) {
    out('Open the manual online: ' + D.repo + '  (or tray → "Help & all commands")')
    return
  }
  require('node:child_process').spawn('cmd', ['/c', 'start', '""', file], { detached: true, stdio: 'ignore' }).unref()
  out('Opening ' + file)
}

// ------------------------------------------------------------ dispatch
const [cmd = 'help', ...rest] = process.argv.slice(2)
const table = {
  help,
  '--help': help,
  '-h': help,
  '/?': help,
  commands: () => commands(rest.join(' ')),
  karen: () => commands(rest.join(' ')),
  features,
  feature: () => feature(rest[0]),
  hotkeys,
  keys: hotkeys,
  tray,
  privacy,
  data,
  troubleshoot,
  troubleshooting: troubleshoot,
  search: () => search(rest.join(' ')),
  docs,
  version: () => out(`Spidey Sense ${version()}`),
  '--version': () => out(`Spidey Sense ${version()}`),
  '-v': () => out(`Spidey Sense ${version()}`)
}
const fn = table[cmd.toLowerCase()]
if (fn) fn()
else if (D.features.some((f) => f.id === cmd.toLowerCase())) feature(cmd)
else {
  out(red(`Unknown topic "${cmd}".`) + ' Run ' + yellow('spidey help') + ' for the list.')
  process.exitCode = 1
}
