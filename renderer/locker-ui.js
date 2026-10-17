'use strict'
/* Suit locker overlay: level, XP bar and the suits you have unlocked. */
;(function () {
  const $ = (id) => document.getElementById(id)
  const box = $('locker')
  const list = $('suits')

  function render() {
    const s = window.Suits.state()
    $('lvl').textContent = `LEVEL ${s.level}  ·  ${s.xp} XP`
    const span = s.next - s.base
    $('xpfill').style.width = `${Math.min(100, Math.round(((s.xp - s.base) / span) * 100))}%`
    $('xptext').textContent = `${s.next - s.xp} XP TO LEVEL ${s.level + 1} — focus sessions +40, guardian alerts +10, daily web +15, E.D.I.T.H. scan +10, eye breaks and reminders +5`
    list.replaceChildren(
      ...window.Suits.SUITS.map((suit) => {
        const locked = suit.level > s.level
        const li = document.createElement('li')
        li.dataset.locked = locked ? '1' : '0'
        li.dataset.active = s.suit === suit.id ? '1' : '0'
        li.dataset.id = suit.id
        const sw = document.createElement('span')
        sw.className = 'sw'
        sw.style.background = `linear-gradient(120deg, ${suit.red} 0 50%, ${suit.blue} 50%)`
        const name = document.createElement('span')
        name.textContent = suit.name.toUpperCase()
        const tag = document.createElement('em')
        tag.textContent = locked ? `🔒 LV ${suit.level}` : s.suit === suit.id ? 'WORN' : 'EQUIP'
        li.append(sw, name, tag)
        li.addEventListener('click', () => {
          const r = window.Suits.equip(suit.id)
          if (!r.ok) window.Core.say(r.error)
          else window.Core.say(`SUIT ON: ${suit.name.toUpperCase()}.`)
        })
        return li
      })
    )
  }

  function open() {
    for (const id of ['slog', 'bugle', 'edith']) $(id).hidden = true
    if (document.body.dataset.view !== 'panel') window.spidey.setView('panel')
    box.hidden = false
    render()
  }
  const close = () => {
    box.hidden = true
  }

  window.Suits.onChange(() => {
    if (!box.hidden) render()
  })
  $('lockerbtn').addEventListener('click', () => (box.hidden ? open() : close()))
  $('lclose').addEventListener('click', close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
  window.spidey.onOpenLocker(open)
  window.Locker = { open, close }
  if (window.Core.test) window.__locker = { open, close }
})()
