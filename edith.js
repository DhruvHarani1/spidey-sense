'use strict'
/**
 * E.D.I.T.H.: a quick, read-only security "threat assessment" of this PC.
 * Uses only reg.exe, sc.exe, netstat and tasklist (no admin rights, no PowerShell, no network calls).
 * It reports facts and a simple score; it never changes any setting.
 */
const { execFile } = require('node:child_process')

const FW_BASE = String.raw`HKLM\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy`
const RISKY_PORTS = { 21: 'FTP', 23: 'Telnet', 3389: 'Remote Desktop', 5900: 'VNC', 5985: 'WinRM', 5986: 'WinRM (TLS)' }
const USUAL_PORTS = new Set([135, 139, 445, 5040, 7680])

// ------------------------------------------------------------ pure helpers (unit-tested)
/** value of a REG_DWORD from `reg query` output, or null */
function parseRegDword(out, name) {
  const m = new RegExp(String.raw`^\s*${name}\s+REG_DWORD\s+(0x[0-9a-f]+|\d+)\s*$`, 'im').exec(out || '')
  return m ? Number(m[1]) : null
}

/** `sc query X` → 'running' | 'stopped' | null (missing) */
function parseServiceState(out) {
  const m = /STATE\s*:\s*\d+\s+(\w+)/i.exec(out || '')
  return m ? m[1].toLowerCase() : null
}

/** netstat -ano -p tcp → listening sockets reachable from the network (not loopback-only) */
function parseListening(out) {
  const seen = new Map()
  for (const line of String(out || '').split(/\r?\n/)) {
    const m = /^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i.exec(line)
    if (!m) continue
    const addr = m[1].replace(/^\[|\]$/g, '')
    if (addr === '127.0.0.1' || addr === '::1') continue
    const port = Number(m[2])
    if (!seen.has(port)) seen.set(port, Number(m[3]))
  }
  return [...seen].map(([port, pid]) => ({ port, pid }))
}

function parseTasklist(out) {
  const map = new Map()
  for (const line of String(out || '').split(/\r?\n/)) {
    const c = line.match(/"([^"]*)"/g)
    if (!c || c.length < 2) continue
    const pid = parseInt(c[1].slice(1, -1), 10)
    if (Number.isFinite(pid)) map.set(pid, c[0].slice(1, -1).replace(/\.exe$/i, ''))
  }
  return map
}

const TEMPISH = /\\(temp|downloads)\\|\\appdata\\local\\temp\\/i

/**
 * @param {{id:string,status:'ok'|'warn'|'bad'|'unknown',label:string,detail:string,penalty?:number}[]} checks
 */
function score(checks) {
  const penalty = checks.reduce((s, c) => s + (c.status === 'bad' || c.status === 'warn' ? c.penalty || 0 : 0), 0)
  const value = Math.max(0, 100 - penalty)
  const level = checks.some((c) => c.status === 'bad') || value < 60 ? 'red' : checks.some((c) => c.status === 'warn') || value < 90 ? 'amber' : 'green'
  return { score: value, level }
}

// ------------------------------------------------------------ the scan
function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 16e6 }, (err, out) => resolve(err && !out ? '' : String(out)))
  })
}
const regq = (key, value) => run('reg.exe', ['query', key, '/v', value])

