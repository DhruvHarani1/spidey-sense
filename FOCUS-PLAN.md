# Spidey Sense — Focus Plan

Status: **APPROVED. Phase 0 and Phase 1 DONE (2026-10-18).** Phase 0: tag `v0.2.7-final-with-jarvis-features`. Phase 1: `P:\Jarvis` created (local git repo, 1 commit, not on GitHub yet) with the voice / wake word / AI brain / STT / inbox / reader code copied (not removed) from Spidey, a new minimal Electron shell, and its own tests (unit + wiring + real-app e2e) all passing. Spidey is untouched except one small wake-word fix. **Next: Phase 2 (cut Spidey down), which needs the go-ahead.**

## 1. The problem

Spidey Sense started as one idea: a small Spider-Man widget that **senses trouble on your PC** (spider-sense) and tingles before you notice it. Since then it grew into a general assistant: voice conversation, wake word, AI brain with API keys, speaking notifications aloud, a notification inbox, screenshot-comics, a newspaper, XP and suits.

Most of those are good features, but they are **Jarvis features** (a talking assistant), not **Spider-Man features**. Result today:

- ~8,000 lines of app code, of which roughly **half is assistant code** (`brain.js`, `brain-prompt.js`, `karen-llm.js`, `speech.js`, `stt.js`, `wake.js`, `renderer/voice*.js`, `renderer/reader.js`, `renderer/brain.*`, `renderer/inbox.js`, `notifications.js`).
- Heavy runtime cost on a PC whose RAM already sits at 97–99%: persistent PowerShell speech engine, optional always-on wake-word recogniser (~60–90 MB), mic permission, API keys, local-model hooks.
- Bigger privacy surface than a "danger-sense widget" should have (microphone, notification contents, AI provider keys).
- The identity is blurry: someone opening the README can't tell what the app is *for*.

**Goal: Spidey Sense = a small, sharp, beautiful danger-sense widget. Jarvis = the assistant.** Fewer features, each one deeper and more Spider-Man.

## 2. The test for "does it belong in Spidey?"

A feature stays only if it passes **at least two of these three**:

1. **Senses** — it watches the PC/environment and warns about something (spider-sense, danger).
2. **Spider-Man flavoured** — it is naturally expressed by webs, tingles, suits, comics, the Bugle, Karen as a *suit* AI.
3. **Quiet** — it is glanceable, uses almost no RAM/CPU, needs no accounts, keys or microphone.

Anything that is mainly "an assistant that talks, listens, or answers questions" fails 1 and 2 → Jarvis.

## 3. Feature-by-feature decision

| Feature | Verdict | Why |
|---|---|---|
| Web radar & spider-sense (5 vitals, tingle) | **KEEP — core** | The whole point of the app. |
| Badge & panel (swinging spider) | **KEEP — core** | Identity, tiny footprint. |
| Guardian (danger sense: RAM hog, runaway process, disk, battery, heat…) | **KEEP — grow it** | Pure "senses danger". This is where new work goes (section 5). |
| E.D.I.T.H. (read-only security check + score) | **KEEP — core** | "Threat assessment" is on-brand and passes all 3 tests. |
| Eye-rest nudge (20-20-20) | **KEEP** | Tiny, quiet, a "danger" to your eyes. |
| Web timer + THWIP reminders | **KEEP, simplify** | Small and flavoured. Keep typed `in 20m stretch` / `at 3pm …`; drop the spoken number-word/voice-grammar parts. |
| Karen command bar (typed, rule-based) | **KEEP, slim down** | Stays as the *suit* AI: status questions ("how's my RAM"), start focus, open the radar, Guardian/E.D.I.T.H. commands. Rules only, no LLM, no voice. |
| Suit Locker (XP, colour suits) | **KEEP, tie to danger** | Fits the theme. Earn XP from *healthy PC* (low-RAM streaks, breaks taken, threats handled) instead of generic habits. |
| The Daily Web (end-of-day comic newspaper) | **KEEP** | Very Spidey (the Bugle). Rebuild its stats around "close calls", threats, tingle count. |
| Launch at login & auto-update | **KEEP** | Infrastructure. |
| Web-Capture (comic screenshots) | **MOVE → Spidey Lab** (see 4.3) | Fun, but a screenshot tool. Not sensing. Possible small re-import later. |
| Notification inbox (all Windows notifications in one place) | **MOVE → Jarvis** | An information/assistant feature, reads other apps' private content. |
| Notification reader (spoken) | **MOVE → Jarvis** | Depends on speech engine; pure assistant. |
| Talk to Karen — voice conversation (hotkey, VAD, Whisper/Windows STT) | **MOVE → Jarvis** | Jarvis by definition. Large code and privacy surface. |
| Wake word "Hey Karen / Hey Spidey" | **MOVE → Jarvis** | Always-on mic and extra RAM — wrong trade-off in a quiet sensor widget. Rename phrase to "Hey Jarvis" there. |
| Voice switching (Zira/David), speech engine (`speech.js`) | **MOVE → Jarvis** | Only used by voice/reader. |
| AI brain (multi-key failover → Ollama → rules) | **MOVE → Jarvis** | The biggest item. API keys, network calls, model logic. |
| Free-API-key presets, `brain.js`, `brain-prompt.js`, `karen-llm.js` | **MOVE → Jarvis** | Same. |

