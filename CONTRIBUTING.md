# Contributing to Spidey Sense

Thanks for helping! Spidey Sense is a small always-on-top Windows widget that watches your PC (CPU, RAM, disk, battery, network), warns before trouble, and protects carefully (Auto-Shield). Its sibling project is [Jarvis](https://github.com/DhruvHarani1/jarvis) (voice and AI assistant). Voice, AI chat and the notification reader do **not** belong here.

## Where to start

- Open issues labelled **good first issue** or **help wanted**.
- Questions and ideas: open an issue first for anything bigger than a small fix, so we agree on the approach.

## Run it

```bash
npm install
npm start                 # run the widget from source
npm run test:unit         # fast unit tests (no window)
SPIDEY_TEST=1 npx electron . --remote-debugging-port=9333   # then, in another terminal:
npm test                  # drives the running app over CDP (about two minutes)
npm run dist              # builds release/Spidey-Sense-Setup-<version>.exe (Windows)
```

`npm run dist` works around electron-builder's antivirus-related "EPERM rename" failure by extracting its tools itself (see `scripts/dist-local.ps1`).

## The rules that keep it safe

1. **Never change Windows security settings.** No Defender, firewall, service or policy changes, nothing that needs admin rights without the user clicking and Windows asking. E.D.I.T.H. is read-only.
2. **Auto-Shield may only do things that are safe and reversible, and every action must be logged with an UNDO.** Anything riskier is an *offer* (a button the user clicks), never automatic. `shield.js` has the rules and `scripts/shield-test.js` the tests.
3. **Protected programs are never touched** (Windows itself, Explorer, antivirus, this app). Keep `PROTECTED` in `shield.js` conservative.
4. **No network calls** except the update check and the optional latency probe. No telemetry, no accounts.
5. **Nothing the widget reads leaves the PC.** Command lines and file paths are used for judgements in memory only.
6. **Docs are generated from `help-data.js`.** Add a command, feature or tray item there, run `npm run docs`, and `npm run test:unit` checks that every documented example really works.

## Code style

Plain JavaScript (CommonJS in the main process, no bundler), 2 spaces, no semicolons, single quotes. Pure logic goes in small modules with unit tests (`scripts/*-test.js`); UI glue stays thin. Strict CSP: no inline scripts or styles in HTML.

## Pull requests

- One topic per PR; include or update tests.
- Run `npm run test:unit` (and `npm test` if you touched the UI).
- Describe what you changed and how you checked it on real Windows.
- By contributing you agree your work is released under the project's MIT license.

## Reporting a security problem

Please do not open a public issue for a vulnerability; use GitHub's "Report a vulnerability" on the Security tab.
