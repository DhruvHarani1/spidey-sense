# Badge redesign: the Spider-Man mask (design proposal, nothing implemented yet)

Status: **proposal, waiting for approval.** An interactive demo was shown in the chat; this file is the written plan.

## Goal

Replace the black spider emblem on the red disc with a **Spider-Man mask** whose eyes tell you the state of the PC at a glance, and make the dangling badge feel alive without costing CPU. The badge stays 56 px, stays a small circle hanging on a thread, and keeps working with every suit.

## The mask

Original procedural artwork (fan art, like the rest of the app):

- Round face in the suit colour, a soft highlight, web lines (radial strands plus two sagging rings) clipped to the disc.
- Two angular **lenses**. Their shape and openness are the main signal, so they must read at 56 px: thick outline (about 7 % of the radius), no tiny details.
- Colours come from the suit palette (`renderer/suits.js`): face, highlight, web-line colour, lens colour. Miles gets a near-black face with red web lines; Noir is grey.
- Alert colours (yellow ring, red ring) never change with a suit, as today.

## States

| State | Eyes | Ring and extras | Motion |
|---|---|---|---|
| Calm | open, relaxed; blink every 2.5-6.5 s; drift toward the cursor | none | gentle swing, +-7 deg, 3.4 s |
| Alert | narrowed and angled inward | yellow ring, short yellow ticks | +-9 deg, 2.6 s |
| Tingle | flared wide, pure white | red ring, pulsing outer ring, comic spikes | +-15 deg, 1.1 s, rapid shake |
| Napping (idle 3 min) | closed (curved lines), badge dimmed | "z z" | very slow sway, 8 s |
| Shield acted | unchanged | a web strand snags the culprit; "TAMED" with the UNDO hint; strand retracts | one-shot, about 1.8 s |

## Effects while dangling

All optional, all off under "Reduce motion":

1. **Pendulum swing** on the thread (as now), driven by the state table.
2. **Nudge physics**: dragging or bumping the badge adds a damped wobble that settles by itself (a small spring, not a keyframe).
3. **Blink and look**: random blinks; with "eyes follow cursor" on, the lenses slide up to 6 % of the radius and the head tilts about 7 degrees toward the pointer.
4. **Web pop**: clicking the badge sends an expanding web ring, then the panel opens (the panel already opens on click).
5. **Twirl**: a rare idle flourish (a few seconds without anything happening) where the badge spins around its thread.
6. **Drop-in**: on launch the badge drops from above the screen edge on its thread and bounces once.
7. **Shield web-shot** (see table).
8. **Count knot**: the unread number sits in a small web-knot pill instead of a yellow circle.

## How it will be built

- New module `renderer/mask.js` with a pure `drawMask(ctx, cx, cy, R, opts)` (the demo's function, cleaned up) next to `spider.js`; `Spider.drawSpider` stays for the Suit Locker and the web's centre disc.
- The badge canvas redraws **only when something changes** (state, blink, look, suit). Swing stays on the compositor as CSS `transform` (already true today) so it costs nothing; shake and the nudge spring use `transform` too. Blink and look run at about 12 fps, not 60. This also helps the open "cut idle CPU" issue.
- Effects (web pop, shield strand, twirl) live on a small overlay canvas that exists only while an effect plays.
- `Reduce motion` follows Windows "Animation effects" and the setting from the accessibility issue; with it on: no swing, no shake, no blink animation, static eyes per state, rings only.
- Unit tests: a pure `eyeParams(state, suit, t, look)` function (openness, tilt, ring colour) is tested; the drawing itself is checked by the CDP selftest (non-blank pixels, ring colour per state, no errors).

## Budget and acceptance

- Idle badge under 3 % of one core (measured with the footprint script), no extra memory beyond a few KB.
- Eyes readable at 56 px at 100 %, 125 % and 150 % display scaling (screenshots in the PR).
- All five states and all suits shown in the selftest; reduced-motion verified.
- No change to the panel layout or to any command.

## Rollout

1. Approve this design (and any tweaks to the demo: lens shape, web density, which effects to keep).
2. Implement `mask.js` plus the badge states (no extra effects).
3. Add the effects one at a time, each behind the reduced-motion switch.
4. Release as a minor version.

## Open questions

- Keep the spider emblem somewhere (the panel's web centre keeps it today)? Proposed: yes.
- Lens style: classic white, or a subtle suit-tinted white?
- Is the rare "twirl" welcome, or too playful?
- Should the unread count become the web-knot pill, or stay a plain circle?
