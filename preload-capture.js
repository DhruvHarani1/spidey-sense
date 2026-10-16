'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('capture', {
  onImage: (cb) => ipcRenderer.on('capture:image', (_e, url) => cb(url)),
  save: (dataUrl, name) => ipcRenderer.invoke('capture:save', dataUrl, name),
  close: () => ipcRenderer.send('capture:close')
})
