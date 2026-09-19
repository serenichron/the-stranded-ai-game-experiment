# Phase 3, agent D log (people)

Append-only. Only agent D writes here. Protocol: `comms/PROTOCOL.md` (phase 3 section). Brief: `comms/PHASE-3.md`.

---

## [D-001] 2026-09-19 | DONE | The bench builds frozen now
The character bench is a second page in the frozen build. I did not touch `vite.config.ts`, so the user's dev server did not restart.
- `vite.frozen.config.ts`: the normal config plus `src/world/models/dev/chars.html` as a second input.
- `tests/p3-build-D.sh`: builds into `test-output/build-D` with that config.
- `tests/p3-bench.mjs <port> out.png "query" ...`: shoots the bench on a test port, takes the browser lock, refuses 5190.
- My preview runs on **5197**. C, the frozen config works for you too: `--config vite.frozen.config.ts`.
Baseline shots: `test-output/p3-D-r0-bench-*.png`.
Needs: nothing.

## [D-002] 2026-09-19 | CLAIM | People gaps, in this order
One change per round, blind critic each round, commit only on a win.
1. Tel'sharin head and legs (faceted dome, amber-dot visor slit lit red, backward legs, three-pronged feet).
2. Mi'naa goggles, brass mech arm, torn poncho edges, brown knee patches (from old `dressMinaa`).
3. Sehari: root markings on the skin of one arm and one leg, dark and branching; grey-lavender skin; arms "slightly long"; dreadlocks; teal sash knot.
4. Iskari slimmer, stone cracks, each one different.
5. NPCs, dogs, drone, defender: anatomy and texture pass.
Files: `char-*.ts`, `characters.ts`, `dev/`, `tests/`. I will not touch light or tone without telling you first.
Needs: C, your look proposal for DESIGN.md Look, or ACK and I will draft it.

## [D-003] 2026-09-19 10:05 | ACK | C-002, one look for both halves
Refs: C-002
ACK all six points. Please write it into DESIGN.md Look. Two additions from my half, for the same section:
- **Skin values by race**, so people separate from the ground: Mi'naa warm tan (mid), Sehari cool grey-lavender (light-mid, cooler than sand), Iskari pale bone stone (light, warmer grey than Aza'los stone), Tel'sharin dark grey-green (dark). Each keeps a two-tone read at game zoom.
- **People's placed markings** (Sehari roots, Iskari cracks, hem bands) use body-space masks, not the triplanar tile (lesson 6).
I may opt the Iskari stone and the Tel'sharin armour into your relief later. I will tag and tell you first.
A canon note, no action for you: `docs/visual-reference.md` says Sehari arms reach "close to the kneecap", `docs/races.md` says "slightly longer than human". The brief and the last critic follow races.md, so I will make them slightly long: fingertips at mid-thigh.
Needs: nothing.

## [D-004] 2026-09-19 | REVIEW | Round 1: the Tel'sharin rebuilt, carry-over checklist, critic running
Refs: C-003, C-004, C-005
New file `src/world/models/char-telsharin.ts`: the dark skinned core from `char-people.ts`, then hard faceted armour plates on every bone (convex hulls cut from ellipsoids, flat shaded). New texture `warden` in `char-tex.ts` (grey-green, rust, shot pits, scratches).
**Carry-over checklist** (old model -> new):
- [x] Faceted head: was a box. Now a faceted dome with a darker brow plate.
- [x] Light slits: were three bars. Now one dark visor slit with six red lights, and a short second slit below (canon: slits, several lights).
- [x] Torn chest on the left, bone ribs and sternum, red glow inside: kept, ribs now rigid bone so they stay crisp.
- [x] Red light at elbows, knees, hocks, hip ring, back seam: kept (rings at elbows and ankles).
- [x] Sensor pod on the left shoulder: kept. Two more pods on the head sides (art).
- [x] Big pauldron right: kept, now layered. Smaller one left (asymmetric).
- [x] Bone horn through the dome, bone coral on the right shoulder: kept.
- [x] Right forearm gauntlet with three red studs: kept.
- [x] Four feeding tubes, twitch when starving, reach on attack: kept, same code.
- [x] Hands: were three claws. Now plated palm, three jointed fingers, thumb, bone claw tips.
- [x] Three-pronged feet plus back spur, digitigrade legs: kept, toes plated with bone tips.
- [x] States awake / starving / asleep, glow levels, wake: kept, same code. Scale 1.05 kept.
- Changed on purpose: the stance is more upright (warden art), the core is leaner.
Checked standing, walking, running, crouched asleep, attack and dead on the bench: no loose or swallowed parts.
Shots: `test-output/p3-D-r0-*` (last commit) and `p3-D-r1-*`: `tel-front`, `tel-q`, `tel-head`, `tel-game`, `tel-close`, `creatures-game`, anims in `p3-D-r1-tel-{walk,run,sleep,attack,die}.png`. `tests/p3-d-shots.mjs <port> <round> tel` puts one in open sand beside a Mi'naa.
C, one thing that works for you: in `tel-close` the scaffold, crates and scrap round the Maker wreck read as a real work site. One thing to fix: in `tel-game` there is a hard dark shadow band across the open sand south of the Maker wreck; people standing in it go near-black. Is it the wreck or a cliff? A softer or shorter shadow there would help both halves.
Needs: nothing yet.
