'use strict'
/*
 * Karen: the suit AI. Type (or Ctrl+Alt+K anywhere) and ask in plain words.
 * Layer 1 is a fast offline rule engine (this file's interpret()). Anything it does not understand
 * is handed to a local open-source model through Ollama when one is installed (see karen-llm.js).
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.KarenCore = factory()
})(this, function () {
  const pct = (n) => `${Math.round(n)}%`
  const fmtUp = (s) => {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  }

  const HELP =
    'TRY: "status", "cpu?", "what is eating my ram", "in 20m stretch", "at 3pm call mum", "start focus", "break", "mute", "kill chrome", "collapse".'

  /** Reminder phrases: "remind me to X in 10 minutes" / "remind me in 10m to X" → "in 10m X" */
  function normaliseReminder(text) {
    let s = text.trim().replace(/^(?:please\s+)?(?:remind me|set (?:a )?reminder|reminder)\s*(?:to\s+|about\s+)?/i, '')
    const timeFirst = /^(in\s+\d+\s*\w+|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to\s+|about\s+)?(.*)$/i.exec(s)
    if (timeFirst) return `${timeFirst[1]} ${timeFirst[2]}`.trim()
    // trailing form: "drink water in 10 minutes" / "call mum at 3pm"
    const tail = /^(.*?)\s+(in\s+\d+\s*\w+|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i.exec(s)
    if (tail) return `${tail[2]} ${tail[1]}`.trim()
    return s
  }

  /**
   * @param {string} raw
   * @param {{stats?:any, battery?:any, timer?:any, parseReminder?:(s:string)=>any, pendingKill?:string|null, reminders?:number, now?:Date}} ctx
   * @returns {{say?:string, action?:any, confirm?:any, unknown?:boolean}}
   */
  function interpret(raw, ctx = {}) {
    const text = raw.trim()
    const t = text.toLowerCase().replace(/[?!.]+$/g, '').trim()
    const st = ctx.stats
    const bat = ctx.battery
    if (!t) return { say: 'I’M LISTENING.' }

    // confirmation for a pending destructive action
    if (ctx.pendingKill) {
      if (/^(y|yes|yep|yeah|confirm|do it|go)$/.test(t)) return { action: { type: 'kill', name: ctx.pendingKill, confirmed: true } }
      if (/^(n|no|nope|cancel|stop|never ?mind)$/.test(t)) return { say: 'OKAY, WEB’S UNTOUCHED.', action: { type: 'cancel-kill' } }
    }

    if (/^(help|\?|what can you do|commands)$/.test(t)) return { say: HELP }
    if (/^(hi|hello|hey|yo|sup)( karen)?$/.test(t)) return { say: 'HEY. FRIENDLY NEIGHBOURHOOD KAREN HERE.' }
    if (/^(thanks|thank you|thx|nice|good job)/.test(t)) return { say: 'ANYTIME. WITH GREAT POWER…' }
    if (/\b(what('?s| is)? the )?(time|date|day)\b/.test(t) && /^(what|time|date|day|tell)/.test(t)) {
      const d = ctx.now || new Date()
      return { say: `${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` }
    }

    // ---- reminders (before the stat words so "remind me about cpu" still works)
    if (/^(?:please\s+)?(?:remind me|set (?:a )?reminder|reminder)\b/.test(t) || /^(in\s+\d+\s*\w+|at\s+\d{1,2}(:\d{2})?\s*(am|pm)?)\s+\S+/.test(t)) {
      const n = normaliseReminder(text)
      const p = ctx.parseReminder ? ctx.parseReminder(n) : null
      if (p) return { action: { type: 'remind', raw: n } }
      return { say: 'WHEN? TRY "in 20m stretch" OR "at 3pm call mum".' }
    }
    if (/^(list|show|what are)( my)? reminders$/.test(t)) {
      return { say: ctx.reminders ? `${ctx.reminders} REMINDER${ctx.reminders > 1 ? 'S' : ''} PENDING — SEE THE LIST BELOW.` : 'NO REMINDERS. A CLEAR HEAD.' }
    }

    // ---- kill a process (always asks first)
    let m = /^(?:kill|terminate|end task|force quit)\s+(.+)$/.exec(t)
    if (m) {
      const name = m[1].replace(/\.exe$/, '').replace(/^(the|my)\s+/, '').trim()
      if (!/^[\w .-]{1,60}$/.test(name)) return { say: 'THAT NAME LOOKS ODD. I WON’T TOUCH IT.' }
      return { say: `KILL ${name.toUpperCase()}? SAY YES TO CONFIRM.`, confirm: { type: 'kill', name } }
    }

    // ---- timer
    if (/\b(pause|stop|hold)\b.*\b(focus|timer|pomodoro)\b/.test(t)) return { action: { type: 'timer', op: 'pause' }, say: 'TIMER PAUSED.' }
    if (/\b(reset|restart)\b.*\b(focus|timer|pomodoro)\b/.test(t)) return { action: { type: 'timer', op: 'reset' }, say: 'TIMER RESET.' }
    if (/\b(start|begin|resume|run)\b.*\b(focus|timer|pomodoro)\b/.test(t) || /^focus( mode)?$/.test(t)) return { action: { type: 'timer', op: 'focus' }, say: 'FOCUS MODE. 25 MINUTES. GO.' }
    if (/\b(start|take|begin)\b.*\bbreak\b/.test(t) || /^break$/.test(t)) return { action: { type: 'timer', op: 'break' }, say: 'BREAK TIME. 5 MINUTES. STRETCH.' }
    if (/(how much|time) (left|remaining)|timer status/.test(t) && ctx.timer) {
      const tm = ctx.timer
      return { say: `${tm.mode.toUpperCase()} TIMER: ${Math.floor(tm.left / 60)}M ${tm.left % 60}S ${tm.running ? 'LEFT' : '(PAUSED)'}.` }
    }

    // ---- UI + settings
    if (/\b(collapse|minimi[sz]e|shrink)\b|^(hide|close)( the)?( panel| widget| this)?$/.test(t)) return { action: { type: 'collapse' } }
    if (/\b(unmute|sound on|enable sound)\b/.test(t)) return { action: { type: 'sound', on: true }, say: 'SOUND ON.' }
    if (/\b(mute|silence|sound off|quiet)\b/.test(t)) return { action: { type: 'sound', on: false }, say: 'MUTED. SILENT RUNNING.' }
    m = /\bopacity\s+(?:to\s+)?(\d{1,3})\b|\bset opacity (\d{1,3})\b/.exec(t)
    if (m) {
      const v = Math.min(100, Math.max(30, Number(m[1] || m[2])))
      return { action: { type: 'opacity', value: v / 100 }, say: `OPACITY ${v}%.` }
    }
    if (/\b(more )?transparent\b/.test(t)) return { action: { type: 'opacity', value: 0.7 }, say: 'MORE SEE-THROUGH NOW.' }

    if (/\b(daily web|newspaper|front page|how was my day|recap my day|day recap|end of day)\b/.test(t)) return { action: { type: 'bugle' } }

    // ---- readings
    if (!st) return { unknown: true }
    if (!/^how (much|many)/.test(t) && /(eating|hogging|hog|what('?s| is) using|taking up|slow|heavy|top (process|app))/.test(t) && /(ram|memory|pc|computer|laptop|slow|process|app)/.test(t)) {
      return st.hog ? { say: `${st.hog.name.toUpperCase()} IS THE BIGGEST HOG: ${st.hog.mb} MB.` } : { say: 'STILL SCANNING PROCESSES. ASK AGAIN IN A MOMENT.' }
    }
    if (/^(status|report|summary|how am i doing|how('?s| is) (my )?(pc|computer|laptop|system|web)|everything (ok|okay|fine)|sitrep)$/.test(t)) {
      const bits = [`CPU ${pct(st.cpu)}`, `RAM ${pct(st.ram)}`, `DISK ${pct(st.disk)}`]
      if (bat && bat.present) bits.push(`BATTERY ${pct(bat.level * 100)}${bat.charging ? ' ⚡' : ''}`)
      bits.push(st.online ? (st.latencyMs != null ? `NET ${Math.round(st.latencyMs)}MS` : 'NET OK') : 'NET DOWN')
      return { say: bits.join(' · ') + '.' }
    }
    if (/\bcpu|processor\b/.test(t)) return { say: `CPU AT ${pct(st.cpu)}.` }
    if (/\b(ram|memory)\b/.test(t)) return { say: `RAM AT ${pct(st.ram)}${st.hog ? ` — BIGGEST: ${st.hog.name.toUpperCase()} (${st.hog.mb} MB)` : ''}.` }
    if (/\b(disk|storage|drive|space)\b/.test(t)) return { say: `DISK ${pct(st.disk)} FULL.` }
    if (/\b(battery|charge|power)\b/.test(t)) return { say: bat && bat.present ? `BATTERY ${pct(bat.level * 100)}${bat.charging ? ', CHARGING' : ', ON BATTERY'}.` : 'NO BATTERY — YOU’RE ON AC.' }
    if (/\b(net|network|internet|wifi|wi-fi|ping|online|connection|lag)\b/.test(t)) {
      return { say: !st.online ? 'WEB’S DOWN — NO CONNECTION.' : st.latencyMs != null ? `ONLINE. ${Math.round(st.latencyMs)} MS TO THE WEB.` : 'ONLINE.' }
    }
    if (/\buptime\b|how long.*(on|running|up)/.test(t)) return { say: `UP FOR ${fmtUp(st.uptimeS).toUpperCase()}.` }

    return { unknown: true }
  }

  return { interpret, normaliseReminder, HELP }
})

// ------------------------------------------------------------------ UI glue (browser only)
;(function () {
  if (typeof window === 'undefined' || !window.Core || !window.Reminders) return
  const { interpret } = window.KarenCore
  const input = document.getElementById('rin')
  const SAY_MS = 12000
  let pendingKill = null
  let busy = false
  const llm = { available: false, model: '' }

  const refreshLlm = () => window.spidey.karenLlm().then((s) => Object.assign(llm, s))
  refreshLlm().catch(() => {})
  setInterval(() => refreshLlm().catch(() => {}), 60000)

  const ctx = () => {
    const snap = window.Core.snapshot()
    return {
      stats: snap.stats,
      battery: snap.battery,
      timer: snap.timer,
      parseReminder: window.Reminders.parse,
      reminders: window.Reminders.count(),
      pendingKill
    }
  }

  function say(text) {
    window.Core.say(text, SAY_MS)
  }

  async function run(action) {
    switch (action.type) {
      case 'remind': {
        const p = window.Reminders.parse(action.raw)
        if (p && window.Reminders.add(action.raw)) {
          const when = new Date(p.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          say(`THWIP! I’LL TINGLE AT ${when}: ${p.text.toUpperCase()}`)
        } else say('I COULDN’T SET THAT ONE — TRY "in 20m stretch".')
        break
      }
      case 'timer':
        window.Core.timerOp(action.op)
        break
      case 'collapse':
        window.spidey.setView('badge')
        break
      case 'sound':
        window.spidey.patchSettings({ sound: action.on })
        break
      case 'opacity':
        window.spidey.patchSettings({ opacity: action.value })
        break
      case 'kill': {
        const name = action.name
        pendingKill = null
        const r = await window.spidey.killProcess(name)
        say(r.ok ? `DONE. ${r.count} ${name.toUpperCase()} PROCESS${r.count === 1 ? '' : 'ES'} STOPPED.` : r.error.toUpperCase())
        break
      }
      case 'bugle':
        window.dispatchEvent(new CustomEvent('spidey:bugle'))
        break
      case 'cancel-kill':
        pendingKill = null
        break
    }
  }

  async function handle(text) {
    const c = ctx()
    const r = interpret(text, c)
    if (r.confirm && r.confirm.type === 'kill') pendingKill = r.confirm.name
    if (r.say) say(r.say)
    if (r.action) await run(r.action)
    if (!r.unknown) return
    if (!llm.available) {
      say('NOT SURE I FOLLOW — SAY "HELP". (INSTALL OLLAMA FOR FREE-FORM CHAT.)')
      return
    }
    busy = true
    say('KAREN IS THINKING…')
    const ans = await window.spidey.karenAsk(text, { stats: c.stats, battery: c.battery, timer: c.timer })
    busy = false
    if (ans && ans.say) say(ans.say)
    else say('MY LOCAL BRAIN WENT QUIET. TRY AGAIN.')
    if (ans && ans.action) await run(ans.action)
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key !== 'Enter' || !input.value.trim() || busy) return
    const v = input.value
    input.value = ''
    handle(v)
  })
  input.placeholder = 'ASK KAREN… cpu? · in 20m stretch'

  window.Karen = { handle, interpret: (t) => interpret(t, ctx()), llm }
})()
