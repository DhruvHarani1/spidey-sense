'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('spidey', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onStats: (cb) => {
    const l = (_e, s) => cb(s)
    ipcRenderer.on('stats', l)
    return () => ipcRenderer.removeListener('stats', l)
  },
  onSettings: (cb) => {
    const l = (_e, s) => cb(s)
    ipcRenderer.on('settings', l)
    return () => ipcRenderer.removeListener('settings', l)
  },
  onFocusRemind: (cb) => {
    const l = () => cb()
    ipcRenderer.on('focus-remind', l)
    return () => ipcRenderer.removeListener('focus-remind', l)
  },
  onGuardian: (cb) => {
    const l = (_e, ev) => cb(ev)
    ipcRenderer.on('guardian', l)
    return () => ipcRenderer.removeListener('guardian', l)
  },
  patchSettings: (patch) => ipcRenderer.send('settings:patch', patch),
  killProcess: (name) => ipcRenderer.invoke('proc:kill', name),
  karenAsk: (text, ctx) => ipcRenderer.invoke('karen:ask', text, ctx),
  karenLlm: () => ipcRenderer.invoke('karen:llm'),
  onInbox: (cb) => {
    const l = (_e, items) => cb(items)
    ipcRenderer.on('inbox', l)
    return () => ipcRenderer.removeListener('inbox', l)
  },
  bugleSave: (dataUrl, name) => ipcRenderer.invoke('bugle:save', dataUrl, name),
  onOpenBugle: (cb) => {
    const l = () => cb()
    ipcRenderer.on('open-bugle', l)
    return () => ipcRenderer.removeListener('open-bugle', l)
  },
  edithScan: () => ipcRenderer.invoke('edith:scan'),
  onOpenEdith: (cb) => {
    const l = () => cb()
    ipcRenderer.on('open-edith', l)
    return () => ipcRenderer.removeListener('open-edith', l)
  },
  onOpenLocker: (cb) => {
    const l = () => cb()
    ipcRenderer.on('open-locker', l)
    return () => ipcRenderer.removeListener('open-locker', l)
  },
  updateState: () => ipcRenderer.invoke('update:state'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.send('update:install'),
  onUpdate: (cb) => {
    const l = (_e, s) => cb(s)
    ipcRenderer.on('update:state', l)
    return () => ipcRenderer.removeListener('update:state', l)
  },
  startCapture: () => ipcRenderer.send('capture:start'),
  openHelp: () => ipcRenderer.send('help:open'),
  showMenu: () => ipcRenderer.send('menu:show'),
  speak: (text, opts) => ipcRenderer.send('speak', text, opts),
  onSpeechStart: (cb) => {
    const l = (_e, tag) => cb(tag)
    ipcRenderer.on('speech:start', l)
    return () => ipcRenderer.removeListener('speech:start', l)
  },
  pickVoice: (pick) => ipcRenderer.invoke('voice:pick', pick),
  listVoices: () => ipcRenderer.invoke('voice:list'),
  brainReady: () => ipcRenderer.invoke('brain:ready'),
  brainChat: (text, ctx, opts) => ipcRenderer.invoke('brain:chat', text, ctx, opts),
  brainReset: () => ipcRenderer.send('brain:reset'),
  openBrain: () => ipcRenderer.send('brain:open'),
  transcribe: (audio) => ipcRenderer.invoke('stt:transcribe', audio),
  voiceInfo: () => ipcRenderer.invoke('voice:info'),
  voiceListening: (on) => ipcRenderer.send('voice:listening', !!on),
  onVoiceToggle: (cb) => {
    const l = () => cb()
    ipcRenderer.on('voice:toggle', l)
    return () => ipcRenderer.removeListener('voice:toggle', l)
  },
  onSpeechIdle: (cb) => {
    const l = () => cb()
    ipcRenderer.on('speech:idle', l)
    return () => ipcRenderer.removeListener('speech:idle', l)
  },
  onBrainDelta: (cb) => {
    const l = (_e, t) => cb(t)
    ipcRenderer.on('brain:delta', l)
    return () => ipcRenderer.removeListener('brain:delta', l)
  },
  setView: (v) => ipcRenderer.send('view:set', v),
  drag: {
    start: () => ipcRenderer.send('drag:start'),
    move: (dx, dy) => ipcRenderer.send('drag:move', { dx, dy }),
    end: () => ipcRenderer.send('drag:end')
  },
  notify: (kind, title, body) => ipcRenderer.send('notify', { kind, title, body })
})
