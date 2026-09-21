# The Stranded: The Keeper's errand

One playable level of an isometric RPG set in The Stranded. Canon comes from `../ai/canon.md`. Anything invented for the game goes in `LORE-INVENTIONS.md`.

Each section names its owner. Only the owner edits it. Ask in your comms log for changes.

---

## Level (owner: agent 1)

### Shape

The map is 64 by 56 tiles. One tile is one metre. North is the top of the level file.

- **South: the salvage camp.** Mi'naa tents, three patched shacks, a spring under two sun-date trees, three lamps. The apprentice sits on a salvage crate by his tent at (11, 41). The crate stays after he is gone. The player starts at (12, 47).
- **The ridge.** A band of rock at y 29 to 32 cuts the map in two. There are two ways through.
  - **The gap** at x 38 to 46. The Maker wreck lies north to south just east of it, its torn side facing the gap. The salvage crew's scaffold leans on that side. The Tel'sharin `tel1` feeds on four metal piles in the gap. Two feral dogs roam the camp side of it.
  - **The crack** at x 8. One tile wide. A climb check, owned by agent 2.
- **North: the Ash Reach.** Open sand, field-moss, glass-thistle. A lone spire-root at (15, 18) marks buried pale crystal. A Sehari hunter stands near it. The fallen spire lies east to west across the middle, from x 15 to x 29.
- **The ruin.** A raised circle of pale stone, centre (42.5, 14.5), radius 10. Its mouth faces south at (42, 24). A second gap in the west wall lets a quiet player slip in. The guardian patrols the court. Three crystal sockets sit around it, with carved rings on a wall as the clue.
- **The inner hall.** A smaller ring, radius 4, north of the court. The symbol door at (42, 13) leads in. A curved inner wall splits the hall. The inner door at (42, 10) guards the archive at (42, 7).
- **The Scar.** A dead chasm along the whole north edge, rust-red at the lip. The ruin sits on its edge. A lookout zone at (18 to 27, 4 to 6).

### Routes, by player choice

| Route | Passes | Risk |
|---|---|---|
| Camp, gap, north sand, ruin mouth | dogs, the Tel'sharin | fight or sneak or starve it |
| Camp, crack, north sand, ruin mouth | nothing hostile | a climb check |
| North sand, west breach | skips the guardian's sight at the mouth | the guardian's patrol |

### Look (phase 2, agent A)

- True 3D through a narrow perspective lens (30 degrees). Q and E turn the view by 90 degrees. The wheel zooms, and zooming in lowers the camera from 50 degrees to 9, so close views show the horizon, like the concept paintings.
- One low sun from the north-west at 19 degrees. Warm peach sunlight, lavender sky light, so every shadow is cool.
- A sky dome with a pale sun disc and thin cloud, and a skyline past the map: mesas, hoodoos, broken Aza'los towers, wreck ribs. Distance and height haze use the sky's own colours.
- One shader layer on every lit surface, people included: colour mottling, brush-stroke albedo, warm tops and cool undersides, a warm rim on the sun side, cracks on stone, rock and packed ground. A Kuwahara filter at the end turns flat faces into soft brush patches.
- Places, built from the concept art and the world map (`comms/refs/world-map.png`):
  - the Aza'los ruin: a raised round court, swirling teal floor channels, poured-stone ring walls, stalagmite towers with a crowning cluster, one snapped, scorch and cracks from the war;
  - the camp: a stone cistern with a pipe pouring into it, torn canvas, corrugated roofs, jars, cut stone, a tower at the edge with a stilt hut;
  - three wrecks: the Maker ship (faceted sage armour grown into a porous bone rear with finger-prongs, amber in the seams, a drag trench), a miner hull (a chain of boxes with fins and engines), an Aza'los vessel (a smooth pale seed-shape, teal leaking from a crack, a crash furrow);
  - the Scar: a narrow zigzag fissure with rust-stained lips and hairline cracks. Nothing grows within 7 m of it.
- The defender's niche (`prop-niche`) sits in the east wall. `seamPulse` runs the activation code along the floor channels to it.
- Moods: `normal`, `tense` for combat, `memory` for the reveal, `dim` inside the ruin. Each mood also sets sky, haze and rim.
- Walls hide the player only when solid scenery really stands between the camera and the player. Then a dithered circle opens and fades. Characters, canvas and thin props are never cut.
- Every mesh is built in code. The only images are reference art in `comms/refs/`.

### Look, phase 3 (agents C and D, agreed in C-002 and D-003)

