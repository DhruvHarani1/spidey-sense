'use strict'
/* E.D.I.T.H. overlay: runs the read-only security scan in the main process and shows the result. */
;(function () {
  const $ = (id) => document.getElementById(id)
  const box = $('edith')
  const ICON = { ok: '✔', warn: '⚠', bad: '✖', unknown: '?' }
  const LEVEL = { green: 'THREAT LEVEL: GREEN', amber: 'THREAT LEVEL: AMBER', red: 'THREAT LEVEL: RED' }
  let last = null
  let scanning = null

  function paint(r) {
    $('escore').textContent = r ? String(r.score) : '–'
    $('elevel').textContent = r ? LEVEL[r.level] : 'SCANNING…'
    $('eflag').dataset.level = r ? r.level : 'green'
    $('echecks').replaceChildren(
      ...(r ? r.checks : []).map((c) => {
        const li = document.createElement('li')
        li.dataset.s = c.status
        const i = document.createElement('i')
        i.textContent = ICON[c.status] || '?'
        const b = document.createElement('b')
        b.textContent = c.label.toUpperCase()
        const s = document.createElement('span')
        s.textContent = c.detail
        li.append(i, b, s)
        return li
      })
    )
  }

  /** @returns {Promise<{score:number, level:string, checks:any[]}|null>} */
  function scan() {
    if (scanning) return scanning
    paint(null)
    scanning = window.spidey
      .edithScan()
      .then((r) => {
        last = r
        if (r) window.Suits.award('edith')
        paint(r)
        return r
      })
      .catch(() => null)
      .finally(() => {
        scanning = null
      })
    return scanning
  }

  function open() {
    $('slog').hidden = true
    $('bugle').hidden = true
    box.hidden = false
    if (document.body.dataset.view !== 'panel') window.spidey.setView('panel')
    return scan()
  }
  const close = () => {
    box.hidden = true
  }

  /** Karen-friendly one-liner */
  function summary(r) {
    if (!r) return 'MY SCANNERS ARE OFFLINE. TRY AGAIN.'
    const bad = r.checks.filter((c) => c.status === 'bad' || c.status === 'warn')
    if (!bad.length) return `THREAT LEVEL ${r.level.toUpperCase()} — ${r.score}/100. ALL CLEAR.`
    return `THREAT LEVEL ${r.level.toUpperCase()} — ${r.score}/100. ${bad[0].detail.toUpperCase()}${bad.length > 1 ? ` (+${bad.length - 1} MORE)` : ''}`
  }

  $('erescan').addEventListener('click', scan)
  $('eclose').addEventListener('click', close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
  window.spidey.onOpenEdith(open)
  window.Edith = { open, scan, summary, get last() { return last } }
  if (window.Core.test) window.__edith = { open, close }
})()
