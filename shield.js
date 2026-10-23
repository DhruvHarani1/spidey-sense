'use strict'
/**
 * Auto-Shield: the part of Spidey Sense that acts on its own, carefully.
 *
 * Rules it lives by:
 *  - It only does things that are SAFE and REVERSIBLE, and every action goes in a log with an UNDO button.
 *  - It never needs admin rights, never touches Windows or security settings (Defender, firewall, services), never kills anything by itself.
 *  - Modes: "smart" (default) acts alone on the safe things below, asks for everything else | "ask" never acts alone, offers a button | "off".
 *
 * What it does on its own (smart mode):
 *  1. Tames a runaway program: one that keeps using ~a third or more of the whole CPU for a while gets its priority lowered
 *     (Windows then lets everything else go first; the program keeps working). Undo puts the priority back.
 *  2. Blocks a suspicious new auto-start entry in YOUR user startup (Run key / Startup folder) when it runs from Temp/Downloads or uses a
 *     script trick (encoded PowerShell, mshta, …): the entry is disabled and backed up, so a malware's "come back after restart" fails. Undo restores it.
 * What it only offers (you click):
 *  3. Ending a memory/CPU hog ("take it down"). Never protected system programs.
 *  4. Blocking a program that runs from Temp/Downloads from the internet (a firewall rule; Windows asks for your permission).
 * What it only warns about: hosts-file changes, new listening ports, a filling disk, new drives (Guardian).
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const census = require('./census')

const LEARN_MS = 3 * 60 * 1000
const MEM_EVERY_MS = 10_000
const MAX_LOG = 100
const MAX_SEEN = 800
const MIN_ALERT_GAP_MS = 30_000

/** programs Spidey Sense never touches, whatever the mode */
const PROTECTED =
  /^(system|registry|smss|csrss|wininit|winlogon|services|lsass|lsaiso|svchost|dwm|explorer|fontdrvhost|spidey sense|electron|conhost|sihost|ctfmon|taskhostw|searchhost|startmenuexperiencehost|shellexperiencehost|runtimebroker|audiodg|msmpeng|nissrv|securityhealthservice|securityhealthsystray|wudfhost|wmiprvse|memory compression|secure system|typeperf|tasklist|netstat|reg|powershell|claude|code|cmd|windowsterminal|taskmgr|mmc|msedgewebview2)$/i

const WINDIR = (process.env.SystemRoot || 'C:\\Windows').toLowerCase()