async function scan({ uptimeS = 0, diskPct = 0, startupItems = [] } = {}) {
  const checks = []
  const add = (id, status, label, detail, penalty = 0) => checks.push({ id, status, label, detail, penalty })

  const [defender, fwStd, fwPub, fwDom, uac, rdp, reboot, net, tl] = await Promise.all([
    run('sc.exe', ['query', 'WinDefend']),
    regq(`${FW_BASE}\\StandardProfile`, 'EnableFirewall'),
    regq(`${FW_BASE}\\PublicProfile`, 'EnableFirewall'),
    regq(`${FW_BASE}\\DomainProfile`, 'EnableFirewall'),
    regq(String.raw`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`, 'EnableLUA'),
    regq(String.raw`HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server`, 'fDenyTSConnections'),
    run('reg.exe', ['query', String.raw`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired`]),
    run('netstat', ['-ano', '-p', 'tcp']),
    run('tasklist', ['/fo', 'csv', '/nh'])
  ])

  // antivirus
  const def = parseServiceState(defender)
  if (def === 'running') add('av', 'ok', 'Antivirus', 'Windows Defender is running.')
  else add('av', 'unknown', 'Antivirus', 'Windows Defender is not running — another antivirus may be in charge (not verified).')

  // firewall
  const fw = { private: parseRegDword(fwStd, 'EnableFirewall'), public: parseRegDword(fwPub, 'EnableFirewall'), domain: parseRegDword(fwDom, 'EnableFirewall') }
  const known = Object.entries(fw).filter(([, v]) => v !== null)
  const off = known.filter(([, v]) => v === 0).map(([k]) => k)
  if (!known.length) add('fw', 'unknown', 'Firewall', 'Could not read the firewall state.')
  else if (off.length) add('fw', 'bad', 'Firewall', `Windows Firewall is OFF for: ${off.join(', ')}.`, 30)
  else add('fw', 'ok', 'Firewall', 'Windows Firewall is on for all network types.')

  // UAC
  const lua = parseRegDword(uac, 'EnableLUA')
  if (lua === 0) add('uac', 'bad', 'User Account Control', 'UAC is disabled — programs can change the system without asking.', 20)
  else if (lua === 1) add('uac', 'ok', 'User Account Control', 'UAC is on.')

  // remote desktop
  const deny = parseRegDword(rdp, 'fDenyTSConnections')
  if (deny === 0) add('rdp', 'warn', 'Remote Desktop', 'Remote Desktop is enabled. Turn it off if you do not use it.', 15)
  else if (deny === 1) add('rdp', 'ok', 'Remote Desktop', 'Remote Desktop is off.')

  // listening ports
  const names = parseTasklist(tl)
  const listening = parseListening(net)
  const risky = listening.filter((l) => RISKY_PORTS[l.port])
  const other = listening.filter((l) => !RISKY_PORTS[l.port] && !USUAL_PORTS.has(l.port))
  if (risky.length) {
    const txt = risky.map((l) => `${RISKY_PORTS[l.port]} (${l.port}${names.get(l.pid) ? `, ${names.get(l.pid)}` : ''})`).join('; ')
    add('ports', 'warn', 'Open doors', `Listening to the network: ${txt}.`, Math.min(20, risky.length * 10))
  } else {
    add('ports', 'ok', 'Open doors', `${listening.length} port${listening.length === 1 ? '' : 's'} listening to the network${other.length ? `, ${other.length} from apps (${[...new Set(other.map((l) => names.get(l.pid)).filter(Boolean))].slice(0, 3).join(', ') || 'unknown'})` : ''}. None are high-risk.`)
  }

  // startup items running from temp/download folders
  const sketchy = startupItems.filter((s) => TEMPISH.test(s))
  if (sketchy.length) add('startup', 'warn', 'Auto-start', `${sketchy.length} startup entr${sketchy.length === 1 ? 'y runs' : 'ies run'} from a Temp or Downloads folder.`, 15)
  else add('startup', 'ok', 'Auto-start', 'No startup entries run from Temp or Downloads.')

  // restart needed / long uptime
  const rebootPending = /RebootRequired/i.test(reboot) && !/unable to find/i.test(reboot)
  if (rebootPending) add('reboot', 'warn', 'Updates', 'Windows is waiting for a restart to finish installing updates.', 5)
  else if (uptimeS > 14 * 86400) add('reboot', 'warn', 'Updates', `The PC has been on for ${Math.floor(uptimeS / 86400)} days — restart to apply updates.`, 5)
  else add('reboot', 'ok', 'Updates', 'No restart pending.')

  // disk headroom (ransomware / update failures love a full disk)
  if (diskPct >= 95) add('disk', 'warn', 'Disk space', `System drive is ${Math.round(diskPct)}% full.`, 5)

  return { at: Date.now(), ...score(checks), checks }
}

module.exports = { scan, score, parseRegDword, parseServiceState, parseListening, parseTasklist, TEMPISH }
