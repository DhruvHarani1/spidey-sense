'use strict'
const { app, BrowserWindow, desktopCapturer, shell, dialog, globalShortcut, Menu, powerMonitor, Notification, Tray, ipcMain, nativeImage, net, screen } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const autostart = require('./autostart')
const speech = require('./speech')
const { updater } = require('./updater')
const guardian = require('./guardian')
const karenLlm = require('./karen-llm')
const notifications = require('./notifications')
const edith = require('./edith')

const SIZES = { badge: { w: 96, h: 124 }, panel: { w: 300, h: 580 } }
const size = () => SIZES[settings.view] || SIZES.badge
const MARGIN = 20
const SAMPLE_MS = 1000
const PROBE_EVERY = 8

const DEFAULTS = {
  opacity: 1,
  alwaysOnTop: true,
  sound: true,
  notifications: true,
  netProbe: true,
  startup: true, // launch at login (per-user); the tray toggle turns it off
  startupDefaulted: false,
  readNotifications: false, // Karen reads new notifications aloud
  readMode: 'full', // 'full' = who and what | 'private' = who only
  callMe: '', // how Karen addresses you, e.g. "Dhruv sir"
  readMuted: ['lyra', 'settings', 'system', 'lenovo', 'intel'], // apps she never reads
  voiceName: '', // '' = automatic; otherwise the exact installed Windows voice name
  karenVoice: false, // Karen reads her replies aloud
  llmModel: '', // preferred Ollama model (blank = auto)
  bugleDaily: true, // 21:00 nudge that the day's front page is ready
  lastBugle: '',
  inbox: true, // mirror Windows notifications from all apps into the widget's inbox (local only)
  trayHinted: false,
  guardian: true, // danger sense: first-time internet contact, new auto-start, hosts change, new drive
  eyeBreak: true, // 20-20-20 nudge after 20 min of continuous use
  view: 'badge', // badge = small swinging spider | panel = full widget
  ramMode: 'auto', // auto = alert on spikes above this PC's usual level | 90 | 95 | off
  position: null
}

// ---------------------------------------------------------------- settings
let settings = { ...DEFAULTS }
let settingsFile = ''
let saveTimer = null

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json')
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }
  } catch {
    settings = { ...DEFAULTS }
  }
  settings.opacity = Math.min(1, Math.max(0.3, Number(settings.opacity) || 1))
  if (!settings.startupDefaulted) {
    settings.startup = true // earlier versions saved "off" without ever asking
    settings.startupDefaulted = true
    saveSettings()
  }
}

function saveSettings() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2))
    } catch (e) {
      console.warn('could not save settings', e.message)
    }
  }, 300)
}

function update(patch) {
  settings = { ...settings, ...patch }
  saveSettings()
  applySettings()
  win?.webContents.send('settings', publicSettings())
  buildTray()
}

const publicSettings = () => ({ opacity: settings.opacity, sound: settings.sound, notifications: settings.notifications, netProbe: settings.netProbe, ramMode: settings.ramMode, eyeBreak: settings.eyeBreak, karenVoice: settings.karenVoice, voiceName: settings.voiceName, readNotifications: settings.readNotifications, readMode: settings.readMode, callMe: settings.callMe, readMuted: settings.readMuted, view: settings.view })

// ---------------------------------------------------------------- window
/** @type {BrowserWindow | null} */
let win = null
let tray = null
let topTimer = null
let stopGuardian = null
let stopInbox = null
let bugleTimer = null
let quitting = false

function clampToDisplay(x, y) {
  const { w, h } = size()
  const wa = screen.getDisplayMatching({ x, y, width: w, height: h }).workArea
  return {
    x: Math.min(Math.max(x, wa.x), wa.x + wa.width - w),
    y: Math.min(Math.max(y, wa.y), wa.y + wa.height - h)
  }
}

function defaultPosition() {
  const wa = screen.getPrimaryDisplay().workArea
  return { x: wa.x + wa.width - size().w - MARGIN, y: wa.y }
}

