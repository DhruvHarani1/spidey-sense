'use strict'
/* Per-day counters (local only) that feed the Daily Web front page. Keeps the last 14 days. */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null)
  else root.Day = factory(root.localStorage)
})(this, function (storage) {
  const PREFIX = 'spidey.day.'
  const KEEP_DAYS = 14

  const keyFor = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const blank = () => ({ n: {}, peak: {}, hog: null })

  let cache = null
  let cacheKey = ''
  let dirty = false
  let timer = null

  function load(key) {
    if (!storage) return blank()
    try {
      const v = JSON.parse(storage.getItem(PREFIX + key) || 'null')
      if (v && typeof v === 'object' && v.n && v.peak) return v
    } catch {
      /* corrupt: start fresh */
    }
    return blank()
  }

  function today() {
    const k = keyFor()
    if (k !== cacheKey) {
      flush()
      cacheKey = k
      cache = load(k)
      prune()
    }
    return cache
  }

  function flush() {
    if (!dirty || !storage || !cacheKey) return
    dirty = false
    try {
      storage.setItem(PREFIX + cacheKey, JSON.stringify(cache))
    } catch {
      /* storage full or unavailable */
    }
  }

  function touch() {
    dirty = true
    if (!timer && typeof setTimeout === 'function') {
      timer = setTimeout(() => {
        timer = null
        flush()
      }, 5000)
    }
  }

  function prune() {
    if (!storage) return
    try {
      const keys = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k && k.startsWith(PREFIX)) keys.push(k)
      }
      keys.sort().reverse()
      for (const k of keys.slice(KEEP_DAYS)) storage.removeItem(k)
    } catch {
      /* ignore */
    }
  }

  /** counter += n */
  function add(name, n = 1) {
    const d = today()
    d.n[name] = (d.n[name] || 0) + n
    touch()
  }

  /** remember the highest value seen (and what was going on at that moment) */
  function peak(name, value, hog) {
    const d = today()
    if (!Number.isFinite(value)) return
    if (value > (d.peak[name] || 0)) {
      d.peak[name] = value
      if (name === 'ram' && hog && hog.name) d.hog = { name: String(hog.name).slice(0, 40), mb: Number(hog.mb) || 0 }
      touch()
    }
  }

  const get = (key = keyFor()) => (key === cacheKey ? cache : load(key))

  if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush)
  return { add, peak, get, today, flush, keyFor }
})
