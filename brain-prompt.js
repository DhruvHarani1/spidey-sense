'use strict'
/**
 * What Karen's "brain" is told and how its answer is understood. Pure functions (unit-tested).
 *
 * Privacy: the model only ever sees what you typed/said plus ONE short status line (time, CPU/RAM, timer…).
 * Notification contents, file names and the like are never put in a prompt.
 */

/** Commands the model may trigger. Each is run through Karen's own rule engine, so it can do nothing a typed command could not. */
const ALLOWED_ACTIONS = new Set([
  'remind', 'timer', 'collapse', 'sound', 'opacity', 'voice', 'voice-pick', 'voice-list', 'speak-test',
  'reader', 'reader-mode', 'reader-mute', 'call-me', 'missed', 'repeat', 'speech-stop', 'reader-status',
  'locker', 'equip', 'bugle', 'edith', 'capture', 'help-window', 'update-check', 'brain-open', 'brain-reset'
])
// never allowed from a model: ending processes (kill / its confirmation) and installing updates

/** example commands shown to the model, so it can map "remind me in a bit" to something the rule engine understands */
const DO_EXAMPLES = [
  'in 20m stretch', 'at 3pm call mum', 'start focus', 'take a break', 'pause the timer', 'reset timer', 'collapse',
  'mute', 'unmute', 'opacity 70', 'am i safe', 'daily web', 'take a screenshot', 'show my level', 'wear the neon suit',
  'check for updates', 'read my notifications', 'stop reading notifications', 'read notifications privately',
  "don't read youtube", 'read whatsapp again', 'call me Dhruv sir', 'what did i miss', 'repeat that', 'change voice',
  'use david', 'speak to me', 'stop talking', 'open the manual'
]

const clamp = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)

/** one line of live context (no private content) */
function contextLine(c = {}) {
  const parts = []
  const d = c.now instanceof Date ? c.now : new Date()
  parts.push(`It is ${d.toLocaleDateString('en-US', { weekday: 'long' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`)
  const s = c.stats
  if (s) {
    const bits = []
    if (Number.isFinite(s.cpu)) bits.push(`CPU ${Math.round(s.cpu)}%`)
    if (Number.isFinite(s.ram)) bits.push(`RAM ${Math.round(s.ram)}%`)
    if (Number.isFinite(s.disk)) bits.push(`disk ${Math.round(s.disk)}%`)
    if (s.online === false) bits.push('offline')
    else if (Number.isFinite(s.latencyMs)) bits.push(`ping ${Math.round(s.latencyMs)} ms`)
    if (s.hog && typeof s.hog.name === 'string') bits.push(`biggest app ${clamp(s.hog.name, 30)} ${Number(s.hog.mb) || 0} MB`)
    if (bits.length) parts.push(`PC: ${bits.join(', ')}.`)
  }
  const b = c.battery
  if (b && b.present) parts.push(`Battery ${Math.round(b.level * 100)}%${b.charging ? ' charging' : ''}.`)
  const t = c.timer
  if (t && Number.isFinite(t.left)) parts.push(`Timer: ${t.mode} ${t.running ? 'running' : 'paused'}, ${Math.floor(t.left / 60)}m ${t.left % 60}s left.`)
  if (Number.isFinite(c.unread)) parts.push(`Unread notifications: ${c.unread}.`)
  if (Number.isFinite(c.level)) parts.push(`XP level ${c.level}.`)
  return parts.join(' ')
}

/**
 * @param {{name?:string}} o
 * @returns {string}
 */
function systemPrompt(o = {}) {
  const name = clamp(o.name, 40)
  return [
    'You are Karen, the friendly AI voice of Spidey Sense, a Spider-Man-themed assistant widget on the user’s Windows PC. Talk like a warm, quick-witted friend, never like a manual.',
    'Your replies are SPOKEN ALOUD: one to three short sentences, plain words, no markdown, no emoji, no lists, no stage directions.',
    name ? `Address the user as "${name}" now and then, not in every sentence.` : 'You do not know the user’s name yet; if it feels natural, ask what to call them.',
    'Use the context line for real PC facts. Never invent numbers, files, messages or events. If you do not know, say so briefly.',
    'You can also act. If (and only if) the user clearly asks you to do something, put ONE short command in "do", worded like one of: ' + DO_EXAMPLES.map((x) => `"${x}"`).join(', ') + '. Otherwise leave "do" empty.',
    'You cannot close programs, change system settings, open files or run anything else. If asked, say you cannot do that.',
    'Reply ONLY with JSON: {"say":"what you say out loud","do":""}'
  ].join(' ')
}

/**
 * @param {{role:string,content:string}[]} history previous turns (already short)
 * @param {string} userText
 * @param {{name?:string, ctx?:object}} o
 */
function buildMessages(history, userText, o = {}) {
  const ctx = contextLine(o.ctx || {})
  return [
    { role: 'system', content: systemPrompt({ name: o.name }) + (ctx ? `\nContext: ${ctx}` : '') },
    ...history.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clamp(m.content, 500) })),
    { role: 'user', content: clamp(userText, 600) }
  ]
}

/** models often wrap JSON in prose, code fences or <think> blocks: pull out {say, do}, or treat the whole reply as speech */
function parseReply(raw) {
  let t = String(raw ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/```(?:json)?/gi, ' ')
    .trim()
  if (!t) return { say: '', do: '' }
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try {
      const j = JSON.parse(t.slice(a, b + 1))
      if (j && typeof j === 'object') {
        const say = clamp(j.say ?? j.reply ?? j.text ?? '', 420)
        const cmd = clamp(j.do ?? j.action ?? j.command ?? '', 80)
        if (say || cmd) return { say, do: typeof j.do === 'string' || typeof j.action === 'string' || typeof j.command === 'string' ? cmd : '' }
      }
    } catch {
      /* not JSON after all */
    }
  }
  // plain prose: speak it (cut at a sentence end if it is long)
  let say = clamp(t.replace(/^["']|["']$/g, ''), 420)
  if (say.length > 380) {
    const cut = Math.max(say.lastIndexOf('. ', 380), say.lastIndexOf('! ', 380), say.lastIndexOf('? ', 380))
    if (cut > 120) say = say.slice(0, cut + 1)
  }
  return { say, do: '' }
}

const isAllowedAction = (type) => ALLOWED_ACTIONS.has(String(type))

module.exports = { systemPrompt, buildMessages, parseReply, contextLine, isAllowedAction, ALLOWED_ACTIONS, DO_EXAMPLES, clamp }
