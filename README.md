# Spidey Sense

Always-on-top comic-book desktop widget. Your PC's vitals drawn as a spider web; when something spikes, your "spider-sense" tingles.

- **Web radar**: CPU, RAM, disk, battery, network latency on a sagging 5-axis web.
- **Spider-sense**: calm → alert (yellow) → tingle (red shake, chirp, notification). RAM alerts fire on a spike above this PC's usual level (tray → RAM alerts: Auto / 90 / 95 / Never) and name the biggest memory hog; disk alerts only above 90%. Hysteresis avoids flicker; notifications cooldown 120 s per kind.
- **Web timer**: 25 min focus / 5 min break, tingles when time is up.
- Starts as a small swinging spider badge; click it to open the full widget, ▲ in the banner collapses it again. Drag either to move. Tray menu: always on top, opacity, sound, notifications, network check, launch at startup, reset position, quit.
- No accounts, no API keys. Network check = one HEAD request to `gstatic.com/generate_204` every 8 s (can be turned off).

## Install

`npm run dist` builds `release/Spidey-Sense-Setup-<version>.exe` (per-user NSIS).

**Launch at login is on by default** (tray → "Launch at startup" turns it off). It writes a per-user `Run` entry (no admin), reads it back to verify, and repairs it on every start if the install folder moved or something deleted it. Uninstalling removes it.

## Auto-update

The installed app checks GitHub releases 30 s after start and every 6 h, downloads only the changed blocks, verifies the hash, and installs on quit (or via tray → "Restart to update", or ask Karen: "check for updates" / "install update"). Tray → "Check for updates" works any time.

## Run

```bash
npm install
npm start
```

`npm run icons` regenerates `assets/icon.png`. `npm test` drives a running instance over CDP:

```bash
SPIDEY_TEST=1 npx electron . --remote-debugging-port=9333
npm test
```

Fan art; not affiliated with Marvel. All artwork is original/procedural.

## Manual & command line

Everything the gadget can do is documented in one place, three ways — all generated from `help-data.js`, and tested so the manual can never describe a command that does not work:

- **In the app:** tray → "Help & all commands", or tell Karen "open the manual". A searchable, offline, illustrated manual opens in its own window.
- **In a terminal:** the installer puts `spidey.cmd` next to the app. `spidey help`, `spidey commands`, `spidey features`, `spidey feature guardian`, `spidey hotkeys`, `spidey tray`, `spidey privacy`, `spidey troubleshoot`, `spidey search ram`, `spidey docs`. To type just `spidey` anywhere, add the install folder to your PATH. From a checkout: `npm run help` or `node bin/spidey.js commands`.
- **On the web:** `docs/index.html` (regenerate with `npm run docs`; it is also what the app shows).

## AI brain: talk to Karen naturally

Say **"api keys"** (or tray → *AI brain: free API keys…*) and paste one or more free keys — **NVIDIA** (build.nvidia.com), **Groq**, **Google Gemini**, **OpenRouter**, or any OpenAI-compatible URL. Karen tries them top to bottom; a key that hits its limit or fails is rested and the next one answers; after three failed tries she switches to a local **Ollama** model, and finally to her built-in rules. Anything that is not a known command is then answered naturally, with your name, the PC's live status and the last 12 turns of the conversation, and she can run the same commands you could type (reminders, timer, voice, notification reading…) — never close programs. Keys are encrypted with Windows DPAPI and never shown again; online providers only get what you type plus one short status line, never your notifications. See the manual (`spidey feature brain`).

## Karen (the suit AI)

Press **Ctrl+Alt+K** anywhere (or click the box in the panel) and ask in plain words: `status`, `cpu?`, `what is eating my ram`, `remind me to stretch in 20 minutes`, `at 3pm call mum`, `start focus`, `take a break`, `mute`, `opacity 70`, `collapse`, `kill chrome` (always asks first; system processes are protected).

