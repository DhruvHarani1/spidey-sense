'use strict'
/**
 * Guardian: the "spider-sense" for real danger. Watches for things that should make you look twice:
 *  - a program reaching the internet for the very first time (after a learning period)
 *  - a new auto-start entry (registry Run keys / Startup folder)
 *  - the hosts file changing
 *  - a new drive (USB stick, card, phone) appearing
 * No admin rights, no network calls, no PowerShell: only netstat, tasklist and reg.exe.
 */
const { execFile } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const LEARN_MS = 3 * 60 * 1000
const NET_EVERY_MS = 20_000
const FILE_EVERY_MS = 30_000
const DRIVE_EVERY_MS = 4_000
const MIN_GAP_MS = 20_000
const MAX_NAMES = 600
const RUN_KEYS = [
  String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
  String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce`,
  String.raw`HKLM\Software\Microsoft\Windows\CurrentVersion\Run`,
  String.raw`HKLM\Software\Microsoft\Windows\CurrentVersion\RunOnce`
]

// ------------------------------------------------------------ pure parsers (unit-tested)
function isPrivateIp(ip) {
  if (!ip) return true
  if (ip.includes(':')) return /^(::1|fe80|fc|fd)/i.test(ip) || ip === '::'
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)
}

/** netstat -ano -p tcp → [{pid, remote}] for established connections to public addresses */
function parseNetstat(out) {
  const res = []
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s*TCP\s+\S+\s+(\S+):(\d+)\s+ESTABLISHED\s+(\d+)\s*$/i)
    if (!m) continue
    const remote = m[1].replace(/^\[|\]$/g, '')
    if (isPrivateIp(remote)) continue
    res.push({ pid: Number(m[3]), remote, port: Number(m[2]) })
  }
  return res
}

/** tasklist /fo csv /nh → Map(pid → name without .exe) */
function parseTasklist(out) {
  const map = new Map()
  for (const line of out.split(/\r?\n/)) {
    const c = line.match(/"([^"]*)"/g)
    if (!c || c.length < 2) continue
    const pid = parseInt(c[1].slice(1, -1), 10)
    if (Number.isFinite(pid)) map.set(pid, c[0].slice(1, -1).replace(/\.exe$/i, ''))
  }
  return map
}

/** reg query output → ["HKCU\\...\\Run|Name|value", ...] */
function parseRegRun(key, out) {
  const res = []
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s{2,}(.+?)\s{2,}REG_\w+\s{2,}(.*)$/)
    if (m) res.push(`${key}|${m[1].trim()}|${m[2].trim()}`)
  }
  return res
}

const newItems = (current, known) => current.filter((x) => !known.has(x))

// ------------------------------------------------------------ runtime
function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 16e6 }, (err, out) => resolve(err ? '' : out))
  })
}

function start({ dataDir, emit, selfNames = [] }) {
  const file = path.join(dataDir, 'guardian.json')
  let st = { born: Date.now(), names: [], startup: [], hosts: '', drives: [] }
  let fresh = true
  try {
    st = { ...st, ...JSON.parse(fs.readFileSync(file, 'utf8')) }
    fresh = false
  } catch {
    /* first run */
  }
  const names = new Set(st.names)
  for (const n of selfNames) names.add(n.toLowerCase())
  let startup = new Set(st.startup)
  let hosts = st.hosts
  let drives = new Set(st.drives)
  let lastEmit = 0
  let dirty = false
  const timers = []

  const learning = () => Date.now() - st.born < LEARN_MS
  const save = () => {
    if (!dirty) return
    dirty = false
    try {
      fs.mkdirSync(dataDir, { recursive: true })
      st.names = [...names].slice(-MAX_NAMES)
      st.startup = [...startup]
      st.hosts = hosts
      st.drives = [...drives]
      fs.writeFileSync(file, JSON.stringify(st))
    } catch {
      /* best effort */
    }
  }
  const say = (kind, text) => {
    const now = Date.now()
    if (now - lastEmit < MIN_GAP_MS) {
      setTimeout(() => say(kind, text), MIN_GAP_MS - (now - lastEmit) + 50)
      return
    }
    lastEmit = now
    emit({ kind, text, at: now })
  }

  async function checkNet() {
    const [net, tl] = await Promise.all([run('netstat', ['-ano', '-p', 'tcp']), run('tasklist', ['/fo', 'csv', '/nh'])])
    const pids = parseNetstat(net)
    const byPid = parseTasklist(tl)
    for (const { pid, remote } of pids) {
      const name = byPid.get(pid)
      if (!name || pid === 0 || pid === 4) continue
      const key = name.toLowerCase()
      if (names.has(key)) continue
      names.add(key)
      dirty = true
      if (!learning() && !fresh) say('net', `${name} just reached the internet for the first time (${remote})`)
    }
    fresh = false
    save()
  }

  async function currentStartup() {
    const items = []
    for (const key of RUN_KEYS) items.push(...parseRegRun(key, await run('reg.exe', ['query', key])))
    for (const dir of [
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
      path.join(process.env.ProgramData || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'StartUp')
    ]) {
      try {
        for (const f of fs.readdirSync(dir)) if (f.toLowerCase() !== 'desktop.ini') items.push(`folder|${f}|${dir}`)
      } catch {
        /* missing folder */
      }
    }
    return items
  }

  async function checkFiles() {
    const items = await currentStartup()
    if (startup.size === 0 && st.startup.length === 0) {
      startup = new Set(items)
      dirty = true
    } else {
      for (const it of newItems(items, startup)) {
        startup.add(it)
        dirty = true
        const [, name] = it.split('|')
        if (!/^spideysense$/i.test(name)) say('startup', `new auto-start entry added: ${name}`)
      }
    }
    try {
      const h = crypto.createHash('sha1').update(fs.readFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts'))).digest('hex')
      if (hosts && h !== hosts) say('hosts', 'the hosts file was modified (it can silently redirect websites)')
      if (h !== hosts) {
        hosts = h
        dirty = true
      }
    } catch {
      /* unreadable */
    }
    save()
  }

  function checkDrives() {
    const now = new Set()
    for (let c = 67; c <= 90; c++) {
      const l = String.fromCharCode(c)
      try {
        fs.statSync(`${l}:\\`)
        now.add(l)
      } catch {
        /* not present */
      }
    }
    if (drives.size === 0 && st.drives.length === 0) {
      drives = now
      dirty = true
      return
    }
    for (const l of now) {
      if (!drives.has(l)) say('drive', `new drive ${l}: connected — check what you plug in`)
    }
    if (now.size !== drives.size || [...now].some((l) => !drives.has(l))) {
      drives = now
      dirty = true
      save()
    }
  }

  // stagger so startup stays light
  timers.push(setTimeout(checkNet, 8_000), setInterval(checkNet, NET_EVERY_MS))
  timers.push(setTimeout(checkFiles, 12_000), setInterval(checkFiles, FILE_EVERY_MS))
  timers.push(setTimeout(checkDrives, 1_000), setInterval(checkDrives, DRIVE_EVERY_MS))
  return () => timers.forEach((t) => (clearTimeout(t), clearInterval(t)))
}

module.exports = { start, parseNetstat, parseTasklist, parseRegRun, isPrivateIp, newItems }
