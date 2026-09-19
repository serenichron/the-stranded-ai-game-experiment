# Phase 2: new text outside dialogues.ts

Replacement lines for everything the audit (`p2-text-audit.md`) marked sharpen or rewrite outside `src/story/dialogues.ts`. Line numbers are the audit's. Some have drifted since (game.ts gained drone and defender code), so search for the current text.

Notes:
- The Tel'sharin glows red in every line. Only the Maker wreck stays amber.
- Wounds give no roll penalty. Healing removes the worst wound.
- Many combat and stealth lines are now `BARKS` keys in dialogues.ts. Where that is the fix, the table says so.

## types.ts and level1.ts

| file:line | current text | new text |
|---|---|---|
| types.ts:69 | The record | The Keeper |
| level1.ts:20 | Digger | Old digger |
| level1.ts:31 | Tel'sharin | Ded-waka (Tel'sharin) |
| level1.ts:32-35 | Scrap metal | Heap of plating |
| level1.ts:50 | Aza'los guardian | (already "Aza'los repair drone": keep) |

## game.ts

| file:line | current text | new text |
|---|---|---|
| game.ts:177 | Graphics: ${q}. | Graphics set to ${Label}. (use the button label: High, Medium, Low) |
| game.ts:218 | An Iskari in the salvage camp asked for you. Find him by his tent. | An Iskari in the salvage camp asked for me by name. He waits by his tent. |
| game.ts:312 | CRYSTAL_DESC + " Integrity ${n} of 3." | 3: "Whole." / 2: "Chipped, but it holds." / 1: "Badly cracked. One more use may break it." |
| game.ts:335 | Ready in ${n} turn(s). | n = 1: "Ready next turn." / n > 1: "Ready in ${n} turns." |
| game.ts:415 | You wake in the camp with your head bandaged. | Iskari: "You wake in the camp, propped against a crate. Someone has brushed the sand out of your cracks." / others: keep |
| game.ts:506 | Harm ${h} of ${max} | By harm left: none taken "Unhurt", under half "Hurt", half or more "Badly hurt", one left "Nearly down" |
| game.ts:510 | Click to interact | Per kind: "Click to talk" (NPC), "Click to search" (crate, locker), "Click to drink" (spring, gourd), "Click to read" (sign, panel, door), "Click to take" (crystal), "Click to look" (anything else) |
| game.ts:529 | (displayName only) | Use the LOOK table below |
| game.ts:881-887 | (lamps toggle in silence) | On: "The wick catches. Warm light spills over the sand." / Off: "You pinch the wick. A thread of smoke, then shade." |
| game.ts:904 | Received: ${col} crystal. ${CRYSTAL_DESC[col]} | Keep the shape. It picks up the new crystal text (game.ts:1760-1763) |
| game.ts:919 | The guardian turns its smooth head towards you and holds still. It is waiting for an order you do not know how to give. | The drone turns its eye on you and holds still. It seems to wait for an order you do not know how to give. |
| game.ts:920 | The guardian stands dark. The teal has gone out of it. | (now "The drone hangs still beside the socket, its eye dim." Keep that.) |
| game.ts:1008 | Haul the plating away | Label: "Haul the plating away". Win: "One less heap to feed it". Risk: "Noise, and it may wake" |
| game.ts:1021 | You hauled a heap of plating into the gully. ${n} left. | Update the quest line instead of adding one: "${n} heaps still feed it." / last: "The last heap is in the gully." |
| game.ts:1076 | The amber in its seams dims to the colour of embers. Its legs fold under it. | The red in its seams dims to the colour of embers. Its legs fold under it. |
| game.ts:1117 | [Mind + Tel'sharin tech] | Make it a normal check tag. Win: "A tool that bites harder". Risk: "A cut, and a crumbled tube" |
| game.ts:1126 | Take the feeding tube | Label: "Cut the feeding tube free". Win and risk as above |
| game.ts:1136 | The amber light is gone from its seams. Up close, the bone is real bone. | The red light is gone from its seams. Up close, the bone is real bone. Someone was this, once. |
| game.ts:1139 | It sleeps. Amber light moves in its seams, very slowly, like breathing. | It sleeps. Red light moves in its seams, very slowly, like breathing. |
| game.ts:1182 | Teal light runs up the walls to the inner door. It opens. The guardian goes dark. | (now "...The drone settles by the socket and goes still." Keep that.) |
| game.ts:1348 | Stay hidden from the ${def.name} | Per kind: "Stay out of the ded-waka's sight" / "Stay downwind of the dogs" / "Keep out of the drone's beam" / "Stay out of the scavenger's sight". Win: "Slip past unseen". Risk: "It sees you, and a fight" |
| game.ts:1361 | It heard something. Get out of its sight. | Use BARKS 'stealth:suspicious' |
| game.ts:1507 | You fought the ded-waka and it fell. The amber light went out of it. | I fought the ded-waka and it fell. The red went out of its seams, one by one. |
| game.ts:1513 | You broke the guardian. The halls are silent. | (now "You brought down the repair drone. The court is quiet.") New: "I brought down the repair drone. The court is quiet now." |
| game.ts:1602 | Backlash. | The crystal's heat burns back into your hand. |
| game.ts:1760 | Amber is force. Most common, most used. | Amber holds raw force. Most tools and cells in camp run on it. |
| game.ts:1761 | Crimson is the body: healing and endurance. | Crimson mends the body. Burn it out to close a wound. |
| game.ts:1762 | Pale is light and revelation. It shows what is really there. | Pale shows what is hidden. Hold it to old marks and they light up. |
| game.ts:1763 | Violet is projection. Force at a distance. | Violet pushes. It throws force across a room. |

## ending.ts

| file:line | current text | new text |
|---|---|---|
| ending.ts:12 | You starved the ded-waka. It sleeps by the wreck, amber dimmed to embers. It may wake again in a hundred years. | You starved the ded-waka. It sleeps by the wreck, its red light dimmed to embers. It may wake again in a hundred years. |
| ending.ts:13 | You fought the ded-waka and it fell. Up close, its bones were real bones. | You fought the ded-waka and it fell. Hadda's crew went back east the next day, for the scrap they paid for. |
| ending.ts:20 | Pell and a band-shen fought you for the plating. | Pell and a band-shen fought you for the plating. You did not win that one. |
| ending.ts:25 | The Aza'los guardian stepped aside for you. It knew what you were. You still do not know how. | The repair drone let you pass. It knew what you were. You still do not know how. |
| ending.ts:26 | You broke the Aza'los guardian. The ruin is quieter now, and a little more dead. | Drone dead, defender dead: "You brought down the repair drone. The stone guard it woke fell too. Nobody mends the cracks now." / defender still standing: "You brought down the repair drone. The stone guard it woke still keeps the court." |
| ending.ts:27 | You woke the outer rings and let the middle ring sleep. The guardian went dark on its own. | You woke the outer rings and let the middle ring sleep. The inner door opened for you. |
| ending.ts:29 | You carried the Keeper's archive plate out of the ruin. It holds the last words of the apprentice's master: a stair under the broken city, between the Reach and the Spines. | You carried the Keeper's archive plate out of the ruin. It holds her last words. She went down a stair under the broken city, between the Reach and the Spines. |
| ending.ts:39 | The lamp in his tent is still burning. You sit on his crate, the way he did, and wait. Nobody comes. Stone is patient. You wonder how patient. | The lamp in his tent is still burning. You sit on his crate, the way he did, and wait. Nobody comes. Somewhere north, a stair goes down. |

## combat.ts (game)

| file:line | current text | new text |
|---|---|---|
| combat.ts:74 | Ambush / Combat + enemy names | Title per kind: ded-waka "It has seen you", dogs "Teeth", drone "The drone turns", defender "It walks", scavenger "The old way". Subtitle: a line from BARKS 'combat:start:<kind>' |
| combat.ts:209 | You use ${ab.name}. | Per ability: Channel amber "Force slams out of the amber in your palm." / Channel crimson "Warmth runs from the crystal into the wound." / Run on all fours "You drop to four limbs and run." / Go still "You go still as stone." / Wake the focus "The focus wakes. Teal light gathers." / Shock cell "The cell spits a blue spark down the wire." / Patch plating "You strap plating over the weak spots." / Hold the line "You plant your feet." / Aimed shot "You take a slow breath and aim." / Steady breath "You slow your breathing." / Slip away "You slip out of reach." / Mend "You clean and bind the wound." / Overload "You reach into the machine and pull." |
| combat.ts:272 | ${ab.name}: ${band ?? 'done'}. | full: "${ab.name} lands clean." / partial: "${ab.name} works, at a cost." / miss: "${ab.name} fails." / none: "${ab.name}." |
| combat.ts:284 | You use ${name}. | You use the ${name}. (lower-case the item name) |
| combat.ts:328 | Strike the ${name} / Shoot the ${name} | Lower-case common names, "ded-waka" for the Tel'sharin: "Strike the dog", "Shoot the ded-waka". Win: "Harm it". Risk: "It hits back" |
| combat.ts:342 | You miss the ${name}. | You miss the ${name}, and leave yourself open. (plus BARKS 'combat:miss') |
| combat.ts:414 | You go still. They lose track of you. | Go still: "You go still as stone. They lose track of you." / Slip away: "You slip out of reach. They lose track of you." |
| combat.ts:425 | ${def.name} takes ${n} harm (${h} of ${max}). | Per kind: dog "The dog yelps and backs off a step." / ded-waka "Bone cracks. The red light stutters." / drone "Stone chips fly off the drone. It wobbles." / defender "A slab breaks off its arm. It keeps coming." / scavenger "The band-shen stumbles and swears." Show harm left in the hover, not the log |
| combat.ts:442 | The ${def.name} falls. | BARKS 'combat:down:<kind>' |
| combat.ts:532 | The ${def.name} feeds on the plating and mends (${h} of ${max}). | BARKS 'combat:feeds' |

## state.ts, abilities.ts, rules

| file:line | current text | new text |
|---|---|---|
| state.ts:28 | Thick leaf, bitter sap. Rub it into a wound. Heals your last wound. | Thick leaf, bitter sap. Rub it into a wound. Heals your worst wound. |
| state.ts:83-84 | Found in the empty tent. Most of the words are gone. | Found in the empty tent. What survives: "not the ded-waka... they came for the plate... the stair..." |
| abilities.ts:89-90 | Stand as still as a statue. Gain guard. Enemies at a distance lose track of you. | Stop, the way only stone can. Gain guard. On a clean roll, distant enemies lose you. |
| abilities.ts:205-206 | Clean and bind a wound with dust-aloe sap. | Clean and bind your worst wound. Steady hands, no aloe needed. |
| rules/combat.ts:29 | Tel'sharin | Tel'sharin (ded-waka) |
| rules/combat.ts:38 | Bone fused with dark green metal. Amber light leaks from its seams. It is starving. | Bone fused with dark green metal. Red light leaks from its seams. It is starving. |
| rules/combat.ts:42, 51 | Aza'los guardian / A smooth teal machine... | (already the repair drone: keep) |
| rules/combat.ts:112 | Defend against the ${name} | Lower-case as combat.ts:328: "Defend against the dog". Win: "No harm taken". Risk: "A wound" |
| character.ts:132 | You hurt things from a distance. | You hurt things before they can reach you. |
| character.ts:134 | Stealth, speed and sharp eyes. | You move quietly, move fast, and see things first. |
| wounds.ts:81 | Moderate wound. It slows you, and it counts towards a fall. | Moderate wound. It hurts, and it counts towards a fall. |
| creation.ts:36 | Vessel of the Ninth Stair | Vessel of the Quiet Hall (placeholder: needs the designer's yes, then LORE-INVENTIONS.md) |
| creation.ts:67 | Sing through bone. Sehari only. | Listen to old places, the way the old Sehari did. Sehari only. |
| hud.ts:24 | Force. / Healing. / Reveals what is hidden. / Pushes. | Raw force for tools. / Closes a wound. / Lights up old marks. / Throws force at range. |
| hud.ts:108 | Wound penalty / Applied to every roll until the wound is treated. | Remove the tip. Wounds carry no roll penalty in this game. |
| hud.ts:156 | ${Sev} wound / ${Sev} wound, open | ${Sev} wound / No ${sev} wound yet |
| panels.ts:21 | Right click: Look closer at something | Right click: Look closer at something (keep once LOOK is wired) |
| panels.ts:23 | 1 to 5: Choose an ability in combat | 1 to 5: Use an ability. Some work outside a fight. |
| index.ts:180 | The Keeper's Errand | The Keeper's errand |

## LOOK table

Keyed by entity id, for right click on anything that is not an enemy (game.ts:529). Functions of race or flags are shown as `a / b` with the condition in brackets. Zone ids are included for places with no entity.

```ts
export const LOOK: Record<string, string> = {
  'apprentice': 'An Iskari on a crate, a wax tablet on his knee. He writes slowly, as if every mark costs him.',
  'tent-apprentice': 'A patched tent. Wax tablets stand inside in neat rows, like books on a shelf.',
  'scav1': 'Pell, sorting bolts smallest to largest. The sleeves stay down, even in this heat.',
  'npc-cook': 'Mother Tarn and her pot. The pot is bigger than she is, and it is never cold.',
  'npc-lookout': 'Hadda, eyes on the east. Half her left hand is metal. She taps it when she is thinking.',
  'npc-digger': 'An old digger, knee-deep in a pit. He sifts every handful twice.',
  'spring1': 'Cold water, rising straight out of the rock. The stones around it are green with slime.',
  'lamp-1': 'A crew lamp: a jar, a wick, a cage of wire. It smells of old fat.',
  'lamp-2': 'A crew lamp: a jar, a wick, a cage of wire. It smells of old fat.',
  'lamp-3': 'A crew lamp: a jar, a wick, a cage of wire. It smells of old fat.',
  'chest-1': 'A salvage crate, stencilled with a number nobody can read. The lid is held on with wire.',
  'chest-2': 'A supply crate. Someone has written TARN on it, twice, and underlined it.',
  'chest-3': "A crew crate, dropped when the ded-waka woke. Nobody came back for it.",
  'chest-4': 'A dented locker of dark metal, square-cornered. Miner work, older than anyone here.',
  'sign-1': 'Painted letters on a plank: DED-WAKA. NO GO EST. The skull under it has four eyes.',
  'gourd1': 'A barrel-gourd, fat with water. Cut it and it bleeds sap, then heals.',
  'gourd2': 'A barrel-gourd, fat with water. Cut it and it bleeds sap, then heals.',
  'gourd3': 'A barrel-gourd, fat with water. Cut it and it bleeds sap, then heals.',
  'metal1': 'Torn plating, bone-grey and green. Scrape marks show where the feeding tube has been.',
  'metal2': 'Torn plating, bone-grey and green. Scrape marks show where the feeding tube has been.',
  'metal3': 'Torn plating, bone-grey and green. Scrape marks show where the feeding tube has been.',
  'metal4': 'Torn plating, bone-grey and green. Scrape marks show where the feeding tube has been.',
  'npc-hunter': 'A Sehari hunter on a rock, so still that the dust settles on her.',
  'crystal-buried': 'The sand here is cooler than it should be.',
  'crystal-pale': 'A pale crystal, half out of the sand. It holds the light like water.',
  'crystal-crimson': 'A crimson crystal, warm as a hand. It feels faintly alive.',
  'crystal-amber': 'An amber crystal in a crack of the wall. It hums if you stand close.',
  'niche1': 'A tall niche in the east wall. Something stands inside it, grey and still, one foot forward.',
  'defender1': 'A stone figure in the niche, frozen mid-stride. Dust lies thick on its shoulders.',
  'lever-a': 'A crystal socket in the floor, ringed with carved grooves.',
  'lever-b': 'A crystal socket in the floor, ringed with carved grooves.',
  'lever-c': 'A crystal socket in the floor. Its grooves are scratched through, like the middle ring on the panel.',
  'sign-rings': 'A curved panel of carved rings. The same three rings, again and again.',
  'inner-door': 'A smooth door with no marks at all. Teal threads run from it down into the floor.',
  'symbol-door': 'A round door of pale stone, covered in rings of curved marks. No handle. No seam.',
  'archive': 'A curved niche in the wall. Something thin and pale rests inside.',
  'z-wreck-edge': 'The Maker wreck: bone and coral grown into dark green metal. Amber light still seeps from one torn side.',
  'z-crack': 'A crack in the west ridge, a shoulder wide. Old bolts are hammered into the rock.',
  'z-spire-root': 'A lone spire-root, twisted and woody. Nothing else grows for fifty paces.',
  'z-scar-view': 'Far to the north, a long red-brown wound in the land. The Scar.',
};
```

Variants worth a function, if you want them:
- `apprentice` for an Iskari: "Serving line, like you. His knuckles are worn smooth from the stylus."
- `chest-4` for a Mi'naa: "...A stamped tag inside. Most of the script is gone, but you can read the number: 7."
- `defender1` once awake and dead: use the existing game.ts:963 line.
- `metal1-4` once hauled: "An empty patch of sand, with drag marks leading west."