function createWindow() {
  const pos = settings.position ? clampToDisplay(settings.position.x, settings.position.y) : defaultPosition()
  win = new BrowserWindow({
    width: size().w,
    height: size().h,
    ...pos,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    title: 'Spidey Sense',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })
  win.setMenuBarVisibility(false)
  // right-click on the draggable panel would otherwise open the plain Windows window menu
  win.on('system-context-menu', (e) => {
    e.preventDefault()
    showMenu()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.once('ready-to-show', () => {
    applySettings()
    win.showInactive()
  })
  win.on('moved', () => {
    const [x, y] = win.getPosition()
    settings.position = { x, y }
    saveSettings()
  })
  // close (Alt+F4) hides instead of leaving a ghost; Quit lives in the tray menu
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), process.env.SPIDEY_TEST ? { query: { test: '1' } } : undefined)
}

/** Swap between the small badge and the full widget, keeping the thread's anchor point (window centre) fixed. */
function setView(view) {
  if (!win || !SIZES[view] || settings.view === view) return
  const b = win.getBounds()
  const next = SIZES[view]
  const cx = b.x + b.width / 2
  settings.view = view
  const pos = clampToDisplay(Math.round(cx - next.w / 2), b.y)
  win.setBounds({ ...pos, width: next.w, height: next.h })
  settings.position = pos
  saveSettings()
  win.webContents.send('settings', publicSettings())
  buildTray()
}

function applySettings() {
  if (!win) return
  win.setOpacity(settings.opacity)
  win.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver')
  syncLoginItem(settings.startup)
}

/** Launch at login: HKCU Run entry, verified after writing and repaired on every start (see autostart.js). */
function syncLoginItem(enable) {
  if (!app.isPackaged || process.env.SPIDEY_TEST) return // tests must never touch the real startup entry
  autostart
    .sync({ enable, exe: process.execPath })
    .then((r) => {
      if (!r.ok) logStartup(`autostart ${enable ? 'enable' : 'disable'} failed: ${r.error}`)
    })
    .catch((e) => logStartup(`autostart error: ${e.message}`))
}

function logStartup(line) {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* best effort */
  }
}

function iconPath() {
  const p = path.join(__dirname, 'assets', 'icon.png')
  return fs.existsSync(p) ? p : undefined
}

// ---------------------------------------------------------------- tray
function buildTray() {
  const p = iconPath()
  const img = p ? nativeImage.createFromPath(p).resize({ width: 32, height: 32 }) : fallbackIcon()
  if (!tray) {
    tray = new Tray(img)
    tray.setToolTip(`Spidey Sense v${app.getVersion()}`)
    tray.on('click', toggleVisible)
  }
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()))
}

