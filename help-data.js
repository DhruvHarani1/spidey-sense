'use strict'
/**
 * Single source of truth for everything Spidey Sense can do.
 * The CLI (bin/spidey.js), the offline help window and the web manual (docs/index.html) are all generated from this,
 * and scripts/help-test.js runs every `try` example through Karen so the docs can never describe a command that doesn't work.
 */
const DATA = {
  name: 'Spidey Sense',
  tagline: 'Your PC’s friendly neighbourhood spider-sense.',
  repo: 'https://github.com/DhruvHarani1/spidey-sense',
  intro:
    'Spidey Sense is a small always-on-top comic-book widget for Windows. It watches your PC the way a spider-sense would — CPU, RAM, disk, battery, network — and "tingles" when something is wrong. Around that core it has Guardian (danger sense), E.D.I.T.H. (a security check), a command bar (Karen), a focus timer, an end-of-day comic newspaper and a suit locker. Everything runs locally; there are no accounts, no API keys, no microphone. (Voice and AI chat live in a separate app, Jarvis.)',

  quickstart: [
    'Install it, run it: a small swinging spider badge appears at the top-right of your screen.',
    'Click the badge to open the full widget. Click ▲ in its banner to fold it back into the badge. Drag either to move it.',
    'Press Ctrl+Alt+K anywhere and type to Karen: "status", "what is eating my ram", "in 20m stretch".',
    'Right-click the badge (or anywhere on the open panel) for the full menu: every option, including this manual. The same menu lives on the tray icon by the clock; Windows often hides new tray icons under the ^ arrow, so drag the red spider out onto the taskbar to keep it visible.'
  ],

  hotkeys: [
    { keys: 'Ctrl+Alt+K', does: 'Open the widget and focus Karen’s command box (works from any app).' },
    { keys: 'Ctrl+Alt+S', does: 'Same as Ctrl+Alt+K (kept from the old reminders shortcut).' },
    { keys: 'Esc', does: 'Close any open overlay (log, newspaper, locker, E.D.I.T.H.).' },
    { keys: 'Enter', does: 'Send what you typed to Karen.' }
  ],

  /** Karen: `try` strings are executed by the test-suite. */
  karen: [
    {
      group: 'Ask about your PC',
      items: [
        { say: 'status', does: 'One-line summary of CPU, RAM, disk, battery and network.', try: 'status', aka: ['report', 'sitrep', 'how is my pc'] },
        { say: 'cpu?', does: 'Current processor load.', try: 'cpu?' },
        { say: 'ram', does: 'Memory use, plus the biggest app using it.', try: 'how much ram am i using' },
        { say: 'what is eating my ram', does: 'Names the biggest memory hog and how much it uses.', try: 'what is eating my ram' },
        { say: 'disk', does: 'How full the system drive is.', try: 'disk space' },
        { say: 'battery', does: 'Charge level and whether it is charging (or "AC" on a desktop).', try: 'battery' },
        { say: 'am I online?', does: 'Connection state and latency to the web.', try: 'am i online' },
        { say: 'uptime', does: 'How long the PC has been on.', try: 'uptime' },
        { say: 'what time is it', does: 'Date and time.', try: 'what time is it' }
      ]
    },
    {
      group: 'Reminders (THWIP)',
      items: [
        { say: 'in 20m stretch', does: 'Reminder in 20 minutes. Units: s / m / h (or seconds, minutes, hours).', try: 'in 20m stretch' },
        { say: 'at 3pm call mum', does: 'Reminder at a clock time (24 h "at 15:30" works too; if it already passed, it means tomorrow).', try: 'at 3pm call mum' },
        { say: 'remind me to drink water in 10 minutes', does: 'Natural phrasing works as well.', try: 'remind me to drink water in 10 minutes' },
        { say: 'list reminders', does: 'How many are pending (up to 6; they are listed under the box).', try: 'list reminders' }
      ]
    },
    {
      group: 'Timer (focus / break)',
      items: [
        { say: 'start focus', does: 'Starts a 25-minute focus session.', try: 'start focus' },
        { say: 'take a break', does: 'Starts a 5-minute break.', try: 'take a break' },
        { say: 'pause the timer', does: 'Pauses the running timer.', try: 'pause the timer' },
        { say: 'reset timer', does: 'Resets it to the full length.', try: 'reset timer' },
        { say: 'how much time left', does: 'Remaining time on the timer.', try: 'how much time left' }
      ]
    },
    {
      group: 'Shield, memory and tour',
      items: [
        { say: 'undo', does: 'Reverses the last thing Auto-Shield did on its own (restores a blocked auto-start entry, puts a program’s priority back).', try: 'undo', aka: ['undo that', 'undo shield'] },
        { say: 'shield status', does: 'Tells you which Auto-Shield mode is on. "shield off", "shield ask" (only offer buttons) and "shield smart" switch it.', try: 'shield status', aka: ['shield off', 'shield ask', 'turn on the shield'] },
        { say: 'show me the history', does: 'Opens Web Memory: the last 24 hours of CPU and RAM and what was running at the worst moments.', try: 'show me the history', aka: ['web memory', 'what happened last night', 'cpu history'] },
        { say: 'give me a tour', does: 'Replays the five-card first-run tour.', try: 'give me a tour', aka: ['show me around', 'walk me through'] }
      ]
    },
    {
      group: 'The widget itself',
      items: [
        { say: 'open the manual', does: 'Opens this manual in its own window (also: "docs", "all commands", "what can you do").', try: 'open the manual', aka: ['docs', 'what can you do'] },
        { say: 'collapse', does: 'Folds the panel back into the badge.', try: 'collapse' },
        { say: 'mute / unmute', does: 'Turns the alert chirp off or on.', try: 'mute' },
        { say: 'opacity 70', does: 'Sets window opacity from 30 to 100.', try: 'opacity 70' },
        { say: 'make it more transparent', does: 'Shortcut for opacity 70.', try: 'make it more transparent' }
      ]
    },
    {
      group: 'Other features',
      items: [
        { say: 'am I safe?', does: 'Runs E.D.I.T.H., the security assessment.', try: 'am i safe' },
        { say: 'daily web', does: 'Opens today’s comic newspaper front page.', try: 'show me the daily web' },
        { say: 'my level', does: 'Opens the Suit Locker and tells you your XP.', try: 'show my level' },
        { say: 'wear the neon suit', does: 'Equips a suit you have unlocked (midnight, gold, neon, pop, miles, prism, noir, 2099, iron).', try: 'wear the neon suit' },
        { say: 'check for updates', does: 'Asks GitHub for a newer version.', try: 'check for updates' },
        { say: 'install update', does: 'Restarts and installs a downloaded update.', try: 'install update' }
      ]
    },
    {
      group: 'Careful ones',
      items: [
        { say: 'kill chrome', does: 'Ends all processes named chrome — but only after you answer "yes". System processes (explorer, svchost, antivirus, …) are protected and refused.', try: 'kill chrome', note: 'Always asks first. Say "no" to cancel.' }
      ]
    }
  ],

  karenNotes: [
    'Karen is a fast offline rule engine: it understands the phrases above and many variations ("how is my pc", "cpu", "remind me at 5pm to …").',
    'She never does anything destructive without asking: "kill chrome" needs a "yes", and system processes are protected.',
    'Ask "help" for a quick list at any time.'
  ],

  features: [
    {
      id: 'radar',
      name: 'Web radar & spider-sense',
      icon: '🕸',
      summary: 'Five vital signs drawn as a spider web. When one spikes, the widget tingles.',
      how: [
        'The web has five spokes: CPU, RAM, DISK, BAT (battery drain) and NET (latency). The further a dot sits from the centre, the worse that reading is.',
        'Calm = green light, nothing to do. Alert = yellow border at 75 % or more on any axis. Tingle = red shaking border, a chirp and a notification at 90 % or more, or when you are offline.',
        'Alerts need 3 consecutive readings to start and 5 to stop, so a one-second blip never triggers anything. The same kind of notification is held back for 2 minutes.',
        'RAM is special: Windows keeps RAM nearly full on purpose, so by default (Auto) it only alerts on a jump above this PC’s usual level. Tray → RAM alerts lets you use "above 90 %", "above 95 %" or "never" instead.',
        'Disk only alerts above 90 % (95 % for a tingle). Battery alerts only while unplugged. Offline is always a tingle.'
      ],
      reads: 'CPU, RAM and uptime from Windows; disk with a free-space query; battery from the browser engine; network by one tiny HEAD request to gstatic.com every 8 s (tray → "Network check" turns that off).'
    },
    {
      id: 'badge',
      name: 'Badge & panel',
      icon: '🕷',
      summary: 'A tiny swinging spider that opens into the full widget.',
      how: [
        'The widget starts as a small badge hanging from a thread. A coloured ring shows the mood: none = calm, yellow = alert, red + shake = tingle. A number on it counts unread items.',
        'Click it to open the panel; ▲ in the panel banner folds it back. Drag either to move; the position is remembered and clamped to your screen (tray → Reset position if it ever goes missing).',
        'After 3 minutes without keyboard or mouse the badge naps (dims, "z z") and wakes when you come back.',
        'Always-on-top and opacity are in the tray menu; close (Alt+F4) only hides the widget — Quit is in the tray.'
      ]
    },
    {
      id: 'timer',
      name: 'Web timer',
      icon: '⏱',
      summary: 'A focus/break timer with a streak.',
      how: [
        'FOCUS is 25 minutes, BREAK is 5. Press ▶ to start/pause, ↺ to reset, click the FOCUS/BREAK chip to switch.',
        'When time is up the widget tingles, chirps and notifies, then switches to the other mode.',
        'Finished focus sessions today show as ★N on the chip.',
        '"Focus quiet": while a focus timer runs, system alerts (CPU, RAM…) stay visual — no chirp, no popup — so they cannot break your concentration. Reminders and the timer itself still speak up.'
      ]
    },
    {
      id: 'reminders',
      name: 'THWIP reminders',
      icon: '📌',
      summary: 'Type "in 20m stretch" or "at 3pm call mum".',
      how: [
        'Use the command box (Ctrl+Alt+K). Up to 6 pending reminders appear as chips under it with a live countdown; ✕ cancels one.',
        'When due: the widget tingles, the caption reads "THWIP! <your text>", and Windows shows a notification.',
        'Reminders are stored locally and survive a restart.'
      ]
    },
    {
      id: 'karen',
      name: 'Karen — the suit AI',
      icon: '🤖',
      summary: 'A command bar that understands plain words.',
      how: ['Ctrl+Alt+K opens it anywhere. See the full command list below.', 'Replies appear in the yellow caption box for ~12 seconds. Karen is a rule engine: for talking, voice and AI chat use Jarvis.']
    },
    {
      id: 'guardian',
      name: 'Guardian — danger sense',
      icon: '🛡',
      summary: 'Notices things that should make you look twice.',
      how: [
        'It tingles (and logs, see the status light in the banner) when: a program contacts the internet for the first time; a new auto-start entry appears; the hosts file changes; a new drive (USB stick, card, phone) is connected; a program starts listening for connections from the network on a new port; or the system drive is filling fast (+3 points in 15 minutes).',
        'For the first 3 minutes after the very first run it only learns what is normal, so it does not alert on everything you already use.',
        'At most one alert every 20 seconds. Click the round status light in the banner to read the log.'
      ],
      reads: 'Uses netstat, tasklist and reg.exe plus a hash of the hosts file. No admin rights, no network calls. Tray → "Guardian" turns it off. Not covered (they need admin rights or vendor drivers): battery health and temperatures.'
    },
    {
      id: 'shield',
      name: 'Auto-Shield — acts on its own, carefully',
      icon: '⚔',
      summary: 'Tames runaway programs and blocks suspicious auto-start entries by itself. Every move has an UNDO.',
      how: [
        'Smart mode (default). (1) A program that keeps using about a third or more of the whole CPU for a while gets its priority lowered: Windows lets everything else go first, the program keeps working. (2) A NEW auto-start entry in your own startup that runs from Temp/Downloads or uses a script trick (encoded PowerShell, mshta, wscript…) is disabled and backed up, so malware cannot come back after a restart.',
        'Everything it does appears in the SENSE LOG (click the status light) with an UNDO button, or say "undo". It never kills anything by itself, never touches Windows, Defender, the firewall or any service, and needs no admin rights.',
        'It only OFFERS (you click): lowering a program’s priority in Ask mode, blocking a program that started from Temp/Downloads from the internet (a firewall rule: Windows shows its own permission prompt), and ending a program with TAKE DOWN.',
        'Tray → Auto-Shield: Smart / Ask first (only buttons) / Off (watch only). Karen: "shield off", "shield ask", "shield smart", "shield status".',
        'Protected programs (Windows itself, Explorer, your antivirus, this app…) are never touched in any mode.'
      ],
      reads: 'Lists running programs with tasklist (memory, every 10 s), measures per-program CPU with typeperf only while the CPU has been busy for 8 seconds, and looks up the file location of a few brand-new programs with Get-Process. Changes only: a program’s priority, your own Run-key / Startup-folder entries (backed up), and a firewall rule only when you click and approve it. Nothing is sent anywhere. Costs a little RAM and CPU; "Off" stops the actions but the radar still names the biggest memory user.'
    },
    {
      id: 'culprit',
      name: 'The culprit bar — who is behind the tingle',
      icon: '🎯',
      summary: 'When RAM or CPU tingles, the panel names the program and offers TAKE DOWN.',
      how: [
        'A red bar appears under the readings while the web is yellow or red because of memory or CPU: "CHROME · 2.1 GB · 38 PROCESSES".',
        'TAKE DOWN ends the single heaviest process of that name (one Chrome tab, not every Chrome window). It asks twice (the button turns white: "SURE? CLICK AGAIN") and refuses protected programs.',
        'Unsaved work in that program is lost, so use it on things you can afford to close.'
      ]
    },
    {
      id: 'memory',
      name: 'Web Memory — the last 24 hours',
      icon: '🕘',
      summary: 'CPU and RAM for the past day, and what was running at the worst moments.',
      how: [
        'Click 🕘 in the banner (or say "show me the history", or tray → Web Memory). Red line = RAM, blue = CPU, yellow ticks = events (tingles, Shield actions, Guardian alerts). The faint lines are each minute’s peak.',
        'Tap or drag on the chart to inspect any minute: averages, peaks, the biggest program and what happened. "Worst moments" lists up to three spikes at least 20 minutes apart with the culprit. RAM only counts when it jumped above this PC’s usual level.',
        'One point per minute, 24 hours, kept on your PC.'
      ]
    },
    {
      id: 'tour',
      name: 'Quick tour',
      icon: '🧭',
      summary: 'Five cards on first run; replay any time.',
      how: ['Shows once after install. Say "give me a tour" to see it again.']
    },
    {
      id: 'edith',
      name: 'E.D.I.T.H. — threat assessment',
      icon: '🔍',
      summary: 'A read-only security check with a score.',
      how: [
        'Ask Karen "am I safe?" or use the tray. It checks: antivirus running (and its real-time protection), Windows Firewall, User Account Control, Remote Desktop, which ports listen to the network (and which app owns them), startup entries running from Temp/Downloads, how long since Windows installed an update, and whether Windows is waiting for a restart.',
        'You get a score out of 100 and GREEN / AMBER / RED, with one line of explanation per check (✔ fine, ⚠ worth a look, ✖ fix this, ? could not tell).',
        'Every check that is not fine comes with a numbered fix-it checklist in plain words (where to click in Windows). It never changes any setting itself. A third-party antivirus shows as "?" because it cannot be verified from outside.'
      ]
    },
    {
      id: 'daily',
      name: 'The Daily Web',
      icon: '📰',
      summary: 'An end-of-day comic newspaper made from your own day.',
      how: [
        'Ask Karen "daily web" or "how was my day", or use the tray. A front page opens with a headline chosen from your day (a memory hog, a long focus run, a security scare, or "quiet day"), a photo of the web at its peak, and stats: focus time, tingles by cause, guardian alerts, what Auto-Shield did, eye breaks. When Shield stepped in, that is the headline.',
        'SAVE writes a PNG, COPY puts it on the clipboard. After 9 pm Spidey Sense also nudges you once that today’s edition is out (tray toggle).',
        'The counters behind it are kept on your PC for 14 days.'
      ]
    },
    {
      id: 'locker',
      name: 'Suit Locker',
      icon: '★',
      summary: 'Healthy habits earn XP; levels unlock colour suits.',
      how: [
        'XP: focus session +40 · defending the PC +15 (Auto-Shield acted or you ended a hog; 4 a day) · clean E.D.I.T.H. scan (all green) +20 (once a day) · guardian alert +10 · Daily Web opened +15 (once a day) · E.D.I.T.H. scan +10 (once a day) · eye-rest nudge +5 · reminder fired +5.',
        'Level = floor(√(XP ÷ 50)) + 1. Suits: Classic (L1), Midnight (L2), Gold Armor (L3), Neon Noir (L4), Pop Art (L5), Miles (L6), Prism (L7), Noir (L9), Spider-2099 (L11), Iron Spider (L13).',
        'Click ★ in the banner, or tell Karen "wear the neon suit". Alert colours (yellow / red) never change with a suit, so a warning always looks like a warning.'
      ]
    },
    {
      id: 'eye',
      name: 'Eye-rest nudge (20-20-20)',
      icon: '👁',
      summary: 'Every 20 minutes of continuous use: look 20 feet away for 20 seconds.',
      how: ['Counts only time you are actually active; a 2-minute pause counts as a real break and resets it.', 'Tray → "Eye-rest nudge" turns it off.']
    },
    {
      id: 'startup',
      name: 'Launch at login & auto-update',
      icon: '🚀',
      summary: 'Starts with Windows and keeps itself current.',
      how: [
        'Launch at login is ON by default. It writes a per-user startup entry (no admin), reads it back to verify, and repairs it on every launch if the folder moved or something deleted it. Tray → "Launch at startup" turns it off.',
        'Updates: 30 seconds after start and every 6 hours it checks GitHub releases, downloads only the changed blocks, verifies the hash, and installs when you quit — or tray → "Restart to update", or tell Karen "install update".'
      ]
    }
  ],

  tray: [
    'Show / Hide the web',
    'Open widget / Collapse to badge',
    'Always on top',
    'Opacity (100 / 85 / 70 / 55 %)',
    'RAM alerts (Auto / above 90 % / above 95 % / never)',
    'Spider-sense sound',
    'Eye-rest nudge (20-20-20)',
    'Suit locker (XP)',
    'Web Memory (last 24 hours)',
    'E.D.I.T.H. threat assessment',
    'Today’s Daily Web (front page)',
    'Daily Web ready nudge (9 pm)',
    'Guardian (danger sense)',
    'Auto-Shield (Smart / Ask first / Off)',
    'Desktop notifications',
    'Network check (pings gstatic.com)',
    'Launch at startup',
    'Check for updates / Restart to update',
    'Help & all commands (this manual)',
    'Reset position',
    'Quit Spidey Sense'
  ],

  data: [
    { what: 'Settings', where: '%APPDATA%\\Spidey Sense\\settings.json', note: 'opacity, toggles, window position, view' },
    { what: 'Guardian memory', where: '%APPDATA%\\Spidey Sense\\guardian.json', note: 'which programs / startup entries / drives are "normal"' },
    { what: 'Auto-Shield log and memory', where: '%APPDATA%\\Spidey Sense\\shield.json', note: 'what it did (with undo information), program names seen before' },
    { what: 'Quarantined Startup-folder items', where: '%APPDATA%\\Spidey Sense\\quarantine', note: 'moved here, not deleted; UNDO moves them back' },
    { what: 'Reminders, XP, daily counters, Web Memory', where: 'the widget’s local storage under %APPDATA%\\Spidey Sense', note: '14 days of counters, 24 hours of CPU/RAM history' },
    { what: 'Startup log', where: '%APPDATA%\\Spidey Sense\\startup.log', note: 'only written if enabling launch-at-login ever fails' },
    { what: 'Downloaded updates', where: '<install folder>-updates', note: 'removed on uninstall' }
  ],

  privacy: [
    'No accounts, no analytics, no API keys, no microphone. Nothing you do is uploaded.',
    'Network use, in full: a tiny HEAD request to gstatic.com every 8 seconds (can be turned off) and a GitHub check for updates (30 s after start, then every 6 h). Nothing else.',
    'Read-only access to Windows facilities: `netstat`, `tasklist`, `typeperf`, `reg query`, `sc query`, `Get-Process` / `Get-HotFix` and a hash of the hosts file. It changes nothing on your system except: its own startup entry and files; what Auto-Shield does and logs with an UNDO (a running program’s priority, your own startup entries); and a firewall rule only when you click "BLOCK ITS INTERNET" and approve Windows’ permission prompt.'
  ],

  troubleshooting: [
    { q: 'Where is the tray menu? I can’t find the tray icon.', a: 'Right-click the little spider badge (or anywhere on the open panel): it shows the exact same menu. The tray icon is the red spider next to the clock, but Windows 11 hides new icons under the ^ arrow: click the ^ and drag the spider onto the taskbar so it stays visible.' },
    { q: 'Auto-Shield blocked something I need.', a: 'Open the sense log (click the round status light) and press UNDO on that line, or say "undo". The auto-start entry is restored exactly as it was. If it keeps blocking something you trust, set tray → Auto-Shield → Ask first.' },
    { q: 'Did Auto-Shield slow my programs down?', a: 'It only lowers the priority of a program that kept hogging the CPU, so everything else stays responsive; that program still runs. Press UNDO in the log (or say "undo") to restore its priority.' },
    { q: 'TAKE DOWN says protected, or does nothing.', a: 'Windows itself, Explorer, antivirus and this app are protected on purpose. A program running as administrator cannot be ended by a normal app either: close it yourself.' },
    { q: 'The culprit bar shows nothing for CPU.', a: 'CPU culprits need English Windows counter names. On other languages the bar still names the biggest memory user.' },
    { q: 'The widget disappeared.', a: 'Right-click the tray spider → "Show the web". If it is off-screen: tray → "Reset position".' },
    { q: 'Ctrl+Alt+K does nothing.', a: 'Another program owns that shortcut. Close it, or use the tray menu / the command box on the open panel instead.' },
    { q: 'Karen says "not sure I follow".', a: 'Karen is a rule engine, not a chatbot: say "help" for the phrasing she knows. For talking, voice and an AI brain use Jarvis (a separate app).' },
    { q: 'My RAM is always at 97 % — will it tingle forever?', a: 'No. RAM alerts use "Auto" mode: they fire on jumps above this PC’s normal level. Choose a fixed threshold or "never" in tray → RAM alerts.' },
    { q: 'E.D.I.T.H. shows "?" for antivirus.', a: 'Windows Defender is not running, usually because a third-party antivirus is in charge. That is normal; Spidey Sense cannot verify other products.' },
    { q: 'SmartScreen warns about the installer.', a: 'The installer is not code-signed yet. Click More info → Run anyway.' },
    { q: 'It does not start with Windows.', a: 'Tray → "Launch at startup" should be ticked. Check Task Manager → Startup apps that "Spidey Sense" is not disabled there. The log %APPDATA%\\Spidey Sense\\startup.log lists any write failure.' },
    { q: 'How do I uninstall?', a: 'Windows Settings → Apps → Spidey Sense. The startup entry and downloaded updates are removed with it.' },
    { q: 'An update failed.', a: 'Tray → "Check for updates" retries. Or download the newest installer from the releases page and run it over the old one.' }
  ]
}

module.exports = DATA
