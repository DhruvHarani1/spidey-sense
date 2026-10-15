'use strict'
// Renders the spider emblem to assets/icon.png (256px). Run: npm run icons
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 256, height: 256, transparent: true, frame: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,<body style="margin:0;background:transparent"><canvas id=c width=256 height=256></canvas>')
  const spiderSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'spider.js'), 'utf8')
  await win.webContents.executeJavaScript(spiderSrc)
  await win.webContents.executeJavaScript(`(() => {
    const c = document.getElementById('c'); const x = c.getContext('2d')
    const g = x.createRadialGradient(100, 96, 14, 128, 128, 120)
    g.addColorStop(0, '#ff5a5a'); g.addColorStop(1, '#a50f1a')
    x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2); x.fillStyle = g; x.fill()
    x.lineWidth = 12; x.strokeStyle = '#05060d'; x.stroke()
    window.Spider.drawSpider(x, 128, 128, 88)
  })()`)
  const img = await win.webContents.capturePage()
  fs.mkdirSync(path.join(__dirname, '..', 'assets'), { recursive: true })
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), img.toPNG())
  console.log('icon written', img.getSize())
  app.quit()
})
