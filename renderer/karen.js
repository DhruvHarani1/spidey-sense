'use strict'
/*
 * Karen: the suit AI. Type (or Ctrl+Alt+K anywhere) and ask in plain words.
 * A fast offline rule engine (interpret()): PC status, timer, reminders, suits, E.D.I.T.H., the Daily Web.
 * Chatting and voice live in Jarvis, a separate app.
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

    if (/^(help|\?|commands)$/.test(t)) return { say: HELP }
    if (/^(hi|hello|hey|yo|sup)( karen| spidey)?$/.test(t)) return { say: 'HEY. FRIENDLY NEIGHBOURHOOD KAREN HERE.' }
    if (/^(thanks|thank you|thx|nice|good job)/.test(t)) return { say: 'ANYTIME. WITH GREAT POWER…' }
    if (/^(how are you|how'?s it going|how are things|what'?s up|whats up|how do you do)\b/.test(t)) return { say: 'ALL SYSTEMS TINGLE-FREE. HOW ARE YOU?' }
    if (/^good (morning|afternoon|evening|night)\b/.test(t)) return { say: 'AND A GOOD ONE TO YOU. THE WEB IS HOLDING STRONG.' }
    if (/^(who are you|what are you|what'?s your name|what is your name)\b/.test(t)) return { say: 'I’M KAREN, THE SUIT AI IN YOUR SPIDEY SENSE WIDGET. FOR CHATTING AND VOICE, THAT’S JARVIS.' }
    if (/^(are you there|you there|karen)$/.test(t)) return { say: 'RIGHT HERE.' }
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
    // ---- Auto-Shield, Web Memory, tour
    if (/^undo( that| it| the last( one)?| shield)?$/.test(t)) return { action: { type: 'shield-undo' } }
    if (/\b(auto[- ]?shield|spidey shield|shield)\b/.test(t) && !/\b(captain|america)\b/.test(t)) {
      if (/\b(off|stop|disable|turn off|pause)\b/.test(t)) return { action: { type: 'shield', mode: 'off' } }
      if (/\b(ask|careful|manual|confirm)\b/.test(t)) return { action: { type: 'shield', mode: 'ask' } }
      if (/\b(on|enable|start|smart|auto|automatic|full)\b/.test(t)) return { action: { type: 'shield', mode: 'smart' } }
      return { action: { type: 'shield', mode: 'status' } }
    }
    if (/\b(web memory|history|what happened|last night|past (day|24)|24 ?h(ours?)?|yesterday|earlier today|show me the graph)\b/.test(t)) return { action: { type: 'memory' } }
    if (/\b(tour|show me around|walk me through|getting started|how does this work)\b/.test(t)) return { action: { type: 'tour' } }
    if (/\b(unmute|sound on|enable sound)\b/.test(t)) return { action: { type: 'sound', on: true }, say: 'SOUND ON.' }
    if (/\b(mute|silence|sound off|quiet)\b/.test(t)) return { action: { type: 'sound', on: false }, say: 'MUTED. SILENT RUNNING.' }
    m = /\bopacity\s+(?:to\s+)?(\d{1,3})\b|\bset opacity (\d{1,3})\b/.exec(t)
    if (m) {
      const v = Math.min(100, Math.max(30, Number(m[1] || m[2])))
      return { action: { type: 'opacity', value: v / 100 }, say: `OPACITY ${v}%.` }
    }
    if (/\b(more )?transparent\b/.test(t)) return { action: { type: 'opacity', value: 0.7 }, say: 'MORE SEE-THROUGH NOW.' }

    if (/\b(install|apply)( the)? update\b|\brestart (and|to) update\b|\bupdate now\b/.test(t)) return { action: { type: 'update-install' } }
    if (/\b(check (for )?updates?|any updates?|is there an update|new version|update (the )?(app|widget|spidey( sense)?)|am i up to date|what version)\b/.test(t)) return { action: { type: 'update-check' } }
    if (/\b(manual|documentation|docs|user guide|all (the )?commands|full help|help (me )?(page|window)|what can (you|this) do)\b/.test(t)) return { action: { type: 'help-window' }, say: 'OPENING THE MANUAL.' }
    if (/\b(daily web|newspaper|front page|how was my day|recap my day|day recap|end of day)\b/.test(t)) return { action: { type: 'bugle' } }
    if (/\b(edith|e\.d\.i\.t\.h|threat (assessment|level|scan)|security (check|scan|status)|(scan|check) (my )?(pc|computer|laptop|security)|am i safe|is my (pc|computer|laptop) safe)\b/.test(t)) return { action: { type: 'edith' } }
    {
      const suit = ctx.findSuit ? ctx.findSuit(t) : null
      if (suit && /\b(equip|wear|put on|switch|change|use|suit|armor|armour)\b/.test(t)) return { action: { type: 'equip', id: suit.id } }
      if (/\b(suits?|locker|wardrobe|my level|what level|xp|experience)\b/.test(t)) return { action: { type: 'locker' } }
    }

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

  const ctx = () => {
    const snap = window.Core.snapshot()
    return {
      stats: snap.stats,
      battery: snap.battery,
      timer: snap.timer,
      parseReminder: window.Reminders.parse,
      findSuit: window.Suits.findSuit,
      reminders: window.Reminders.count(),
      pendingKill
    }
  }

  const say = (text) => window.Core.say(text, SAY_MS)

  function describeUpdate(s) {
    if (!s) return 'COULDN’T REACH THE UPDATER.'
    const now = `V${s.version_now}`
    switch (s.state) {
      case 'ready':
        return `UPDATE ${String(s.version).toUpperCase()} IS READY. SAY "INSTALL UPDATE" (YOU'RE ON ${now}).`
      case 'downloading':
        return `DOWNLOADING V${s.version}… ${s.percent ?? 0}%.`
      case 'none':
        return `YOU'RE UP TO DATE (${now}).`
      case 'error':
        return `UPDATE CHECK FAILED: ${s.message}`.toUpperCase()
      case 'disabled':
        return `DEV BUILD (${now}) — UPDATES WORK IN THE INSTALLED APP.`
      default:
        return `UPDATER IS ${String(s.state).toUpperCase()} (${now}).`
    }
  }

  window.spidey.onUpdate((s) => {
    if (s.state === 'ready') say(`UPDATE V${s.version} IS READY — SAY "INSTALL UPDATE" OR USE THE TRAY.`)
  })

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
      case 'help-window':
        window.spidey.openHelp()
        break
      case 'update-check': {
        say('CHECKING GITHUB FOR A NEWER SUIT…')
        say(describeUpdate(await window.spidey.updateCheck()))
        break
      }
      case 'update-install':
        if ((await window.spidey.updateState()).state === 'ready') {
          say('RESTARTING TO UPDATE. BACK IN A MOMENT!')
          window.spidey.updateInstall()
        } else say('NO UPDATE IS READY TO INSTALL YET. SAY "CHECK FOR UPDATES".')
        break
      case 'locker': {
        window.Locker.open()
        const s = window.Suits.state()
        say(`LEVEL ${s.level} · ${s.xp} XP · ${s.next - s.xp} TO THE NEXT LEVEL.`)
        break
      }
      case 'equip': {
        const r = window.Suits.equip(action.id)
        say(r.ok ? `SUIT ON: ${r.suit.name.toUpperCase()}.` : r.error)
        break
      }
      case 'edith': {
        say('E.D.I.T.H. SCANNING…')
        say(window.Edith.summary(await window.Edith.open()))
        break
      }
      case 'memory':
        window.Memory.open()
        break
      case 'tour':
        window.Tour.open()
        break
      case 'shield': {
        const names = { smart: 'SMART: I TAME RUNAWAY PROGRAMS AND BLOCK SUSPICIOUS AUTO-START ENTRIES ON MY OWN (EVERYTHING HAS AN UNDO).', ask: 'ASK FIRST: I ONLY OFFER A BUTTON, NEVER ACT ALONE.', off: 'OFF: I ONLY WATCH.' }
        if (action.mode === 'status') say('AUTO-SHIELD ' + names[window.Core.getSettings().shield || 'smart'])
        else {
          window.spidey.patchSettings({ shield: action.mode })
          say('AUTO-SHIELD ' + names[action.mode])
        }
        break
      }
      case 'shield-undo': {
        const e = window.Guardian && window.Guardian.lastUndoable()
        if (!e) say('NOTHING TO UNDO.')
        else {
          const r = await window.spidey.shieldUndo(e.id)
          say(r && r.ok ? 'UNDONE: ' + e.text.slice(0, 80).toUpperCase() : String((r && r.error) || 'COULD NOT UNDO').toUpperCase())
          if (r && r.ok) window.Guardian.markUndone(e.id)
        }
        break
      }
      case 'cancel-kill':
        pendingKill = null
        break
    }
  }

  async function handle(text) {
    const r = interpret(text, ctx())
    if (r.confirm && r.confirm.type === 'kill') pendingKill = r.confirm.name
    if (r.say) say(r.say)
    if (r.action) await run(r.action)
    if (r.unknown) say('NOT SURE I FOLLOW — SAY "HELP". FOR CHATTING AND VOICE, THAT’S A JOB FOR JARVIS.')
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key !== 'Enter' || !input.value.trim()) return
    const v = input.value
    input.value = ''
    void handle(v)
  })
  input.placeholder = 'ASK KAREN… cpu? · in 20m stretch'

  window.Karen = { handle, interpret: (t) => interpret(t, ctx()) }
})()
