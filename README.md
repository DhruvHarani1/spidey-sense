# Spidey Sense

**Smart, lightweight system monitoring and protection for Windows.**
It watches your PC's vital signs, notices what is wrong *and who is behind it*, and defends the safe, reversible way, with an undo for everything it does. No account, no cloud, no admin rights.

> Spidey Sense is not an antivirus and does not replace one. It is the always-on sentinel next to it: fast to read at a glance, honest about what it knows, and careful about what it touches.

## What it does

| | |
|---|---|
| **Monitor** | CPU, RAM, disk, battery and network latency on a live radar; 24 hours of history with the worst moments and the program behind each. |
| **Detect** | Names the program behind a spike ("CHROME · 2.1 GB · 38 PROCESSES"); warns about first-time internet contact, new auto-start entries, new listening ports, hosts-file changes, new drives, a filling disk, programs started from Temp/Downloads. |
| **Respond** | **Auto-Shield** lowers the priority of a runaway program and blocks a suspicious new auto-start entry on its own. Everything else is a button you press (end a hog, block a program from the internet). Every action is logged with **UNDO**. |
| **Assess** | **E.D.I.T.H.** scores your security posture (antivirus, firewall, UAC, Remote Desktop, open ports, Windows Update age, pending restart) and gives a numbered fix-it checklist for every problem. Read-only. |
| **Understand** | The **Daily Web** summarises your day in a headline built from real events; **Web Memory** lets you tap any minute of the last 24 hours. |

It lives in a small always-on-top widget: a Spider-Man mask dangling on a thread whose eyes show the state of the PC (calm, alert, tingle with spider-sense shock waves, asleep upside down), opening into the full panel. The Spider-Man skin is there because monitoring should not be dull. Under the skin it is a plain, tested, offline engine.

## How it works

```
 sensors              detectors                responders                 you
 ───────              ─────────                ──────────                 ───
 tasklist / typeperf  runaway-CPU tamer        T1  auto + reversible  ─┐
 netstat, reg, fs     startup judge             (priority, disable    │   sense log
 os / battery / ping  Guardian baselines         auto-start entry)    ├─► with UNDO
 Windows Update age   E.D.I.T.H. checks        T2  offer a button  ───┤
                      disk trend, new ports     (end program,         │   toasts, badge,
                                                block from internet)  │   Daily Web
                                               T3  never                ─┘
```

**Safety model (the rules in `CONTRIBUTING.md`):**

- **T0 read-only** everywhere by default. No admin rights are ever needed.
- **T1 automatic only if safe *and* reversible**, and always logged with an UNDO.
- **T2 anything riskier is an offer**: a button you click (Windows shows its own permission prompt where it is needed).
- **T3 never**: touching Windows, Defender, the firewall, services or security settings on its own; killing anything alone; protected programs (Windows itself, Explorer, antivirus, this app).
- Nothing leaves the PC. Network use is one tiny latency probe (can be turned off) and the update check.

## Features

### Live radar and spider-sense
Five axes (CPU, RAM, disk, battery, network) drawn as a web. Calm → alert (yellow) → tingle (red shake, chirp, notification). RAM alerts fire on a jump above *this* PC's usual level (so a PC that always sits at 97 % does not cry wolf); alerts need 3 readings to start and 5 to stop; notifications are rate-limited. While a focus timer runs, system alerts stay visual only.

### Culprit bar and TAKE DOWN
When memory or CPU is the cause, the panel names the program, its size and how many processes it has, and offers **TAKE DOWN** for the single heaviest one (two clicks, protected programs refused).

### Auto-Shield
Tray → Auto-Shield: **Smart** (default), **Ask first**, **Off**.
- A program that keeps using about a third of the whole CPU gets its **priority lowered** (it keeps working; everything else goes first).
- A **new, suspicious auto-start entry** in your own startup (runs from Temp/Downloads, encoded PowerShell, mshta/wscript…) is **disabled and backed up**.
- Offers: end a hog; block a program that started from Temp/Downloads from the internet.
- Say **"undo"** or press UNDO in the sense log.

### Guardian
First-time internet contact, new auto-start entries, hosts-file changes, new drives, a program opening a new network port, the system drive filling fast. It learns what is normal first, then stays quiet about it.

### E.D.I.T.H. (security posture)
"Am I safe?" gives a 0-100 score and a green/amber/red level with one line per check and a numbered fix-it checklist. Reads only (`reg`, `sc`, `netstat`, `tasklist`, one `Get-HotFix`); never changes a setting.

### Web Memory
The last 24 hours of CPU/RAM, one point per minute, with tingles and Shield actions marked. Tap or drag to inspect any minute; the "worst moments" list names the program behind each.

### The Daily Web
An end-of-day comic newspaper built from your own counters (headline from what really happened, including what Shield did). Save or copy as PNG.

### Also built in
Karen (type `Ctrl+Alt+K`: "status", "what is eating my ram", "undo", "show me the history", "in 20m stretch"; an offline rule engine, no AI), a focus/break timer, THWIP reminders, an eye-rest nudge (20-20-20), Suit Locker (XP for defending the PC; ten colour suits), nap mode, a first-run tour.

## Roadmap

Where it is going (more sensors, more detectors, still safe): see **[ROADMAP.md](ROADMAP.md)**: a privacy sentinel (who is using your microphone and camera), a network watch, a ransomware tripwire, a persistence audit, rules you write yourself, incident reports. Each item is also a GitHub issue.

## Install

`npm run dist` builds `release/Spidey-Sense-Setup-<version>.exe` (per-user NSIS). Prebuilt installers are on the [releases page](https://github.com/DhruvHarani1/spidey-sense/releases).

**Launch at login is on by default** (tray → "Launch at startup" turns it off). It writes a per-user `Run` entry (no admin), reads it back to verify and repairs it on every start. Uninstalling removes it.

**Auto-update:** the app checks GitHub releases 30 s after start and every 6 h, downloads only the changed blocks, verifies the hash and installs on quit (tray → "Restart to update", or ask Karen: "check for updates").

## Run from source

```bash
npm install
npm start
npm run test:unit        # fast tests
SPIDEY_TEST=1 npx electron . --remote-debugging-port=9333   # then: npm test   (drives the real app over CDP)
```

Idle footprint on a busy test PC (badge view, Shield on): roughly 120 MB of private memory and under 10 % of one CPU core; Shield adds a one-second `tasklist` every 10 s. Not covered yet: battery health and temperatures (need admin rights or vendor drivers; see the roadmap).

## Manual & command line

Everything is documented once, in `help-data.js`, and tested so the manual can never describe a command that does not work:
- **In the app:** tray → "Help & all commands", or tell Karen "open the manual".
- **In a terminal:** the installer adds `spidey.cmd`: `spidey help`, `spidey features`, `spidey feature shield`, `spidey privacy`, `spidey search ram`.
- **On the web:** `docs/index.html` (`npm run docs`).

## Contributing

Issues labelled **good first issue** and **help wanted** are the best start; read [CONTRIBUTING.md](CONTRIBUTING.md) first (the safety rules matter). Voice and AI chat live in the sibling project [Jarvis](https://github.com/DhruvHarani1/jarvis).

## License

MIT. Spider-Man styling is fan art; not affiliated with Marvel. All artwork is original/procedural.
