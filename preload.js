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
  setView: (v) => ipcRenderer.send('view:set', v),
  drag: {
    start: () => ipcRenderer.send('drag:start'),
    move: (dx, dy) => ipcRenderer.send('drag:move', { dx, dy }),
    end: () => ipcRenderer.send('drag:end')
  },
  notify: (kind, title, body) => ipcRenderer.send('notify', { kind, title, body })
})
