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
    { id: 'miles', name: 'Miles', level: 6, red: '#e11d48', blue: '#111827', navy: '#05050a', navyHi: '#1f1f2e', hi: '#ff3355', lo: '#7a0a22', line: '#ff2d55', vert: '#a855f7' },
    { id: 'prism', name: 'Prism', level: 7, red: '#7c3aed', blue: '#db2777', navy: '#0b1020', navyHi: '#1e1b4b', hi: '#a78bfa', lo: '#4c1d95', line: '#22d3ee', vert: '#f59e0b' },
    { id: 'noir', name: 'Noir', level: 9, red: '#6b7280', blue: '#1f2937', navy: '#050505', navyHi: '#202020', hi: '#d1d5db', lo: '#374151', line: '#e5e7eb', vert: '#9ca3af' },
    { id: 'spider2099', name: 'Spider-2099', level: 11, red: '#c026d3', blue: '#0ea5e9', navy: '#070324', navyHi: '#1b0f5c', hi: '#f0abfc', lo: '#6b21a8', line: '#38bdf8', vert: '#f472b6' },
    { id: 'iron', name: 'Iron Spider', level: 13, red: '#b91c1c', blue: '#a16207', navy: '#1a0505', navyHi: '#3d1010', hi: '#fbbf24', lo: '#7f1d1d', line: '#f59e0b', vert: '#fde68a' }
  ]

  /** XP per action. `daily: true` means it only counts once per day; `cap: n` means at most n times per day. */
  const XP = {
    focus: { xp: 40 },
    eye: { xp: 5 },
    remind: { xp: 5 },
    guardian: { xp: 10 },
    bugle: { xp: 15, daily: true },
    edith: { xp: 10, daily: true },
    defend: { xp: 15, cap: 4 }, // Auto-Shield acted, or you ended a hog: defending the PC
    clean: { xp: 20, daily: true } // E.D.I.T.H. found nothing wrong
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
    return { xp: 0, suit: 'classic', daily: {}, counts: {} }
  }

  /** @returns {{gained:number, levelUp:null|{level:number, suits:object[]}}} */
  function award(state, kind, dayKey) {
    const rule = XP[kind]
    if (!rule) return { gained: 0, levelUp: null }
    if (rule.daily) {
      if (state.daily[kind] === dayKey) return { gained: 0, levelUp: null }
      state.daily[kind] = dayKey
    }
    if (rule.cap) {
      state.counts = state.counts || {}
      const c = state.counts[kind] && state.counts[kind].day === dayKey ? state.counts[kind] : { day: dayKey, n: 0 }
      if (c.n >= rule.cap) return { gained: 0, levelUp: null }
      c.n++
      state.counts[kind] = c
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
