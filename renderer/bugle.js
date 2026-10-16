'use strict'
/*
 * The Daily Web: an end-of-day comic newspaper front page built from your day's numbers.
 * compose() is pure (unit-tested); render() paints it on a canvas in the browser.
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null)
  else root.Bugle = factory(root)
})(this, function (win) {
  const QUOTES = [
    'THE WEB HOLDS. TOMORROW, WE SWING AGAIN.',
    'EVERY TINGLE WAS TAKEN SERIOUSLY. MOST WERE CHROME.',
    'NO CAPE. NO PROBLEM. JUST A VERY TIDY DESKTOP.',
    'HEROES TAKE BREAKS TOO. HYDRATE.',
    'THE CITY SLEEPS. THE WIDGET DOES NOT.',
    'SMALL WINS ADD UP — ASK ANY FRIENDLY NEIGHBOUR.'
  ]

  const num = (d, k) => (d && d.n && Number(d.n[k])) || 0
  const peak = (d, k) => (d && d.peak && Number(d.peak[k])) || 0

  function fmtDur(totalMin) {
    const h = Math.floor(totalMin / 60)
    const m = Math.round(totalMin % 60)
    return h ? `${h}H ${String(m).padStart(2, '0')}M` : `${m}M`
  }

  function dayOfYear(date) {
    return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
  }

  /** @returns {{headline:string, deck:string, lines:string[], quote:string, dateLine:string, issue:number}} */
  function compose(day, date = new Date()) {
    const tingleKeys = Object.keys((day && day.n) || {}).filter((k) => k.startsWith('tingle:'))
    const byKind = tingleKeys.map((k) => [k.slice(7), num(day, k)]).sort((a, b) => b[1] - a[1])
    const tingles = byKind.reduce((s, [, n]) => s + n, 0)
    const focusMin = num(day, 'focusMin')
    const sessions = num(day, 'focusSessions')
    const activeMin = Math.round(num(day, 'activeS') / 60)
    const guardian = num(day, 'guardian')
    const hog = day && day.hog
    const ramTingles = num(day, 'tingle:ram')
    const cpuTingles = num(day, 'tingle:cpu')

    let headline
    let deck
    if (guardian >= 1) {
      headline = 'STRANGE VISITOR SPOTTED ON THE WEB!'
      deck = `Spider-sense raised ${guardian} security alert${guardian > 1 ? 's' : ''} today. Hero is on the case.`
    } else if (ramTingles >= 3) {
      headline = hog ? `${hog.name.toUpperCase()} HOARDS MEMORY — CITY ON EDGE!` : `MEMORY MENACE STRIKES ${ramTingles} TIMES!`
      deck = `RAM tingled ${ramTingles} times${hog ? `; the biggest culprit weighed in at ${(hog.mb / 1024).toFixed(1)} GB` : ''}.`
    } else if (cpuTingles >= 3) {
      headline = 'CPU MELTDOWN SHAKES THE CITY!'
      deck = `The processor redlined ${cpuTingles} times. Fans were heard screaming.`
    } else if (focusMin >= 100) {
      headline = `WEB-HEAD LOCKS IN: ${fmtDur(focusMin)} OF PURE FOCUS!`
      deck = `${sessions} focus session${sessions === 1 ? '' : 's'} completed without a single villain getting through.`
    } else if (focusMin > 0) {
      headline = `HERO KEEPS HEAD DOWN: ${sessions} FOCUS SESSION${sessions === 1 ? '' : 'S'}`
      deck = `${fmtDur(focusMin)} of deep work banked today.`
    } else if (activeMin >= 480) {
      headline = 'HERO WORKS THROUGH THE DAY — DOES ANYONE SLEEP?'
      deck = `${fmtDur(activeMin)} at the keyboard. Citizens urged to stretch.`
    } else if (tingles === 0) {
      headline = 'QUIET DAY IN THE CITY: NOTHING TO TINGLE ABOUT'
      deck = 'Not one alert all day. Experts are suspicious.'
    } else {
      headline = `SPIDEY KEEPS WATCH: ${tingles} TINGLE${tingles === 1 ? '' : 'S'}, ALL HANDLED`
      deck = 'The web held firm under pressure.'
    }

    const lines = []
    if (focusMin) lines.push(`FOCUS: ${fmtDur(focusMin)}${sessions ? ` (${sessions} ★)` : ''}`)
    if (activeMin) lines.push(`AT THE KEYBOARD: ${fmtDur(activeMin)}`)
    if (tingles) lines.push(`TINGLES: ${tingles} (${byKind.slice(0, 3).map(([k, n]) => `${k.toUpperCase()} ${n}`).join(' · ')})`)
    if (peak(day, 'ram')) lines.push(`PEAK RAM: ${Math.round(peak(day, 'ram'))}%${hog ? ` — ${hog.name.toUpperCase()} ${(hog.mb / 1024).toFixed(1)} GB` : ''}`)
    if (peak(day, 'cpu')) lines.push(`PEAK CPU: ${Math.round(peak(day, 'cpu'))}%`)
    if (num(day, 'notifs')) lines.push(`NOTIFICATIONS RECEIVED: ${num(day, 'notifs')}`)
    if (guardian) lines.push(`GUARDIAN ALERTS: ${guardian}`)
    if (num(day, 'note:eye')) lines.push(`EYE-REST NUDGES: ${num(day, 'note:eye')}`)
    if (num(day, 'note:remind')) lines.push(`REMINDERS FIRED: ${num(day, 'note:remind')}`)
    if (!lines.length) lines.push('NO DATA YET — THE REPORTERS JUST CLOCKED IN.')

    const dateLine = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
    return { headline, deck, lines, quote: QUOTES[dayOfYear(date) % QUOTES.length], dateLine, issue: dayOfYear(date) }
  }

  // ------------------------------------------------------------ canvas rendering (browser only)
  function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/)
    const rows = []
    let row = ''
    for (const w of words) {
      const test = row ? `${row} ${w}` : w
      if (ctx.measureText(test).width > maxW && row) {
        rows.push(row)
        row = w
      } else row = test
    }
    if (row) rows.push(row)
    return rows
  }

  function render(canvas, c, day) {
    const W = 1080
    const H = 1500
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#efe6cf'
    ctx.fillRect(0, 0, W, H)
    // newsprint speckle
    ctx.fillStyle = 'rgba(90, 70, 30, 0.05)'
    for (let i = 0; i < 1800; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
    ctx.strokeStyle = '#111'
    ctx.fillStyle = '#111'

    // masthead
    ctx.textAlign = 'center'
    let mast = 128
    ctx.font = `bold ${mast}px Georgia, 'Times New Roman', serif`
    while (ctx.measureText('THE DAILY WEB').width > W - 110 && mast > 60) {
      mast -= 4
      ctx.font = `bold ${mast}px Georgia, 'Times New Roman', serif`
    }
    ctx.fillText('THE DAILY WEB', W / 2, 160)
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(50, 190)
    ctx.lineTo(W - 50, 190)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(50, 202)
    ctx.lineTo(W - 50, 202)
    ctx.stroke()
    ctx.font = "bold 22px Georgia, serif"
    ctx.textAlign = 'left'
    ctx.fillText(`VOL. 1 · NO. ${c.issue}`, 50, 238)
    ctx.textAlign = 'center'
    ctx.fillText(c.dateLine, W / 2, 238)
    ctx.textAlign = 'right'
    ctx.fillText('PRICE: ONE TINGLE', W - 50, 238)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(50, 254)
    ctx.lineTo(W - 50, 254)
    ctx.stroke()

    // EXTRA ribbon
    ctx.save()
    ctx.translate(W - 190, 300)
    ctx.rotate(0.12)
    ctx.fillStyle = '#d4202a'
    ctx.fillRect(-90, -30, 180, 60)
    ctx.lineWidth = 4
    ctx.strokeRect(-90, -30, 180, 60)
    ctx.fillStyle = '#fff'
    ctx.font = "italic 900 40px 'Arial Black', Impact, sans-serif"
    ctx.textAlign = 'center'
    ctx.fillText('EXTRA!', 0, 14)
    ctx.restore()

    // headline
    ctx.fillStyle = '#111'
    ctx.textAlign = 'left'
    ctx.font = "900 70px 'Arial Black', Impact, sans-serif"
    const hl = wrap(ctx, c.headline, 880).slice(0, 3)
    let y = 340
    for (const row of hl) {
      ctx.fillText(row, 50, y + 60)
      y += 76
    }
    ctx.font = "italic 32px Georgia, serif"
    ctx.fillStyle = '#333'
    for (const row of wrap(ctx, c.deck, 980).slice(0, 2)) {
      y += 42
      ctx.fillText(row, 50, y + 60)
    }
    const top = Math.max(y + 100, 640)

    // "photograph": the web at its peak
    ctx.fillStyle = '#111'
    ctx.fillRect(50, top, 530, 470)
    ctx.fillStyle = '#d9cca8'
    ctx.fillRect(58, top + 8, 514, 454)
    if (win && win.Spider) {
      const off = document.createElement('canvas')
      off.width = 260
      off.height = 248
      const octx = off.getContext('2d')
      const p = (k) => Math.min(100, peak(day, k))
      win.Spider.drawWeb(octx, 260, 248, {
        values: [p('cpu'), p('ram'), p('disk'), 0, Math.min(100, peak(day, 'latency') / 5)],
        labels: ['CPU', 'RAM', 'DISK', 'BAT', 'NET'],
        level: 'calm',
        t: 0,
        hot: [0, 0, 0, 0, 0]
      })
      ctx.save()
      ctx.filter = 'sepia(0.7) contrast(1.1)'
      ctx.drawImage(off, 58, top + 20, 514, 490 * (248 / 260) * 0.95)
      ctx.restore()
    }
    // halftone dots over the photo
    ctx.fillStyle = 'rgba(30, 20, 5, 0.10)'
    for (let gy = top + 12; gy < top + 462; gy += 8)
      for (let gx = 62; gx < 572; gx += 8) {
        ctx.beginPath()
        ctx.arc(gx, gy, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    ctx.fillStyle = '#333'
    ctx.font = "italic 21px Georgia, serif"
    ctx.fillText('PHOTO: THE WEB AT ITS PEAK TODAY. (NO SPIDERS WERE HARMED.)', 50, top + 500)

    // stats column
    ctx.fillStyle = '#111'
    ctx.font = "bold 22px Georgia, serif"
    ctx.fillText('BY THE SPIDEY-SENSE STAFF', 620, top + 20)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(620, top + 32)
    ctx.lineTo(W - 50, top + 32)
    ctx.stroke()
    ctx.font = "bold 27px Georgia, serif"
    let sy = top + 74
    for (const line of c.lines) {
      const rows = wrap(ctx, line, 400)
      ctx.fillText('■', 620, sy)
      for (const r of rows) {
        ctx.fillText(r, 650, sy)
        sy += 36
      }
      sy += 14
      if (sy > top + 520) break
    }

    // quote band
    const qy = Math.max(top + 560, 1230)
    ctx.fillStyle = '#111'
    ctx.fillRect(50, qy, W - 100, 100)
    ctx.fillStyle = '#ffd83a'
    ctx.textAlign = 'center'
    ctx.font = "italic 900 30px 'Arial Black', Impact, sans-serif"
    const q = wrap(ctx, c.quote, W - 160)
    q.slice(0, 2).forEach((r, i) => ctx.fillText(r, W / 2, qy + 44 + i * 36 - (q.length > 1 ? 12 : -6)))
    ctx.fillStyle = '#555'
    ctx.font = '18px Georgia, serif'
    ctx.fillText('Spidey Sense · fan-made · generated locally from your own PC — nothing leaves your machine', W / 2, H - 28)
  }

  return { compose, render, fmtDur, QUOTES }
})