Rule of thumb: **after the split Spidey makes no network calls except the update check, and never touches the microphone or notification contents.**

## 4. New project layout

All under `P:\`, siblings of `P:\Spidey Sense`:

### 4.1 `P:\Jarvis` — the assistant (main destination)

Everything that talks, listens, or answers.

Moves (code, tests, docs):

- `brain.js`, `brain-prompt.js`, `karen-llm.js`, `renderer/brain.{html,css,js}`, `preload-brain.js`
- `speech.js`, `stt.js`, `wake.js`
- `renderer/voice.js`, `voice-core.js`, `pcm-worklet.js`
- `notifications.js`, `renderer/inbox.js`, `renderer/reader.js`
- tests: `brain-*`, `speech-test`, `stt-test`, `voice-core-test`, `wake-test`, `reader-test`, `notifications-test`
- help sections: voice, brain, reader, inbox, wake word, and the matching troubleshooting/privacy text
- the AI-related settings (`sttMode`, `voiceName`, `voiceConverse`, `wakeWord`, `readNotifications`…, brain keys file)

Jarvis gets its own Electron shell (tray, hotkey Ctrl+Alt+Space, own installer and auto-update, own GitHub repo), its own name/icon (arc-reactor blue), and its own help. First Jarvis release = exactly today's Spidey 0.2.7 behaviour for these features, so nothing regresses for the user.

Optional bridge: Jarvis can *read* Spidey's state later through a tiny local read-only file (e.g. `%APPDATA%/Spidey Sense/state.json`: vitals + Guardian alerts) so "Jarvis, how is my PC?" works without Spidey knowing about Jarvis. One direction only.

### 4.2 `P:\Jarvis` is the only move we need now

Everything else that leaves Spidey is small enough to park inside Jarvis or the lab below.

### 4.3 `P:\Spidey Lab` — parking lot (create only if you want it)

For features that are fun but don't belong anywhere yet: Web-Capture (comic screenshots), the earlier "roaming pet" idea (already rejected, stays dead), future experiments. A plain folder with a README; no build until one of them earns a home.

## 5. What we add to Spidey instead (make it great, not heavy)

Everything below is "senses danger", cheap to run, and fully offline.

1. **Spider-sense v2: causes, not just numbers.** When the widget tingles it says *what* and *who*: "Chrome renderer is eating 2.1 GB", with a one-click "Take it down" (ask first, never kill silently). Directly serves the always-97%-RAM problem that started the project.
2. **Tingle history ("Web Memory").** Keep 24 h of vitals in a small ring buffer and draw a live strand-by-strand sparkline per vital; tap a strand to see what happened at 3 am.
3. **Guardian additions:** new startup items appearing, unknown process listening on a port, disk filling fast, battery health/charger-stuck, laptop thermals/fan, unsigned process spawned from Temp, clipboard-hijack style behaviour (read-only detection).
4. **E.D.I.T.H. upgrade:** a one-screen "suit diagnostic" — Defender/Firewall state, pending reboot, Windows update age, risky open ports, startup entries, with a single score and a fix-it checklist (read-only; never changes security settings itself).
5. **Danger levels with personality:** green / amber / red tingle states, three animation strengths, quiet hours, per-vital sensitivity — so it warns rarely and meaningfully.
6. **Suit Locker 2.0:** suits unlocked by defending the PC (a week of green, a threat handled, a RAM spike resolved), plus a few new suit skins (Miles, Noir, 2099, Iron-spider style) as pure colour themes.
7. **The Daily Bugle, sharpened:** headline generated from the day's real events ("RAM HOG SPOTTED IN CHROME — 3 CLOSE CALLS"), no AI needed; keep the copy button.
8. **Polish pass:** smaller idle footprint (measure and publish idle RAM/CPU in the README), faster startup, crisper badge animation, a proper first-run tour of five screens, one-page README with a GIF.

## 6. What changes for the user

- Spidey gets smaller and calmer. Fewer tray items (target: ≤ 12), one hotkey (Ctrl+Alt+K).
- Voice, wake word, AI brain, reading notifications aloud: **gone from Spidey, present in Jarvis**. Existing settings and saved API keys are *not* deleted from the user's profile; Jarvis will offer to import them (it never reads them without asking).
- Karen stays as the typed suit AI. In the final Spidey, anything she can't do locally says: "That's a job for Jarvis."

## 7. Execution plan (nothing runs until you approve)

**Phase 0 – Safety (≈5 min).** Tag current main as `v0.2.7-final-with-jarvis-features` and keep release 0.2.7 downloadable. This is the "everything in one app" fallback.

**Phase 1 – Create `P:\Jarvis` (≈1 session).** `git init`, copy (not move) the files listed in 4.1, add a minimal Electron shell (window, tray, hotkey, settings, installer, updater), get all moved tests green, run the fake-mic e2e. Spidey is untouched in this phase, so nothing can break.

**Phase 2 – Cut Spidey down (≈1 session).** Delete the moved code from Spidey, strip the settings, tray items, Karen intents, help sections, privacy text and tests; remove `speech`, `stt`, microphone permission handler and the PowerShell engines; regenerate docs; run the fast unit suite plus one e2e of the widget. Release **Spidey 0.3.0** ("Focus release") — with your go-ahead.

**Phase 3 – Spidey upgrades (several small releases).** Section 5 in this order: (1) causes + take-it-down, (2) Web Memory sparkline, (3) Guardian additions, (4) E.D.I.T.H. diagnostic, (5) Suit Locker 2.0 + Bugle copy, (6) polish and README.

**Phase 4 – Jarvis grows on its own.** Rename wake phrase, own repo/README/releases, optional read-only bridge to Spidey's state file.

## 8. Risks and how we handle them

- *Losing a feature you like:* Phase 1 copies first and keeps 0.2.7 downloadable; Spidey only loses code after Jarvis passes the same tests.
- *Shared code (help generator, tests harness):* duplicate the small pieces; do not create a shared library yet.
- *Auto-update confusion:* existing Spidey installs will update to 0.3.0 and lose voice. Release notes and a one-line first-run notice will say "Voice moved to Jarvis".
- *Settings migration:* Spidey ignores unknown old keys; Jarvis imports `brain.json` only when you click import.

## 9. Decisions I need from you

1. Approve the **KEEP / MOVE** table (section 3) or change any row. Biggest judgement calls: **notification inbox** (I moved it to Jarvis), **Web-Capture** (to Spidey Lab), **reminders/timer** (kept, simplified).
2. Folder names: `P:\Jarvis` and `P:\Spidey Lab` OK?
3. Start with Phase 0 + Phase 1 once approved?
