'use strict'
/* "THWIP" reminders: type "in 20m stretch" or "at 15:30 call mum"; the widget tingles when it is due. */
;(function () {
  const KEY = 'spidey.reminders'
  const MAX = 6
  const $ = (id) => document.getElementById(id)
  const input = $('rin')
  const list = $('rlist')
  const UNIT = { s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hr: 3600000, hrs: 3600000 }

  /** @returns {{due:number,text:string}|null} */
  function parse(raw, now = Date.now()) {
    const s = raw.trim()
    let m = s.match(/^(?:in\s+)?(\d+)\s*(s|sec|m|min|h|hr|hrs)\b\s*(.*)$/i)
    if (m) {
      const due = now + Number(m[1]) * UNIT[m[2].toLowerCase()]
      return { due, text: m[3].trim() || 'Time’s up!' }
    }
    m = s.match(/^at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b\s*(.*)$/i)
    if (m) {
      let h = Number(m[1])
      const min = Number(m[2] || 0)
      const ap = (m[3] || '').toLowerCase()
      if (ap === 'pm' && h < 12) h += 12
      if (ap === 'am' && h === 12) h = 0
      if (h > 23 || min > 59) return null
      const d = new Date(now)
      d.setHours(h, min, 0, 0)
      if (d.getTime() <= now) d.setDate(d.getDate() + 1)
      return { due: d.getTime(), text: m[4].trim() || 'Time’s up!' }
    }
    return null
  }

  let items = []
  try {
    items = JSON.parse(localStorage.getItem(KEY) || '[]').filter((r) => r && Number.isFinite(r.due) && typeof r.text === 'string')
  } catch {
    items = []
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* storage unavailable */
    }
  }

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000))
    if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
    if (s >= 60) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`
    return `${s}s`
  }

  function render() {
    const now = Date.now()
    const sorted = [...items].sort((a, b) => a.due - b.due)
    list.replaceChildren(
      ...sorted.map((r) => {
        const li = document.createElement('li')
        const t = document.createElement('span')
        t.className = 'r-text'
        t.textContent = r.text
        const c = document.createElement('em')
        c.textContent = fmt(r.due - now)
        const x = document.createElement('button')
        x.className = 'r-del'
        x.textContent = '✕'
        x.title = 'Cancel reminder'
        x.setAttribute('aria-label', `Cancel reminder: ${r.text}`)
        x.addEventListener('click', () => {
          items = items.filter((i) => i !== r)
          save()
          render()
        })
        li.append(t, c, x)
        return li
      })
    )
  }

  function add(raw) {
    const p = parse(raw)
    if (!p || items.length >= MAX) {
      input.classList.remove('bad')
      void input.offsetWidth // restart the shake
      input.classList.add('bad')
      input.placeholder = p ? 'TOO MANY WEBS (6 MAX)' : 'TRY: in 20m stretch · at 15:30 call'
      return false
    }
    items.push({ id: Math.random().toString(36).slice(2), ...p })
    save()
    render()
    return true
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter' && input.value.trim()) {
      if (add(input.value)) input.value = ''
    }
  })
  input.addEventListener('input', () => input.classList.remove('bad'))

  setInterval(() => {
    const now = Date.now()
    const due = items.filter((r) => r.due <= now)
    if (due.length) {
      items = items.filter((r) => r.due > now)
      save()
      window.Core.fireNote(`THWIP! ${due.map((r) => r.text).join(' · ').toUpperCase()}`, `remind:${due[0].id}`)
    }
    if (document.body.dataset.view === 'panel' || due.length) render()
  }, 1000)
  render()

  window.spidey.onFocusRemind(() => {
    input.focus()
    input.select()
  })

  if (window.Core.test) window.__reminders = { parse, add, get items() { return items } }
})()
