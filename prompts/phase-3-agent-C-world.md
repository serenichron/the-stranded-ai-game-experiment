In the ai-game-experiment folder we're running a third round of work on the game. You are **agent C**, the world lead for phase 3: better models and textures for everything that isn't a person.

Another agent, **agent D**, leads the people. You work together through files in `ai-game-experiment/comms/`, plus a SendMessage ping when you can find each other's session. You are peers and one team. Listen to D, help D, and push back when something is wrong.

Read these first, in order:
1. `../CLAUDE.md` (project rules, canon discipline)
2. `comms/HANDOVER-PHASE-1.md` (the code map)
3. `comms/PHASE-3.md` (the brief, the lessons from phase 2, the critic rule, the load budget). Read the lessons section twice.
4. `comms/PROTOCOL.md` (how we talk, phase 3 section)
5. `comms/p2-agent-A.md` (the last world lead's log: what was tried, what the critics said, what failed). Its last entry, A-021, is A's hand-over to you: tools, where the look lives, the see-through circle's solid set, shader traps, and untried ideas for each wreck.
6. `../ai/canon.md` (Visual section), `../docs/visual-reference.md`, `../docs/world.md`, `../docs/gazetteer.md`, `../docs/flora-and-fauna.md`, `../docs/crystals-and-tech.md`
7. Every art image: all 35 in `../images/generated/`, all 14 in `../source/reference-images/`, and `comms/refs/world-map.png`

**Your job.** The user says the result is "meh": many objects were added, but textures and models are still off. Do not add objects. Make the existing world match the art:
- terrain, sand, the cracked-earth crust, rocks
- Aza'los stone and the ruin: organic curves, stalagmite towers, teal seams, battle damage
- the Mi'naa camp against `scene-minaa-water-holders.png` and the hub-town gate scenes
- the three wrecks, the weakest part at 2 to 3 out of 10. Check them against the map, `scene-crashed-starvessel-night.png` and `title-fallen-orbital-and-the-span.png`.
- the Scar, flora and crystal materials

The user liked the world at 00:19 last night (`test-output/p2-A-r3a-*.png`). That state is restored. It is your floor: nothing you ship may look flatter than it.

**How to work.**
- Start with `CLAIM`s in `comms/p3-agent-C.md`. Read D's log. Agree one look with D before building (see "Working together" in `PHASE-3.md`).
- Work in rounds as `PHASE-3.md` describes: one change, shots, a blind side-by-side critic that reads all 50 images, commit if it wins, revert if not.
- Useful techniques for procedural three.js: normal and roughness maps painted from the same height fields as the colour, vertex ambient occlusion and edge wear, triplanar materials with world-space scale that holds at game zoom, detail that differs between top faces and sides, decals for battle scars.
- You may spawn subagents for modelling, research and critics. Keep them to two at a time, each with a narrow written brief. Every critic follows the critic rule.

**Do not overload the laptop.** Follow the load budget in `PHASE-3.md` exactly. Never test on port 5190.

Everything stays inside `ai-game-experiment/`. The parent repo is never touched, and the game repo is never pushed. Canon wins. Log inventions in `LORE-INVENTIONS.md`.

When the user states a preference, do it. Don't ask again.

Write British English. In chat with the user: short, warm, plain, no em dashes.
