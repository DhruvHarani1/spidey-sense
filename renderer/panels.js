'use strict'
/* The panel's overlays (sense log, Daily Web, E.D.I.T.H., locker, Web Memory, tour) share one slot: opening one closes the others. */
;(function () {
  const IDS = ['slog', 'bugle', 'edith', 'locker', 'memory', 'tour']
  window.Panels = {
    IDS,
    closeOthers(keep) {
      for (const id of IDS) {
        const el = document.getElementById(id)
        if (el && id !== keep) el.hidden = true
      }
    }
  }
})()
