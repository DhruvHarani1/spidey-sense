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
    'Spidey Sense is a small always-on-top comic-book widget for Windows. It watches your PC the way a spider-sense would — CPU, RAM, disk, battery, network — and "tingles" when something is wrong. Around that core it has an AI-style command bar (Karen), a notification inbox, a security check, an end-of-day newspaper, comic screenshots and more. Everything runs locally; there are no accounts and no API keys.',

  quickstart: [
    'Install it, run it: a small swinging spider badge appears at the top-right of your screen.',
    'Click the badge to open the full widget. Click ▲ in its banner to fold it back into the badge. Drag either to move it.',
    'Press Ctrl+Alt+K anywhere and type to Karen: "status", "what is eating my ram", "in 20m stretch".',
    'Right-click the badge (or anywhere on the open panel) for the full menu: every option, including this manual. The same menu lives on the tray icon by the clock; Windows often hides new tray icons under the ^ arrow, so drag the red spider out onto the taskbar to keep it visible.'
  ],

  hotkeys: [
    { keys: 'Ctrl+Alt+K', does: 'Open the widget and focus Karen’s command box (works from any app).' },
    { keys: 'Ctrl+Alt+S', does: 'Same as Ctrl+Alt+K (kept from the old reminders shortcut).' },
    { keys: 'Ctrl+Alt+Space', does: 'Talk to Karen: opens the microphone, listens until you stop speaking, answers out loud. Press again to finish early; Esc cancels.' },
    { keys: 'Ctrl+Alt+C', does: 'Web-Capture: freeze the screen and turn a region into a comic panel.' },
    { keys: 'Esc', does: 'Close any open overlay (inbox, log, newspaper, locker…) or cancel a capture.' },
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
      group: 'Notifications read aloud',
      items: [
        { say: 'read my notifications', does: 'Karen reads every new notification out loud: "Dhruv sir, you received a message from Mum on WhatsApp. The message is: dinner at eight." Messages, email, calls, calendar and system notices each get natural wording. Off by default.', try: 'read my notifications', aka: ['announce my messages', 'turn on notification reading'] },
        { say: 'stop reading notifications', does: 'Turns it off and cuts off anything she is saying.', try: 'stop reading notifications', aka: ["don't read my messages", 'turn off notification reading'] },
        { say: 'call me Dhruv sir', does: 'How she addresses you ("Dhruv sir, you received…"). Use any name or title. Without one she skips the address.', try: 'call me Dhruv sir', aka: ['you can call me Boss'] },
        { say: 'read notifications privately', does: 'Private mode: she says who messaged you and on which app, never what they said. Good in a café or a meeting. "read everything" switches back.', try: 'read notifications privately', aka: ['private mode', 'only tell me who'] },
        { say: "don't read youtube", does: 'Never read that app’s notifications (works for any app name: whatsapp, mail, teams…).', try: "don't read youtube", aka: ['stop reading whatsapp notifications', 'ignore teams'] },
        { say: 'read whatsapp again', does: 'Puts an app back on her list.', try: 'read whatsapp again', aka: ['start reading mail'] },
        { say: 'what did I miss', does: 'Reads your unread notifications, newest first (up to 5), one short line each.', try: 'what did i miss', aka: ['any new messages', 'do i have any notifications'] },
        { say: 'repeat that', does: 'Says the last notification again.', try: 'repeat that', aka: ['say that again', 'what was that'] },
        { say: 'skip', does: 'Stops what she is saying right now (the next queued notification still plays; "stop reading notifications" silences everything).', try: 'skip', aka: ['enough', 'next'] },
        { say: 'are you reading my notifications', does: 'Tells you the current reading settings: on/off, mode, your name, muted apps.', try: 'are you reading my notifications' }
      ]
    },
    {
      group: 'Karen’s voice',
      items: [
        { say: 'change voice', does: 'Switches between the Windows voices installed on your PC (normally Zira, female, and David, male) and says a line in the new one.', try: 'change voice', aka: ['try another voice', 'next voice'] },
        { say: 'use david', does: 'Picks a voice by name (zira, david) or by gender ("use the female voice").', try: 'use david', aka: ['switch to zira', 'use the female voice'] },
        { say: 'list voices', does: 'Shows which voices are installed and which one is active (✓).', try: 'list voices', aka: ['what voices do you have'] }
      ]
    },
    {
      group: 'Talking to her out loud',
      items: [
        { say: 'listen', does: 'Opens the microphone, same as Ctrl+Alt+Space or the 🎤 button.', try: 'listen', aka: ['listen to me', "let's talk", 'start listening'] },
        { say: 'turn on the wake word', does: 'Karen listens for "Hey Karen" / "Hey Spidey" so you need no hotkey. Offline; a blue ear shows on the badge while on. "turn off the wake word" to stop.', try: 'turn on the wake word', aka: ['wake word off', 'always listening'] },
        { say: 'conversation mode', does: 'After she answers a spoken question she listens again for your follow-up, so you can just keep talking. "conversation mode off" to stop.', try: 'conversation mode', aka: ['keep listening', 'hands free'] },
        { say: 'use windows speech recognition', does: 'Recognise your voice with Windows only: no audio ever leaves this PC. (Less accurate than Groq Whisper.)', try: 'use windows speech recognition', aka: ["don't send my voice"] },
        { say: 'switch to groq whisper', does: 'Back to automatic: Groq Whisper when you have a Groq key, otherwise Windows.', try: 'switch to groq whisper' }
      ]
    },
    {
      group: 'Talking to Karen naturally (AI brain)',
      items: [
        { say: 'api keys', does: 'Opens the AI brain window: add free API keys (NVIDIA, Groq, Gemini, OpenRouter, any OpenAI-compatible URL), order them, test them.', try: 'api keys', aka: ['open the ai settings', 'set up the ai', 'add an api key'] },
        { say: 'which ai are you using', does: 'Says which key / model answered last.', try: 'which ai are you using', aka: ['brain status'] },
        { say: 'new chat', does: 'Makes Karen forget the conversation so far (she remembers the last 12 turns otherwise).', try: 'new chat', aka: ['forget this conversation', 'start over'] },
        { say: 'how are you today?', does: 'With a brain set up, anything that is not a known command is answered naturally and can trigger actions ("could you nudge me in twenty minutes to stretch" sets a reminder). Without a brain you get a short built-in reply.', try: 'how are you' }
      ]
    },
    {
      group: 'The widget itself',
      items: [
        { say: 'open the manual', does: 'Opens this manual in its own window (also: "docs", "all commands", "what can you do").', try: 'open the manual', aka: ['docs', 'what can you do'] },
        { say: 'speak to me', does: 'Karen reads every reply aloud with a Windows voice (Zira, or David if that is all you have). Say \"stop talking\" to silence her; the tray has the same switch.', try: 'speak to me', aka: ['talk to me', 'read it aloud', 'turn on the voice'] },
        { say: 'stop talking', does: 'Turns the spoken replies off and cuts off anything she is saying.', try: 'stop talking', aka: ['voice off', 'stop speaking'] },
        { say: 'say hello', does: 'Speaks one test sentence so you can check your speakers, without switching the voice on.', try: 'say hello', aka: ['test your voice', 'can you hear me'] },
        { say: 'collapse', does: 'Folds the panel back into the badge.', try: 'collapse' },
        { say: 'mute / unmute', does: 'Turns the alert chirp off or on.', try: 'mute' },
        { say: 'opacity 70', does: 'Sets window opacity from 30 to 100.', try: 'opacity 70' },
        { say: 'make it more transparent', does: 'Shortcut for opacity 70.', try: 'make it more transparent' }
      ]
    },
    {
      group: 'Features by voice… well, by typing',
      items: [
        { say: 'am I safe?', does: 'Runs E.D.I.T.H., the security assessment.', try: 'am i safe' },
        { say: 'daily web', does: 'Opens today’s comic newspaper front page.', try: 'show me the daily web' },
        { say: 'take a screenshot', does: 'Starts Web-Capture (comic screenshot).', try: 'take a screenshot' },
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
    'Anything it does not recognise can go to an optional local AI model through Ollama (https://ollama.com): install it, run `ollama pull qwen2.5:1.5b` (about 1 GB), and Karen answers free-form questions. It stays on your PC (127.0.0.1) and can only trigger a short whitelist of safe actions: set a reminder, control the timer, mute, collapse.',
    'The model never gets to kill processes or touch files. Tray → "Karen speaks her replies" reads answers aloud using Windows voices.',
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
      how: ['Ctrl+Alt+K opens it anywhere. See the full command list below.', 'Replies appear in the yellow caption box for ~12 seconds (and can be spoken aloud).']
    },
    {
      id: 'inbox',
      name: 'Notification inbox',
      icon: '✉',
      summary: 'Every Windows notification from every app, in one place.',
      how: [
        'Click ✉ in the banner. Each row shows the app, the title, the message and the time. Click a row to dismiss it; CLEAR empties the list. The newest 100 are kept.',
        'The unread count shows on the ✉ and on the badge. Opening the inbox marks everything read.',
        'On first start it also shows the last few notifications from the past 12 hours, so it is not empty.'
      ],
      reads: 'Windows keeps a database of recent notifications for your account (wpndatabase.db). Spidey Sense reads a private, read-only copy of it every few seconds. Nothing is sent anywhere. Tray → "Notification inbox" turns it off.'
    },
    {
      id: 'voice',
      name: 'Talk to Karen — Jarvis-style voice conversation',
      icon: '🎤',
      summary: 'Press Ctrl+Alt+Space, speak, and she answers out loud, sentence by sentence while she is still thinking.',
      how: [
        'Press Ctrl+Alt+Space anywhere (or click 🎤 beside the command box, or say "listen"). A rising beep and a blue ring on the badge show the microphone is open. Speak normally; when you stop for about a second she knows you are done (press the hotkey again to finish early, Esc to cancel). The microphone is open ONLY while the blue ring is on; nothing is recorded in the background.',
        'Your words are turned into text with Groq Whisper when you have a Groq key (accurate, fast, handles accents), otherwise with Windows’ built-in offline recogniser, which listens for exactly the commands Karen knows ("what is my CPU", "start focus", "remind me in twenty minutes to…") plus free dictation. Spoken numbers work: "in twenty minutes", "half an hour", "at five pm".',
        'Then it is a normal Karen turn: commands run, anything else goes to the AI brain. Because you spoke, every answer is spoken back (Windows voice; "change voice" picks Zira or David). Brain replies stream: the first sentence is spoken as soon as it is written, the rest follow, and the caption fills in as she talks. You can interrupt her any time by pressing the hotkey: she stops instantly and listens.',
        'Conversation mode ("conversation mode"): after a spoken answer she listens again for 5 seconds for your follow-up, so you can chat without touching anything. If you say nothing she quietly stops.',
        'Wake word (opt-in, off by default): tray → Wake word, or say "turn on the wake word". Then say "Hey Karen" or "Hey Spidey" (also "Okay Karen/Spidey"), pause for the beep, and ask. A small blue ear shows on the badge while it is on. She ignores the wake word while she is talking so she never wakes herself.',
        'Windows needs to allow microphone access for desktop apps (Settings → Privacy & security → Microphone). The first time, Windows may show its own prompt.'
      ],
      reads: 'Audio is recorded in memory only while the ring is on, converted to a small WAV and sent to Groq (if you use Groq Whisper) or handed to the Windows recogniser through a temporary file that is deleted immediately. Choose "Speech recognition → Windows only" in the tray (or say "use windows speech recognition") to guarantee that audio never leaves your PC. Recordings are never saved. The wake word is different in one way: while it is on, a small Windows recogniser keeps the microphone open and checks only for the four wake phrases, on this PC. Nothing is recorded, stored or sent; the real question is captured only after the beep. It costs roughly 60–90 MB of RAM, and Windows shows its microphone-in-use icon while it is on.'
    },
    {
      id: 'brain',
      name: 'AI brain — talk to Karen naturally',
      icon: '🧠',
      summary: 'Free online AI models with automatic failover, then a local model, then built-in rules.',
      how: [
        'Open it with "api keys" (or tray → AI brain: free API keys…). Paste one or more keys. Karen tries them top to bottom; if one hits its limit or fails she moves to the next. After three failed tries in one question she switches to the local model on your PC (Ollama), and if that is missing she falls back to her built-in rules. Reorder with ▲ ▼, switch a key off, test it, or replace it.',
        'A key that hits a rate limit (HTTP 429) rests for the time the provider asks for (or 1 minute, doubling up to 15), a key that is rejected (401/403) is marked KEY REJECTED and left alone until you change it, and server errors rest briefly. Keys are only tried again when they have recovered, so a dead key never slows you down.',
        'Providers: NVIDIA (build.nvidia.com — 100+ open models, free key, about 40 requests a minute), Groq (very fast), Google Gemini (AI Studio), OpenRouter (:free models), or any OpenAI-compatible URL (Mistral, Together, a server you host…). The model is picked automatically from what your key can use, or type one yourself. Free tiers change — check each provider’s dashboard for current limits and terms.',
        'What it enables: just talk. "How are you?", "what should I do with this hour?", "could you nudge me in twenty minutes to stretch" — she answers in a few spoken-style sentences, uses your name, knows the time and your PC’s status, remembers the last 12 turns, and can run the same commands you could type (reminders, timer, notification reading, voice, screenshots…). She can NOT close programs, change settings outside the widget, or run anything else — the brain can only choose from a whitelist, and every action goes through the same rule engine as typed commands.',
        'Say "karen speaks her replies" on (tray) and she talks back; with notification reading and voice switching you get a full voice assistant on the output side. (Speaking to her by microphone is the next step.)'
      ],
      reads: 'Online providers receive what you type to Karen plus ONE short status line (time, CPU/RAM/disk, ping, battery, timer, number of unread notifications, XP level). Never notification contents, file names or anything else on your PC. Keys are encrypted with Windows DPAPI and are never shown again, logged or sent anywhere except to their own provider. Some free tiers may use prompts to improve their models (Google says so for its free tier): do not tell Karen secrets, or keep the local model as your only brain.'
    },
    {
      id: 'reader',
      name: 'Notification reader — Karen reads them aloud',
      icon: '🔊',
      summary: 'Every new notification, spoken: "Dhruv sir, you received a message from Mum on WhatsApp. The message is: …"',
      how: [
        'Turn it on with "read my notifications" (or tray → Read notifications aloud). Tell her your name once: "call me Dhruv sir". It is off until you switch it on.',
        'Wording fits the kind of notification. Messages (WhatsApp, Telegram, Teams, Discord, Slack, SMS via Phone Link…): "you received a message from X on WhatsApp. The message is: …". In group chats she says who wrote it and in which group. Photos, voice notes and videos are described ("they sent a photo"). Email: "you have a new email from X. The subject is: …". Calls: "Mum is calling you on WhatsApp" — calls cut in immediately and are never held back. Calendar, Windows notices and websites (YouTube etc.) are announced with the app name first.',
        'She tidies the text for a speech voice: emoji and markdown vanish, links become "a link", "heeeeey!!!!!" is shortened, very long messages are cut ("… and more"). Text in a script an English voice would garble (Hindi, Arabic, Chinese…) is not spoken: "the message is not in English, so I left it on screen".',
        'Nothing overlaps: notifications queue and are read one after another. If more than three arrive at once you get a summary instead ("you received 5 notifications: 3 from WhatsApp, 2 from Mail").',
        'Away or focusing? While you are away from the PC (3 minutes idle) or a focus timer is running, she stays quiet and collects them; the moment you are back, or the session ends, you get one digest ("Welcome back… you received 4 notifications: 3 from WhatsApp…"). Then say "what did I miss" to hear them.',
        'Private mode ("read notifications privately") speaks only who and where, never the content. Apps you never want read can be muted by name ("don\'t read youtube"). By default now-playing pings and vendor chatter (Lyra, Settings, System, Lenovo, Intel) are muted. The same notification is read once per minute at most, and anything older than 3 minutes (e.g. from before the app started) is skipped.',
        'The voice is the Windows voice you picked ("change voice"): Zira or David.'
      ],
      reads: 'It uses the notifications the inbox already collects (a read-only copy of the Windows notification database) and the speech engine built into Windows. The text is passed to the speech engine through stdin, never run as a command, and nothing leaves your PC.'
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
      id: 'capture',
      name: 'Web-Capture',
      icon: '📸',
      summary: 'Comic-book screenshots.',
      how: [
        'Press Ctrl+Alt+C (or ask Karen "take a screenshot"). The widget hides, the screen freezes, and you drag a box around what you want.',
        'It becomes a comic panel: posterised colour, black ink outlines, halftone shading, a frame, and a yellow caption box. Edit the caption (default THWIP!) and the panel updates live.',
        'COPY → clipboard, SAVE → PNG file, AGAIN → pick another region, CLOSE or Esc → done. Nothing is uploaded.'
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
    'Talk to Karen (Ctrl+Alt+Space)',
    'Keep listening after she answers (conversation mode)',
    'Wake word: say "Hey Karen" / "Hey Spidey" (always listening, offline)',
    'Speech recognition (Automatic / Windows only)',
    'Karen speaks her replies',
    'Read notifications aloud',
    'Notification reading: private (who, not what)',
    'Karen’s voice (Automatic / Zira / David)',
    'Web-Capture: comic screenshot',
    'Suit locker (XP)',
    'E.D.I.T.H. threat assessment',
    'Today’s Daily Web (front page)',
    'Daily Web ready nudge (9 pm)',
    'AI brain: free API keys…',
    'Notification inbox',
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
    { what: 'Reminders, inbox, XP, daily counters', where: 'the widget’s local storage under %APPDATA%\\Spidey Sense', note: 'last 100 inbox items, 14 days of counters' },
    { what: 'Startup log', where: '%APPDATA%\\Spidey Sense\\startup.log', note: 'only written if enabling launch-at-login ever fails' },
    { what: 'Downloaded updates', where: '<install folder>-updates', note: 'removed on uninstall' }
  ],

  privacy: [
    'No accounts, no analytics, no API keys. Nothing you do is uploaded.',
    'Network use, in full: a tiny HEAD request to gstatic.com every 8 seconds (can be turned off), a GitHub check for updates (30 s after start, then every 6 h), and — only if you install Ollama — local traffic to 127.0.0.1.',
    'Voice: the microphone is open only while the blue ring is on. With a Groq key the recorded sentence is sent to Groq for transcription; with "Windows only" it never leaves your PC. Nothing is saved.',
    'Read-only access to Windows facilities: the notification database, `netstat`, `tasklist`, `reg query`, `sc query`, and a hash of the hosts file. It changes nothing on your system except its own startup entry and its own files.'
  ],

  troubleshooting: [
    { q: 'Where is the tray menu? I can’t find the tray icon.', a: 'Right-click the little spider badge (or anywhere on the open panel): it shows the exact same menu. The tray icon is the red spider next to the clock, but Windows 11 hides new icons under the ^ arrow: click the ^ and drag the spider onto the taskbar so it stays visible.' },
    { q: 'I can’t hear Karen.', a: 'Say "say hello" to test your speakers, then "speak to me" to switch spoken replies on (tray: "Karen speaks her replies"). She uses the Windows voices Zira / David, so check your volume and the Windows output device. Say "stop talking" to turn her off.' },
    { q: 'Karen does not read my WhatsApp messages.', a: 'Check: (1) "are you reading my notifications" — it must say on; (2) the app is not muted ("read whatsapp again"); (3) you are not away or in a focus session (she saves those for a digest); (4) Windows is actually showing WhatsApp notifications (Settings → System → Notifications) — only notifications Windows records can be read; (5) the message is not in a non-English script, which she leaves on screen.' },
    { q: 'She reads notifications too loudly / in public.', a: 'Say "read notifications privately" so she only says who, or "stop reading notifications". Turn the Windows volume down — she speaks through the normal output device.' },
    { q: 'Ctrl+Alt+Space does nothing / she says she can’t use the microphone.', a: 'Open Windows Settings → Privacy & security → Microphone and switch on "Let desktop apps access your microphone". Another program may also own the shortcut: use the 🎤 button or tray → Talk to Karen instead.' },
    { q: 'She mishears me.', a: 'Offline recognition is the weak spot: add a free Groq key ("api keys") and she switches to Whisper automatically, which is far more accurate. Speak after the beep, close to the microphone, and pause about a second when you are done.' },
    { q: 'Hey Karen does not wake her / wakes her by mistake.', a: 'Say the phrase clearly, then pause for the beep before asking (words straight after the phrase are lost). Speaker volume from music or a video can confuse it: use the hotkey in noisy rooms. If it says it could not start, check Windows microphone privacy for desktop apps. Turn it off with tray → Wake word.' },
    { q: 'She stops listening before I finish / waits too long.', a: 'She decides you are done after about a second of quiet. In a very noisy room the quiet may never come: press Ctrl+Alt+Space again to finish, or use the hotkey right after you speak.' },
    { q: 'Karen says "not sure I follow" to everything.', a: 'She only chats when she has a brain. Say "api keys", paste a free key (NVIDIA / Groq / Gemini / OpenRouter), press Test. Or install Ollama + a small model for a private local brain.' },
    { q: 'A key shows COOLING or KEY REJECTED.', a: 'COOLING = the provider said "too many requests"; it is retried automatically after the wait shown. KEY REJECTED = the provider refused the key: copy it again from the provider’s dashboard and press "New key". Karen simply uses the next key in the meantime.' },
    { q: 'Is it safe to put API keys in? Where do they go?', a: 'They are encrypted with Windows (DPAPI, tied to your Windows account) in brain.json, and only ever sent to the provider they belong to. The settings window can add or replace a key but can never display one again.' },
    { q: 'The widget disappeared.', a: 'Right-click the tray spider → "Show the web". If it is off-screen: tray → "Reset position".' },
    { q: 'Ctrl+Alt+K / Ctrl+Alt+C does nothing.', a: 'Another program owns that shortcut. Close it, or use the tray menu / Karen instead — everything the hotkeys do is also in the tray.' },
    { q: 'My RAM is always at 97 % — will it tingle forever?', a: 'No. RAM alerts use "Auto" mode: they fire on jumps above this PC’s normal level. Choose a fixed threshold or "never" in tray → RAM alerts.' },
    { q: 'The inbox is empty.', a: 'It only shows notifications Windows recorded. Check Windows Settings → System → Notifications, and tray → "Notification inbox" is ticked. Some apps (and Do Not Disturb) never create a notification record.' },
    { q: 'Karen says "not sure I follow".', a: 'Say "help" for the phrasing she knows, or install Ollama and a small model for free-form chat.' },
    { q: 'E.D.I.T.H. shows "?" for antivirus.', a: 'Windows Defender is not running, usually because a third-party antivirus is in charge. That is normal; Spidey Sense cannot verify other products.' },
    { q: 'SmartScreen warns about the installer.', a: 'The installer is not code-signed yet. Click More info → Run anyway.' },
    { q: 'It does not start with Windows.', a: 'Tray → "Launch at startup" should be ticked. Check Task Manager → Startup apps that "Spidey Sense" is not disabled there. The log %APPDATA%\\Spidey Sense\\startup.log lists any write failure.' },
    { q: 'How do I uninstall?', a: 'Windows Settings → Apps → Spidey Sense. The startup entry and downloaded updates are removed with it.' },
    { q: 'An update failed.', a: 'Tray → "Check for updates" retries. Or download the newest installer from the releases page and run it over the old one.' }
  ]
}

module.exports = DATA
