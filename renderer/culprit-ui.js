'use strict'
/*
 * The culprit bar: when the web is alert or tingling because of memory or CPU, name the program behind it and offer to end it.
 * Ending a program always takes two clicks, and protected system programs never show up here.
 */
;(function () {
  const $ = (id) => document.getElementById(id)
  const bar = $('culprit')
  const text = $('ctext')
  const btn = $('cgo')
  let data = null
  let target = null // what the button would end: {pid, name}
  let armedUntil = 0

  const gb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`)

  function refresh() {
    const level = document.getElementById('panel').dataset.level
    const axis = window.Core.hotAxis()
    let t = null
    let label = ''
    if (data && level !== 'calm') {
      if (axis === 'ram' && data.mem) {
        t = { pid: data.mem.pid, name: data.mem.name }
        label = `${data.mem.name.toUpperCase()} · ${gb(data.mem.mb)}${data.mem.count > 1 ? ` · ${data.mem.count} PROCESSES` : ''}`
      } else if (axis === 'cpu' && data.cpu) {
        t = { pid: data.cpu.pid, name: data.cpu.name }
        label = `${data.cpu.name.toUpperCase()} · ${Math.round(data.cpu.share * 100)}% OF THE CPU${data.cpu.count > 1 ? ` · ${data.cpu.count} PROCESSES` : ''}`
      }
    }
    target = t
    bar.hidden = !t
    if (t) {
      text.textContent = label
      btn.textContent = armedUntil > Date.now() ? 'SURE? CLICK AGAIN' : 'TAKE DOWN'
      btn.dataset.armed = armedUntil > Date.now() ? '1' : '0'
    }
  }

  btn.addEventListener('click', async () => {
    if (!target) return
    if (armedUntil < Date.now()) {
      armedUntil = Date.now() + 4000
      refresh()
      setTimeout(refresh, 4100)
      return
    }
    armedUntil = 0
    const t = target
    const r = await window.spidey.shieldTakeDown(t.pid)
    if (r && r.ok) {
      window.Day.add('shield:takedown')
      window.Suits.award('defend')
      window.Core.say(`DONE. ${t.name.toUpperCase()} ENDED.`)
    } else window.Core.say(String((r && r.error) || 'COULD NOT END IT').toUpperCase())
    refresh()
  })

  window.spidey.onCulprit((c) => {
    data = c
    refresh()
  })
  setInterval(refresh, 1000)
  window.Culprit = { refresh, get target() { return target } }
  if (window.Core.test) window.__culprit = { set: (c) => ((data = c), refresh()), refresh, get hidden() { return bar.hidden }, get text() { return text.textContent } }
})()
