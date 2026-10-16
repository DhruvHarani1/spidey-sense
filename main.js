'use strict'
const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, net, screen } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')

const SIZES = { badge: { w: 96, h: 124 }, panel: { w: 300, h: 490 } }
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
  startup: false,
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

const publicSettings = () => ({ opacity: settings.opacity, sound: settings.sound, notifications: settings.notifications, netProbe: settings.netProbe, ramMode: settings.ramMode, view: settings.view })

// ---------------------------------------------------------------- window
/** @type {BrowserWindow | null} */
let win = null
let tray = null
let topTimer = null
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

let loginState = null
function syncLoginItem(enable) {
  if (!app.isPackaged) return
  // act on a change, and once at startup when enabled (repairs a path that moved after an update)
  if (loginState === enable || (loginState === null && !enable)) {
    loginState = enable
    return
  }
  loginState = enable
  try {
    app.setLoginItemSettings({ openAtLogin: enable, name: 'SpideySense', path: process.execPath })
  } catch (e) {
    console.warn('setLoginItemSettings failed', e.message)
  }
  const key = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
  const args = enable ? ['add', key, '/v', 'SpideySense', '/t', 'REG_SZ', '/d', '"' + process.execPath + '"', '/f'] : ['delete', key, '/v', 'SpideySense', '/f']
  execFile('reg.exe', args, { windowsHide: true }, (err) => {
    if (err) fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), new Date().toISOString() + ' ' + err.message + '\n')
  })
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
    tray.setToolTip('Spidey Sense')
    tray.on('click', toggleVisible)
  }
  const check = (label, key) => ({ label, type: 'checkbox', checked: !!settings[key], click: (i) => update({ [key]: i.checked }) })
  tray.setContextMenu(
    Menu.buildFromTemplate([
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
      check('Desktop notifications', 'notifications'),
      check('Network check (pings gstatic.com)', 'netProbe'),
      check('Launch at startup', 'startup'),
      { type: 'separator' },
      { label: 'Reset position', click: () => { settings.position = null; const d = defaultPosition(); win?.setPosition(d.x, d.y); saveSettings() } },
      { label: 'Quit Spidey Sense', click: () => app.quit() }
    ])
  )
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
    hog
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
    setInterval(sample, SAMPLE_MS)
    topTimer = setInterval(() => {
      if (win?.isVisible() && settings.alwaysOnTop) {
        win.setAlwaysOnTop(true, 'screen-saver')
        win.moveTop()
      }
    }, 3000)
  })
  app.on('before-quit', () => {
    quitting = true
    clearInterval(topTimer)
  })
  app.on('window-all-closed', () => {
    /* tray keeps the app alive */
  })
}
