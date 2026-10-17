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
        { say: 'wear the neon suit', does: 'Equips a suit you have unlocked (midnight, gold, neon, pop, prism).', try: 'wear the neon suit' },
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
        'It tingles (and logs, see the status light in the banner) when: a program contacts the internet for the first time; a new auto-start entry appears; the hosts file changes; or a new drive (USB stick, card, phone) is connected.',
        'For the first 3 minutes after the very first run it only learns what is normal, so it does not alert on everything you already use.',
        'At most one alert every 20 seconds. Click the round status light in the banner to read the log.'
      ],
      reads: 'Uses netstat, tasklist and reg.exe plus a hash of the hosts file. No admin rights, no network calls. Tray → "Guardian" turns it off.'
    },
    {
      id: 'edith',
      name: 'E.D.I.T.H. — threat assessment',
      icon: '🔍',
      summary: 'A read-only security check with a score.',
      how: [
        'Ask Karen "am I safe?" or use the tray. It checks: antivirus running, Windows Firewall, User Account Control, Remote Desktop, which ports listen to the network (and which app owns them), startup entries running from Temp/Downloads, and whether Windows is waiting for a restart.',
        'You get a score out of 100 and GREEN / AMBER / RED, with one line of explanation per check (✔ fine, ⚠ worth a look, ✖ fix this, ? could not tell).',
        'It never changes any setting. A third-party antivirus shows as "?" because it cannot be verified from outside.'
      ]
    },
    {
      id: 'daily',
      name: 'The Daily Web',
      icon: '📰',
      summary: 'An end-of-day comic newspaper made from your own day.',
      how: [
        'Ask Karen "daily web" or "how was my day", or use the tray. A front page opens with a headline chosen from your day (a memory hog, a long focus run, a security scare, or "quiet day"), a photo of the web at its peak, and stats: focus time, tingles by cause, notifications, guardian alerts, eye breaks.',
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
        'XP: focus session +40 · guardian alert +10 · Daily Web opened +15 (once a day) · E.D.I.T.H. scan +10 (once a day) · eye-rest nudge +5 · reminder fired +5.',
        'Level = floor(√(XP ÷ 50)) + 1. Suits: Classic (L1), Midnight (L2), Gold Armor (L3), Neon Noir (L4), Pop Art (L5), Prism (L7).',
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
    'E.D.I.T.H. threat assessment',
    'Today’s Daily Web (front page)',
    'Daily Web ready nudge (9 pm)',
    'Guardian (danger sense)',
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
    { what: 'Reminders, XP, daily counters', where: 'the widget’s local storage under %APPDATA%\\Spidey Sense', note: '14 days of counters' },
    { what: 'Startup log', where: '%APPDATA%\\Spidey Sense\\startup.log', note: 'only written if enabling launch-at-login ever fails' },
    { what: 'Downloaded updates', where: '<install folder>-updates', note: 'removed on uninstall' }
  ],

  privacy: [
    'No accounts, no analytics, no API keys, no microphone. Nothing you do is uploaded.',
    'Network use, in full: a tiny HEAD request to gstatic.com every 8 seconds (can be turned off) and a GitHub check for updates (30 s after start, then every 6 h). Nothing else.',
    'Read-only access to Windows facilities: `netstat`, `tasklist`, `reg query`, `sc query`, and a hash of the hosts file. It changes nothing on your system except its own startup entry and its own files.'
  ],

  troubleshooting: [
    { q: 'Where is the tray menu? I can’t find the tray icon.', a: 'Right-click the little spider badge (or anywhere on the open panel): it shows the exact same menu. The tray icon is the red spider next to the clock, but Windows 11 hides new icons under the ^ arrow: click the ^ and drag the spider onto the taskbar so it stays visible.' },
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
