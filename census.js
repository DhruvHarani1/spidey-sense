'use strict'
/**
 * Process census, in three cheap read-only pieces (a full CIM query costs seconds of CPU on a busy PC, so it is never used):
 *   tasklist      who is running and how much memory each uses     (~0.2 s, used all the time)
 *   typeperf      who is using CPU right now                       (~3 s, only when the CPU is busy)
 *   Get-Process   the file path of a few NEW programs              (~1 s, only when something new starts)
 * Nothing here changes anything or sends anything anywhere.
 */
const { execFile } = require('node:child_process')

const SKIP = /^(system idle process|system|registry|memory compression|secure system|idle|_total)$/i

// ------------------------------------------------------------ tasklist
/** `tasklist /fo csv /nh` → [{pid,name,mb}] (working set; names without .exe) */
function parseTasklist(out) {
  const res = []
  for (const line of String(out || '').split(/\r?\n/)) {
    const c = line.match(/"([^"]*)"/g)
    if (!c || c.length < 5) continue
    const pid = parseInt(c[1].slice(1, -1), 10)
    const name = c[0].slice(1, -1).replace(/\.exe$/i, '')
    const kb = parseInt(c[4].replace(/[^0-9]/g, ''), 10) || 0
    if (!Number.isInteger(pid) || pid <= 4 || !name || SKIP.test(name)) continue
    res.push({ pid, name, mb: Math.round(kb / 1024) })
  }
  return res
}

// ------------------------------------------------------------ typeperf (CPU)
/** one CSV line → fields (handles the quoted, comma separated PDH-CSV format) */
function csvFields(line) {
  const out = []
  const re = /"((?:[^"]|"")*)"|([^,]+)/g
  let m
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2])
  return out
}

/**
 * `typeperf "\Process(*)\% Processor Time" "\Process(*)\ID Process" -sc 2` → [{pid,name,cpu}] from the LAST sample.
 * cpu is the percent of ONE core (it can exceed 100 on a multi-core PC). English Windows only (counter names are localised).
 */
function parseTypeperf(out) {
  const lines = String(out || '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('"'))
  if (lines.length < 3) return []
  const head = csvFields(lines[0])
  const last = csvFields(lines[lines.length - 1])
  const inst = new Map() // instance -> {cpu, pid}
  head.forEach((h, i) => {
    const m = /\\Process\((.+)\)\\(% Processor Time|ID Process)$/.exec(h)
    if (!m) return
    const e = inst.get(m[1]) || {}
    const v = Number(last[i])
    if (m[2] === 'ID Process') e.pid = Number.isFinite(v) ? v : undefined
    else e.cpu = Number.isFinite(v) ? v : 0
    inst.set(m[1], e)
  })
  const res = []
  for (const [instance, e] of inst) {
    const name = instance.replace(/#\d+$/, '')
    if (!Number.isInteger(e.pid) || e.pid <= 4 || SKIP.test(name)) continue
    res.push({ pid: e.pid, name, cpu: Math.max(0, e.cpu || 0) })
  }
  return res
}

// ------------------------------------------------------------ Get-Process (paths of a few pids)
/** `pid|path` lines → Map(pid → path) */
function parsePaths(out) {
  const map = new Map()
  for (const line of String(out || '').split(/\r?\n/)) {
    const i = line.indexOf('|')
    if (i < 1) continue
    const pid = parseInt(line.slice(0, i), 10)
    const p = line.slice(i + 1).trim()
    if (Number.isInteger(pid) && p) map.set(pid, p)
  }
  return map
}

// ------------------------------------------------------------ pure helpers
/** same-name processes added up ("chrome" is 40 processes), heaviest single process remembered */
function groupByName(procs) {
  const g = new Map()
  for (const p of procs) {
    const key = p.name.toLowerCase()
    const e = g.get(key) || { name: p.name, count: 0, mb: 0, cpu: 0, top: p }
    e.count++
    e.mb += p.mb || 0
    e.cpu += p.cpu || 0
    if ((p.mb || 0) > (e.top.mb || 0) || ((p.mb || 0) === (e.top.mb || 0) && (p.cpu || 0) > (e.top.cpu || 0))) e.top = p
    g.set(key, e)
  }
  return [...g.values()]
}

/**
 * The two names worth showing: who uses the most memory, who uses the most CPU.
 * `pid` is the single heaviest process of that name: what "take it down" would end (one Chrome tab, not every Chrome window).
 * @param {{pid:number,name:string,mb?:number,cpu?:number}[]} procs
 * @returns {{mem:null|{name:string,mb:number,count:number,pid:number},cpu:null|{name:string,share:number,count:number,pid:number}}}
 */
function topCulprits(procs, cores = 1, skip = () => false) {
  const groups = groupByName(procs.filter((p) => !skip(p)))
  const byMem = groups.slice().sort((a, b) => b.mb - a.mb)[0]
  const byCpu = groups.slice().sort((a, b) => b.cpu - a.cpu)[0]
  const n = Math.max(1, cores)
  return {
    mem: byMem && byMem.mb > 0 ? { name: byMem.name, mb: byMem.mb, count: byMem.count, pid: byMem.top.pid } : null,
    cpu: byCpu && byCpu.cpu / n >= 5 ? { name: byCpu.name, share: Math.min(1, byCpu.cpu / n / 100), count: byCpu.count, pid: byCpu.top.pid } : null
  }
}

// ------------------------------------------------------------ runtime
const run = (cmd, args, opts = {}, exec = execFile) =>
  new Promise((resolve) => {
    try {
      exec(cmd, args, { windowsHide: true, maxBuffer: 16e6, ...opts }, (err, out) => resolve(err && !out ? null : String(out)))
    } catch {
      resolve(null)
    }
  })

/** @returns {Promise<{pid:number,name:string,mb:number}[]|null>} */
async function memory(exec) {
  const out = await run('tasklist', ['/fo', 'csv', '/nh'], { timeout: 15000 }, exec)
  return out === null ? null : parseTasklist(out)
}
/** @returns {Promise<{pid:number,name:string,cpu:number}[]|null>} null = could not measure (non-English Windows, timeout…) */
async function cpu(exec) {
  const out = await run('typeperf', ['\\Process(*)\\% Processor Time', '\\Process(*)\\ID Process', '-sc', '2'], { timeout: 25000 }, exec)
  if (out === null) return null
  const list = parseTypeperf(out)
  return list.length ? list : null
}
/** @returns {Promise<Map<number,string>>} */
async function paths(pids, exec) {
  const ids = [...new Set(pids)].filter((n) => Number.isInteger(n) && n > 4).slice(0, 40)
  if (!ids.length) return new Map()
  // pids are integers we validated above, so building the command from them is safe
  const script = `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id)|$($_.Path)" }`
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 20000 }, exec)
  return parsePaths(out)
}

module.exports = { parseTasklist, parseTypeperf, parsePaths, csvFields, groupByName, topCulprits, memory, cpu, paths }
