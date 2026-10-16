'use strict'
/*
 * Suit Locker: XP for healthy habits unlocks new colour schemes ("suits") for the widget.
 * Alert colours (yellow / red) never change with a suit, so warnings always look like warnings.
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null)
  else root.Suits = factory(root)
})(this, function (win) {
  const SUITS = [
    { id: 'classic', name: 'Classic', level: 1, red: '#d4202a', blue: '#1d3fd8', navy: '#0a1131', navyHi: '#1b2a78', hi: '#ff5a5a', lo: '#a50f1a', line: '#ff3b3b', vert: '#4a7bff' },
    { id: 'midnight', name: 'Midnight', level: 2, red: '#4a5070', blue: '#14182a', navy: '#06070c', navyHi: '#1a1f35', hi: '#8a93bd', lo: '#171b2c', line: '#c9d2ff', vert: '#c9d2ff' },
    { id: 'gold', name: 'Gold Armor', level: 3, red: '#b5121b', blue: '#8a5a00', navy: '#1c0a08', navyHi: '#4a2410', hi: '#ffd34d', lo: '#a8610a', line: '#ffb300', vert: '#ffd83a' },
    { id: 'neon', name: 'Neon Noir', level: 4, red: '#009e92', blue: '#5a14d9', navy: '#05040f', navyHi: '#1a1050', hi: '#19ffe1', lo: '#006b70', line: '#19ffe1', vert: '#ff3df2' },
    { id: 'pop', name: 'Pop Art', level: 5, red: '#e6007e', blue: '#2a1fd0', navy: '#16004d', navyHi: '#3a0e8a', hi: '#ff6ec7', lo: '#a1005a', line: '#ff4db8', vert: '#00e0ff' },
    { id: 'prism', name: 'Prism', level: 7, red: '#7c3aed', blue: '#db2777', navy: '#0b1020', navyHi: '#1e1b4b', hi: '#a78bfa', lo: '#4c1d95', line: '#22d3ee', vert: '#f59e0b' }
  ]

  /** XP per action. `daily: true` means it only counts once per day. */
  const XP = {
    focus: { xp: 40 },
    eye: { xp: 5 },
    remind: { xp: 5 },
    guardian: { xp: 10 },
    bugle: { xp: 15, daily: true },
    edith: { xp: 10, daily: true }
  }

  const levelFor = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1
  const xpAt = (level) => 50 * (level - 1) * (level - 1)
  const unlocked = (level) => SUITS.filter((s) => s.level <= level)
  const byId = (id) => SUITS.find((s) => s.id === id)

  /** match "equip neon", "wear gold armor", "midnight suit" … */
  function findSuit(text) {
    const t = String(text || '').toLowerCase()
    return SUITS.find((s) => t.includes(s.id) || t.includes(s.name.toLowerCase()))
  }

  // ---- state (pure; persisted by the browser glue below)
  function fresh() {
    return { xp: 0, suit: 'classic', daily: {} }
  }

  /** @returns {{gained:number, levelUp:null|{level:number, suits:object[]}}} */
  function award(state, kind, dayKey) {
    const rule = XP[kind]
    if (!rule) return { gained: 0, levelUp: null }
    if (rule.daily) {
      if (state.daily[kind] === dayKey) return { gained: 0, levelUp: null }
      state.daily[kind] = dayKey
    }
    const before = levelFor(state.xp)
    state.xp += rule.xp
    const after = levelFor(state.xp)
    const levelUp = after > before ? { level: after, suits: SUITS.filter((s) => s.level > before && s.level <= after) } : null
    return { gained: rule.xp, levelUp }
  }

  function equip(state, id) {
    const s = byId(id)
    if (!s) return { ok: false, error: 'NO SUCH SUIT.' }
    if (s.level > levelFor(state.xp)) return { ok: false, error: `${s.name.toUpperCase()} UNLOCKS AT LEVEL ${s.level}.` }
    state.suit = s.id
    return { ok: true, suit: s }
  }

  // ---- browser glue
  const api = { SUITS, XP, levelFor, xpAt, unlocked, byId, findSuit, fresh, award, equip }
  if (!win || !win.document) return api

  const KEY = 'spidey.suits'
  let state = fresh()
  try {
    const v = JSON.parse(win.localStorage.getItem(KEY) || 'null')
    if (v && Number.isFinite(v.xp) && byId(v.suit)) state = { ...fresh(), ...v }
  } catch {
    /* start fresh */
  }
  const save = () => {
    try {
      win.localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }
  const dayKey = () => new Date().toDateString()

  function apply() {
    const s = byId(state.suit) || SUITS[0]
    const st = win.document.documentElement.style
    st.setProperty('--red', s.red)
    st.setProperty('--blue', s.blue)
    st.setProperty('--navy', s.navy)
    st.setProperty('--navy-hi', s.navyHi)
    st.setProperty('--suit-hi', s.hi)
    st.setProperty('--suit-lo', s.lo)
    if (win.Spider && win.Spider.setPalette) win.Spider.setPalette({ hi: s.hi, lo: s.lo, line: s.line, vert: s.vert })
    win.document.body.dataset.suit = s.id
    if (win.Core && win.Core.repaint) win.Core.repaint()
  }

  const listeners = []
  api.onChange = (fn) => listeners.push(fn)
  const changed = () => listeners.forEach((fn) => fn())

  api.state = () => ({ ...state, level: levelFor(state.xp), next: xpAt(levelFor(state.xp) + 1), base: xpAt(levelFor(state.xp)) })
  api.award = (kind) => {
    const r = award(state, kind, dayKey())
    if (r.gained) {
      save()
      changed()
    }
    if (r.levelUp && win.Core && win.Core.fireNote) {
      const names = r.levelUp.suits.map((s) => s.name.toUpperCase())
      win.Core.fireNote(`LEVEL UP! LEVEL ${r.levelUp.level}${names.length ? ` — NEW SUIT: ${names.join(', ')}` : ''}`, 'level')
    }
    return r
  }
  api.equip = (id) => {
    const r = equip(state, id)
    if (r.ok) {
      save()
      apply()
      changed()
    }
    return r
  }
  api.apply = apply
  win.addEventListener('DOMContentLoaded', apply)
  if (win.document.readyState !== 'loading') apply()
  return api
})
