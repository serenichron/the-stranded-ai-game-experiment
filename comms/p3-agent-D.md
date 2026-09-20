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

## [D-005] 2026-09-19 | DONE | Round 1 won; creation screen fixed
- **Tel'sharin** committed (`50bbc4c`). Blind critic, all 50 images proven: the new version clearly closer to the art. Its three gaps for later: legs still read straight at game zoom (the hock needs to show), limbs too bulky against the gaunt wardens of variant b, no rifle or strong one-sided hardware.
- **Creation screen** committed. The user's note (PHASE-3.md) asked for this first, and I read it late. Cause: the race cards kept a 25rem height and a 6rem medallion made for three side-by-side columns. Docked cards are now rows with a small medallion, roles in two columns. Origin and Role both fit at 1600x900 with no scroll. Shots `p3-D-r0|r1-creation`, `-creation-iskari`, `-creation-role`.
- Correction to my own work: my first read of the art returned "request limit" for 33 images. I have now read the Tel'sharin, Mi'naa, Iskari and Sehari reference sheets properly. One finding for everyone: in the Sehari art the red root pattern is on the **cloth panel**, and the **skin** carries fine dark branching lines up the arms. Both belong.
Next: Tel'sharin gaunt limbs and visible hocks (small round), then the Mi'naa.
Needs: nothing.

## [D-006] 2026-09-19 | DONE | Tel'sharin round 2 committed; I now edit only in a worktree
- Round 2 (gaunt limbs, longer backward hock, three-lens pod from variant a) won the blind side-by-side, **slightly**. All 50 images proven. Shots `p3-D-r1b-*` (last commit) vs `p3-D-r2-*`.
- The critic's next gaps: shins still read as straight pipes from the front; the chest block is barrel-shaped over a thin waist; the visor bar sticks out like a toy's; the right gauntlet does not read. I will take these in a later pass, after the Mi'naa.
- The rifle from the art stays out. The Tel'sharin fights hand to hand in the game, so a gun would promise an attack it does not have.
- From now on I edit only in `test-output/wt-D` (branch `d-work`), like C. Wins reach master by commit. `tests/p3-build-D.sh` builds HEAD plus my files from there; `sh tests/p3-build-D.sh base` builds HEAD alone.
Next: the Mi'naa (goggles round the man's neck, full mech arms, torn hems, brown knee patches).
Needs: nothing.

## [D-007] 2026-09-19 | DONE | Mi'naa round won; portraits on the creation screen (user request)
- **Mi'naa tinkers** (`273ca96`). From `mi-naa-tinker-pair.png`: his left arm is steel from the shoulder, hers the right in copper-bronze, each with a teal crystal at the elbow and a machine hand. His goggles hang at his neck. Torn hems on her poncho and both pairs of trousers. Brown patches on his knees. A screen cuff on her other wrist, the rope belt's ends hanging. Blind critic, all 50 proven: **slightly** better. Close-ups clearly, game zoom close to equal.
  Carry-over: every old piece kept (sash, bandolier with four cartridges, hip flap, crystal at her throat, pouch, sandals). Dropped on purpose: his goggles on the brow (art has them at the neck); the iron forearm cuff and the bronze forearm (both became full mech arms).
  Critic's next gaps: skin and trousers merge at game zoom (skin should be lighter, dusty tan); her top should be a loose poncho off one shoulder, not a fitted crop; his ochre cloth should be one draped cloth knotted at the hip, not two flat straps.
- **Portraits** (`35ff752`), the user's request: head-and-shoulders crops from the concept art on the three race cards and the two body buttons, for the chosen body. The 3D bodies still stand beside the panel. Files and sources in `public/portraits/`.
- C, thanks for the review. I'll give the Tel'sharin plates a lighter worn edge in its next pass.
Needs: nothing.

## [D-008] 2026-09-19 | DONE | Mi'naa clothing round won; Sehari round under critic
- **Mi'naa** (`408ef72`): her poncho now falls off one shoulder with no fitted top under it; his ochre cloth is one band from the right shoulder to the left hip, knotted there with a long tail; the flat strap is gone; skin a step lighter. Blind critic, all 50 proven: **slightly** better. Its next gaps: skin still too dark at game zoom; her mech arm blends into her skin and its crystals float; her hips and trousers too heavy for the slim woman in the art; board-like sandals.
- **Sehari round** in my worktree, critic running: arms "slightly long" (fingertips mid-thigh), fewer and bolder root markings, greyer skin, the wrap over one shoulder as body cloth instead of a flat board, a wide sash with a knot and two long ends. Also a real bug: from behind, the Sehari woman's head was bald above the nape. The hair shape was cut too high at the back. Fixed.
Needs: nothing.

## [D-009] 2026-09-19 | DONE | Sehari round won (slightly)
Committed. All 50 proven. The critic's next gaps: the marked arm reads as a dark sleeve, and the face, neck and chest carry no roots (art: sparse lines up the neck into one cheek); the hair hangs as two flat slabs, not locks with fibre wraps; the wrap is the same tan as the trousers, so top and trousers blend; faces too round and soft. I'll take hair and root placement next, with body-space masks, then the Iskari.
Needs: nothing.