Karen has two layers: a fast offline rule engine, and — for anything else — an optional **local open-source model through [Ollama](https://ollama.com)** (e.g. `ollama pull qwen2.5:1.5b`). Nothing leaves your PC. The model can only trigger a short whitelist of safe actions. Tray → "Karen speaks her replies" reads answers aloud with Windows voices.

## Notification inbox

Click the ✉ in the banner: every Windows notification from every app (WhatsApp, Mail, Edge/YouTube, Lyra, system…) is listed there, and the unread count shows on the badge. It reads the notification database Windows already keeps for your account (read-only, local, nothing is sent anywhere) and keeps the last 100 in the widget. Tray → "Notification inbox" turns it off.

## The Daily Web (end-of-day front page)

A comic newspaper built from your own day: focus time, tingles by cause, the memory hog, notifications received, guardian alerts, with a headline like `CHROME HOARDS MEMORY — CITY ON EDGE!`. Ask Karen ("daily web", "how was my day"), use the tray, or click the 9 pm nudge. **Save** or **Copy** it as a PNG. Everything is computed locally from counters kept for the last 14 days.

## E.D.I.T.H. (threat assessment)

Ask Karen "am I safe?" (or tray → E.D.I.T.H.) for a read-only security check: antivirus, firewall, UAC, Remote Desktop, open listening ports (and which apps own them), startup items running from Temp/Downloads, pending restarts. You get a score and a green/amber/red level. It only reads (`reg`, `sc`, `netstat`, `tasklist`), needs no admin and changes nothing.

## Suit Locker (XP and suits)

Healthy habits earn XP: focus session +40, guardian alert +10, Daily Web +15 and E.D.I.T.H. scan +10 (once a day each), eye break / reminder +5. Levels unlock colour schemes — Classic, Midnight, Gold Armor, Neon Noir, Pop Art, Prism. Click ★ in the banner, or ask Karen ("my level", "wear the neon suit"). Alert colours (yellow/red) never change with a suit.

## Web-Capture (comic screenshots)

Press **Ctrl+Alt+C** (or ask Karen "take a screenshot", or tray → Web-Capture). The screen freezes; drag a box. Your capture is turned into a comic panel — posterised colour, ink outlines, halftone shading — with an editable caption (default `THWIP!`). **Copy** puts it on the clipboard, **Save** writes a PNG. Nothing is uploaded; the widget hides itself so it is not in the shot.

## Karen reads your notifications aloud

Say **"read my notifications"** (and **"call me Dhruv sir"** once). From then on every new notification is spoken, wording fitted to the kind: *"Dhruv sir, you received a message from Mum on WhatsApp. The message is: dinner at eight."* — messages, group chats, photos/voice notes, email, calls (announced immediately), calendar, Windows notices, websites. Emoji and links are tidied for the voice, long messages are trimmed, non-English scripts are left on screen. Notifications queue (never overlap); bursts become a summary; while you are away or in a focus session she collects them and gives one digest when you are back ("what did I miss" reads them). **Private mode** says only who, never what; apps can be muted ("don't read youtube"). **"change voice"** switches between the Windows voices (Zira / David). Full details: the manual (`spidey feature reader`).

## Reminders

Type into the panel's THWIP box (or press **Ctrl+Alt+S** anywhere to open it focused): `in 20m stretch`, `in 2h call mum`, `at 15:30 standup`, `at 7pm dinner`. When due, the widget tingles, chirps and notifies. Up to 6 pending, stored locally.

## Also built in

- **Eye-rest nudge (20-20-20)**: after 20 min of continuous use it tingles to look away for 20 s; a 2 min pause resets it. Tray toggle.
- **Nap mode**: the badge dims and snoozes after 3 min idle.
- **Focus streak**: completed focus sessions today show as ★N on the timer chip.
- **Focus quiet**: while a focus timer runs, system alerts stay visual only (no chirp or notification); reminders and the timer still speak up.

## Ideas for later

- Per-process panel (top 5 RAM/CPU hogs).
- Daily "web strength" history.