- Light, sky, haze and rim stay as they were at 00:19. Neither half changes a mood, the sun or tone mapping without a log post first. After such a change, both halves re-shoot.
- Palette, canon first: faded ochre, rust-red, teal, bone. Sand `#d8c2a0` lit, lavender in shadow. Aza'los stone `#e2d7c3`, teal `#5fe0d0` as small accents only. Maker hull dark grey-green, bone parts pale. All Tel'sharin light is red (`PALETTE.telsharinRed`), the Maker ship's seams included (user decision, phase 3; canon says amber-orange).
- Scale: at the default zoom 1 m is about 55 px. Big colour patches run 4 to 8 m. The detail that must read runs 0.3 to 1.5 m and is at least 3 px wide at zoom 1. Grain under 0.15 m is for close views and is never a surface's only detail.
- At game zoom every surface shows two tones and one line feature: a crack, seam, panel line, fold or hem. Material families differ in value as well as hue: stone light, rock mid, metal dark, cloth mid with a pattern.
- Skin by race: Mi'naa warm tan (mid), Sehari cool grey-lavender (light-mid, cooler than sand), Iskari pale bone stone (light, warmer than Aza'los stone), Tel'sharin dark grey-green (dark).
- Markings that belong in one place (Sehari roots, Iskari cracks, hem bands) use body-space masks, never the triplanar tile.
- Relief: the world layer bumps the normal from the same height fields that draw cracks and strata, only on materials tagged `userData.surface`. People opt in by tagging.
- The rim light belongs to the world layer. Nobody adds a second one. Glows are tagged `userData.glow`.

### Input

- Mouse: click to act, right-click to look, wheel or + and - to zoom, middle-drag to pan, Q and E to turn.
- Touch: tap the ground to walk. Tap a person or thing once to select it, and again to act. Pinch to zoom, drag two fingers to pan. Two turn buttons sit top right.

### Performance

- Static scenery is merged by material and map cell. About 900 meshes become a few dozen draw calls.
- Effect lights come from a fixed pool of four. Adding lights at runtime would recompile every shader.
- Every shader compiles at load, so the first look at the ruin does not stall.
- Resolution drops to 75% when frames run slow and climbs back when they recover.

### Ids

The full list of entity and zone ids lives in `src/level/level1.ts`. Agent 2 registers a script for each.

---

## Story (owner: agent 2)

Hook, complication, reveal. The session ends on the reveal, as canon asks.

**Hook.** The player arrives at a Mi'naa salvage camp. An Iskari, the Keeper's apprentice, asks them to fetch a Keeper archive plate from the ruin north of the ridge. His master vanished in the last ripple, about two hundred years ago. He never finished his training.

**Complication.** Hadda's crew cut into the Maker wreck and woke a starving Tel'sharin, the ded-waka. It sits in the gap in the ridge. Four ways past it:

| Answer | How | Cost |
|---|---|---|
| Fight | Turn-based combat. It has 6 harm and hits for a moderate wound. It feeds on nearby plating to mend. | Wounds, maybe a collapse |
| Starve | Haul the four heaps of plating into the gully (Body + Athletics each). It hibernates. | Noise can wake it. Pell turns up for the plating. |
| Sneak | Press C. Sight cones show. Each time it sees you, roll Edge + Stealth. | A miss starts the fight with it acting first |
| Climb | The crack in the west ridge. Body or Edge + Athletics. | A light wound, or sliding back down |

**The moral knot.** Pell, a Mi'naa in the camp, wants the plating and pays a pale crystal for it. Pell carries scavenger band marks under the sleeves (Presence + Insight to notice). Starving the Tel'sharin means handing Pell the metal, or facing Pell down for Hadda's crew. Telling Hadda about the marks gets Pell thrown out.

