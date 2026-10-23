'use strict'
/* First-run tour: five short cards. Shows once, can be repeated any time ("tour" in the command box). */
;(function () {
  const KEY = 'spidey.tour'
  const $ = (id) => document.getElementById(id)
  const box = $('tour')
  const STEPS = [
    { title: 'THE WEB', text: 'Five spokes: CPU, RAM, DISK, BATTERY and NETWORK. The further a dot sits from the centre, the worse that reading. Green light = calm, yellow = alert, red shake = tingle.' },
    { title: 'SPIDER-SENSE', text: 'When something spikes I tingle and name the culprit. A bar appears with the program behind it and a TAKE DOWN button (it asks twice, and never touches system programs).' },
    { title: 'AUTO-SHIELD', text: 'I handle the safe things on my own: a runaway program gets its priority lowered, and a suspicious new auto-start entry gets blocked. Everything is in the SENSE LOG with an UNDO button. Tray → Auto-Shield switches it to "ask first" or off.' },
    { title: 'KAREN & MEMORY', text: 'Press Ctrl+Alt+K and type: "status", "what is eating my ram", "in 20m stretch", "am i safe". The 🕘 button shows the last 24 hours and what happened at the worst moments.' },
    { title: 'FIND ME', text: 'Click ▲ to fold me into the badge. Right-click the badge (or the tray spider) for every setting, the manual and updates. Suits unlock as you earn XP: tap ★.' }
  ]
  let i = 0

  function paint() {
    $('ttitle').textContent = `${i + 1}/${STEPS.length} · ${STEPS[i].title}`
    $('ttext').textContent = STEPS[i].text
    $('tnext').textContent = i === STEPS.length - 1 ? 'DONE' : 'NEXT'
  }
  function open() {
    window.Panels.closeOthers('tour')
    if (document.body.dataset.view !== 'panel') window.spidey.setView('panel')
    i = 0
    box.hidden = false
    paint()
  }
  function close() {
    box.hidden = true
    try {
      localStorage.setItem(KEY, 'done')
    } catch {
      /* ignore */
    }
  }
  $('tnext').addEventListener('click', () => {
    if (i >= STEPS.length - 1) close()
    else {
      i++
      paint()
    }
  })
  $('tskip').addEventListener('click', close)

  window.Tour = { open, close, STEPS }
  if (window.Core.test) window.__tour = { open, close, get hidden() { return box.hidden } }
  else if (localStorage.getItem(KEY) !== 'done') setTimeout(open, 2500)
})()
