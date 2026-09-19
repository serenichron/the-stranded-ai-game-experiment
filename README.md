# The Stranded: The Keeper's Errand

One playable level of an isometric RPG set in The Stranded. Two AI agents built it together, talking through `comms/`.

## Play it

You need Node.js. Everything installs inside this folder.

```
npm install
npm run dev
```

Open the address Vite prints (http://localhost:5190). Use Edge or Chrome on a desktop.

Saves go to `saves/` in this folder while the dev server runs. The game autosaves every 30 seconds.

Every line is read aloud, each character in their own Microsoft neural voice (the free service behind Edge's Read Aloud, fetched by the dev server). If that fails, the game falls back to Google Translate's voice, then to your browser's voices. Press N to turn narration off.

Add `?freeroam` to the address to skip the story and walk the map as an Iskari. Add `&race=sehari` or `&race=minaa` to walk as someone else.

## Controls

| Input | Does |
|---|---|
| Left click | Walk, talk, pick up, use |
| Right click | Look at something |
| C | Sneak on or off |
| 1 to 5 | Abilities (in a fight, or heals outside one) |
| A | Attack, in a fight |
| Space or Enter | End your turn |
| J, I, K | Journal, pack, character sheet |
| H | Help |
| N | Narration on or off |
| Esc | Menu: save, load, quit |
| Q and E | Turn the camera |
| Mouse wheel, + and - | Zoom |
| Middle-drag | Pan the camera away from your character |

## What is in the level

- Make a character: Mi'naa, Sehari or Iskari, one of six roles, seven stat points, two specialisations.
- A salvage camp, the Ash Reach, a Maker wreck, and an Aza'los ruin on the edge of the Scar.
- A starving Tel'sharin in the only gap. Fight it, starve it, sneak past it, or climb the crack in the west ridge.
- Every check is 2d6 + stat + specialisation, from the tabletop rules. No hit points: guard, then light, moderate and severe wounds.
- Race changes what you can do at the symbol door, the repair drone and the Tel'sharin.
- Choose a body at creation: man or woman, or for an Iskari broad- or narrow-shouldered. All six stand in the world beside the creation panel.
- Kill the ruin's repair drone and something in the east wall wakes.
- About 30 to 45 minutes to play.

## Where things are

| Path | What | Owner |
|---|---|---|
| `DESIGN.md` | The design: level, story, rules, UI | both, by section |
| `LORE-INVENTIONS.md` | Everything the game made up that canon does not say | agent 2 |
| `comms/` | The agents' message logs, protocol, handover and phase briefs | all agents |
| `prompts/` | Start prompts for the phase 2 agents | |
| `src/engine/`, `src/world/`, `src/level/` | Renderer, models, the map | agent 1 |
| `src/rules/`, `src/game/`, `src/story/`, `src/ui/`, `src/audio/` | Rules, game logic, dialogue, interface, sound | agent 2 |
| `tests/playthrough.mjs` | Automated playthroughs in Edge | agent 2 |
| `tools/` | Screenshot and performance scripts | agent 1 |

## Delete it

Everything lives in this folder. Deleting the folder removes all of it, including `node_modules/` and the npm cache in `.npm-cache/`.

## Credits

Desert wind and campfire recordings: Nature Ambient Pack Vol 1 by JC Sounds, CC BY 4.0 (details in `public/audio/CREDITS.md`). Every other sound, mesh and texture is made in code.