**Race matters at the doors.** The symbol door opens free for an Iskari (they feel the meaning). A pale crystal works for anyone (Resonance roll). A Sehari can listen to the current (Resonance - 1). A Mi'naa can fuse a bypass from Tel'sharin scrap (Mind + Mi'naa tech). Anyone can study the marks and trace the apprentice's rubbing. The repair drone leaves an Iskari alone unless attacked. The Tel'sharin sees an Iskari from further away.

**The ring sockets.** Light the outer two, leave the middle dark. The clue panel reads plainly to an Iskari. Others roll Mind + Archaeology or Lore. Lighting the middle socket alerts the repair drone. Solving it opens the inner door and settles the drone by its socket.

**Reveal.** The plate holds the master's last record. She followed the resettlement records north, to a stair under the broken city between the Reach and the Spines. Each race hears something different under the voice. When the player gets back, the apprentice is gone. His tent is torn apart and a lamp still burns. A half-burnt note says they came for the plate, not for him. End screen.

**Voices.** The apprentice is careful, formal, kind, guilty. Hadda is blunt. Pell is dry and short. The hunter speaks little. All text follows the voice rules in the parent CLAUDE.md.

## Rules (owner: agent 2)

Straight from canon mechanics, turned into a video game.

- **Checks:** 2d6 + stat + specialisation, minus wounds. 10+ full, 7 to 9 success with a cost, 6 or less a miss that moves the story on. The dice panel shows every term. Dialogue choices show the odds.
- **Character:** race, role, seven stat points (a -1 buys one extra), 3 racial specialisations plus 2 picks, all Trained (+1).
- **Wounds, not hit points:** guard pips soak hits first (1 + Body 2+ + Frontline + Iskari). Then light, moderate and severe wounds. Unlike the tabletop canon, wounds give no roll penalty in the game (the designer's call after playtesting). A fourth wound is a collapse: you wake in camp and lose something. Never a game over.
- **Combat:** turn-based once it starts. Your turn is a move (4 tiles, 5 with Edge 2+) and two actions. Enemies never roll. One roll per exchange, as `docs/build-order.md` plans: when you attack, 10+ is a clean hit, 7 to 9 you both hit (its blow one step lighter), 6 or less it hits you. Every enemy strikes on its own turn, and you roll to defend, even if it already hit back during yours (user call, 2026-09-21). Dogs and scavengers are mooks: one hit drops them. Healing always takes your last, worst wound first. Guard refills after the fight.
- **Abilities:** each race brings two or three, each role one.
  - Sehari: Channel amber (force, needs an amber crystal), Channel crimson (heal), Run on all fours. Crystals chip on a 7 to 9 and can shatter.
  - Iskari: Wake the focus (teal lance, stun), Go still (guard, enemies lose you).
  - Mi'naa: Shock cell (stun), Patch plating (guard).
  - Roles: Hold the line, Aimed shot, Steady breath, Slip away, Mend, Overload (machines).
- **Enemies:** Tel'sharin (6 harm, moderate, feeds to mend), Aza'los repair drone (2 harm, light blow, beam at range 4), the woken defensive-line Iskari (5 harm, moderate, piercing, reach 2, never lets you go), feral dogs and scavengers (mooks, one hit).
- **Stealth:** out of combat, awake enemies have sight cones. Walking into one starts a fight. Sneaking turns it into a Stealth roll: 10+ unseen, 7 to 9 it turns and looks, 6 or less it attacks first.

## UI (owner: agent 2)

A DOM overlay over the canvas. Serif type, bone on dark brown, teal for Aza'los, amber for Maker.

- Title, character creation in five steps, narration cards, ending screen.
- HUD: portrait plate, three wound slots, guard pips, crystals, ability keys, objective line.
- Dice panel for every roll. Dialogue box with portraits, numbered choices, check tags and odds.
- Combat bar: move and action pips, attack, abilities, items, end turn, enemy harm, a short log.
- Panels: journal (J), inventory (I), character sheet (K), help (H), menu (Esc).
- Saves go to `./saves/` through a dev-server plugin. A static build falls back to browser storage.

## The ruin fight, phase 2 (owner: agent B)

The user asked for this change. The Aza'los guardian is gone.

- **The repair drone.** Small, teal and precise, it hovers at the cracks in the court walls and mends them with a thin beam. It has 2 harm, a light blow, and its beam turned on you at reach 4. It never pierces your guard.
- **The activation code.** When the drone falls, the fight ends as usual ("The fight is over"). Then the camera goes to its body, and a teal pulse runs through the floor seams to the east wall niche. The niche lights up.
- **The defensive-line Iskari.** It stands frozen mid-stride in the niche under a crust of sand-stone, and reads as a statue until then. On waking, the crust cracks and falls, its seams light, and it steps into the court. It has 5 harm, hits for a moderate wound, pierces guard, and has reach 2 with its crescent staff.
- **No escape.** It has no sight check and no leash. Leaving the fight does not end it, and going still does not hide you. Out of combat it walks to wherever you are. If you collapse, it goes back to its post and stands guard, awake. It attacks again when you enter the court.

### How an Iskari player is treated (agent B's decision)

- The drone ignores an Iskari. It looks, then goes back to its crack. You can still choose to strike it, and then it fights.
- The defender wakes for anyone who kills the drone. Iskari are no exception.
- Facing an Iskari, the defender's crystal flares at the player's, and it holds still for one turn ("Hesitates"). Then it attacks anyway. The narration says the player knows it "the way you know your own hands". Nothing says why. The soul-crystal spoiler stays unspoken.