// ------------------------------------------------------------ pure helpers (unit-tested)
/** where does this file live? 'temp' | 'downloads' | 'public' | 'recycle' | '' */
function locationOf(p) {
  const s = String(p || '').toLowerCase().replace(/\//g, '\\')
  if (!s) return ''
  if (/\\appdata\\local\\temp\\/.test(s) || /\\windows\\temp\\/.test(s) || /\\temp\\/.test(s) || /\\tmp\\/.test(s)) return 'temp'
  if (/\\downloads\\/.test(s)) return 'downloads'
  if (/\\users\\public\\/.test(s)) return 'public'
  if (/\\\$recycle\.bin\\/.test(s)) return 'recycle'
  return ''
}

const isProtected = (name, p) => PROTECTED.test(String(name || '').replace(/\.exe$/i, '')) || (!!p && String(p).toLowerCase().startsWith(WINDIR + '\\'))

const SCRIPT_TRICKS = [
  [/\b(wscript|cscript|mshta)(\.exe)?\b/i, 'starts through a script host (wscript/cscript/mshta)'],
  [/\bregsvr32(\.exe)?\b.*(scrobj|\/i:http)/i, 'abuses regsvr32 to run remote code'],
  [/\bcertutil(\.exe)?\b.*-urlcache/i, 'uses certutil to download a file'],
  [/\bbitsadmin(\.exe)?\b.*\/transfer/i, 'uses bitsadmin to download a file'],
  [/\bpowershell(\.exe)?\b.*(\s-e(nc|ncodedcommand)?\s|downloadstring|downloadfile|invoke-expression|\biex\b|frombase64string|-w(indowstyle)?\s+hidden)/i, 'runs hidden or encoded PowerShell'],
  [/\bcmd(\.exe)?\b.*\/c\b.*https?:\/\//i, 'a command prompt that fetches something from the web']
]

/**
 * Should a NEW auto-start entry be blocked? Only entries in the user's own startup can ever be blocked.
 * @param {{kind:'reg'|'folder', key?:string, name:string, value:string}} it
 * @returns {{verdict:'block'|'watch', reason:string}}
 */
function judgeStartup(it) {
  const value = String(it.value || '')
  const loc = locationOf(value.replace(/^"/, '')) || locationOf(extractExe(value))
  const inUserStartup = it.kind === 'folder' || /^HKCU\\/i.test(it.key || '')
  if (!inUserStartup) return { verdict: 'watch', reason: 'machine-wide entry' }
  if (loc) return { verdict: 'block', reason: `runs from a ${loc === 'downloads' ? 'Downloads' : loc === 'recycle' ? 'Recycle Bin' : loc === 'public' ? 'public' : 'Temp'} folder` }
  for (const [re, why] of SCRIPT_TRICKS) if (re.test(value)) return { verdict: 'block', reason: why }
  return { verdict: 'watch', reason: '' }
}

/** the first program path in a command line: "C:\a b\x.exe" -arg  |  C:\x.exe -arg */
function extractExe(cmd) {
  const s = String(cmd || '').trim()
  const q = /^"([^"]+)"/.exec(s)
  if (q) return q[1]
  const m = /^(.+?\.(?:exe|bat|cmd|vbs|js|ps1|lnk|scr))\b/i.exec(s)
  return m ? m[1] : s.split(/\s+/)[0] || ''
}

/**
 * Runaway detector: a process is a runaway after `needHits` consecutive samples at or above `share` of the WHOLE cpu.
 * feed() returns the processes that just crossed the line (once each).
 */
function createTamer({ share = 0.3, needHits = 3 } = {}) {
  const hits = new Map() // pid -> consecutive hits
  const tamed = new Set()
  return {
    /** @param {{pid:number,name:string,cpu:number}[]} list cpu = percent of ONE core */
    feed(list, cores = 1) {
      const out = []
      const alive = new Set()
      for (const p of list) {
        const s = p.cpu / Math.max(1, cores) / 100
        if (s >= share) {
          alive.add(p.pid)
          const n = (hits.get(p.pid) || 0) + 1
          hits.set(p.pid, n)
          if (n >= needHits && !tamed.has(p.pid)) {
            tamed.add(p.pid)
            out.push({ pid: p.pid, name: p.name, share: Math.min(1, s) })
          }
        }
      }
      for (const pid of [...hits.keys()]) if (!alive.has(pid)) hits.delete(pid)
      for (const pid of [...tamed]) if (!alive.has(pid) && !list.some((p) => p.pid === pid)) tamed.delete(pid)
      return out
    },
    reset() {
      hits.clear()
    }
  }
}

/** value of `name` in `reg query` output → {type, value} | null */
function parseRegValue(out, name) {
  const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`^\\s+${esc}\\s{2,}(REG_\\w+)\\s{2,}(.*?)\\s*$`, 'im').exec(String(out || ''))
  return m ? { type: m[1], value: m[2] } : null
}

const SAFE_ARG = /^[^"%&|<>^\r\n;`]+$/
/**
 * The firewall commands (run elevated, after Windows' own permission prompt) that block a program from the internet.
 * Only programs in Temp/Downloads/Public folders qualify. Returns null when the path is not acceptable.
 */
function buildFirewallCommands(exePath) {
  const p = String(exePath || '')
  if (!/^[A-Za-z]:\\/.test(p) || !/\.exe$/i.test(p) || !SAFE_ARG.test(p) || p.length > 240) return null
  if (!locationOf(p)) return null
  const base = path.win32.basename(p).replace(/[^\w.-]/g, '_').slice(0, 60)
  const rule = `Spidey Shield block ${base}`
  const add = (dir) => ['advfirewall', 'firewall', 'add', 'rule', `name=${rule}`, `dir=${dir}`, 'action=block', `program=${p}`, 'enable=yes']
  return { rule, commands: [add('out'), add('in')], remove: ['advfirewall', 'firewall', 'delete', 'rule', `name=${rule}`] }
}

/** PowerShell (elevated through Windows' permission prompt) running netsh with each argument list */
function elevatedNetshArgs(argLists) {
  const quote = (a) => `'${String(a).replace(/'/g, "''")}'`
  // netsh wants name="with spaces": quote only the value
  const arg = (a) => {
    const m = /^(\w+)=(.*)$/.exec(a)
    if (!m) return a
    return /\s/.test(m[2]) ? `${m[1]}="${m[2]}"` : a
  }
  const calls = argLists.map((args) => `& netsh ${args.map(arg).join(' ')}`).join('; ')
  const inner = Buffer.from(calls, 'utf16le').toString('base64')
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList ${quote('-NoProfile')},${quote('-EncodedCommand')},${quote(inner)}`]
}

// ------------------------------------------------------------ runtime
const defaultRun = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 8e6, ...opts }, (err, out) => resolve({ ok: !err, out: String(out || '') }))
  })

/**
 * @param {{dataDir:string, emit:(e:object)=>void, mode:()=>'smart'|'ask'|'off', onCulprit?:(c:object)=>void, selfNames?:string[],
 *          run?:Function, cen?:typeof census, now?:()=>number, cores?:number, osApi?:{setPriority:Function,getPriority:Function,constants:object},
 *          kill?:(pid:number)=>void, fsApi?:typeof fs, learnMs?:number, memEveryMs?:number, manual?:boolean}} o
 */
function createShield(o) {
  const now = o.now || Date.now
  const cen = o.cen || census
  const run = o.run || defaultRun
  const fsx = o.fsApi || fs
  const osx = o.osApi || os
  const kill = o.kill || ((pid) => process.kill(pid))
  const cores = o.cores || os.cpus().length || 1
  const learnMs = o.learnMs ?? LEARN_MS
  const file = path.join(o.dataDir, 'shield.json')
  const qdir = path.join(o.dataDir, 'quarantine')

  let st = { born: now(), log: [], seen: [] }
  try {
    st = { ...st, ...JSON.parse(fsx.readFileSync(file, 'utf8')) }
  } catch {
    /* first run */
  }
  const seen = new Set(st.seen)
  for (const n of o.selfNames || []) seen.add(n.toLowerCase())
  const alerted = new Set() // exe paths already reported
  const offers = new Map() // id -> {type,...} (this session only)
  const tamer = createTamer()
  let procs = [] // last tasklist: [{pid,name,mb}]
  let cpuList = null // last typeperf: [{pid,name,cpu}], with its time
  let cpuAt = 0
  let highSecs = 0
  let sampling = false
  let lastAlert = 0
  let counter = 0
  const timers = []
  let dirty = false

  const learning = () => now() - st.born < learnMs
  const mode = () => o.mode()
  const nextId = () => `${now().toString(36)}${(counter++).toString(36)}`
  const save = () => {
    if (!dirty) return
    dirty = false
    try {
      fsx.mkdirSync(o.dataDir, { recursive: true })
      st.seen = [...seen].slice(-MAX_SEEN)
      st.log = st.log.slice(0, MAX_LOG)
      fsx.writeFileSync(file, JSON.stringify(st))
    } catch {
      /* best effort */
    }
  }

  /** put an entry in the persistent log and tell the window */
  function record(kind, text, extra = {}) {
    const id = nextId()
    const entry = { id, at: now(), kind, text, ...(extra.undo ? { undo: extra.undo } : {}) }
    st.log.unshift(entry)
    dirty = true
    save()
    o.emit({ kind: 'shield', act: kind, text, at: entry.at, id, undo: !!extra.undo, offer: extra.offer || null })
    return entry
  }
  /** warn only (no action taken) */
  function warn(text, offer) {
    if (now() - lastAlert < MIN_ALERT_GAP_MS) return false
    lastAlert = now()
    o.emit({ kind: 'shield', act: 'warn', text, at: now(), id: '', undo: false, offer: offer || null })
    return true
  }
  function offer(spec, label) {
    const id = nextId()
    offers.set(id, spec)
    if (offers.size > 40) offers.delete(offers.keys().next().value)
    return { id, label }
  }

  // ---------------------------------------------------------- 1) tame a runaway program
  async function tame(p) {
    if (isProtected(p.name)) return false
    try {
      const was = osx.getPriority(p.pid)
      const below = osx.constants.priority.PRIORITY_BELOW_NORMAL
      if (was >= below) return false // already low
      osx.setPriority(p.pid, below)
      record('tame', `${p.name} kept using ${Math.round(p.share * 100)}% of the CPU, so I lowered its priority. It still works; everything else goes first.`, { undo: { type: 'priority', pid: p.pid, name: p.name, was } })
      return true
    } catch {
      return false // not ours to change (another user, already gone)
    }
  }

  async function onRunaway(p) {
    if (mode() === 'off') return
    if (mode() === 'smart') {
      if (!(await tame(p))) warn(`${p.name} is using ${Math.round(p.share * 100)}% of the CPU.`)
    } else warn(`${p.name} keeps using ${Math.round(p.share * 100)}% of the CPU.`, offer({ type: 'tame', pid: p.pid, name: p.name, share: p.share }, 'LOWER ITS PRIORITY'))
  }

  async function sampleCpu() {
    if (sampling) return
    sampling = true
    try {
      const list = await cen.cpu()
      if (list) {
        cpuList = list
        cpuAt = now()
        for (const r of tamer.feed(list.filter((p) => !isProtected(p.name)), cores)) await onRunaway(r)
        publishCulprit()
      }
    } finally {
      sampling = false
    }
  }

  /** called every second with the total CPU %: when the PC is busy for a while, find out who */
  function hint(cpuPct) {
    if (cpuPct >= 85) highSecs++
    else {
      highSecs = 0
      if (cpuPct < 60) tamer.reset()
    }
    if (highSecs >= 8 && !sampling && now() - cpuAt >= 10_000) void sampleCpu()
  }

  // ---------------------------------------------------------- the memory/culprit watch + programs running from Temp
  function publishCulprit() {
    if (!o.onCulprit) return
    const withCpu = cpuList && now() - cpuAt < 60_000 ? cpuList : []
    const merged = procs.map((p) => ({ ...p, cpu: (withCpu.find((c) => c.pid === p.pid) || {}).cpu || 0 }))
    const tc = cen.topCulprits(merged.length ? merged : withCpu, cores, (p) => isProtected(p.name))
    o.onCulprit({ mem: tc.mem, cpu: withCpu.length ? tc.cpu : null, at: now() })
  }

  async function memTick() {
    const list = await cen.memory()
    if (!list) return
    procs = list
    // any program name we have never seen before: where does it run from?
    const fresh = []
    for (const p of list) {
      const k = p.name.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        dirty = true
        fresh.push(p)
      }
    }
    if (fresh.length && !learning() && mode() !== 'off') {
      const where = await cen.paths(fresh.slice(0, 12).map((p) => p.pid))
      for (const p of fresh) {
        const exe = where.get(p.pid)
        const loc = locationOf(exe)
        if (!exe || !loc || alerted.has(exe.toLowerCase()) || isProtected(p.name, exe)) continue
        alerted.add(exe.toLowerCase())
        const fw = buildFirewallCommands(exe)
        warn(`${p.name} just started from your ${loc === 'downloads' ? 'Downloads' : loc === 'public' ? 'public' : 'Temp'} folder. Installers do this, but so does malware.`, fw ? offer({ type: 'block-net', exe, name: p.name }, 'BLOCK ITS INTERNET') : null)
      }
    }
    save()
    publishCulprit()
  }

  // ---------------------------------------------------------- 2) block a suspicious new auto-start entry
  /**
   * Guardian found a new auto-start entry. Returns true when Shield reported it itself (so Guardian stays quiet about it).
   * @param {string} item "key|name|value" for registry entries, "folder|file|dir" for the Startup folder
   */
  function onStartup(item) {
    if (mode() === 'off') return false
    const [key, name, value] = String(item).split('|')
    const it = key === 'folder' ? { kind: 'folder', name, value: path.join(value || '', name || '') } : { kind: 'reg', key, name, value: value || '' }
    if (/^spideysense$/i.test(name)) return false
    const j = judgeStartup(it)
    if (j.verdict !== 'block') return false
    // a user-level entry only; machine-wide entries stay Guardian's warning
    if (mode() === 'smart') {
      void quarantine(it, j.reason)
      return true
    }
    warn(`new auto-start entry "${name}" ${j.reason}.`, offer({ type: 'quarantine', it, reason: j.reason }, 'BLOCK IT'))
    return true
  }

  async function quarantine(it, reason) {
    try {
      if (it.kind === 'reg') {
        const q = await run('reg.exe', ['query', it.key, '/v', it.name])
        const cur = parseRegValue(q.out, it.name)
        if (!cur) return false
        const del = await run('reg.exe', ['delete', it.key, '/v', it.name, '/f'])
        const after = await run('reg.exe', ['query', it.key, '/v', it.name])
        if (!del.ok || parseRegValue(after.out, it.name)) {
          warn(`new auto-start entry "${it.name}" ${reason}, but I could not block it.`)
          return false
        }
        record('block', `Blocked a new auto-start entry "${it.name}": it ${reason}. It cannot start with Windows now.`, { undo: { type: 'reg', key: it.key, name: it.name, regType: cur.type, value: cur.value } })
        return true
      }
      // Startup folder: move the file away, keep it
      fsx.mkdirSync(qdir, { recursive: true })
      const dest = path.join(qdir, `${now()}-${path.basename(it.value)}`)
      fsx.renameSync(it.value, dest)
      record('block', `Blocked a new Startup-folder item "${it.name}": it ${reason}. I moved it to a quarantine folder.`, { undo: { type: 'folder', from: it.value, to: dest, name: it.name } })
      return true
    } catch {
      warn(`new auto-start entry "${it.name}" ${reason}, but I could not block it.`)
      return false
    }
  }

  // ---------------------------------------------------------- buttons (offers) and undo
  async function apply(id) {
    const spec = offers.get(String(id))
    if (!spec) return { ok: false, error: 'that offer has expired' }
    offers.delete(String(id))
    if (spec.type === 'tame') return { ok: await tame({ pid: spec.pid, name: spec.name, share: spec.share }), text: `Lowered the priority of ${spec.name}.` }
    if (spec.type === 'quarantine') return { ok: await quarantine(spec.it, spec.reason), text: `Blocked "${spec.it.name}".` }
    if (spec.type === 'block-net') return blockNet(spec.exe)
    return { ok: false, error: 'unknown offer' }
  }

  /** firewall rule for a program from a risky folder; Windows shows its own permission prompt */
  async function blockNet(exe) {
    const fw = buildFirewallCommands(exe)
    if (!fw) return { ok: false, error: 'that program cannot be blocked this way' }
    const r = await run('powershell.exe', elevatedNetshArgs(fw.commands), { timeout: 120000 })
    if (!r.ok) return { ok: false, error: 'Windows did not allow it (or you said no)' }
    record('net', `Blocked ${path.win32.basename(exe)} from the internet (firewall rule "${fw.rule}").`, { undo: { type: 'fwrule', rule: fw.rule, exe } })
    return { ok: true, text: `Blocked ${path.win32.basename(exe)} from the internet.` }
  }

  async function undo(id) {
    const e = st.log.find((x) => x.id === String(id))
    if (!e || !e.undo) return { ok: false, error: 'nothing to undo' }
    const u = e.undo
    try {
      if (u.type === 'priority') {
        try {
          osx.setPriority(u.pid, u.was)
        } catch {
          /* it has already exited: nothing to restore */
        }
      } else if (u.type === 'reg') {
        const r = await run('reg.exe', ['add', u.key, '/v', u.name, '/t', u.regType, '/d', u.value, '/f'])
        if (!r.ok) return { ok: false, error: 'could not restore the entry' }
      } else if (u.type === 'folder') {
        fsx.renameSync(u.to, u.from)
      } else if (u.type === 'fwrule') {
        const r = await run('powershell.exe', elevatedNetshArgs([['advfirewall', 'firewall', 'delete', 'rule', `name=${u.rule}`]]), { timeout: 120000 })
        if (!r.ok) return { ok: false, error: 'Windows did not allow it (or you said no)' }
      } else return { ok: false, error: 'unknown action' }
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err).slice(0, 120) }
    }
    delete e.undo
    e.text += ' (undone)'
    dirty = true
    save()
    return { ok: true, text: 'Undone.' }
  }

  /** "take it down": end one process. Only something seen in the last scan, never a protected one. */
  function takeDown(pid) {
    const p = procs.find((x) => x.pid === pid) || (cpuList || []).find((x) => x.pid === pid)
    if (!p) return { ok: false, error: 'that program is not running any more' }
    if (isProtected(p.name)) return { ok: false, error: `${p.name} is protected — I won't touch it` }
    try {
      kill(p.pid)
    } catch (err) {
      return { ok: false, error: `could not end ${p.name}: ${String((err && err.message) || err).slice(0, 80)}` }
    }
    record('takedown', `Ended ${p.name} (${p.mb ? Math.round(p.mb) + ' MB' : 'was running'}) at your request.`)
    return { ok: true, name: p.name }
  }

  return {
    start() {
      if (o.manual) return
      timers.push(setTimeout(() => void memTick(), 2_000), setInterval(() => void memTick(), o.memEveryMs || MEM_EVERY_MS))
    },
    stop() {
      timers.forEach((t) => (clearTimeout(t), clearInterval(t)))
      save()
    },
    hint,
    onStartup,
    apply,
    undo,
    takeDown,
    blockNet,
    log: () => st.log.slice(0, MAX_LOG),
    /** biggest process by memory, for the radar caption */
    hog: () => {
      const g = cen.topCulprits(procs, cores, (p) => isProtected(p.name)).mem
      return g ? { name: g.name, mb: g.mb } : null
    },
    // test hooks
    _memTick: memTick,
    _sampleCpu: sampleCpu,
    _offers: offers
  }
}

module.exports = { createShield, createTamer, judgeStartup, locationOf, isProtected, extractExe, parseRegValue, buildFirewallCommands, elevatedNetshArgs, PROTECTED }