## [D-010] 2026-09-19 | DONE | Sehari hair and roots: ranked first, equal at game zoom
Committed. Locks now separate with fibre bindings; roots are a few branching lines on one arm, one leg, the left side of the neck and one cheek; narrower jaws. The critic ranked it first but called it **about equal**: close-ups better, game zoom the same pixel for pixel.
A pattern across all my rounds: detail wins close up and barely moves the game camera. At ~100 px tall, a figure reads by silhouette, big colour blocks and value. My next rounds aim there first.
Critic's remaining Sehari gaps: the tunic should be a loose sleeveless tunic to mid-thigh with a ragged hem, and the motif only at its lower corner; long teal sash tails; faces still too soft (lips, small eyes); a faint glow at the joints.
Needs: nothing.

## [D-011] 2026-09-19 | DONE | Iskari round won (slightly)
Committed. Pale bone stone, finer cracks, longer necks, his vest open and sleeveless, her short wrap skirt with a thin teal hem and a wrap over one shoulder. Carry-over: the critic noticed her soul crystal vanished under the new wrap. I moved it in front of the cloth before committing. All 50 proven.
Critic's next Iskari gaps: legs read straight and human with blocky feet (art: slightly digitigrade, low knee, ankle bent back); heads are round eggs (art: long narrow skull, plates, deep-set eyes); her purple waist sash and bare midriff.
Next: the NPCs, silhouette and colour first.
Needs: nothing.

## [D-012] 2026-09-19 | DONE | NPCs: Pell's values split (won, slightly)
Committed. Pell was one brown from hood to boots; now a pale hood and cape, a rust face scarf, a dark coat. Hadda's skin a step lighter. All 50 proven.
Critic gaps I am NOT taking, with reasons:
- "The apprentice's long robe hides the Iskari legs." The robe is his look from phase 2 (the one Iskari in the camp dresses as a scribe). Canon leaves the Iskari look open, so I keep it unless the user says otherwise.
- "Hunter's arms should reach the knee." races.md says "slightly longer than human", and the brief follows it.
- "Square patch texture on Hadda and Tarn." That is the 00:20 patched texture the user liked. Lesson 2: keep it.
Taking later: the hunter's forward crouch and her sash ends.
Next: the dogs, drone and defender.
Needs: nothing.

## [D-013] 2026-09-19 | DONE | Dogs and defender (won, slightly)
Committed. Dogs were sand-coloured and vanished at game zoom; now sun-dark brown (the event text says "sun-dark fur"). Defender chest plates pale stone. All 50 proven. Honest note: the critic also credited a more visible awake defender, but that shot's timing varies run to run; I don't count it.
Critic's next gaps: the defender needs a real forearm shield (crescent or round, both references), and fewer teal cracks (teal only in a few seams); the dogs show no ribs or tucked belly.
Next: Tel'sharin third pass (worn edges, shins from the front), then the defender shield.
Needs: nothing.

## [D-014] 2026-09-19 | REVIEW | Re-shot under C's shadow fill (C-023)
Refs: C-023
`p3-D-r11-*` (tel, bodies-game, camp-npcs) on 403da07. All people still read; shade is cooler and a touch lighter, not muddy. No change needed on my side. The Tel'sharin in deep shade is my next round (lighter worn plate edges).
Needs: nothing.

## [D-015] 2026-09-19 | REVIEW | Tel'sharin worn facets: lost, reverted
Per-facet tone with pale up-facing facets (vertex colours on the plate hulls). The code reached the build, but the blind critic saw no difference in the armour, and its pixel diff agreed: only the lights differed. So the change was too faint to matter. Reverted, not committed. Diff kept in my scratchpad.
Critic's gaps, all three the same as before: plates read as one khaki slab (too light and too khaki against the dark teal-grey-green of the art); visor bar sticks out past the head; legs still read as knees bending forward from the side.
Next try on the Tel'sharin should be bolder: darker teal-grey base with bone-pale plate rims as real geometry, not a tint.
Needs: nothing.

## [D-016] 2026-09-19 | DONE | Paused by the user
My previews on 5197 and 5198 are stopped; I hold no browser lock. Master has every round that won. My worktree `test-output/wt-D` is clean at master.
Next when I resume: the defender's forearm shield, the Iskari legs and skulls, then a bolder Tel'sharin pass (darker teal-grey base, bone rims as geometry, flush visor).
Needs: nothing.

## [D-017] 2026-09-20 | DONE | Tel'sharin bolder pass won
Committed. Darker teal-grey plates with a pale bone rim (a back-face shell) on chest, pauldrons, thighs and shins; the visor sits flush in a wider dome; a longer foot and sharper leg angles, so the backward hock reads. Checked standing, walking, asleep and dead. All 50 proven.
Critic's next Tel'sharin gaps: both arms are the same (the art gives one sealed gauntlet and a different pauldron per side); no damage as shape (variant c has a stitched gash across the belly plates and a torn thigh); no sensor disc cluster at one temple.
Next: the Iskari legs and skulls.
Needs: nothing.

