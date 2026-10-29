'use strict'

const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function record(baseline, hour, ram) {
  const next = Array.isArray(baseline) ? baseline.map((values) => Array.isArray(values) ? values.slice(-59) : []) : []
  while (next.length < 24) next.push([])
  if (Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isFinite(ram)) {
    next[hour].push(ram)
    if (next[hour].length > 60) next[hour].shift()
  }
  return next
}

function baselineFor(baseline, hour) {
  if (!Array.isArray(baseline)) return null
  const sameHour = Number.isInteger(hour) && Array.isArray(baseline[hour]) ? median(baseline[hour]) : null
  return sameHour == null ? median(baseline.flatMap((values) => Array.isArray(values) ? values : [])) : sameHour
}

function createStore(storage, key) {
  let baseline = []
  try { baseline = JSON.parse(storage.getItem(key) || '[]') } catch {}
  return {
    reference(hour, history) {
      const saved = baselineFor(baseline, hour)
      return saved == null ? (history.length >= 30 ? median(history) : null) : saved
    },
    record(hour, ram) {
      baseline = record(baseline, hour, ram)
      try { storage.setItem(key, JSON.stringify(baseline)) } catch {}
    }
  }
}

function createRamAlert(store, settings, history, getHour) {
  return function ramAlert(ram) {
    history.push(ram)
    if (history.length > 600) history.shift()
    const mode = settings.ramMode
    if (mode === 'off') return 0
    if (mode === 'auto') {
      const hour = getHour()
      const reference = store.reference(hour, history)
      store.record(hour, ram)
      if (reference == null) return 0
      const spike = ram - reference
      return spike >= 6 ? 92 : spike >= 3 ? 78 : 0
    }
    const threshold = Number(mode) || 90
    return ram >= threshold + (100 - threshold) / 2 ? 92 : ram >= threshold ? 78 : 0
  }
}

module.exports = { baselineFor, record, createStore, createRamAlert }
