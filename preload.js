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
  notify: (kind, title, body) => ipcRenderer.send('notify', { kind, title, body })
})
