'use strict'
/* Web-Capture: freeze the screen, drag a region, turn it into a comic panel, copy or save it. */
;(function () {
  const $ = (id) => document.getElementById(id)
  const stage = $('stage')
  const ctx = stage.getContext('2d')
  const hint = $('hint')
  const result = $('result')
  const panel = $('panel')
  const caption = $('caption')
  const msg = $('msg')

  let shot = null // the frozen screen
  let sel = null // {x, y, w, h} in CSS px
  let drag = null
  let cropped = null // ImageData-ready canvas of the comic-filtered region

  function size() {
    stage.width = innerWidth
    stage.height = innerHeight
    draw()
  }

  function draw() {
    ctx.clearRect(0, 0, stage.width, stage.height)
    if (!shot) return
    ctx.drawImage(shot, 0, 0, stage.width, stage.height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, stage.width, stage.height)
    if (sel && sel.w > 0 && sel.h > 0) {
      const k = shot.naturalWidth / stage.width
      ctx.drawImage(shot, sel.x * k, sel.y * k, sel.w * k, sel.h * k, sel.x, sel.y, sel.w, sel.h)
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ffd83a'
      ctx.setLineDash([10, 6])
      ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
      ctx.setLineDash([])
    }
  }

  const rectFrom = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

  stage.addEventListener('mousedown', (e) => {
    drag = { x: e.clientX, y: e.clientY }
    sel = null
    hint.hidden = true
  })
  stage.addEventListener('mousemove', (e) => {
    if (!drag) return
    sel = rectFrom(drag, { x: e.clientX, y: e.clientY })
    draw()
  })
  stage.addEventListener('mouseup', (e) => {
    if (!drag) return
    sel = rectFrom(drag, { x: e.clientX, y: e.clientY })
    drag = null
    if (sel.w < 24 || sel.h < 24) {
      sel = null
      hint.hidden = false
      draw()
      return
    }
    makePanel(sel)
  })

  function makePanel(r) {
    const k = shot.naturalWidth / stage.width
    let sw = Math.round(r.w * k)
    let sh = Math.round(r.h * k)
    // keep the filter fast: cap the long side at 2200 px
    const cap = 2200 / Math.max(sw, sh)
    const scale = cap < 1 ? cap : 1
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d')
    cx.drawImage(shot, r.x * k, r.y * k, sw, sh, 0, 0, w, h)
    const img = cx.getImageData(0, 0, w, h)
    window.Comic.apply(img.data, w, h)
    cx.putImageData(img, 0, 0)
    cropped = c
    stage.style.display = 'none'
    hint.hidden = true
    result.hidden = false
    render()
    caption.focus()
    caption.select()
  }

  /** frame + caption box + tag, around the filtered region */
  function render() {
    if (!cropped) return
    const pad = Math.max(14, Math.round(Math.min(cropped.width, cropped.height) / 40))
    const W = cropped.width + pad * 2
    const H = cropped.height + pad * 2
    panel.width = W
    panel.height = H
    const g = panel.getContext('2d')
    g.fillStyle = '#f4f1e6'
    g.fillRect(0, 0, W, H)
    g.drawImage(cropped, pad, pad)
    g.lineWidth = Math.max(4, pad / 3)
    g.strokeStyle = '#000'
    g.strokeRect(pad, pad, cropped.width, cropped.height)

    const text = (caption.value || '').trim().toUpperCase()
    if (text) {
      const fs = Math.max(26, Math.round(Math.min(cropped.width, cropped.height) / 11))
      g.font = `italic 900 ${fs}px 'Arial Black', Impact, sans-serif`
      const tw = g.measureText(text).width
      const bw = tw + fs
      const bh = fs * 1.5
      g.save()
      g.translate(pad + fs * 0.4, pad + fs * 0.4)
      g.rotate(-0.025)
      g.fillStyle = '#000'
      g.fillRect(fs * 0.12, fs * 0.12, bw, bh)
      g.fillStyle = '#ffd83a'
      g.fillRect(0, 0, bw, bh)
      g.lineWidth = Math.max(3, fs / 10)
      g.strokeStyle = '#000'
      g.strokeRect(0, 0, bw, bh)
      g.fillStyle = '#111'
      g.textBaseline = 'middle'
      g.fillText(text, fs / 2, bh / 2 + fs * 0.03)
      g.restore()
    }
    const tag = Math.max(12, Math.round(pad * 0.9))
    g.font = `italic 900 ${tag}px 'Arial Black', Impact, sans-serif`
    g.textAlign = 'right'
    g.fillStyle = '#000'
    g.fillText('SPIDEY SENSE', W - pad - 4, H - pad * 0.3)
  }

  const flash = (t) => {
    msg.textContent = t
    setTimeout(() => (msg.textContent = ''), 2200)
  }
  const dataUrl = () => panel.toDataURL('image/png')

  caption.addEventListener('input', render)
  caption.addEventListener('keydown', (e) => e.stopPropagation())
  function copyPanel() {
    return new Promise((resolve) => {
      panel.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          resolve(true)
        } catch {
          resolve(false)
        }
      }, 'image/png')
    })
  }
  $('copy').addEventListener('click', async () => flash((await copyPanel()) ? 'COPIED ✓' : 'COPY FAILED'))
  $('save').addEventListener('click', async () => flash((await window.capture.save(dataUrl(), `Comic-Panel-${Date.now()}.png`)) ? 'SAVED ✓' : ''))
  $('again').addEventListener('click', () => {
    result.hidden = true
    stage.style.display = ''
    hint.hidden = false
    sel = null
    cropped = null
    draw()
  })
  $('close').addEventListener('click', () => window.capture.close())
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.capture.close()
  })
  window.addEventListener('resize', size)

  window.capture.onImage((url) => {
    const img = new Image()
    img.onload = () => {
      shot = img
      size()
    }
    img.src = url
  })
  size()
})()