## [D-018] 2026-09-20 | REVIEW | Iskari legs and skulls: both tries lost, reverted
- Try 1 (longer foot, lower knee, plus a taller narrow skull with deep-set eyes): lost. The critic read the new skull as cone-headed, which no reference shows, and that beat the better legs at game zoom.
- Try 2 (the same legs, old skulls): lost again, and the reason is worth keeping. The longer foot raises the hips, so the man's kilt hangs below the knee and a gap of bare stone opens at his hip. The leg change breaks the clothing that was cut for the old height.
Reverted both. Diff kept in my scratchpad. If the legs are tried again, the kilt, the skirt and the hip closure have to be re-cut in the same round.
Critic's other Iskari gaps: teal reads as forest green on headband, sash and hem (canon locks teal); the hem band carries no motif; the crossbody strap has no satchel on it; eyes are flat white ovals, not deep-set.
Needs: nothing.

## [D-019] 2026-09-20 | DONE | Iskari trim and colour rounds won; walked playthrough passes
- **Trim** (`95d700e`): real teal on headband, sash and hem, a satchel on the strap, marks along her hem. Won, slightly.
- **Colour**: true violet vest, cooler paler stone, lighter rust bloom. Won, slightly: the violet reads at game zoom.
- **Walked playthrough** on the committed build: `node tests/p2-walk.mjs minaa-frontline 5198`. Camp, crack, north sand, ruin mouth, drone fight, the pulse and the defender, sockets, symbol door, archive, walk home, the empty tent, the ending. 16 shots `test-output/p2-walk-minaa-frontline-*.png`, **no console errors**.
Open Iskari gaps, both tried and lost, so I leave them: digitigrade legs (breaks the kilt cut, see D-018) and the stone reading in the Mi'naa's tan family at game zoom (two goes at lightening it; the rust bloom in the texture pulls it warm).
Ready for the closing jobs: the fps reading (needs the user's tab closed) and the joint report.
Needs: C, say when you want to write the joint report, and I'll send my half.

## [D-020] 2026-09-20 | DONE | Frame rate measured (the user closed their browser)
`tests/p3-fps.mjs <port>`: headed Edge, 1600x900, window brought to front, 4 s per camera, average and 95th percentile. The user confirmed they do not use Edge, so the earlier Edge processes were my own test browser.

| Camera | High | Medium |
|---|---|---|
| camp, zoom 1 | 30.0 | 36.9 |
| Maker wreck, zoom 1 | 32.1 | 34.8 |
| ruin court, zoom 1 | 23.0 | 26.4 |
| camp, zoom 2 | 26.5 | 31.0 |

So the phase target (30 fps at 1600x900 on High) is met in the open and **missed in the ruin** (23) and at close zoom (26.5).
Layer A/B at the ruin (`tests/p3-perf-layers.mjs`, agent A's test): base 28, noPaint 27, paint 25, noSurface 29, noMottle 25, noFog 24, noBloom 25, noShadow 27, noPost 27, pixel ratio 1: 24, base again 25. Spread is inside the noise, so **no single layer is to blame**. It reads as overall scene cost on this laptop, not one effect.
Options for the user, none taken yet: ship Medium as the default; or profile the ruin properly (draw calls per object type) in a later phase.
Needs: nothing.

## [D-021] 2026-09-20 | REVIEW | The ruin profiled; coarser NPC meshes bought nothing, reverted
`tests/p3-profile-ruin.mjs` (scene inventory plus hide-one-group tests) and `tests/p3-calls.mjs`
(whole-frame counters, `renderer.info.autoReset = false`; the old readings said "1 call" because
post-processing overwrites the counter each frame).

**What the frame really costs**
| Camera | Draw calls | Triangles per frame (all passes) |
|---|---|---|
| ruin court, zoom 1 | 614 | 1.59 M |
| camp, zoom 1 | 728 | 1.91 M |
| camp, zoom 2 | 1102 | 2.15 M |

**Scene at the ruin:** merged scenery 223 k tris in 86 meshes; ground cover 221 k in **2,627 meshes**;
terrain 100 k in 1; each townsperson 70 to 76 k in 12 to 14 meshes.
**Hide tests:** hiding the merged scenery lifts 23 to 32 fps. Hiding any one person changes nothing.

**My experiment:** build NPCs and crowd at a coarser sculpt cell (0.021 instead of 0.0145, with
coarser heads, hands and feet). Triangles per townsperson fell by about half, and they dropped out
of the top eight groups. Frame rate: ruin 23.9 before, 23.9 after; camp 30.3 before, 29.9 after.
**No gain, so I reverted it** rather than spend mesh quality for nothing.

**Read:** the game is not triangle-bound on this laptop (AMD Radeon integrated). No single layer
dominates either: at the ruin, paint, surface, mottle, fog, bloom, shadows and post all sit inside
the noise. The two numbers worth attacking are the 2,627 ground-cover meshes (C's half: instancing
or merging) and the draw-call count at close zoom (1,102).
Needs: C, ground cover is yours. Instancing it is the one change the profile actually points at.
