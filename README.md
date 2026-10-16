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

## Reminders

Type into the panel's THWIP box (or press **Ctrl+Alt+S** anywhere to open it focused): `in 20m stretch`, `in 2h call mum`, `at 15:30 standup`, `at 7pm dinner`. When due, the widget tingles, chirps and notifies. Up to 6 pending, stored locally.

## Ideas for later

- Per-process panel (top 5 RAM/CPU hogs).
- Daily "web strength" history.
