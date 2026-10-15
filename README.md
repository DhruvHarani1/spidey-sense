# Spidey Sense

Always-on-top comic-book desktop widget. Your PC's vitals drawn as a spider web; when something spikes, your "spider-sense" tingles.

- **Web radar**: CPU, RAM, disk, battery, network latency on a sagging 5-axis web.
- **Spider-sense**: calm → alert (yellow) → tingle (red shake, chirp, notification). Hysteresis avoids flicker; notifications cooldown 120 s per kind.
- **Web timer**: 25 min focus / 5 min break, tingles when time is up.
- Drag anywhere to move. Tray menu: always on top, opacity, sound, notifications, network check, launch at startup, reset position, quit.
- No accounts, no API keys. Network check = one HEAD request to `gstatic.com/generate_204` every 8 s (can be turned off).

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
