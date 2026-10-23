'use strict'
/*
 * Web Memory: the last 24 hours of CPU / RAM, one point per minute, plus what was going on at the worst moments.
 * Pure data structure (unit-tested); the browser glue at the bottom keeps it in localStorage and feeds it from the live readings.
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null)
  else root.WebMemory = factory(root)
})(this, function (win) {
  const MINUTE = 60000
  const KEEP_MIN = 24 * 60
  const MAX_EVENTS = 150

  const r1 = (n) => Math.round(n * 10) / 10

  /** @param {{keepMin?:number}} [opts] */
  function create(opts = {}) {
    const keep = opts.keepMin || KEEP_MIN
    /** @type {{t:number,n:number,c:number,cm:number,r:number,rm:number,hog:string,mb:number,lat:number}[]} */
    let b = [] // one bucket per minute; c/r are SUMS (divide by n); cm/rm are the maxima
    let e = [] // marked events: tingles, shield actions
    const bucketT = (ms) => Math.floor(ms / MINUTE) * MINUTE

    function prune(nowMs) {
      const min = bucketT(nowMs) - keep * MINUTE
      while (b.length && b[0].t < min) b.shift()
      while (e.length && e[0].at < min) e.shift()
    }

    return {
      /** @param {{cpu:number, ram:number, latencyMs?:number|null, hog?:{name:string,mb:number}|null}} s */
      push(s, nowMs = Date.now()) {
        if (!s || !Number.isFinite(s.cpu) || !Number.isFinite(s.ram)) return
        const t = bucketT(nowMs)
        let cur = b[b.length - 1]
        if (!cur || cur.t !== t) {
          cur = { t, n: 0, c: 0, cm: 0, r: 0, rm: 0, hog: '', mb: 0, lat: 0 }
          b.push(cur)
          prune(nowMs)
        }
        cur.n++
        cur.c += s.cpu
        cur.r += s.ram
        if (s.cpu > cur.cm) cur.cm = s.cpu
        if (s.ram >= cur.rm) {
          cur.rm = s.ram
          if (s.hog && s.hog.name) {
            cur.hog = String(s.hog.name).slice(0, 30)
            cur.mb = Number(s.hog.mb) || 0
          }
        }
        if (Number.isFinite(s.latencyMs) && s.latencyMs > cur.lat) cur.lat = s.latencyMs
      },
      /** remember something that happened (a tingle, a Shield action) */
      mark(kind, text, nowMs = Date.now()) {
        e.push({ at: nowMs, kind: String(kind).slice(0, 12), text: String(text).slice(0, 120) })
        if (e.length > MAX_EVENTS) e.shift()
        prune(nowMs)
      },
      /** points for drawing: [{t, cpu, ram, cpuMax, ramMax}] oldest first */
      series() {
        return b.map((x) => ({ t: x.t, cpu: r1(x.c / x.n), ram: r1(x.r / x.n), cpuMax: r1(x.cm), ramMax: r1(x.rm) }))
      },
      /** the bucket closest to a time, or null (within 3 minutes) */
      at(ms) {
        let best = null
        for (const x of b) if (!best || Math.abs(x.t - ms) < Math.abs(best.t - ms)) best = x
        if (!best || Math.abs(best.t - ms) > 3 * MINUTE) return null
        const near = e.filter((ev) => Math.abs(ev.at - best.t - MINUTE / 2) <= 2 * MINUTE)
        return { t: best.t, cpu: r1(best.c / best.n), cpuMax: r1(best.cm), ram: r1(best.r / best.n), ramMax: r1(best.rm), hog: best.hog, mb: best.mb, lat: Math.round(best.lat), events: near.map((x) => x.text) }
      },
      /**
       * The worst moments of the window, at least `gapMin` minutes apart.
       * RAM counts only when it jumped above this PC's usual level (RAM sits high on most PCs).
       */
      worst(n = 3, gapMin = 20) {
        if (b.length < 2) return []
        const sorted = b.map((x) => x.r / x.n).sort((p, q) => p - q)
        const usual = sorted[Math.floor(sorted.length / 2)]
        const cand = []
        for (const x of b) {
          const ramJump = x.rm - usual
          if (x.cm >= 70) cand.push({ t: x.t, kind: 'cpu', value: r1(x.cm), score: x.cm, hog: x.hog })
          if (ramJump >= 4) cand.push({ t: x.t, kind: 'ram', value: r1(x.rm), score: 60 + ramJump, hog: x.hog, mb: x.mb })
        }
        cand.sort((p, q) => q.score - p.score)
        const out = []
        for (const c of cand) {
          if (out.every((o) => Math.abs(o.t - c.t) >= gapMin * MINUTE)) out.push(c)
          if (out.length >= n) break
        }
        return out.sort((p, q) => p.t - q.t)
      },
      events: () => e.slice(),
      get size() {
        return b.length
      },
      toJSON: () => ({ v: 1, b, e }),
      load(obj) {
        if (!obj || obj.v !== 1 || !Array.isArray(obj.b) || !Array.isArray(obj.e)) return false
        const ok = (x) => x && Number.isFinite(x.t) && Number.isFinite(x.n) && x.n > 0 && Number.isFinite(x.c) && Number.isFinite(x.r) && Number.isFinite(x.cm) && Number.isFinite(x.rm)
        b = obj.b.filter(ok).map((x) => ({ t: x.t, n: x.n, c: x.c, cm: x.cm, r: x.r, rm: x.rm, hog: String(x.hog || '').slice(0, 30), mb: Number(x.mb) || 0, lat: Number(x.lat) || 0 }))
        e = obj.e.filter((x) => x && Number.isFinite(x.at) && typeof x.text === 'string').map((x) => ({ at: x.at, kind: String(x.kind || ''), text: x.text.slice(0, 120) }))
        prune(Date.now())
        return true
      }
    }
  }

  const api = { create, KEEP_MIN }
  if (!win || !win.document) return api

  // ---- browser glue: one shared history, saved every two minutes
  const KEY = 'spidey.memory'
  const mem = create()
  try {
    mem.load(JSON.parse(win.localStorage.getItem(KEY) || 'null'))
  } catch {
    /* start empty */
  }
  const save = () => {
    try {
      win.localStorage.setItem(KEY, JSON.stringify(mem))
    } catch {
      /* storage full: skip this round */
    }
  }
  setInterval(save, 2 * MINUTE)
  win.addEventListener('beforeunload', save)
  return Object.assign(mem, { create, KEEP_MIN, save })
})
