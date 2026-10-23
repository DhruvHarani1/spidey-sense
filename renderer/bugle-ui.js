'use strict'
/* Overlay that shows today's Daily Web front page, with Save / Copy. */
;(function () {
  const $ = (id) => document.getElementById(id)
  const box = $('bugle')
  const paper = $('bpaper')

  function open() {
    const day = window.Day.today()
    const composed = window.Bugle.compose(day)
    window.Suits.award('bugle')
    window.Bugle.render(paper, composed, day)
    window.Panels.closeOthers('bugle')
    box.hidden = false
    if (document.body.dataset.view !== 'panel') window.spidey.setView('panel')
    return composed
  }
  const close = () => {
    box.hidden = true
  }
  const stamp = () => window.Day.keyFor()

  $('bclose').addEventListener('click', close)
  $('bsave').addEventListener('click', async () => {
    const r = await window.spidey.bugleSave(paper.toDataURL('image/png'), `Daily-Web-${stamp()}.png`)
    if (r && r.ok) window.Core.say('FRONT PAGE SAVED. STOP THE PRESSES!')
  })
  $('bcopy').addEventListener('click', async () => {
    const ok = await new Promise((resolve) => {
      paper.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          resolve(true)
        } catch {
          resolve(false)
        }
      }, 'image/png')
    })
    window.Core.say(ok ? 'COPIED. GO PASTE THE NEWS.' : 'COULDN’T COPY THAT ONE.')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
  window.addEventListener('spidey:bugle', open)
  window.spidey.onOpenBugle(open)
  if (window.Core.test) window.__bugle = { open, close, paper }
})()
