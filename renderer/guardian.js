'use strict'
/* Guardian feed: shows what the spider-sense noticed. Click the status light to open the log. */
;(function () {
  const KEY = 'spidey.guardian.log'
  const MAX = 40
  const $ = (id) => document.getElementById(id)
  const slog = $('slog')
  const sitems = $('sitems')
  const balert = $('balert')
  const LABEL = { net: 'NEW CONTACT', startup: 'AUTO-START', hosts: 'HOSTS FILE', drive: 'NEW DRIVE' }

  let log = []
  try {
    log = JSON.parse(localStorage.getItem(KEY) || '[]').filter((e) => e && typeof e.text === 'string')
  } catch {
    log = []
  }
  let unread = 0
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(log.slice(0, MAX)))
    } catch {
      /* ignore */
    }
  }

  function render() {
    sitems.replaceChildren(
      ...(log.length
        ? log.slice(0, MAX).map((e) => {
            const li = document.createElement('li')
            const tag = document.createElement('b')
            tag.textContent = LABEL[e.kind] || 'ALERT'
            const t = document.createElement('span')
            t.textContent = e.text
            const when = document.createElement('em')
            when.textContent = new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            li.append(tag, t, when)
            return li
          })
        : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'NOTHING LURKING. SENSE IS QUIET.' })])
    )
    balert.hidden = unread === 0
    balert.textContent = unread > 9 ? '9+' : String(unread)
  }

  function onEvent(e) {
    if (!e || typeof e.text !== 'string') return
    log.unshift({ kind: String(e.kind || ''), text: e.text.slice(0, 160), at: Number(e.at) || Date.now() })
    log = log.slice(0, MAX)
    save()
    unread++
    render()
    window.Core.fireNote(`SPIDEY-SENSE: ${e.text.toUpperCase()}`, `guardian:${e.kind}`)
  }

  function toggle(open) {
    const show = open ?? slog.hidden
    slog.hidden = !show
    if (show) {
      unread = 0
      render()
    }
  }
  $('led').addEventListener('click', () => toggle())
  $('led').style.cursor = 'pointer'
  $('sclose').addEventListener('click', () => toggle(false))
  $('sclear').addEventListener('click', () => {
    log = []
    save()
    render()
  })
  // badge: a click on it opens the panel, and the log shows pending items
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggle(false)
  })

  window.spidey.onGuardian(onEvent)
  render()
  if (window.Core.test) window.__guardian = { onEvent, toggle, get log() { return log }, get unread() { return unread } }
})()
