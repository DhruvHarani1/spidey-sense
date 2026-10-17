# Spidey Sense

Always-on-top comic-book desktop widget. Your PC's vitals drawn as a spider web; when something spikes, your "spider-sense" tingles.

- **Web radar**: CPU, RAM, disk, battery, network latency on a sagging 5-axis web.
- **Spider-sense**: calm → alert (yellow) → tingle (red shake, chirp, notification). RAM alerts fire on a spike above this PC's usual level (tray → RAM alerts: Auto / 90 / 95 / Never) and name the biggest memory hog; disk alerts only above 90%. Hysteresis avoids flicker; notifications cooldown 120 s per kind.
- **Web timer**: 25 min focus / 5 min break, tingles when time is up.
- Starts as a small swinging spider badge; click it to open the full widget, ▲ in the banner collapses it again. Drag either to move. Tray menu: always on top, opacity, sound, notifications, network check, launch at startup, reset position, quit.
- No accounts, no API keys, no microphone. Network check = one HEAD request to `gstatic.com/generate_204` every 8 s (can be turned off).

> **0.3.0 is the focus release.** Voice, the wake word, the AI brain, notification reading and the inbox moved to a separate app, **Jarvis**; Web-Capture is parked in *Spidey Lab*. Spidey Sense is now only the danger-sense widget. See `FOCUS-PLAN.md` for the why. The last all-in-one version is tag `v0.2.7-final-with-jarvis-features`.

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

## Karen (the suit AI)

Press **Ctrl+Alt+K** anywhere (or click the box in the panel) and ask in plain words: `status`, `cpu?`, `what is eating my ram`, `remind me to stretch in 20 minutes`, `at 3pm call mum`, `start focus`, `take a break`, `mute`, `opacity 70`, `collapse`, `kill chrome` (always asks first; system processes are protected).

Karen is a fast offline rule engine, not a chatbot: no AI, no network, no microphone. For talking, voice and AI chat use Jarvis.

## The Daily Web (end-of-day front page)

A comic newspaper built from your own day: focus time, tingles by cause, the memory hog, notifications received, guardian alerts, with a headline like `CHROME HOARDS MEMORY — CITY ON EDGE!`. Ask Karen ("daily web", "how was my day"), use the tray, or click the 9 pm nudge. **Save** or **Copy** it as a PNG. Everything is computed locally from counters kept for the last 14 days.

## E.D.I.T.H. (threat assessment)

Ask Karen "am I safe?" (or tray → E.D.I.T.H.) for a read-only security check: antivirus, firewall, UAC, Remote Desktop, open listening ports (and which apps own them), startup items running from Temp/Downloads, pending restarts. You get a score and a green/amber/red level. It only reads (`reg`, `sc`, `netstat`, `tasklist`), needs no admin and changes nothing.

## Suit Locker (XP and suits)

Healthy habits earn XP: focus session +40, guardian alert +10, Daily Web +15 and E.D.I.T.H. scan +10 (once a day each), eye break / reminder +5. Levels unlock colour schemes — Classic, Midnight, Gold Armor, Neon Noir, Pop Art, Prism. Click ★ in the banner, or ask Karen ("my level", "wear the neon suit"). Alert colours (yellow/red) never change with a suit.

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