/** The one menu: used by the tray icon and by right-clicking the badge or the panel. */
function menuTemplate() {
  const check = (label, key) => ({ label, type: 'checkbox', checked: !!settings[key], click: (i) => update({ [key]: i.checked }) })
  return [
      { label: win?.isVisible() ? 'Hide the web' : 'Show the web', click: toggleVisible },
      { label: settings.view === 'panel' ? 'Collapse to badge' : 'Open widget', click: () => { win?.showInactive(); setView(settings.view === 'panel' ? 'badge' : 'panel') } },
      { type: 'separator' },
      check('Always on top', 'alwaysOnTop'),
      {
        label: 'Opacity',
        submenu: [1, 0.85, 0.7, 0.55].map((o) => ({
          label: `${Math.round(o * 100)}%`,
          type: 'radio',
          checked: Math.abs(settings.opacity - o) < 0.01,
          click: () => update({ opacity: o })
        }))
      },
      {
        label: 'RAM alerts',
        submenu: [
          ['auto', 'Auto (spikes above usual)'],
          ['90', 'Above 90%'],
          ['95', 'Above 95%'],
          ['off', 'Never']
        ].map(([v, label]) => ({ label, type: 'radio', checked: settings.ramMode === v, click: () => update({ ramMode: v }) }))
      },
      { type: 'separator' },
      check('Spider-sense sound', 'sound'),
      check('Eye-rest nudge (20-20-20)', 'eyeBreak'),
      check('Karen speaks her replies', 'karenVoice'),
      check('Read notifications aloud', 'readNotifications'),
      { label: 'Notification reading: private (who, not what)', type: 'checkbox', checked: settings.readMode === 'private', click: (i) => update({ readMode: i.checked ? 'private' : 'full' }) },
      {
        label: "Karen's voice",
        submenu: [
          { label: 'Automatic', type: 'radio', checked: !settings.voiceName, click: () => pickVoice('auto') },
          ...speechVoices.map((v) => ({ label: `${v.short} (${v.gender})`, type: 'radio', checked: settings.voiceName === v.name, click: () => pickVoice(v.name) }))
        ]
      },
      { label: "Today's Daily Web (front page)", click: () => openBugle() },
      check('Daily Web ready nudge (9 pm)', 'bugleDaily'),
      { label: 'E.D.I.T.H. threat assessment', click: () => openEdith() },
      { label: 'Web-Capture: comic screenshot (Ctrl+Alt+C)', click: () => void startCapture() },
      { label: 'Suit locker (XP)', click: () => openLocker() },
      check('Notification inbox', 'inbox'),
      check('Guardian (danger sense)', 'guardian'),
      check('Desktop notifications', 'notifications'),
      check('Network check (pings gstatic.com)', 'netProbe'),
      check('Launch at startup', 'startup'),
      { type: 'separator' },
      updateMenuItem(),
      { type: 'separator' },
      { label: 'Help & all commands (manual)', click: () => openHelp() },
      { label: 'Reset position', click: () => { settings.position = null; const d = defaultPosition(); win?.setPosition(d.x, d.y); saveSettings() } },
      { label: 'Quit Spidey Sense', click: () => app.quit() }
  ]
}

function showMenu() {
  if (win) Menu.buildFromTemplate(menuTemplate()).popup({ window: win })
}

ipcMain.on('menu:show', (e) => {
  if (e.sender === win?.webContents) showMenu()
})

function updateMenuItem() {
  const s = updater.state
  if (s.state === 'ready') return { label: `Restart to update to v${s.version}`, click: () => updater.install() }
  if (s.state === 'downloading') return { label: `Downloading update… ${s.percent ?? 0}%`, enabled: false }
  if (s.state === 'checking') return { label: 'Checking for updates…', enabled: false }
  if (s.state === 'disabled') return { label: `Version ${app.getVersion()} (dev build)`, enabled: false }
  return { label: `Check for updates (v${app.getVersion()})`, click: () => void updater.check() }
}

function fallbackIcon() {
  // 16x16 red disc (BGRA) so the tray always has something to show
  const s = 16
  const buf = Buffer.alloc(s * s * 4)
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5)
      if (d <= 7) buf.writeUInt32LE(0xffd4202a, (y * s + x) * 4)
    }
  return nativeImage.createFromBitmap(buf, { width: s, height: s })
}

function toggleVisible() {
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
  buildTray()
}

// ---------------------------------------------------------------- stats
let lastCpu = null
let latencyMs = null
let online = true
let tick = 0

function cpuPercent() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k]
    idle += c.times.idle
  }
  const cur = { idle, total }
  let pct = 0
  if (lastCpu) {
    const dt = cur.total - lastCpu.total
    pct = dt > 0 ? (1 - (cur.idle - lastCpu.idle) / dt) * 100 : 0
  }
  lastCpu = cur
  return Math.min(100, Math.max(0, pct))
}

async function diskPercent() {
  try {
    const root = (process.env.SystemDrive || 'C:') + '\\'
    const s = await fs.promises.statfs(root)
    const total = Number(s.blocks) * Number(s.bsize)
    const free = Number(s.bavail) * Number(s.bsize)
    return total > 0 ? (1 - free / total) * 100 : 0
  } catch {
    return 0
  }
}

