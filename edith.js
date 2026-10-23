'use strict'
/**
 * E.D.I.T.H.: a quick, read-only security "threat assessment" of this PC.
 * Uses only reg.exe, sc.exe, netstat, tasklist and one read-only Get-HotFix query for the Windows Update age (no admin rights, no network calls).
 * It reports facts, a simple score and a plain-words fix checklist; it never changes any setting.
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
/** value of a REG_SZ from `reg query` output, or null */
function parseRegString(out, name) {
  const m = new RegExp(String.raw`^\s*${name}\s+REG_SZ\s+(.+?)\s*$`, 'im').exec(out || '')
  return m ? m[1] : null
}

/** whole days between a "2026-10-10" or "2026-10-10 05:12:33" timestamp (UTC) and now, or null */
function daysSince(stamp, nowMs = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(String(stamp || '').trim())
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
  return Number.isFinite(t) && t <= nowMs + 86400000 ? Math.max(0, Math.floor((nowMs - t) / 86400000)) : null
}

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
  const add = (id, status, label, detail, penalty = 0, fix = []) => checks.push({ id, status, label, detail, penalty, fix: status === 'ok' ? [] : fix })

  const [defender, fwStd, fwPub, fwDom, uac, rdp, reboot, net, tl, rtp, pol, lastUpdate] = await Promise.all([
    run('sc.exe', ['query', 'WinDefend']),
    regq(`${FW_BASE}\\StandardProfile`, 'EnableFirewall'),
    regq(`${FW_BASE}\\PublicProfile`, 'EnableFirewall'),
    regq(`${FW_BASE}\\DomainProfile`, 'EnableFirewall'),
    regq(String.raw`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`, 'EnableLUA'),
    regq(String.raw`HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server`, 'fDenyTSConnections'),
    run('reg.exe', ['query', String.raw`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired`]),
    run('netstat', ['-ano', '-p', 'tcp']),
    run('tasklist', ['/fo', 'csv', '/nh']),
    regq(String.raw`HKLM\SOFTWARE\Microsoft\Windows Defender\Real-Time Protection`, 'DisableRealtimeMonitoring'),
    regq(String.raw`HKLM\SOFTWARE\Policies\Microsoft\Windows Defender`, 'DisableAntiSpyware'),
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', "(Get-HotFix -ErrorAction SilentlyContinue | Where-Object { $_.InstalledOn } | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn.ToString('yyyy-MM-dd')"])
  ])

  // antivirus
  const def = parseServiceState(defender)
  const rtOff = parseRegDword(rtp, 'DisableRealtimeMonitoring') === 1 || parseRegDword(pol, 'DisableAntiSpyware') === 1
  if (def === 'running' && rtOff) add('av', 'bad', 'Antivirus', 'Windows Defender is running but its real-time protection is switched OFF.', 25, ['Open Windows Security → Virus & threat protection → Manage settings.', 'Turn "Real-time protection" on.', 'If it switches itself off again, scan the PC: some malware does this.'])
  else if (def === 'running') add('av', 'ok', 'Antivirus', 'Windows Defender is running.')
  else add('av', 'unknown', 'Antivirus', 'Windows Defender is not running — another antivirus may be in charge (not verified).', 0, ['If you use another antivirus (Norton, Kaspersky, …), open it and check that it is on and up to date.', 'If you use none: Windows Security → Virus & threat protection → turn Defender on.'])

  // firewall
  const fw = { private: parseRegDword(fwStd, 'EnableFirewall'), public: parseRegDword(fwPub, 'EnableFirewall'), domain: parseRegDword(fwDom, 'EnableFirewall') }
  const known = Object.entries(fw).filter(([, v]) => v !== null)
  const off = known.filter(([, v]) => v === 0).map(([k]) => k)
  if (!known.length) add('fw', 'unknown', 'Firewall', 'Could not read the firewall state.')
  else if (off.length) add('fw', 'bad', 'Firewall', `Windows Firewall is OFF for: ${off.join(', ')}.`, 30, ['Open Windows Security → Firewall & network protection.', 'Select each network type shown as off and press "Turn on".'])
  else add('fw', 'ok', 'Firewall', 'Windows Firewall is on for all network types.')

  // UAC
  const lua = parseRegDword(uac, 'EnableLUA')
  if (lua === 0) add('uac', 'bad', 'User Account Control', 'UAC is disabled — programs can change the system without asking.', 20, ['Search the Start menu for "Change User Account Control settings".', 'Move the slider up from "Never notify" (the default is the second step from the top), then restart.'])
  else if (lua === 1) add('uac', 'ok', 'User Account Control', 'UAC is on.')

  // remote desktop
  const deny = parseRegDword(rdp, 'fDenyTSConnections')
  if (deny === 0) add('rdp', 'warn', 'Remote Desktop', 'Remote Desktop is enabled. Turn it off if you do not use it.', 15, ['Settings → System → Remote Desktop → switch it off.', 'If you do need it, use a strong password and never expose it to the internet.'])
  else if (deny === 1) add('rdp', 'ok', 'Remote Desktop', 'Remote Desktop is off.')

  // listening ports
  const names = parseTasklist(tl)
  const listening = parseListening(net)
  const risky = listening.filter((l) => RISKY_PORTS[l.port])
  const other = listening.filter((l) => !RISKY_PORTS[l.port] && !USUAL_PORTS.has(l.port))
  if (risky.length) {
    const txt = risky.map((l) => `${RISKY_PORTS[l.port]} (${l.port}${names.get(l.pid) ? `, ${names.get(l.pid)}` : ''})`).join('; ')
    add('ports', 'warn', 'Open doors', `Listening to the network: ${txt}.`, Math.min(20, risky.length * 10), ['These ports let other computers try to connect. If you do not use the service named, disable it (Services app) or block the port in Windows Firewall.', 'Never forward these ports on your router.'])
  } else {
    add('ports', 'ok', 'Open doors', `${listening.length} port${listening.length === 1 ? '' : 's'} listening to the network${other.length ? `, ${other.length} from apps (${[...new Set(other.map((l) => names.get(l.pid)).filter(Boolean))].slice(0, 3).join(', ') || 'unknown'})` : ''}. None are high-risk.`)
  }

  // startup items running from temp/download folders
  const sketchy = startupItems.filter((s) => TEMPISH.test(s))
  if (sketchy.length) add('startup', 'warn', 'Auto-start', `${sketchy.length} startup entr${sketchy.length === 1 ? 'y runs' : 'ies run'} from a Temp or Downloads folder.`, 15, ['Task Manager → Startup apps: disable the entries you do not recognise.', 'Starting from Temp or Downloads is a classic malware trick. Scan the PC if you did not add them.'])
  else add('startup', 'ok', 'Auto-start', 'No startup entries run from Temp or Downloads.')

  // restart needed / long uptime
  const rebootPending = /RebootRequired/i.test(reboot) && !/unable to find/i.test(reboot)
  if (rebootPending) add('reboot', 'warn', 'Updates', 'Windows is waiting for a restart to finish installing updates.', 5, ['Save your work and restart the PC.'])
  else if (uptimeS > 14 * 86400) add('reboot', 'warn', 'Updates', `The PC has been on for ${Math.floor(uptimeS / 86400)} days — restart to apply updates.`, 5, ['Save your work and restart the PC.'])
  else add('reboot', 'ok', 'Updates', 'No restart pending.')

  // how long since Windows last installed an update
  const age = daysSince(String(lastUpdate || '').trim(), Date.now())
  if (age === null) add('winupdate', 'unknown', 'Windows Update', 'Could not tell when Windows last installed an update.')
  else if (age > 60) add('winupdate', 'warn', 'Windows Update', `Windows last installed an update ${age} days ago.`, 10, ['Settings → Windows Update → Check for updates, then install and restart.', 'If it keeps failing: Settings → System → Troubleshoot → Other troubleshooters → Windows Update.'])
  else add('winupdate', 'ok', 'Windows Update', age === 0 ? 'Windows installed an update today.' : `Windows last installed an update ${age} day${age === 1 ? '' : 's'} ago.`)

  // disk headroom (ransomware / update failures love a full disk)
  if (diskPct >= 95) add('disk', 'warn', 'Disk space', `System drive is ${Math.round(diskPct)}% full.`, 5, ['Settings → System → Storage: clean up temporary files (Storage Sense).', 'Uninstall programs you no longer use and move big files to another drive.'])

  return { at: Date.now(), ...score(checks), checks }
}

module.exports = { scan, score, parseRegDword, parseRegString, daysSince, parseServiceState, parseListening, parseTasklist, TEMPISH }
