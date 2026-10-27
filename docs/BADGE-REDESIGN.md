# Badge redesign: the Spider-Man mask (design proposal v2, nothing implemented yet)

Status: **proposal, waiting for final approval.** Demo v2 was shown in the chat; this file is the written plan. Decisions marked (decided) were delegated to the maintainer's assistant.

## Goal

Replace the black spider emblem on the red disc with a **Spider-Man mask** whose eyes tell you the state of the PC at a glance, and make the dangling badge feel alive without costing CPU. The badge stays about 56 px, hangs on a thread, and works with every suit.

## The mask (v2: closer to the real thing)

Original procedural artwork (fan art, like the rest of the app):

- **Egg-shaped head** instead of a circle: wider at the temples, tapering to a slightly pointed chin, thick black outline. The badge silhouette is now the mask.
- **Web pattern as on the real mask**: strands radiate from a point on the nose bridge (below the eyes), crossed by four scalloped rings that sag like silk, clipped to the head. A soft highlight on the upper left gives the cloth some volume.
- **Slanted lenses**: large, angular, wedge-shaped, wide at the temple and pointing down toward the nose, with a heavy black rim. Lens openness and slant are the expression.
- Colours come from the suit palette (`renderer/suits.js`): face, highlight, web-line colour, lens tint. Classic is red with black webbing; Miles is near-black with red webbing; Noir is grey. Alert colours (yellow ring, red ring) never change with a suit.

## States and moods

| State | Eyes | Ring and extras | Motion |
|---|---|---|---|
| Calm | open, relaxed; blink every 2.5-6.5 s; follow the cursor | none | gentle swing, +-7 deg, 3.4 s |
| Alert | narrowed, slanted harder | yellow ring, short ticks | +-9 deg, 2.6 s |
| Tingle | flared wide, pure white | red ring, pulsing outer ring, comic spikes | +-15 deg, 1.1 s, rapid shake |
| Napping (idle 3 min) | shut, dimmed | "z z"; **hangs upside down** like a sleeping bat (thread meets the chin) | very slow sway |
| Shield acted | unchanged | web strand snags the culprit, "TAMED" tag with the UNDO hint | one-shot, about 1.8 s |

Moods stack on any state:

| Mood | Look |
|---|---|
| Low battery | droopy, half-closed eyes, tiny red battery chip |
| Offline | web strands and thread turn dashed ("broken web"), red cross |
| CPU hot | a sweat drop slides down the temple |
| Focus timer running | a thin ring in the suit colour fills clockwise around the mask (25 min) |
| Unread alerts | a small web-knot pill with the number (decided: yes, replaces the yellow circle) |

## Dangling effects (all kept, all off under "Reduce motion")

1. **Pendulum swing** driven by the state table.
2. **Nudge physics**: a damped spring; dragging or bumping adds a wobble that settles by itself.
3. **Blink and look**: random blinks; with "eyes follow cursor" on, lenses slide a little and the head tilts toward the pointer.
4. **Web pop**: clicking sends an expanding web ring, then the panel opens.
5. **Twirl**: a rare idle flourish where the badge spins about its thread (decided: keep, rare, never during an alert).
6. **Drop-in** on launch: falls on its thread and bounces once.
7. **Shield web-shot** (table above).
8. **Lens glint**: a bright diagonal sweep across both lenses every 9-17 s while calm.
9. **Swing to a new spot**: when you drag the badge elsewhere, it shoots a strand to the new anchor and swings there.
10. **Level-up flash**: when a new suit unlocks, the mask cross-fades into it with a short web-pop.
11. **Soft "thwip"** on click (generated, no asset), follows the existing sound setting.

## How it will be built

- New `renderer/mask.js` with a pure `drawMask(ctx, cx, cy, R, opts)` (the demo's function cleaned up) and a pure `eyeParams(state, moods, t, look)` that returns openness, slant, lens colour and ring colour (unit-tested). `Spider.drawSpider` stays for the Suit Locker and the web's centre disc.
- The badge canvas redraws **only when something changes** (state, blink, look, suit, mood). Swing, shake and the nudge spring use CSS `transform` on the compositor. Blink and look run at about 12 fps, not 60. Effects (web pop, strands, twirl, glint) draw on a small overlay canvas that exists only while one plays.
- "Reduce motion" follows the Windows "Animation effects" setting plus an in-app switch: no swing, shake, blink animation, twirl or glint; static eyes per state; rings only.
- Tests: `eyeParams` unit tests for every state and mood; the CDP selftest checks non-blank pixels, ring colours per state, and no errors in the console.

## Budget and acceptance

- Idle badge under 3 % of one CPU core (measured with the footprint script), a few KB of extra memory.
- Lenses readable at 56 px at 100 %, 125 % and 150 % scaling (screenshots in the PR).
- Every state, mood and suit exercised in the selftest; reduced-motion verified.
- No change to panel layout or commands.

## Rollout

1. Approve this design (and any tweaks after seeing demo v2).
2. Implement `mask.js` plus states and moods.
3. Add the effects one at a time, each behind the reduced-motion switch.
4. Release as a minor version with before/after screenshots.

## Decisions taken (the two open questions)

- Unread count becomes a web-knot pill.
- Lens colour is a very light suit tint (not pure white) so the glint and the tingle's pure white stand out.
- The spider emblem stays in the panel's web centre and in the Suit Locker.