async function probeNetwork() {
  const t0 = Date.now()
  try {
    const res = await net.fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(4000) })
    online = res.status < 500
    latencyMs = Date.now() - t0
  } catch {
    online = false
    latencyMs = null
  }
}

let hog = null
function refreshHog() {
  execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 8e6 }, (err, out) => {
    if (err) return
    const by = new Map()
    for (const line of out.split(/\r?\n/)) {
      const c = line.match(/"([^"]*)"/g)
      if (!c || c.length < 5) continue
      const name = c[0].slice(1, -1).replace(/\.exe$/i, '')
      const kb = parseInt(c[4].replace(/[^0-9]/g, ''), 10) || 0
      by.set(name, (by.get(name) || 0) + kb)
    }
    let best = null
    for (const [name, kb] of by) if (!best || kb > best.kb) best = { name, kb }
    hog = best ? { name: best.name, mb: Math.round(best.kb / 1024) } : null
  })
}

async function sample() {
  tick++
  if (tick % 10 === 1) refreshHog()
  if (settings.netProbe) {
    if (tick % PROBE_EVERY === 1) void probeNetwork()
  } else {
    latencyMs = null
    online = net.isOnline()
  }
  const total = os.totalmem()
  const stats = {
    cpu: cpuPercent(),
    ram: ((total - os.freemem()) / total) * 100,
    disk: await diskPercent(),
    latencyMs,
    online,
    uptimeS: os.uptime(),
    probing: settings.netProbe,
    hog,
    idleS: powerMonitor.getSystemIdleTime()
  }
  win?.webContents.send('stats', stats)
}

// ---------------------------------------------------------------- IPC
ipcMain.on('view:set', (e, view) => {
  if (e.sender === win?.webContents) setView(view)
})
let dragFrom = null
ipcMain.on('drag:start', (e) => {
  if (e.sender === win?.webContents) dragFrom = win.getPosition()
})
ipcMain.on('drag:move', (e, d) => {
  if (e.sender !== win?.webContents || !dragFrom || !Number.isFinite(d?.dx) || !Number.isFinite(d?.dy)) return
  const p = clampToDisplay(Math.round(dragFrom[0] + d.dx), Math.round(dragFrom[1] + d.dy))
  win.setPosition(p.x, p.y)
})
ipcMain.on('drag:end', () => {
  dragFrom = null
})
const PATCHABLE = { sound: 'boolean', notifications: 'boolean', opacity: 'number', karenVoice: 'boolean' }
ipcMain.on('settings:patch', (e, patch) => {
  if (e.sender !== win?.webContents || !patch || typeof patch !== 'object') return
  const clean = {}
  for (const [k, type] of Object.entries(PATCHABLE)) {
    if (typeof patch[k] !== type) continue
    clean[k] = k === 'opacity' ? Math.min(1, Math.max(0.3, patch[k])) : patch[k]
  }
  if (typeof patch.readNotifications === 'boolean') clean.readNotifications = patch.readNotifications
  if (patch.readMode === 'full' || patch.readMode === 'private') clean.readMode = patch.readMode
  if (typeof patch.callMe === 'string') clean.callMe = patch.callMe.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 40)
  if (Array.isArray(patch.readMuted)) {
    clean.readMuted = [...new Set(patch.readMuted.filter((x) => typeof x === 'string').map((x) => x.toLowerCase().replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 40)).filter(Boolean))].slice(0, 40)
  }
  if (Object.keys(clean).length) update(clean)
})

