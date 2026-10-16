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
  bugleCopy: (dataUrl) => ipcRenderer.invoke('bugle:copy', dataUrl),
  onOpenBugle: (cb) => {
    const l = () => cb()
    ipcRenderer.on('open-bugle', l)
    return () => ipcRenderer.removeListener('open-bugle', l)
  },
  setView: (v) => ipcRenderer.send('view:set', v),
  drag: {
    start: () => ipcRenderer.send('drag:start'),
    move: (dx, dy) => ipcRenderer.send('drag:move', { dx, dy }),
    end: () => ipcRenderer.send('drag:end')
  },
  notify: (kind, title, body) => ipcRenderer.send('notify', { kind, title, body })
})
