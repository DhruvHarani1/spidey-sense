'use strict'
/* Guardian + Auto-Shield feed: shows what the spider-sense noticed and what Shield did about it. Click the status light to open the log. */
;(function () {
  const KEY = 'spidey.guardian.log'
  const MAX = 40
  const $ = (id) => document.getElementById(id)
  const slog = $('slog')
  const sitems = $('sitems')
  const LABEL = { net: 'NEW CONTACT', startup: 'AUTO-START', hosts: 'HOSTS FILE', drive: 'NEW DRIVE', port: 'NEW DOOR', disk: 'DISK', shield: 'SHIELD' }

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

  function button(label, onClick) {
    const b = document.createElement('button')
    b.className = 'act'
    b.textContent = label
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation()
      b.disabled = true
      await onClick(b)
    })
    return b
  }

  async function doUndo(e, b) {
    const r = await window.spidey.shieldUndo(e.id)
    if (r && r.ok) {
      e.undo = false
      e.text += ' (undone)'
      save()
      render()
      window.Core.say('UNDONE.')
    } else {
      b.disabled = false
      window.Core.say(String((r && r.error) || 'COULD NOT UNDO').toUpperCase())
    }
  }

  async function doOffer(e, b) {
    const r = await window.spidey.shieldDo(e.offer.id)
    if (r && r.ok) {
      e.offer = null
      save()
      render()
      window.Core.say(String(r.text || 'DONE.').toUpperCase())
    } else {
      b.disabled = false
      window.Core.say(String((r && r.error) || 'COULD NOT DO THAT').toUpperCase())
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
            if (e.undo && e.id) li.append(button('UNDO', (b) => doUndo(e, b)))
            else if (e.offer && e.offer.id) li.append(button(String(e.offer.label || 'DO IT').toUpperCase(), (b) => doOffer(e, b)))
            return li
          })
        : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'NOTHING LURKING. SENSE IS QUIET.' })])
    )
    window.Core.setUnread('guardian', unread)
  }

  function onEvent(e) {
    if (!e || typeof e.text !== 'string') return
    const entry = { kind: String(e.kind || ''), text: e.text.slice(0, 220), at: Number(e.at) || Date.now() }
    if (e.id) entry.id = String(e.id).slice(0, 40)
    if (e.undo) entry.undo = true
    if (e.offer && e.offer.id) entry.offer = { id: String(e.offer.id).slice(0, 40), label: String(e.offer.label || '').slice(0, 30) }
    log.unshift(entry)
    log = log.slice(0, MAX)
    save()
    unread++
    window.Day.add(e.kind === 'shield' ? 'shield' : 'guardian')
    if (e.kind === 'shield' && e.act && e.act !== 'warn') {
      window.Day.add('shield:' + e.act)
      if (window.Badge) window.Badge.shieldShot()
      window.Suits.award('defend')
    } else window.Suits.award('guardian')
    window.WebMemory.mark(e.kind === 'shield' ? 'shield' : 'guardian', e.text)
    render()
    window.Core.fireNote(`${e.kind === 'shield' ? 'SPIDEY SHIELD' : 'SPIDEY-SENSE'}: ${e.text.toUpperCase()}`, `guardian:${e.kind}`)
  }

  function toggle(open) {
    const show = open ?? slog.hidden
    if (show) window.Panels.closeOthers('slog')
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

  window.Guardian = {
    lastUndoable: () => log.find((e) => e.undo && e.id) || null,
    markUndone(id) {
      const e = log.find((x) => x.id === id)
      if (e) {
        e.undo = false
        e.text += ' (undone)'
        save()
        render()
      }
    }
  }
  window.spidey.onGuardian(onEvent)
  render()
  if (window.Core.test) window.__guardian = { onEvent, toggle, get log() { return log }, get unread() { return unread } }
})()