// never let a chat command take down the OS or this app
const PROTECTED = /^(system|registry|smss|csrss|wininit|winlogon|services|lsass|svchost|dwm|explorer|fontdrvhost|spidey sense|electron|conhost|sihost|ctfmon|taskhostw|searchhost|startmenuexperiencehost|shellexperiencehost|runtimebroker|audiodg|msmpeng|securityhealthservice|wudfhost)$/i
ipcMain.handle('proc:kill', (e, name) => {
  if (e.sender !== win?.webContents) return { ok: false, error: 'not allowed' }
  const n = String(name || '').replace(/\.exe$/i, '').trim()
  if (!/^[\w .-]{1,60}$/.test(n)) return { ok: false, error: 'invalid process name' }
  if (PROTECTED.test(n)) return { ok: false, error: `${n} is protected — I won't touch it` }
  return new Promise((resolve) => {
    execFile('taskkill', ['/IM', `${n}.exe`, '/F'], { windowsHide: true }, (err, out) => {
      const count = (String(out).match(/SUCCESS/gi) || []).length
      resolve(count ? { ok: true, count } : { ok: false, error: `no running process named ${n}` })
    })
  })
})

ipcMain.handle('karen:llm', async () => karenLlm.status(settings.llmModel))
ipcMain.handle('karen:ask', async (e, text, ctx) => {
  if (e.sender !== win?.webContents || typeof text !== 'string') return null
  return karenLlm.ask(text, ctx, settings.llmModel)
})
/** @type {BrowserWindow | null} */
let capWin = null

/** Freeze the screen, then open a full-screen window where the user drags a region to turn into a comic panel. */
async function startCapture() {
  if (capWin) return
  const disp = screen.getPrimaryDisplay()
  const hid = !!win && win.isVisible()
  if (hid) {
    win.hide() // keep the widget out of the screenshot
    await new Promise((r) => setTimeout(r, 250))
  }
  let url = ''
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(disp.size.width * disp.scaleFactor), height: Math.round(disp.size.height * disp.scaleFactor) }
    })
    const src = sources.find((s) => s.display_id === String(disp.id)) || sources[0]
    if (src) url = src.thumbnail.toDataURL()
  } catch (e) {
    console.warn('capture failed', e.message)
  } finally {
    if (hid) win.showInactive()
  }
  if (!url) return
  capWin = new BrowserWindow({
    ...disp.bounds,
    show: false,
    frame: false,
    backgroundColor: '#000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    title: 'Web-Capture',
    webPreferences: { preload: path.join(__dirname, 'preload-capture.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  capWin.setAlwaysOnTop(true, 'screen-saver')
  capWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  capWin.webContents.on('will-navigate', (e) => e.preventDefault())
  capWin.webContents.on('did-finish-load', () => capWin?.webContents.send('capture:image', url))
  capWin.once('ready-to-show', () => {
    capWin?.show()
    capWin?.focus()
  })
  capWin.on('closed', () => {
    capWin = null
  })
  capWin.loadFile(path.join(__dirname, 'renderer', 'capture.html'))
}

ipcMain.on('capture:start', (e) => {
  if (e.sender === win?.webContents) void startCapture()
})
ipcMain.on('capture:close', (e) => {
  if (e.sender === capWin?.webContents) capWin.close()
})
ipcMain.handle('capture:save', async (e, dataUrl, suggested) => {
  if (e.sender !== capWin?.webContents) return false
  const img = pngFrom(dataUrl)
  if (!img) return false
  const name = String(suggested || 'Comic-Panel.png').replace(/[^\w.-]/g, '_').slice(0, 60)
  const r = await dialog.showSaveDialog(capWin, { defaultPath: path.join(app.getPath('pictures'), name), filters: [{ name: 'PNG image', extensions: ['png'] }] })
  if (r.canceled || !r.filePath) return false
  fs.writeFileSync(r.filePath, img.toPNG())
  return true
})

/** @type {BrowserWindow | null} */
let helpWin = null

/** The offline manual (generated from help-data.js) in its own window. */
let speechVoices = []

/** switch Karen's voice (name, 'zira', 'male', 'next', 'auto' …) and say one line in it so you can hear the change */
async function pickVoice(pick) {
  if (!speechVoices.length) speechVoices = await speech.listVoices()
  const v = speech.resolveVoice(pick, settings.voiceName)
  if (!v) return null
  update({ voiceName: v.name })
  speech.setVoice(v.name)
  const label = v.name ? v.short : 'my default voice'
  void speech.speak(`Hello, this is ${label}. How do I sound?`)
  return { name: v.name, short: v.short || 'automatic', gender: v.gender || '' }
}

ipcMain.handle('voice:pick', (e, pick) => (e.sender === win?.webContents ? pickVoice(String(pick || 'next')) : null))
ipcMain.handle('voice:list', async (e) => {
  if (e.sender !== win?.webContents) return []
  if (!speechVoices.length) speechVoices = await speech.listVoices()
  return speechVoices.map((v) => ({ name: v.name, short: v.short, gender: v.gender, active: v.name === settings.voiceName }))
})

function openHelp() {
  if (helpWin) {
    helpWin.show()
    helpWin.focus()
    return
  }
  helpWin = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0a1131',
    title: 'Spidey Sense — manual',
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  helpWin.setMenuBarVisibility(false)
  // the manual is static local HTML; any real link opens in the browser, never inside this window
  helpWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  helpWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) {
      e.preventDefault()
      if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    }
  })
  helpWin.on('closed', () => {
    helpWin = null
  })
  helpWin.loadFile(path.join(__dirname, 'renderer', 'help.html'))
}

