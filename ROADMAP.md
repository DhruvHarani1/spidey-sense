# Spidey Sense roadmap: a smarter, safer system sentinel

Positioning: **a lightweight, always-on system monitor and security sentinel for Windows**: it sees what is happening, understands who is behind it, and acts only in ways you can undo. It complements an antivirus; it does not replace one.

Everything below follows the same rules (see [CONTRIBUTING.md](CONTRIBUTING.md)): no admin rights, nothing leaves the PC unless you opt in, T1 actions only when safe *and* reversible with UNDO, riskier things are offers (T2), Windows security settings are never changed (T3).

## Architecture to grow into: sensors → detectors → responders

Today the sensors, detectors and responses are wired together by hand in `main.js`, `guardian.js`, `shield.js`. To add features without making that worse:

1. **Sensors** are small modules that produce plain events on a bus: `process.start`, `process.cpu`, `net.connection`, `fs.burst`, `startup.new`, `device.mic.use`… (cheap, read-only, each with a cost budget).
2. **Detectors** are pure functions over events and baselines that emit **findings** `{id, severity, evidence, process?, suggestedAction?}`. Pure means unit-testable with recorded fixtures.
3. **Responders** turn a finding into a tiered action: T1 auto (reversible, logged, UNDO), T2 offer, or just a notification. One place enforces the tier rules and the protected list.
4. **A timeline** stores findings and vitals together, so Web Memory, the Daily Web, incident reports and rules all read the same history.

## Now (small, high value)

| # | Feature | Idea | Source (no admin) | Tier |
|---|---|---|---|---|
| 1 | **Privacy sentinel** | Show when the microphone or camera is in use and by which app; log it; warn when an unfamiliar app uses them. | Registry `HKCU\...\CapabilityAccessManager\ConsentStore\{microphone,webcam}` keeps `LastUsedTimeStart/Stop` per app (packaged apps directly, desktop apps under `NonPackaged`; Stop = 0 means in use now). | T0 read, alert |
| 2 | **Unified timeline** | One scrollable timeline of vitals + Guardian + Shield events; filter by program; "what happened at 3 am?". | Existing Web Memory + sense log, merged and persisted. | T0 |
| 3 | **Posture drift alerts** | Run E.D.I.T.H. daily in the background and alert when something got worse (firewall turned off, Defender real-time off, UAC off). | `edith.js` + stored last result. | T0 alert |
| 4 | **Defender detections feed** | Show recent threat detections reported by Defender, and warn when real-time protection was switched off. | Event log `Microsoft-Windows-Windows Defender/Operational` through `wevtutil` (readable by normal users; verify), registry. | T0 |
| 5 | **Rules you write** | `if cpu > 90 for 5 min and process = x then notify / lower priority`; JSON rules with a strict whitelist of actions (notify, lower priority, offer take-down). | New small rule evaluator over the event bus. | T0/T1/T2 per action |
| 6 | **CLI and local status** | `spidey status --json` for scripts; opt-in read-only local endpoint for a dashboard; also lets Jarvis answer "how is my PC?". | Existing readings. | T0 |

## Next

| # | Feature | Idea | Source | Tier |
|---|---|---|---|---|
| 7 | **Network watch** | Per-program live connections: top talkers, new destinations, long-lived connections to raw IPs, mining-pool ports (3333, 4444, 14444…), regular "beacon" intervals. | `netstat -ano` + process map, sampled; no payload inspection. | T0 alert, T2 "block its internet" |
| 8 | **Persistence audit** | Diff scheduled tasks, services that run as the user, Startup folder, Run keys, browser extensions against the baseline; disable a clearly suspicious user-owned scheduled task (reversible). | `schtasks /query /xml`, `reg query`, extension manifests (read-only). | T0 / T1 for user tasks only |
| 9 | **Ransomware tripwire** | Canary files in Documents/Desktop plus rate detection of mass file rename/rewrite; loud alert with the safest next steps; offer TAKE DOWN for the top-CPU program. | `fs.watch` on user folders. Attribution to a process is hard without ETW, so start with alert + offer, research the rest. | T0 alert, T2 offer |
| 10 | **Download watcher** | New `.exe/.msi/.js/.ps1/.lnk` in Downloads: hash (SHA-256), publisher/signature, whether Defender already scanned it; optional hash-only reputation lookup if you add your own key. | Local hashing + `Get-AuthenticodeSignature`; any lookup is opt-in and hash-only. | T0, opt-in network |
| 11 | **USB / new device guard** | When a drive appears: look for `autorun.inf`, executables or shortcuts-to-scripts at the root and hidden-folder tricks; warn before you open anything. | File listing of the new drive. | T0 |
| 12 | **Anomaly baselines** | Learn each program's normal CPU/RAM/network range and flag deviations ("Code normally uses 400 MB, now 3 GB"), including a miner pattern (sustained CPU + pool-port traffic). | Census samples + a small per-program baseline store. | T0 alert / T1 tame |

## Later / research

- **Incident report**: one click exports an HTML/Markdown report (timeline, findings, evidence, what Shield did) to share with someone who helps you.
- **Lockdown checklist**: on a RED level, a guided step list (disconnect, change passwords, scan) rather than automatic drastic changes.
- **Disk health** (`Get-PhysicalDisk` health status), **battery health**, **temperatures** (needs a safe no-admin source; see the open research issues).
- **Hosts-file restore** and other fixes that need admin: only as an explicit, diff-showing button through the Windows permission prompt.
- **Plugin API** for community detectors (pure functions + a manifest of what they read), reviewed against the tier rules.
- **Fleet view** for a few machines (opt-in, local network only).

## Non-goals

Replacing an antivirus, scanning files for malware signatures, killing processes automatically, changing firewall/Defender/UAC settings, collecting telemetry, or anything that needs the user to trust a cloud service.

## How to help

Every item above is tracked as a GitHub issue labelled `roadmap`. Pick one, comment with your approach, and keep the pieces small: a sensor with a fixture-based test, a pure detector with tests, then the UI.
