# Spidey Sense

Always-on-top comic-book desktop widget. Your PC's vitals drawn as a spider web; when something spikes, your "spider-sense" tingles.

- **Web radar**: CPU, RAM, disk, battery, network latency on a sagging 5-axis web.
- **Spider-sense**: calm → alert (yellow) → tingle (red shake, chirp, notification). RAM alerts fire on a spike above this PC's usual level (tray → RAM alerts: Auto / 90 / 95 / Never) and name the biggest memory hog; disk alerts only above 90%. Hysteresis avoids flicker; notifications cooldown 120 s per kind.
- **Web timer**: 25 min focus / 5 min break, tingles when time is up.
- Starts as a small swinging spider badge; click it to open the full widget, ▲ in the banner collapses it again. Drag either to move. Tray menu: always on top, opacity, sound, notifications, network check, launch at startup, reset position, quit.
- No accounts, no API keys. Network check = one HEAD request to `gstatic.com/generate_204` every 8 s (can be turned off).

## Install

`npm run dist` builds `release/Spidey-Sense-Setup-<version>.exe` (per-user NSIS). Tray → "Launch at startup" writes the Run key; uninstall removes it.

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

## Karen (the suit AI)

Press **Ctrl+Alt+K** anywhere (or click the box in the panel) and ask in plain words: `status`, `cpu?`, `what is eating my ram`, `remind me to stretch in 20 minutes`, `at 3pm call mum`, `start focus`, `take a break`, `mute`, `opacity 70`, `collapse`, `kill chrome` (always asks first; system processes are protected).

Karen has two layers: a fast offline rule engine, and — for anything else — an optional **local open-source model through [Ollama](https://ollama.com)** (e.g. `ollama pull qwen2.5:1.5b`). Nothing leaves your PC. The model can only trigger a short whitelist of safe actions. Tray → "Karen speaks her replies" reads answers aloud with Windows voices.

## Notification inbox

Click the ✉ in the banner: every Windows notification from every app (WhatsApp, Mail, Edge/YouTube, Lyra, system…) is listed there, and the unread count shows on the badge. It reads the notification database Windows already keeps for your account (read-only, local, nothing is sent anywhere) and keeps the last 100 in the widget. Tray → "Notification inbox" turns it off.

## The Daily Web (end-of-day front page)

A comic newspaper built from your own day: focus time, tingles by cause, the memory hog, notifications received, guardian alerts, with a headline like `CHROME HOARDS MEMORY — CITY ON EDGE!`. Ask Karen ("daily web", "how was my day"), use the tray, or click the 9 pm nudge. **Save** or **Copy** it as a PNG. Everything is computed locally from counters kept for the last 14 days.

## E.D.I.T.H. (threat assessment)

Ask Karen "am I safe?" (or tray → E.D.I.T.H.) for a read-only security check: antivirus, firewall, UAC, Remote Desktop, open listening ports (and which apps own them), startup items running from Temp/Downloads, pending restarts. You get a score and a green/amber/red level. It only reads (`reg`, `sc`, `netstat`, `tasklist`), needs no admin and changes nothing.

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