ipcMain.on('help:open', (e) => {
  if (e.sender === win?.webContents) openHelp()
})

function openLocker() {
  if (!win) return
  win.show()
  setView('panel')
  win.webContents.send('open-locker')
}

function openEdith() {
  if (!win) return
  win.show()
  setView('panel')
  win.webContents.send('open-edith')
}

ipcMain.handle('edith:scan', async (e) => {
  if (e.sender !== win?.webContents) return null
  const [disk, startupItems] = await Promise.all([diskPercent(), guardian.currentStartup()])
  return edith.scan({ uptimeS: os.uptime(), diskPct: disk, startupItems })
})

function openBugle() {
  if (!win) return
  win.show()
  setView('panel')
  win.webContents.send('open-bugle')
}

const MAX_IMG = 12 * 1024 * 1024
const pngFrom = (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > MAX_IMG * 1.4) return null
  const img = nativeImage.createFromDataURL(dataUrl)
  return img.isEmpty() ? null : img
}
ipcMain.handle('bugle:save', async (e, dataUrl, suggested) => {
  if (e.sender !== win?.webContents) return { ok: false }
  const img = pngFrom(dataUrl)
  if (!img) return { ok: false }
  const name = String(suggested || 'Daily-Web.png').replace(/[^\w.-]/g, '_').slice(0, 60)
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('pictures'), name), filters: [{ name: 'PNG image', extensions: ['png'] }] })
  if (r.canceled || !r.filePath) return { ok: false }
  fs.writeFileSync(r.filePath, img.toPNG())
  return { ok: true }
})

ipcMain.handle('update:state', (e) => (e.sender === win?.webContents ? { ...updater.state, version_now: app.getVersion() } : null))
ipcMain.handle('update:check', async (e) => (e.sender === win?.webContents ? { ...(await updater.check()), version_now: app.getVersion() } : null))
ipcMain.on('update:install', (e) => {
  if (e.sender === win?.webContents) updater.install()
})
speech.setOnStart((tag) => win?.webContents.send('speech:start', tag))
ipcMain.on('speak', (e, text, opts) => {
  if (e.sender !== win?.webContents) return
  const o = opts && typeof opts === 'object' ? opts : {}
  void speech.speak(typeof text === 'string' ? text : '', {
    queue: o.queue === true,
    urgent: o.urgent === true,
    tag: typeof o.tag === 'string' ? o.tag.slice(0, 140) : undefined
  })
})
ipcMain.handle('settings:get', () => publicSettings())
ipcMain.on('notify', (e, payload) => {
  if (e.sender !== win?.webContents || !settings.notifications || !Notification.isSupported()) return
  const { kind, title, body } = payload || {}
  if (typeof title !== 'string' || typeof body !== 'string') return
  const now = Date.now()
  notifiedAt[kind] = notifiedAt[kind] || 0
  if (now - notifiedAt[kind] < 120_000) return
  notifiedAt[kind] = now
  new Notification({ title: title.slice(0, 80), body: body.slice(0, 200), silent: true }).show()
})
const notifiedAt = {}

// ---------------------------------------------------------------- lifecycle
// tests run against a throwaway profile so they never fight (or touch) an installed copy
if (process.env.SPIDEY_TEST) {
  const dir = path.join(app.getPath('temp'), 'spidey-test-' + process.pid)
  app.setPath('userData', dir) // fresh profile per test run
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    win?.showInactive()
    buildTray()
  })
  app.whenReady().then(() => {
    app.setAppUserModelId('dev.spidey.sense')
    loadSettings()
    createWindow()
    buildTray()
    syncLoginItem(settings.startup)
    stopGuardian = guardian.start({
      dataDir: app.getPath('userData'),
      selfNames: ['Spidey Sense', 'electron'],
      emit: (ev) => {
        if (settings.guardian) win?.webContents.send('guardian', ev)
      }
    })
    const summon = () => {
      if (!win) return
      win.show()
      setView('panel')
      win.focus()
      win.webContents.send('focus-remind')
    }
    // once a day after 21:00: tell the user their front page is ready (click opens it)
    bugleTimer = setInterval(() => {
      const d = new Date()
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      if (!settings.bugleDaily || d.getHours() < 21 || settings.lastBugle === key) return
      settings.lastBugle = key
      saveSettings()
      if (Notification.isSupported()) {
        const n = new Notification({ title: "Today's Daily Web is out!", body: 'Your front page is ready — click to read it.', silent: true })
        n.on('click', openBugle)
        n.show()
      }
    }, 60_000)
    updater.on('state', (s) => {
      buildTray()
      win?.webContents.send('update:state', s)
      if (s.state === 'ready' && Notification.isSupported()) {
        const n = new Notification({ title: 'Spidey Sense update ready', body: `Version ${s.version} is downloaded. Click to restart and update.`, silent: true })
        n.on('click', () => updater.install())
        n.show()
      }
    })
    updater.start()
    speech.setVoice(settings.voiceName)
    void speech.listVoices().then((v) => {
      speechVoices = v
      buildTray()
    })
    if (!settings.trayHinted && Notification.isSupported()) {
      settings.trayHinted = true
      saveSettings()
      setTimeout(() => {
        new Notification({
          title: 'Spidey Sense is running',
          body: 'Right-click the little spider badge for the menu. The tray icon by the clock may be under the ^ arrow — drag it onto the taskbar to keep it visible.',
          silent: true
        }).show()
      }, 6000)
    }
    stopInbox = notifications.start({
      selfIds: ['dev.spidey.sense'],
      emit: (items) => {
        if (settings.inbox) win?.webContents.send('inbox', items)
      }
    })
    globalShortcut.register('Control+Alt+K', summon) // Karen
    globalShortcut.register('Control+Alt+C', () => void startCapture()) // Web-Capture
    globalShortcut.register('Control+Alt+S', summon) // kept from the reminders hotkey
    setInterval(sample, SAMPLE_MS)
    topTimer = setInterval(() => {
      if (win?.isVisible() && settings.alwaysOnTop) {
        win.setAlwaysOnTop(true, 'screen-saver')
        win.moveTop()
      }
    }, 3000)
  })
  app.on('before-quit', () => {
    globalShortcut.unregisterAll()
    stopGuardian?.()
    stopInbox?.()
    clearInterval(bugleTimer)
    updater.dispose()
    speech.stop()
    quitting = true
    clearInterval(topTimer)
  })
  app.on('window-all-closed', () => {
    /* tray keeps the app alive */
  })
}
