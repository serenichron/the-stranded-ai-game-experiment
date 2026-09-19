# Phase 2 text audit

Audit only. Nothing in `src/` was changed. Every line below is verbatim from the source as of this audit. Line numbers are 1-based.

Scope: every string the player reads or hears. That covers dialogue, choices, narration cards, barks, look text, toasts, journal lines, objectives, item and ability text, enemy blurbs, check labels, combat log, UI prompts, help, creation and ending. Pure numbers and one-word button labels are grouped where they are all fine.

## Header

**Counts** (one row per line or tight group): **keep 394, sharpen 125, rewrite 30**. Total 549 rows. Many keeps are functional UI (buttons, tooltips, pickup toasts). In the story text alone, roughly one line in three needs work.

Most of the dialogue in the set pieces is good. The door, the archive, the tent and the crack read like a game already. The weak text is the glue around them: hubs, exits, check labels, misses, journal lines, logs and toasts.

**The 5 worst patterns**

1. **Hub prompts and exits with no one in them.** Each NPC falls back to the same shop-counter line when you return.
   - Hadda: "What do you need?" (dialogues.ts:202). Pell: "Anything else?" (293). The apprentice: "Ask what you need to ask." (34).
   - Exits: "Nothing. Take care." (213), "Later." (310), "I should go." (55), "Not now." (464).
2. **Choices read as menu items, not a person talking.** Most are plain questions or reports with one attitude each.
   - "Who are you?", "What is the job?", "Tell me about the ded-waka.", "Who is Pell?", "What happened at the wreck?"
   - The worst is "Pell carries band marks. Pell is a scavenger." (207). It sounds like a form being filled in.
   - Only Pell's marks scene (341 to 343) gives a real kind, curious or blunt split.
3. **Checks hide the stakes, and misses are dead ends.** Every check label is a verb ("Read the apprentice", "Watch Pell", "Study the door", "Climb the crack"). None says what you risk or could win.
   - Several misses are just "you fail", or a joke in place of an outcome: "Rings. More rings. Your head aches." (744), "The marks swim. The longer you look, the less they mean." (675), "It is a tree. It is alone. You know the feeling." (904).
4. **System-speak in toasts, logs and hovers.** Examples:
   - "Shock cell: partial." (combat.ts:272), "Feral dog takes 1 harm (1 of 1)." (combat.ts:425), "Harm 2 of 6" (game.ts:506).
   - "Integrity 2 of 3." (game.ts:312), "Ready in 1 turn(s)." (game.ts:335), "Backlash." (game.ts:1602).
   - Capital letters land mid-sentence: "Stay hidden from the Feral dog", "Strike the Feral dog".
   - The combat log never gives the enemy a voice or a body.
5. **Lines that sound deep and say nothing.**
   - "The light will not wait. It never moves, but it will not wait." (34)
   - "Stone forgets slowly, but it forgets." (83). "Stone is patient. You wonder how patient." (ending.ts:39). "It is only a plate." (806).
   - Crystal text: "Pale is light and revelation." (game.ts:1762), "Amber is force. Most common, most used." (1760).

**Also found (not voice, but they break the text):**
- **Dead text.** The kid Osk (dialogues.ts:479 to 513) has no entity in `level1.ts`, so the player never meets him. `plateBack` "You have it." (178) cannot be reached, because the apprentice is removed when you take the plate.
- **Promises the code does not keep.**
  - Pell's "And the offer is gone with me." (362): `pellThreatened` is never read, so the offer still stands.
  - `paleMiss` says "something inside the ruin turns its head" (619), but `guardianAlerted` is never read.
  - Help says right click lets you "Look closer at something" (panels.ts:21), but right-clicking anything that is not an enemy shows only its name (game.ts:529).
- **Rules the text gets wrong.**
  - The moderate wound tip says "It slows you" (wounds.ts:81), and the HUD tip says a penalty applies "to every roll" (hud.ts:108). `WOUND_PENALTIES = false`.
  - The aloe "Heals your last wound" (state.ts:28), but `healOne` heals the worst.
  - Mend says it uses "dust-aloe sap" (abilities.ts:206), but it uses none.
- **Canon for this game.** PHASE-2 says the Tel'sharin glow red, and only the wreck stays amber. Seven lines still describe amber light in the Tel'sharin itself (telFirst, the blurb, hibernation, look text, the journal, the ending).
- **The guardian is being replaced** by the repair drone and the defender. Every guardian line is marked rewrite for that reason alone.
- **Speaker tags on narration.** `cook.eat` (469) and `hunter.start` (1058 to 1059) are narration but tagged with a speaker, so the NPC's voice reads out a line about them.

---

## src/story/dialogues.ts

### The apprentice

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :17 | start, return | The apprentice looks up from his tablet of wax. His stone fingers stop mid-line. | keep | good: concrete, shows him working |
| :18 | start, first | An Iskari sits on a crate by a patched tent. His skin is grey stone, worn smooth at the knuckles. He does not move until you are close. | keep | good: concrete intro, stillness in character |
| :25 | hello, Iskari | Serving line. Like me. I can see it in your hands. Sit, if you like. The crate is the only chair I have. | keep | good: race-aware, warm, the crate joke lands |
| :27 | hello, Sehari | A Sehari, in a salvage camp. The crew will stare. Let them. Sit, if you like. The crate is the only chair I have. | keep | good: race-aware, kind |
| :28 | hello, Mi'naa | You came. Good. Sit, if you like. The crate is the only chair I have. | sharpen | the Mi'naa player gets no race line, unlike the other two |
| :34 | hub, after job | Is there something else? The light will not wait. It never moves, but it will not wait. | rewrite | sounds deep, says nothing (PHASE-2 example); "X, but Y" shape |
| :34 | hub, before job | Ask what you need to ask. | rewrite | hub prompt with no character |
| :36 | choice | Who are you? | sharpen | choice reads as a menu item |
| :37 | choice | What is the job? | sharpen | menu item; one attitude only |
| :38 | choice | Tell me about the ded-waka. | sharpen | menu item |
| :39 | choice | Is there another way past the ridge? | keep | player talking about their problem |
| :40 | choice | What do you know about the ruin? | sharpen | generic info request |
| :42 | choice | Look at him closely. | keep | an action, not a question |
| :47 | check label | Read the apprentice | sharpen | check does not say what is at stake |
| :54 | choice | I have the plate. | rewrite | cannot be reached: the apprentice is removed when you get the plate (game.ts:709, 829) |
| :55 | choice | I should go. | sharpen | filler exit |
| :60 | who | I keep records. Or I try to. Long ago I was apprenticed to a Keeper. | keep | good: self-doubt in three beats |
| :65 | who2 | The Keepers were Iskari who wrote things down, so the ripples could not take everything. Few people know the name now. | sharpen | a lore lecture with no feeling from him |
| :70 | who3 | My master went north to look at something. Then the last ripple came. I shut down, as we do. When I woke, she was gone. | keep | good: concrete loss, sets up the reveal |
| :72 | choice | When was that? | keep | natural follow-up |
| :73 | choice | I am sorry. | keep | kind attitude, fits |
| :78 | who4 | About two hundred years ago, by the Mi'naa count. I never finished my training. I have done the work alone since. | keep | good: concrete number, guilt shows |
| :83 | who5 | Thank you. It was a long time ago. Stone forgets slowly, but it forgets. | sharpen | aphorism with an "X, but Y" shape; close to sounding deep |
| :88 | job | North, past the ridge, there is an Aza'los ruin. Half of it is under the sand. My master hid archive plates in places like that. | keep | good: concrete and clear |
| :93 | job2 | I think one plate is still inside. Here. This is her mark, three rings with one broken. Look for it. | keep | good: hands you an object |
| :96 | toast | Received: the apprentice's rubbing | keep | functional; the flavour lives in the item text |
| :104 | job3, Iskari | I tried the door once. It did not know me. I am a poor reader of the old marks. You may read them better. Some of us do. | keep | good: race-aware, humble |
| :105 | job3, other | I tried the door once. It did not know me. I am a poor reader of the old marks, and I never finished my training. | sharpen | repeats who4's line word for word |
| :110 | job4 | And now there is the ded-waka. Hadda's crew cut into the old wreck two days ago. Something inside woke up. | keep | good hook |
| :112 | choice | I will bring the plate back. | sharpen | only one way to accept; no attitude |
| :113 | choice | What do I get out of it? | keep | good: blunt attitude |
| :118 | pay | Water. A leaf of dust-aloe. And whatever the plate says, you hear it first. I have nothing else to give. | keep | good: concrete, and the last clause is character |
| :125 | accept, Iskari | Good. Keep your focus close. The ded-waka know us, somehow. I have never learned why. | keep | good: plants the Tel'sharin tie |
| :127 | accept, Sehari | Good. You feel the ground here, I think. There is old crystal under that ruin. More than anyone has dug. | keep | good: race-aware |
| :128 | accept, Mi'naa | Good. Your people keep memory in things. So do mine, in a way. That plate is memory. Carry it carefully. | sharpen | "That plate is memory" is abstract |
| :133 | toast | Received: water, dust-aloe leaf | keep | functional |
| :134 | journal | The apprentice wants a Keeper archive plate from the ruin north of the ridge. Look for three rings, one broken. | rewrite | reads like a task list, not your notes |
| :135 | journal | A starving Tel'sharin woke in the wreck to the east. It sits by the gap in the ridge. | sharpen | task list; he said "ded-waka", the journal says "Tel'sharin", and nothing links the two |
| :136 | objective | Get past the ridge to the ruin in the north. | keep | objective line, plain is right |
| :142 | dedwaka | The crew call it ded-waka. Dead-walker. A starving one feeds on metal, and on the dead. | keep | good: concrete, eerie |
| :147 | dedwaka2 | The old records say this. Take its food away and it sleeps again. It can sleep for centuries. There are four heaps of plating around it. | sharpen | "The old records say this." is stiff |
| :148 | journal | The apprentice says a starving Tel'sharin sleeps again if its food is taken away. Four heaps of metal lie around it. | sharpen | task list; passive voice |
| :153 | crack | There is a crack in the west ridge. It is narrow and the rock is loose. Two of the crew fell there last season. One walked again. | keep | good: "One walked again" does real work |
| :154 | journal | There is a narrow crack in the west ridge. A climb, and a risky one. | keep | reads like a note |
| :159 | ruin | Pale stone, curved halls, teal light in the seams. The door is marked. Past the door, I do not know. Something moved in there when I tried. | keep | good: concrete, ends on a hook |
| :163 | readFull | He is afraid. It is not the ded-waka. He keeps glancing at the north road, where nobody is. He hides it well, and he is not hiding it from you. | keep | good: a clue to the reveal (but `apprenticeAfraid` is never used) |
| :168 | readPartial | He is tired in a way stone should not be. There is something he is not saying. | sharpen | the second sentence is generic |
| :173 | readMiss | You are staring. Iskari faces do not move much. You will not learn a lot that way. | sharpen | the miss is just a failure, though in voice |
| :178 | plateBack | You have it. | rewrite | cannot be reached, and flat |
| :183 | bye, has job | Come back soon. I would like to read it with you. | keep | good: sets up the empty crate |
| :183 | bye, no job | I will be here. I am usually here. | keep | good: dry humour in character |

### Hadda, crew boss

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :195 | start, return | Hadda wipes grease off her hands onto grease on her trousers. | keep | good: a funny, concrete image |
| :196 | start, first | A broad Mi'naa woman in a patched leather apron. Half her left hand is metal. "Gud dey. You're the one the stone man hired." | keep | good intro (but Pell uses the same greeting, see below) |
| :202 | hub | What do you need? | rewrite | hub prompt with no character (PHASE-2 example) |
| :204 | choice | What happened at the wreck? | sharpen | menu item |
| :205 | choice | Who is Pell? | sharpen | menu item; offered before the player may know the name |
| :207 | choice | Pell carries band marks. Pell is a scavenger. | rewrite | choice reads as a report form; no attitude; the name is said twice |
| :211 | choice | The ded-waka is asleep. | sharpen | flat report, no attitude (proud, tired, warning) |
| :212 | choice | The ded-waka is dead. | sharpen | same |
| :213 | choice | Nothing. Take care. | rewrite | filler exit (PHASE-2 example) |
| :218 | wreck | We cut into the old wreck for metal. We got the metal. We also got that thing. It took Brenn by the arm and would not let go. | keep | good: blunt, concrete |
| :223 | wreck2 | Brenn lives. The arm stayed there. Nobody goes east now. The good scrap is still lying around it, and it is ours. We paid for it. | keep | good: her want is clear |
| :229 | pell | Came in a month ago with good hands and no band. Doesn't talk much. Works hard. That's all I ask of anyone. | keep | good: clipped, with irony |
| :234 | report | Band-shen. In my camp. Eating my food. | keep | good: anger in six words |
| :239 | report2 | Then Pell goes tonight. Thank you. Here, take these. We dried them last season. | sharpen | "Thank you" is soft for her; the reward feels like a vending machine |
| :244 | toast | Received: 2 dust-aloe leaves, a charge-fruit | keep | functional |
| :245 | journal | You told Hadda that Pell is a scavenger. Pell will be thrown out. | sharpen | task log with no feeling |
| :251 | asleep | Asleep. Not dead. Well. Asleep is quiet. We can work around quiet. | keep | good voice |
| :257 | dead | Dead. You're sure? Then we go back out tomorrow. Brenn will want to see it. | keep | good: the Brenn callback |
| :261 | bye | Watch the east. | keep | short and in character (but should change once the ded-waka is dealt with) |

### Pell

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :271 | start, return | Pell keeps sorting bolts by size. Pell does not look up. | keep | good: a dry dodge |
| :272 | start, first | A thin Mi'naa in long sleeves sorts bolts on a cloth. "Gud dey. You're going past the wreck? Then you can do something for me." | sharpen | same "Gud dey. You're..." opener as Hadda, which blurs the two |
| :278 | offer | The ded-waka sits on four heaps of good plating. Drag them into the dry gully west of it. No food, no ded-waka. It sleeps. | keep | good: a concrete plan |
| :283 | offer2 | Leave the plating in the gully. I collect it later. You get a pale crystal for your trouble. Clean one. | keep | good: "Clean one." is salesman |
| :287 | journal | Pell will pay a pale crystal if you starve the ded-waka and leave the plating in the gully for Pell. | sharpen | task list; the name is said twice |
| :293 | hub | Anything else? | rewrite | hub prompt with no character (PHASE-2 example) |
| :295 | choice | Why do you want the plating? | sharpen | menu item |
| :297 | choice | Watch Pell's hands while they work. | keep | good: an action |
| :303 | check label | Watch Pell | sharpen | check does not say what is at stake |
| :309 | choice | Hadda says that plating belongs to the camp. | keep | the player pushing back |
| :310 | choice | Later. | sharpen | filler exit |
| :315 | why | Metal is metal. People pay for it. Hadda pays in stew. | keep | good: dry, funny |
| :320 | belongs | Hadda cut the wreck open and then ran. Things belong to whoever carries them. Ask anyone out on the sand. | keep | good: a scavenger's view in plain words |
| :324 | marksFull | Pell reaches for a bolt and a sleeve rides up. Dark lines on the forearm, cut in a pattern. Band marks. Pell sees you see. | keep | good: "Pell sees you see" |
| :329 | marksPartial | Something is off. Pell tugs a sleeve down every few seconds, even in this heat. You do not see what it hides. | keep | good: the partial still gives a clue |
| :334 | marksMiss | Staring costs extra. | keep | good: in character; the miss still has a voice |
| :339 | marks2 | Covered is covered. You want to make something of it? | keep | good: the tic, and a threat |
| :341 | choice | No. Your business is yours. | keep | kind attitude |
| :342 | choice | Does Hadda know? | keep | curious attitude |
| :343 | choice | Hadda should know. | keep | blunt attitude (no sly option, such as using it as leverage) |
| :348 | haddaKnow | Hadda knows what Hadda wants to know. My band is four days west. I came here to eat. That is all. | keep | good |
| :353 | keep | Good. Then we are fine, you and me. | sharpen | flat for Pell |
| :356 | journal | Pell carries scavenger band marks. You said nothing. | keep | reads like a note |
| :362 | threat | Then tell. I will be gone before your feet are dusty. And the offer is gone with me. | rewrite | does not make sense: `pellThreatened` is never read, so the offer and the gully payout still stand |
| :365 | journal | Pell carries scavenger band marks. You said you might tell Hadda. | keep | note |
| :369 | bye | Mind the ded-waka. It minds you. | keep | good wordplay |
| :376 | gully, reported | Pell steps out from behind a rock. "Thrown out of camp. Thanks for that. The plating is mine now. I think I earned it." | keep | good: bitter, dry |
| :377 | gully | Pell steps out from behind a rock and looks at the four heaps in the gully. "Neat work. It sleeps like a stone." | sharpen | stock phrase; could jab an Iskari player |
| :379 | choice | It is yours. As agreed. | keep | fine |
| :380 | choice | Take it and go. | keep | curt, fits |
| :382 | choice | The plating goes back to Hadda's crew. | keep | clear stand |
| :386 | check label | Face Pell down | sharpen | check does not say the stake (crystal, or a fight) |
| :396 | gullyGive | Then here. Pale, as promised. It shows you what is really there. Useful in old places. | sharpen | "what is really there" is vague; it could point at the door |
| :400 | toast | Received: pale crystal | keep | functional |
| :401 | journal | You let Pell take the plating. Pell paid in a pale crystal. | keep | note |
| :407 | gullyGo | I will. Next time you see a band-shen, look the other way. It is cheaper. | keep | good parting shot |
| :416 | gullyWin | Pell looks at you for a long moment, then laughs once. "Fine. Keep your stew-metal. Take the crystal anyway. I do not like owing." | keep | good: a want and pride |
| :421 | journal | You kept the plating for the camp. Pell left, and paid you anyway. | keep | note |
| :427 | gullyHalf | "Fine. Keep it." Pell spits in the sand and walks west. There is no crystal. | keep | good: a partial with a real cost |
| :430 | journal | You kept the plating for the camp. Pell left with nothing. | keep | note |
| :436 | gullyFight | Pell whistles two notes. A second figure rises from the rocks with a sling. "Then we do it the old way." | keep | good: an interesting miss |
| :444 | gullyEnd | Pell walks off into the sand. In a minute there is nothing to see but heat. | keep | good image |

### Mother Tarn (cook)

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :457 | start | Mother Tarn stirs a pot of digger-tuber stew. "Eat first. Heroes are for stories. You are going out on the sand." | keep | good: warm and bossy |
| :460 | choice | I would love some. | sharpen | the only attitude is polite; bland |
| :464 | choice | Not now. | sharpen | filler exit |
| :469 | eat | Hot, starchy and a bit burnt. It is the best thing you have eaten in days. | sharpen | good line, but tagged `speaker: 'cook'`, so Tarn's voice reads narration about her own stew |
| :476 | bye | Your stomach will ask later. | keep | fine, in character |

### Osk, the child (unreachable)

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :484 | start, Iskari | A small Mi'naa child stares at your stone hands. "Are you very old? Do you remember the ded-waka coming?" | keep | good, but unreachable: no Osk entity in level1.ts |
| :486 | start, Sehari | A small Mi'naa child stares at your eyes. "Can you really feel the kin under the sand? Is there any under me?" | sharpen | unreachable; "kin" (crystal) is never explained to the player |
| :487 | start, Mi'naa | A small Mi'naa child tugs your sleeve. "Are you going to the ruin? Bring me a teal stone. A small one." | keep | good, unreachable |
| :490 | choice | I do not remember. I am sorry. | keep | kind, fits |
| :495 | choice | Kneel and put a palm on the sand. | keep | action |
| :499 | choice | We will see. | sharpen | filler exit |
| :504 | iskBye | "That is all right. I don't remember much either. Mama says that is normal." | keep | good: sweet, and a canon echo |
| :508 | sehFeel | Far below, faint as a pulse through a wall, something hums. Not under the child. North, under the ruin. A lot of it. | sharpen | a "Not X. Y" shape; `sehFeltNorth` is never used |
| :512 | bye | "A small one," the child says again. | keep | good |

### Symbol door

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :521 | start, tried | The door is still sealed. The curved marks sit in their rings, patient. | keep | fine |
| :522 | start, first | A round door of pale stone fills the hall. Curved marks run around it in rings. A thread of teal light moves through them, then stops. There is no handle. There is no seam. | keep | good: concrete, sets the puzzle |
| :526 | choice, Iskari | Let the meaning come. | keep | good: race voice |
| :532 | choice | Hold the pale crystal to the marks. | keep | clear |
| :538 | check label | Wake the door with pale light | sharpen | stake unstated (the crystal can crack; something can wake) |
| :545 | choice, Sehari | Put your palm flat on the stone and listen. | keep | good |
| :552 | check label | Listen to the door | sharpen | stake unstated (a burnt hand) |
| :559 | choice, Mi'naa | Fuse a bypass from Tel'sharin scrap. | keep | good |
| :562 | lock reason | You need a piece of Tel'sharin scrap. | sharpen | does not say where to get it (the heaps by the wreck) |
| :566 | check label | Fuse a bypass | sharpen | stake unstated |
| :573 | choice | Study the marks for a pattern. | keep | clear |
| :578 | check label | Study the door | sharpen | stake unstated |
| :585 | choice | Match the apprentice's rubbing to the marks. | keep | clear |
| :589 | choice | Leave it for now. | keep | fine exit from an object |
| :592 | leave | You step back. The teal thread moves once more, then rests. | keep | good |
| :594 | iskRead | You do not read the marks. You feel them, the way you feel warmth on your face. *Kept for those who come back.* There is a question under it. You answer without words. | sharpen | strong, but opens with a "not X, Y" contrast |
| :598 | opens | The rings turn. Stone slides on stone with no sound at all. The door opens like an eye. | keep | good |
| :608 | paleFull | Pale light spills from the crystal into the rings. The marks brighten one by one, as if something checked each and found it true. | keep | good |
| :612 | palePartial | The rings light and turn. The crystal gets hot in your hand. A fine crack runs across it. | keep | good: the cost is visible |
| :619 | paleMiss | The light goes into the marks and comes back wrong. The crystal cracks. Somewhere inside the ruin, something turns its head. | sharpen | a good miss, but `guardianAlerted` is never read, so the threat is empty |
| :627 | listenFull | Under the stone the old current still runs. You find its rhythm and breathe with it. The rings answer. | keep | good |
| :631 | listenPartial | The current finds you before you find it. It goes through your arm like cold water. The rings answer, but your hand shakes. | keep | good |
| :638 | listenMiss | Too much, too fast. The current throws your hand off the stone. Your palm is burnt white. | keep | good: an interesting miss |
| :645 | fuseFull | You wedge the scrap into a gap in the rings and twist two wires into its warm core. The Tel'sharin metal wakes. The Aza'los stone does not like it. It opens anyway. | keep | good: the best race beat in the game |
| :652 | fusePartial | The scrap spits sparks and burns your fingers. The rings grind open, loud as a rockfall. | keep | good (`guardianAlerted` is unused again) |
| :661 | fuseMiss | The scrap flares and dies. The door does not care. You still have the scrap, but it is cooler now. | sharpen | "cooler now" does not say what it means for a second try |
| :665 | studyFull | The outer ring repeats. The inner rings do not. One inner mark is the same as the rubbing: three rings, one broken. The door wants that shape traced in order. | keep | clear clue |
| :670 | studyPartial | There is a pattern. Rings inside rings. One mark looks familiar, but you cannot say from where. | keep | fine |
| :675 | studyMiss | The marks swim. The longer you look, the less they mean. | sharpen | the miss is just a failure; abstract |
| :679 | rubbing | You hold the cloth up to the stone. The broken ring matches one mark exactly. You trace it with a finger: outer, middle, inner, and the break. | keep | good |
| :683 | choice | Trace it slowly. | sharpen | the only choice; no way to back out |
| :687 | check label | Trace the Keeper mark | sharpen | stake unstated |
| :696 | traceCost | The stone warms under your finger and bites. The rings turn. | keep | good |
| :703 | traceMiss | Your finger slips at the break. The teal thread flares and goes dark. Try again, slower. | sharpen | "Try again, slower." is a UI instruction in narration voice |

### Ring panel

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :714 | start, Iskari | Marks in a curved panel. The meaning arrives whole: *The outer rings wake. The middle ring sleeps. Then the way is kept open.* | keep | good |
| :715 | start, other | A curved panel of marks: three rings, drawn again and again. In each drawing the middle ring is scratched through. | keep | good: a fair visual clue |
| :719 | choice | Work out what it means. | keep | fine |
| :724 | check label | Read the ring panel | sharpen | stake unstated |
| :730 | choice | Step back. | keep | fine |
| :733 | back | The panel glows faintly, then settles. | sharpen | filler |
| :735 | ringsFull | Three sockets, three rings. Light the outer two. Leave the middle one dark. That is the instruction. | keep | clear ("That is the instruction." is a bit flat) |
| :740 | ringsPartial | The middle ring is always crossed out. Whatever the middle one is, it should stay off. | keep | a partial that still helps |
| :744 | ringsMiss | Rings. More rings. Your head aches. | rewrite | the miss is just a failure; the joke adds nothing and gives no way on |

### Archive

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :753 | start | A thin plate of pale stone rests in a curved niche. Three rings are cut into its face, one broken. Azure threads drift under the surface like fish under ice. | keep | good: "fish under ice" |
| :755 | choice | Take the plate. | keep | fine |
| :756 | choice | Not yet. | keep | fine |
| :759 | wait | The threads slow, as if waiting with you. | keep | good |
| :761 | touch | The moment your skin touches it, the room goes blue. | keep | good |
| :769 | r1 | If this plate is warm, someone has come back. I hope it is you, my apprentice. I hope it is not only the sand. | keep | good: moving |
| :774 | r2 | The ripple is close. I feel it at the back of my teeth. I have maybe a day before I go still. | keep | good: "back of my teeth" |
| :781 | r3, Mi'naa | I followed the resettlement records north. [The next marks are numbers, in Mi'naa script. You can read them. A year: thirteen hundred.] | keep | good: race payoff |
| :782 | r3, other | I followed the resettlement records north. [The next marks are numbers in an old script. They slide away from you.] | keep | fine |
| :787 | r4 | Where the old city broke, between the Reach and the Spines, there is a stair that goes down. Our records never mention it. That is why I went. | keep | good |
| :794 | r5, Iskari | Something below is still awake. [For a moment you know this voice. Not the words. The voice. Then it is gone, and you do not know why your hands are shaking.] | keep | good: the strongest race beat |
| :796 | r5, Sehari | Something below is still awake. [Under the voice, the ground hums. Not one hum. Many, very far down, like a crowd behind a wall.] | keep | good |
| :797 | r5, Mi'naa | Something below is still awake. [The plate buzzes against your palm, the way an implant does when it is about to fail.] | keep | good: concrete Mi'naa image |
| :802 | r6 | Do not follow me alone. Find people who remember different things. Between you, you may remember enough. | keep | good: the theme in plain words |
| :806 | r7 | The blue drains out of the room. The plate is cold again. It is only a plate. | sharpen | "It is only a plate." deflates the peak |
| :810 | toast | Received: Keeper archive plate | keep | functional |
| :811 | journal | The plate holds the master's last record. She went north, to a stair under the broken city. Take it to the apprentice. | sharpen | the last sentence is a task, not a note |
| :812 | objective | Take the plate back to the apprentice in the camp. | keep | objective |

### The empty tent

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :822 | start | The apprentice is not on his crate. The tent flap is open. Inside, a lamp still burns. | keep | good |
| :826 | t2 | The wax tablets are scattered on the floor. One is split in two. A long scrape runs through the sand to the back of the tent, and out. | keep | good |
| :830 | t3 | Half under the bedroll there is a scrap of cloth with charcoal on it. Most of it is burnt. | keep | good |
| :832 | choice | Read what is left. | keep | fine |
| :836 | t4 | *...not the ded-waka. They came for the plate, not for me... tell them the stair... do not let them take...* The rest is ash. | keep | good: the reveal lands |
| :839 | journal | The apprentice is gone. His tent was torn apart. He left a half-burnt note. | keep | fine as a closing note |

### Spire-root, Scar, crack

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :852 | spireRoot, Sehari | A lone spire-root stands in the open sand, woody and twisted. You feel it before you see it. Under its roots, something cool and bright. Pale. | keep | good |
| :853 | spireRoot, other | A lone spire-root stands in the open sand, woody and twisted. Nothing else grows for fifty paces. | keep | good |
| :856 | choice | Dig where the feeling is strongest. | keep | good |
| :862 | choice | Why would a tree grow alone out here? | keep | good: curious player voice |
| :868 | check label | Read the spire-root | sharpen | stake unstated (a crystal) |
| :874 | choice | Move on. | keep | fine |
| :877 | move | The tree creaks in the hot wind. | keep | fine |
| :879 | dig | An arm deep, the sand turns cool. Your fingers close on a pale crystal the size of a thumb. It holds the light like water. | keep | good |
| :888 | readFull | Prospectors say a lone spire-root drinks from buried crystal. You dig between the roots. An arm deep, your fingers close on a pale crystal. | keep | good |
| :897 | readPartial | It must be drinking from something below. You dig, but the sand keeps sliding back. You find a few charge-fruit fallen in the roots instead. | keep | good: the partial gives something |
| :904 | readMiss | It is a tree. It is alone. You know the feeling. | rewrite | the joke deflates the moment (PHASE-2 example) |
| :909 | scarView | From the ridge you can see it. Far to the north, a long wound in the land, red-brown at the edges. The Scar. Nothing moves there. Nothing grows. | keep | good |
| :916 | crack | The crack is a shoulder wide. Loose stone hangs above it. Someone has hammered old bolts into the rock as handholds. Some of the bolts are missing. | keep | good |
| :919 | choice | Climb through. | keep | fine |
| :923 | check label | Climb the crack | sharpen | stake unstated (a wound, or sliding back) |
| :930 | choice | Squeeze through, light and careful. | keep | good |
| :934 | check label | Squeeze through the crack | sharpen | stake unstated |
| :940 | choice | Not this way. | keep | fine |
| :944 | no | A pebble rattles down the crack as you turn away. | keep | good |
| :951 | through | Hand, foot, bolt, breathe. The rock scrapes both shoulders. Then there is sky again, and the ruin below you. | keep | good rhythm |
| :958 | throughHurt | A bolt pulls loose under your hand. You catch the rock with your forearm and lose some skin. But you are through. | keep | good |
| :966 | fall | The rock gives. You slide the whole way down in a rush of grit and land hard. | keep | good |

### Tel'sharin, guardian, dogs

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :977 | telFirst | It crouches over a heap of torn plating. Bone and dark green metal, grown into each other. A tube slides out of its chest and into the metal. Amber light pulses along its seams, slow, like breathing. | sharpen | strong, but PHASE-2 makes Tel'sharin light red |
| :981 | telFirst, Iskari | Then its head turns. Not towards a sound. Towards you. You have not made a sound. | keep | good: chilling race beat |
| :985 | telFirst end | Four heaps of plating lie around it. The gap in the ridge runs right past. | keep | good |
| :988 | journal | You have seen it. You could fight it, starve it, sneak past it, or climb the crack in the west ridge. | sharpen | a menu list in the journal |
| :989 | objective | Get past the ded-waka. Fight, starve, sneak, or climb. | keep | objective, plain is right |
| :999 | guardianFirst, Iskari | A smooth teal machine stands in the hall. It turns. A thin fan of light passes over your face, and it steps aside. It knows what you are. So, it seems, does everything here. | rewrite | the guardian is replaced by the repair drone |
| :1000 | guardianFirst | A smooth teal machine stands in the hall. Every movement it makes is exact. A thin fan of light sweeps the floor in front of it. | rewrite | the guardian is replaced by the repair drone |
| :1011 | dogsCalm | Two lean dogs come out of the wreck shadows, heads low. Ribs show through sun-dark fur. They have not decided about you yet. | keep | good |
| :1014 | choice | Crouch low. Show them empty hands. | keep | good |
| :1018 | check label | Calm the dogs | sharpen | stake unstated |
| :1024 | choice | Ready yourself. | sharpen | menu word for "fight" |
| :1028 | calm | You keep still and let them smell the air. The bigger one sneezes. They lose interest and trot off towards the camp scraps. | keep | good: the sneeze |
| :1035 | half | The smaller dog backs off. The bigger one does not. | keep | fine |
| :1042 | fight | The bigger dog shows its teeth. | sharpen | thin for a fight trigger |

### Sehari hunter

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :1058 | start, Sehari | The hunter drops from four limbs to two as you come near. Pale-gold eyes, root-dark marks down one cheek. "Sael is loud today. You hear it too." | keep | good: race-aware kinship |
| :1059 | start, other | A Sehari hunter crouches on a rock, grey-lavender skin cracked like dry clay. Pale-gold eyes follow you. They do not blink much. | sharpen | tagged `speaker: 'hunter'` but pure narration, and the hunter says nothing to non-Sehari |
| :1061 | choice | What are you hunting? | sharpen | menu item |
| :1062 | choice | Have you been inside the ruin? | keep | natural |
| :1063 | choice, Sehari | Is the ground loud here? | keep | good: uses her word |
| :1064 | choice | I will leave you to it. | keep | natural exit |
| :1069 | hunt | Nothing. The ded-waka woke. Every animal for a day around went still. I am waiting for them to come back. | keep | good (static once the ded-waka sleeps or dies) |
| :1074 | ruin | No. There is a clean machine in there. Teal. It walks the same four steps, over and over. It does not get tired. I do. | sharpen | good voice; the guardian is now the drone, so the details change |
| :1075 | journal | A Sehari hunter says a teal machine walks the halls of the ruin, the same steps over and over. | sharpen | task log |
| :1080 | loud | Under the lone tree, south of here, something cool and bright. Under the ruin, much more. Old kin. It does not like being walked on. | sharpen | "Old kin" is never glossed for the player |
| :1083 | bye | Walk soft. | keep | good |

### Barks

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :1090 | digger | Dig, sift, dig. The sand gives back one bolt a day. On a good day. | keep | good |
| :1091 | digger | Brenn says the ded-waka looked right at him. Brenn says a lot of things. | keep | good: character and a callback |
| :1092 | digger | Mind the pit. It is deeper than it looks. | sharpen | generic |
| :1094 | digger, after | The stone man is gone? He was always here. Always. | keep | good |
| :1095 | cook, after | Nobody took stew to the apprentice today. Nobody saw him go. | keep | good |
| :1096 | lookout, after | I watched the east all day. Whatever took him came from the north. | sharpen | spoken by Hadda (npc-lookout is Hadda), but reads as a separate lookout |

## src/story/types.ts (speaker names)

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :64 | speaker | The apprentice | keep | fine |
| :65 | speaker | Hadda, crew boss | keep | fine |
| :66 | speaker | Pell | keep | fine |
| :67 | speaker | Osk | keep | fine (unused) |
| :68 | speaker | Mother Tarn | keep | fine |
| :69 | speaker | The record | sharpen | cold; the voice is the master's, and naming her would land harder |
| :70 | speaker | Sehari hunter | keep | fine |
| :71-72 | speaker | You / Painted sign | keep | unused |

## src/level/level1.ts (hover names)

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :15-16 | hover | The Keeper's apprentice / The apprentice's tent | keep | fine |
| :17-19 | hover | Salvager / Cook / Lookout | keep | overridden by `displayName` (game.ts:1777) |
| :20 | hover | Digger | sharpen | the only nameless camp voice |
| :21-28 | hover | Spring / Lamp / Salvage crate / Supply crate / Signboard / Barrel-gourd | keep | fine |
| :31 | hover | Tel'sharin | sharpen | everyone in the world calls it the ded-waka; the hover never links the two |
| :32-35 | hover | Scrap metal | sharpen | dialogue calls it "plating" everywhere |
| :36-38, 41-58 | hover | Feral dog / Salvage crew's crate / Sehari hunter / Buried crystal / Pale crystal / Crimson crystal / Old miner locker / Crystal socket / Carved rings / Inner door / Amber crystal / Symbol door / Keeper archive | keep | fine |
| :50 | hover | Aza'los guardian | rewrite | replaced in phase 2 |

## src/game/game.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :152 | menu | No save found. | keep | functional |
| :156 | menu | Loading... | keep | functional |
| :164 | menu | Saves go to the saves folder inside the game folder while the dev server runs. | keep | functional |
| :177 | toast | Graphics: ${q}. | sharpen | prints a lower-case code value ("Graphics: high.") |
| :210 | intro card | The star never climbs higher than this. It hangs low and red over the Ash Reach, and every shadow is long. | keep | good opening |
| :211 | intro card | You came to this salvage camp because an Iskari asked for you by name. | keep | good hook |
| :212 | intro card | He is waiting by his tent. He has been waiting a long time. It is what Iskari do. | keep | good: pays off at the coda |
| :214 | card title | The Keeper's errand | keep | fine |
| :217 | toast | Left click to walk and talk. Press H for help. | keep | tutorial, fine |
| :218 | journal | An Iskari in the salvage camp asked for you. Find him by his tent. | sharpen | task list |
| :312 | inventory | CRYSTAL_DESC + " Integrity ${n} of 3." | sharpen | "Integrity" is system-speak |
| :320-322 | char sheet | Guard: ${g} of ${max} / Move in combat: ${n} tiles / Rolls made: ${n} | keep | functional |
| :335 | ability block | Ready in ${n} turn(s). | sharpen | "turn(s)" is code-speak (hud.ts gets it right) |
| :336 | ability block | You have no whole ${colour} crystal. | keep | clear |
| :337 | ability block | You have no focus. | keep | clear |
| :395-396 | float/toast | ${Sev} wound / ${reason} ${Sev} wound. | keep | functional |
| :413 | collapse card | The world tips sideways. The sand comes up to meet you. | keep | good |
| :414 | collapse card | Voices. Hands under your arms. The smell of Mother Tarn's stew. | keep | good |
| :415 | collapse card | You wake in the camp with your head bandaged. | sharpen | not race-aware: a stone Iskari head with a bandage; canon Iskari "shut down" |
| :417 | card title | You fall | keep | fine |
| :445 | collapse loss | Your water gourd is gone. Someone drank it while you slept. | keep | good |
| :449 | collapse loss | They used your dust-aloe on you. It is gone. | keep | fine |
| :453 | collapse loss | Your ${colour} crystal is missing. Nobody saw who took it. | keep | good: suspicion |
| :455 | collapse loss | Your pack is lighter. You cannot remember what was in it. That frightens you more than the wound. | keep | good: on theme |
| :473 | toast | Narration on. / Narration off. | keep | functional |
| :494 | toast | Sneaking. You move slowly and roll Stealth when seen. | keep | tutorial |
| :494 | toast | Walking normally. Enemies who see you will attack. | keep | tutorial |
| :506 | hover status | Dead / Asleep / Watching / Harm ${h} of ${max} | sharpen | "Harm 2 of 6" is system-speak, and unclear whether that is harm taken or harm left |
| :510 | hover sub | Click to interact | sharpen | generic; could name the verb (Talk, Search, Drink) |
| :526 | right click enemy | ENEMIES blurb | keep | see rules/combat.ts |
| :529 | right click other | displayName only | rewrite | help promises "Look closer"; the player gets only the name |
| :831 | toast | The niche is empty now. | keep | fine |
| :846 | toast | The apprentice's tent. Wax tablets in neat rows. You do not go in uninvited. | keep | good: sets up the torn tent |
| :854 | inner door, Iskari | The inner door has no marks at all. You feel it waiting for the three sockets in the hall below. | keep | good |
| :855 | inner door | The inner door is smooth. No marks, no seam. Teal threads run from it down towards the hall with the three sockets. | keep | good: a fair clue |
| :867 | spring | Cold water, straight from the deep rock. Guard restored, and your light wound eases. | keep | good |
| :868 | spring | Cold water, straight from the deep rock. Guard restored. | keep | fine |
| :874 | gourd | You have already cut this gourd. It is sealing itself with sap. | keep | good: world detail |
| :878 | gourd | You cut the barrel-gourd and fill your flask. Received: water. | keep | fine |
| :881-887 | lamps | (no text) | sharpen | clicking a lamp toggles it in silence |
| :890 | sign | Painted letters on a plank: *DED-WAKA. NO GO EST.* Someone has drawn a skull under it. The skull has four eyes. | keep | good: the best look text in the game |
| :904 | toast | Received: ${col} crystal. ${CRYSTAL_DESC[col]} | sharpen | carries the weak crystal text |
| :909 | toast | The sand here is cooler than it should be. | keep | good hint |
| :919 | guardian, friendly | The guardian turns its smooth head towards you and holds still. It is waiting for an order you do not know how to give. | rewrite | replaced in phase 2 (the idea is worth keeping for the drone) |
| :920 | guardian, asleep | The guardian stands dark. The teal has gone out of it. | rewrite | replaced in phase 2 |
| :925 | dog, friendly | The dog watches you, then goes back to gnawing a strip of old leather. | keep | good |
| :950, :962 | chest | Empty. / Received: ${names} | keep | functional |
| :963 | chest-4 | A dented locker of dark metal, square-cornered. Miner work. Inside, wrapped in rotten cloth, a stamped tag in a script nobody reads any more. | keep | good |
| :980 | heap choice | Haul it into the gully, quietly. | keep | good |
| :981 | heap choice | Break off a piece of scrap. | keep | fine |
| :981 | heap tag | [Mi'naa: you could fuse this] | keep | good race nudge |
| :982 | heap choice | Leave it. | keep | fine |
| :988 | heap look, fed on | Torn plating, bone-grey and green, heaped like a meal. Fresh scrape marks show where the feeding tube has been. | keep | good |
| :989 | heap look | Torn plating, bone-grey and green. Nothing feeds on it now. | keep | fine |
| :996 | toast | You already took what comes loose from this heap. | keep | fine |
| :1000 | toast | Received: Tel'sharin scrap | keep | functional |
| :1008 | check label | Haul the plating away | sharpen | stake unstated (the noise can wake it) |
| :1011 | haul miss | It is heavier than it looks. The heap crashes back down. | keep | a miss with a consequence (noise) |
| :1020 | toast | You drag the plating into the gully. ${n} heap(s) left. / You drag the last heap into the gully. | keep | functional progress |
| :1021 | journal | You hauled a heap of plating into the gully. ${n} left. | sharpen | four near-identical counter lines stack up in the journal |
| :1024 | haul partial | The plating shrieks on the rocks. | keep | good |
| :1075 | sleep card | The feeding tube slides back into its chest. It searches the empty sand around it. Once. Twice. | keep | good |
| :1076 | sleep card | The amber in its seams dims to the colour of embers. Its legs fold under it. | sharpen | amber, where PHASE-2 now says red |
| :1077 | sleep card | It will sleep now. The records say it can sleep for centuries. | keep | good callback |
| :1079 | card title | The ded-waka sleeps | keep | fine |
| :1082 | journal | You starved the ded-waka. It sleeps. | keep | fine |
| :1083 | objective | Go north through the gap to the ruin. | keep | fine |
| :1114 | tube, dead | The body lies still. The feeding tube hangs half out of its chest, soft at one end, hard at the other. | keep | good |
| :1115 | tube, asleep | It sleeps. The feeding tube hangs half out of its chest. Your hands already know how a thing like that could be fused. | keep | good: Mi'naa instinct |
| :1117 | choice | Cut the tube free and fuse it to your kit. | keep | good |
| :1117 | tag | [Mind + Tel'sharin tech] | sharpen | a static tag with no modifier or odds, unlike every other check |
| :1118 | choice | Leave it. | keep | fine |
| :1126 | check label | Take the feeding tube | sharpen | stake unstated |
| :1127 | tube miss | The tube crumbles in your hands like wet bark. | keep | good |
| :1129 | toast | Received: salvage-feeder. +1 to Shock cell. | keep | functional |
| :1130 | wound reason | The cut edge bites. | keep | good |
| :1136 | tel look, dead | The amber light is gone from its seams. Up close, the bone is real bone. | sharpen | amber; the same idea is repeated word for word in the ending |
| :1138 | tel look, Iskari | It sleeps. Standing this close, something old in your chest goes tight. You step back before you decide to. | keep | good |
| :1139 | tel look | It sleeps. Amber light moves in its seams, very slowly, like breathing. | sharpen | amber, where PHASE-2 now says red |
| :1147 | toast | The sockets are quiet now. The way is open. | keep | fine |
| :1154 | toast | The middle socket flares. A hum runs through the floor. | keep | good warning |
| :1182 | toast | Teal light runs up the walls to the inner door. It opens. The guardian goes dark. | sharpen | the guardian is gone in phase 2 |
| :1183 | journal | The outer sockets lit, the middle dark. The inner door opened. | keep | note |
| :1184 | objective | Enter the archive behind the inner door. | keep | fine |
| :1205 | toast | Press C to sneak. Sight cones show where it can see. | keep | tutorial |
| :1229 | journal | You found the ruin. Pale stone, curved halls, teal light. | keep | good note |
| :1230 | objective | Get through the symbol door. | keep | fine |
| :1252 | objective | Find the apprentice. His crate is empty. | keep | good: the objective carries the beat |
| :1348 | check label | Stay hidden from the ${def.name} | sharpen | a mid-sentence capital ("the Feral dog"); stake unstated |
| :1361 | toast | It heard something. Get out of its sight. | sharpen | a sight check reported as sound; "It" is generic for dog or scavenger |
| :1495 | toast | The fight is over. Your guard comes back as your breathing slows. | keep | good |
| :1498 | toast | You got away. It has lost you, for now. | keep | fine |
| :1507 | journal | You fought the ded-waka and it fell. The amber light went out of it. | sharpen | amber, where PHASE-2 now says red |
| :1513 | journal | You broke the guardian. The halls are silent. | rewrite | replaced in phase 2 |
| :1518 | journal | Pell and a band-shen came for the plating. You drove them off. It stays with the camp. | keep | fine |
| :1532 | toast | ${name} needs a target. Use it in a fight. | keep | functional |
| :1536 | toast | ${name} is for fights. | keep | functional |
| :1538 | toast | You have no wounds to heal. | keep | functional |
| :1582 | toast | ${Sev} wound healed. | keep | functional |
| :1587, :1609 | float | +${n} guard / +${n} next roll | keep | functional |
| :1595 | toast | You are hidden for a few breaths. | keep | good |
| :1602 | wound reason | Backlash. | sharpen | jargon; does not say what burnt you |
| :1649 | toast, Mi'naa | You crack the crimson crystal into your kit's cell. ${Sev} wound healed. The crystal is spent. | keep | good race flavour |
| :1650 | toast, Iskari | You hold the crimson crystal to your focus until it burns out. ${Sev} wound healed. | keep | good |
| :1659 | toast | You burn the amber crystal to recharge your tools. All abilities are ready. | keep | fine |
| :1673 | toast | The sap stings, then cools. ${Sev} wound healed. | keep | good |
| :1680 | toast | Warm, green-tasting water. Guard restored. | keep | good |
| :1685 | toast | It fizzes on your tongue. +2 to your next Resonance roll. | keep | good |
| :1720 | toast | Saved to the saves folder. / Saved in this browser (no dev server found). | keep | functional |
| :1760 | crystal desc | Amber is force. Most common, most used. | sharpen | fragment; abstract |
| :1761 | crystal desc | Crimson is the body: healing and endurance. | sharpen | abstract |
| :1762 | crystal desc | Pale is light and revelation. It shows what is really there. | rewrite | sounds deep, says nothing; "revelation" is above B1 |
| :1763 | crystal desc | Violet is projection. Force at a distance. | sharpen | abstract ("projection"); no violet crystal is in the level |
| :1777-1779 | names | Hadda, crew boss / Mother Tarn / Pell | keep | fine |

## src/game/ending.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :12 | ended, starved | You starved the ded-waka. It sleeps by the wreck, amber dimmed to embers. It may wake again in a hundred years. | sharpen | amber, where PHASE-2 now says red |
| :13 | ended, killed | You fought the ded-waka and it fell. Up close, its bones were real bones. | sharpen | repeats the look text word for word; says nothing about what it means |
| :14 | ended, climbed | You climbed the crack and left the ded-waka feeding. It is still there, between the camp and the ridge. | keep | good: a lingering threat |
| :15 | ended, snuck | You slipped past the ded-waka while it fed. It never knew you were there. Probably. | keep | good: the "Probably" lands |
| :18 | Pell | Pell took the plating west, to a band four days out. Hadda will never know where it went. | keep | good |
| :19 | Pell | The plating stayed in the gully for Hadda's crew. Pell walked west with empty hands. | keep | good |
| :20 | Pell, won | Pell came for the plating with a band-shen, and you drove them off. | keep | fine |
| :20 | Pell, fight lost | Pell and a band-shen fought you for the plating. | sharpen | the outcome is missing |
| :21 | reported | You told Hadda about the band marks. Pell was gone from the camp that night. | keep | good |
| :22 | trust | You saw Pell's band marks and said nothing. Covered is covered. | keep | good callback |
| :24 | dogs | The two feral dogs now follow the cook around the camp. | keep | lovely |
| :25 | guardian friendly | The Aza'los guardian stepped aside for you. It knew what you were. You still do not know how. | rewrite | replaced in phase 2 |
| :26 | guardian dead | You broke the Aza'los guardian. The ruin is quieter now, and a little more dead. | rewrite | replaced in phase 2 |
| :27 | rings | You woke the outer rings and let the middle ring sleep. The guardian went dark on its own. | rewrite | the guardian half is replaced in phase 2 |
| :29 | plate | You carried the Keeper's archive plate out of the ruin. It holds the last words of the apprentice's master: a stair under the broken city, between the Reach and the Spines. | sharpen | the second sentence is 21 words, over the 20-word cap |
| :36 | title | The Keeper's errand | keep | fine |
| :39 | coda, Iskari | The lamp in his tent is still burning. You sit on his crate, the way he did, and wait. Nobody comes. Stone is patient. You wonder how patient. | sharpen | strong until the last two sentences, which turn abstract |
| :40 | coda | The lamp in his tent is still burning. You sit on his crate and hold the plate on your knees. Somewhere north, a stair goes down. | keep | good: ends on the reveal |
| :42-46 | stats | Character / Time / Dice rolled / Times you fell / Wounds at the end | keep | functional; "Times you fell" is warm |

## src/game/combat.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :74 | banner | Ambush / Combat + enemy names | sharpen | "Combat" is dry; no line from the enemy or the scene |
| :122 | banner | The fight is over | keep | fine |
| :136 | banner | You got away | keep | fine |
| :159 | banner | Your turn / Round ${n} | keep | functional |
| :192 | toast | You have used both actions. Move, or end your turn. | keep | functional |
| :209 | log | You use ${ab.name}. | sharpen | mechanical |
| :225 | toast | No movement left this turn. | keep | functional |
| :244 | toast | You have used both actions this turn. | keep | functional |
| :252 | toast | Too far. Move next to it first. / Out of range. Range ${n}. | keep | functional |
| :253, :263 | toast | You cannot see it from here. | keep | functional |
| :261 | toast | ${ab.name} only works on machines. | keep | functional |
| :272 | log | ${ab.name}: ${band ?? 'done'}. | rewrite | prints raw code words ("Shock cell: partial.") |
| :278 | toast | Using an item takes an action. You have none left. | keep | functional |
| :284 | log | You use ${name}. | sharpen | reads "You use amber crystal." with no article |
| :328 | check label | Strike the ${name} / Shoot the ${name} | sharpen | a mid-sentence capital ("the Feral dog"); stake unstated |
| :341 | float | Miss | keep | functional |
| :342 | log | You miss the ${name}. | sharpen | the miss is just a failure, and it hides that the enemy hits back |
| :348 | log | You hit the ${name}, and it hits back. | keep | clear |
| :360 | log | The ${def.name} is too far away to answer. | keep | fine |
| :395, :401, :405, :462 | float | Stunned ${n} / +${n} move / +${n} defence / Pushed | keep | functional |
| :413 | float | Hidden | keep | functional |
| :414 | log | You go still. They lose track of you. | sharpen | Iskari wording, also used for Slip away |
| :422 | float | -${n} | keep | functional |
| :425 | log | ${def.name} takes ${n} harm (${h} of ${max}). | rewrite | spreadsheet line; no body, no reaction |
| :442 | log | The ${def.name} falls. | sharpen | the same line for a dog and the ded-waka; no weight |
| :475 | banner | The ${name} moves / They move | keep | functional |
| :489 | log | The ${def.name} is still reeling from your exchange. | keep | fine |
| :495-496 | float/log | Stunned / The ${def.name} is stunned and loses its turn. | keep | functional |
| :508 | log | The ${def.name} finds you. | keep | fine |
| :531 | float | Feeds +1 | keep | functional |
| :532 | log | The ${def.name} feeds on the plating and mends (${h} of ${max}). | sharpen | a good event told with a system tail |
| :561 | log | The ${def.name} closes in. | keep | fine |
| :587, :589 | float/log | Avoided / You avoid the ${def.name}. | keep | fine |
| :604-605 | float/log | -1 guard / Your guard takes the ${def.name}'s blow. | keep | fine |
| :610-612 | float/log/toast | ${Sev} wound / The ${def.name} gives you a ${sev} wound. / ${Sev} wound. One more and you go down. | keep | clear; the severe warning is right |
| :614 | log | You go down. | keep | fine |
| :650 | toast | Nothing in reach. Move next to an enemy first. / Nothing in range ${n}. | keep | functional |
| :678 | item desc | Burn it out to heal your worst wound. / Burn it out to make every ability ready. | keep | clear |
| :685 | button | Strike/Shoot (${Stat} + ${Spec} ${mod}) | keep | functional |

## src/game/state.ts (ITEMS and start)

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :27 | item | Dust-aloe leaf | keep | fine |
| :28 | item desc | Thick leaf, bitter sap. Rub it into a wound. Heals your last wound. | sharpen | "last" is wrong: `healOne` heals the worst |
| :33-34 | item | Barrel-gourd water / Cut from a swollen gourd. Drink it to steady yourself. Restores all guard. | keep | good |
| :39-40 | item | Charge-fruit / It tingles on the tongue. +2 to your next Resonance roll. | keep | good |
| :45-46 | item | Tel'sharin scrap / Dark green metal with bone grown through it. Still warm. A Mi'naa could fuse this. | keep | good: "Still warm." |
| :51-52 | item | Salvage-feeder / A Tel'sharin feeding tube, fused into a Mi'naa tool. +1 to Shock cell rolls. | keep | fine |
| :57-58 | item | Worn Keeper focus / A small curved Aza'los device, teal at the core. It wakes for Iskari hands. | keep | good |
| :63-64 | item | The apprentice's rubbing / Charcoal on cloth. A Keeper mark: three nested rings, one broken. | keep | fine |
| :70-71 | item | Keeper archive plate / A thin plate of pale stone, cold to the touch. Azure threads move under the surface. | keep | good |
| :77-78 | item | Miner's tag / Stamped dark metal on a rotten cord. The words are in the lost miner script. Only a number is clear: 7. | keep | good hook (no Mi'naa variant) |
| :83-84 | item | Half-burnt note / Found in the empty tent. Most of the words are gone. | sharpen | could quote the surviving words |
| :138 | objective | Find the Keeper's apprentice in the camp. | keep | fine |

## src/rules/abilities.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :43-44 | Sehari | Channel amber / Push raw force through an amber crystal held in your palm. Range 5. | keep | good |
| :58-59 | Sehari | Channel crimson / Draw the body back together through a crimson crystal. Heals your worst wound. | keep | good |
| :73-74 | Sehari | Run on all fours / Drop to four limbs and cover ground fast. Three extra tiles of movement. | keep | good |
| :89-90 | Iskari | Go still / Stand as still as a statue. Gain guard. Enemies at a distance lose track of you. | sharpen | "statue" is flat for a stone people; the hide only works on a full roll |
| :103-104 | Iskari | Wake the focus / Wake an old Aza'los focus. A teal lance strikes one target. Range 6. | keep | good |
| :119-120 | Mi'naa | Shock cell / A fused amber cell on a wire. It jolts one target and locks it up. Range 4. | keep | good |
| :133-134 | Mi'naa | Patch plating / Strap salvaged plating over the weak spots. Gain guard. | keep | good |
| :149-150 | role | Hold the line / Plant your feet. +1 guard and +1 to your next defence. | keep | fine |
| :163-164 | role | Aimed shot / Take your time. +1 to hit, and a clean hit does 3 harm. Range 7. | keep | fine |
| :177-178 | role | Steady breath / Settle yourself. +2 to your next roll of any kind. | keep | fine |
| :191-192 | role | Slip away / Break contact. On a clean roll, enemies at a distance lose you. | keep | fine |
| :205-206 | role | Mend / Clean and bind a wound with dust-aloe sap. | sharpen | implies it uses up aloe (it does not); does not say which wound it heals |
| :219-220 | role | Overload / Reach into a machine and jam it. Machines only. Adjacent. | keep | fine, terse |

## src/rules/combat.ts (enemies)

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :29 | name | Tel'sharin | sharpen | combat and hover say Tel'sharin, and every voice says ded-waka; the two are never linked |
| :38 | blurb | Bone fused with dark green metal. Amber light leaks from its seams. It is starving. | sharpen | amber, where PHASE-2 now says red |
| :42 | name | Aza'los guardian | rewrite | replaced in phase 2 |
| :51 | blurb | A smooth teal machine. Every movement is exact. It guards what is left. | rewrite | replaced in phase 2 |
| :55, :64 | dog | Feral dog / Lean, sun-dark, ribs showing. The miners brought its line here long ago. | keep | good lore in one line |
| :68, :77 | scavenger | Scavenger / A Mi'naa in patched wraps. Marks hidden under the sleeves. | keep | fine |
| :85-86 | check label | Strike / Shoot / Aim | keep | functional |
| :111 | bonus label | Threat, exposed / Threat | keep | functional |
| :112 | check label | Defend against the ${name} | sharpen | a mid-sentence capital ("the Feral dog") |

## src/rules/character.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :10-15 | stat labels | Body / Edge / Mind / Will / Presence / Resonance | keep | canon |
| :19-24 | stat hints | Strength, melee, taking hits. / Speed, aim, stealth, reflexes. / Knowledge, lore, technical work. / Focus, nerve, resisting effects. / Persuasion, reading people. / Crystals, channelling, old tech. | keep | functional |
| :31-33, :40-45 | labels | Mi'naa / Sehari / Iskari / Frontline / Ranged / Channeller / Scout / Healer / Tech | keep | canon |
| :79-104 | spec labels | Archaeology ... Medicine | keep | canon |
| :123 | race blurb | Descendants of the miners. They forget fast, so they keep memory in objects and implants. They fuse salvage into working tools. | keep | good |
| :125 | race blurb | Native to this planet. They feel the energy under the sand and channel it through crystals held close. They never set a crystal into the body. | keep | good |
| :127 | race blurb | Stone-skinned and built by the Aza'los. They do not age. They feel meaning in Aza'los symbols and can wake the old devices. | keep | good |
| :131 | role blurb | Close combat. You hold the space and take the hits. | keep | fine |
| :132 | role blurb | You hurt things from a distance. | sharpen | dry |
| :133 | role blurb | You push the planet's energy through crystals or old devices. | keep | fine |
| :134 | role blurb | Stealth, speed and sharp eyes. | sharpen | a fragment; dry |
| :135 | role blurb | You mend wounds and keep yourself standing. | keep | fine |
| :136 | role blurb | You repair, fuse and bypass machines. | keep | fine |
| :158-162 | validation | ${Stat} must be between -1 and +3. / You have spent ${n} of 7 points. / You still have ${n} points to spend. | keep | functional |

## src/rules/wounds.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :80 | wound tip | Light wound. It stings. | keep | fine |
| :81 | wound tip | Moderate wound. It slows you, and it counts towards a fall. | rewrite | does not make sense: wounds give no penalty and nothing slows you |
| :82 | wound tip | Severe wound. One more and you go down. | keep | clear |

## src/ui/creation.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :34-35 | default name | Tasko / Ruun | keep | fine |
| :36 | default name | Vessel of the Ninth Stair | sharpen | not in LORE-INVENTIONS.md; "Stair" echoes the reveal |
| :38 | steps | Origin / Role / Stats / Skills / Name | keep | functional |
| :43-68 | spec hints | (26 one-liners, e.g. "Read old sites and what was left in them.") | keep | plain and useful |
| :67 | spec hint | Sing through bone. Sehari only. | sharpen | says nothing to a new player |
| :112-116 | validation | Choose where you come from. / Choose what you do. / Choose ${n} more. / Give a name. | keep | fine |
| :123 | button | Begin the errand / Next | keep | good |
| :148 | heading | Where do you come from | keep | fine |
| :161 | chip label | You know | keep | fine |
| :176 | heading | What do you do | keep | fine |
| :185 | ability chip | Ability ${name} | keep | fine |
| :204, :210 | heading | How you are made / point(s) left | keep | good |
| :212 | note | Spend 7 points. Each stat runs from -1 to +3. Dropping one to -1 gives you a point back. | keep | clear |
| :256, :268 | buttons | Use suggested for ${Role} / Use suggested / Clear | keep | functional |
| :286-296 | skills step | What you have learned / chosen / ${Race} upbringing / Pick two more. Each one is Trained, worth +1 on rolls that use it. | keep | clear |
| :351-352 | name step | What they call you / Default / Abilities | keep | good |

## src/ui/hud.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :14-19 | buttons | Journal / Pack / Character / Sneak / Help / Menu | keep | functional |
| :24 | crystal tip | Force. / Healing. / Reveals what is hidden. / Pushes. | sharpen | dry fragments |
| :27 | ability tip | Ready in ${n} turn/turns. | keep | fine |
| :83 | sneak tip | Move quietly. Enemies notice you later. | keep | fine |
| :101 | label | Objective | keep | fine |
| :108 | penalty tip | Wound penalty / Applied to every roll until the wound is treated. | rewrite | contradicts the no-penalty rule (`WOUND_PENALTIES = false`) |
| :111 | label | Sneaking | keep | fine |
| :156 | wound slot tip | ${Sev} wound / ${Sev} wound, open | sharpen | "open" is jargon for "empty" |
| :163-164 | guard tip | Guard ${g} of ${max} / Guard soaks a hit before a wound lands. It refills after a fight. | keep | clear |

## src/ui/panels.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| :11-15 | panel titles | Journal / Pack / Character / Paused / How to play | keep | fine |
| :20 | help | Left click: Move, talk, pick up, use | keep | fine |
| :21 | help | Right click: Look closer at something | rewrite | the promise is not kept: only enemies get text |
| :22 | help | C: Sneak on or off | keep | fine |
| :23 | help | 1 to 5: Choose an ability in combat | sharpen | abilities also work outside a fight (Mend, Go still) |
| :24-31 | help | Space: End your turn / Q / E: Turn the camera / Mouse wheel: Zoom / J / I / K / H / Esc | keep | fine (N for narration is missing from the list) |
| :117 | empty | Nothing written yet. | keep | fine |
| :125 | tag | Done | keep | fine |
| :133 | empty | Your pack is empty. | keep | fine |
| :144, :155 | tags | Errand / Use | keep | fine |
| :166 | empty | No character yet. | keep | fine |
| :187 | levels | Mastered +2 / Trained +1 | keep | fine |
| :201 | headings | Skills / Abilities | keep | fine |
| :211 | help note | Checks roll two dice plus a stat and a skill. 10 or more is a full success. 7 to 9 works, at a cost. 6 or less is a miss. | keep | clear |
| :218, :222 | menu | Working… / That did not work. | keep | fine |
| :231-248 | menu | Resume / Save / Load / How to play / Quit to title | keep | fine |
| :257-263 | menu | Narration / On / Off / Every line is read aloud (N). / Silent reading (N). | keep | fine |
| :275-281 | menu | Graphics / High / Medium / Low / For slow laptops: no bloom, no dust, lower resolution. / Softer shadows, fewer effects. / Everything on. | keep | fine |

## src/ui/index.ts, dialogue.ts, dice.ts, combat.ts

| location | context | current text | verdict | reason |
|---|---|---|---|---|
| index.ts:177 | title | A tale of the red sun | keep | good |
| index.ts:178 | title | The Stranded | keep | fine |
| index.ts:180 | title | The Keeper's Errand | sharpen | Title Case; "The Keeper's errand" everywhere else (sentence case rule) |
| index.ts:184-185 | title | Continue / New journey | keep | good |
| index.ts:188 | title | The light is always low here. | keep | good |
| index.ts:202 | narration | Click to continue | keep | fine |
| index.ts:236 | ending | Return to title | keep | fine |
| index.ts:244 | ending | The errand ends | keep | fine |
| dialogue.ts:147 | button | Continue | keep | fine |
| dialogue.ts:161-163 | odds | Miss ${p} / At a cost ${p} / Full ${p} | keep | clear |
| dice.ts:7-9 | bands | Full success / Success, at a cost / Miss | keep | clear |
| dice.ts:72 | kicker | The dice | keep | fine |
| dice.ts:141 | term | Dice, ${a} and ${b} | keep | fine |
| combat.ts:43-47 | tips | Movement / ${n} of ${m} tiles left this turn. / Action / You can still act this turn. / Action spent this turn. | keep | functional |
| combat.ts:54-55 | labels | Round ${n} / Your turn / Enemy turn | keep | fine |
| combat.ts:59 | tip | Wait for your turn. / No action left this turn. | keep | fine |
| combat.ts:69 | tip | Range ${n}. | keep | fine |
| combat.ts:85 | tip | None left. | keep | fine |
| combat.ts:109 | button | End turn | keep | fine |
| combat.ts:124 | tip | Stunned / Loses its next turn / ${n} turns. | keep | fine |
| main.ts:33 | error | Failed to start: ${message} | keep | functional |

---

## Voices as they stand

Overall: every voice uses the same short, flat, declarative cadence. The rhythm is identical, so you can tell people apart mostly by what they talk about, not how they talk. Trade-tongue flavour shows up only as "Gud dey", and Hadda and Pell use the exact same opener.

**The apprentice.** Formal, full sentences, humble ("I keep records. Or I try to."), quietly guilty ("I never finished my training", said twice). His want is clear: the plate and his lost master. He has no tic, and he never dodges, except in the insight check, which is narration, not him. DESIGN calls him careful, formal, kind and guilty. The first three come through. The guilt appears only as a fact, never as a slip. His hub lines are his weakest ("Ask what you need to ask.", "The light will not wait..."). **Tellable without a tag:** yes, mostly, from formality and stone talk. His master in the record sounds almost the same, which works (teacher and pupil) but is not a choice anyone made.

**Hadda.** Blunt, owner's pride ("it is ours. We paid for it."), short clauses, a Brenn callback. The best lines are "Band-shen. In my camp. Eating my food." and "We can work around quiet." Her want is the scrap. Her tic could be Brenn, but it only appears twice. She has no dodge. Her hub ("What do you need?") and her "Thank you" in report2 flatten her. Her after-bark "I watched the east all day..." reads as a different person. **Tellable:** in her set lines, yes. In her hub and exits, no.

**Pell.** Dry, transactional, short: "Metal is metal.", "Staring costs extra.", "Mind the ded-waka. It minds you." "Covered is covered" is a real tic, and it has a quest named after it. Pell's want is metal and being left alone. The dodge is a good one: "Hadda knows what Hadda wants to know." Pell is the strongest voice in the game. The weak spots are "Anything else?", "Good. Then we are fine, you and me." and the shared "Gud dey" opener. **Tellable:** yes, except against Hadda, because both are clipped Mi'naa. Pell's dryness against Hadda's heat is the only thing keeping them apart.

**Mother Tarn.** Two spoken lines and one after-bark. "Eat first. Heroes are for stories." is a strong start, and "Your stomach will ask later." is fine. Her want (feed people) is clear, but she has no second beat, no reaction to wounds, and nothing after a collapse, even though the collapse card names her stew. **Tellable:** she has too few lines to judge. What exists is distinct.

**The digger.** Barks only, with a nameless hover ("Digger"). Weary humour: "The sand gives back one bolt a day. On a good day." and "Brenn says a lot of things." "Mind the pit." is filler. **Tellable:** the first two barks, yes. The rhythm is close to Hadda's.

**The Sehari hunter.** Few words, patient, a bit of self-mockery ("It does not get tired. I do."), and a kin line to Sehari players ("Sael is loud today."). "Walk soft." is a good exit. She uses "Sael" and "kin" without ever glossing them. To non-Sehari players, her opening is pure narration and she never speaks first. Her want (to hunt again once the animals return) is there but never pays off. **Tellable:** yes, the most distinct after Pell.

**Osk, the child.** The lines are good ("Mama says that is normal."), but he is not in the level. Nobody hears him.

**The record (the master).** Warm, sensory, grave ("back of my teeth"). The best writing in the game. Tellable from the apprentice only by content.

**Narrator.** Mostly strong and concrete. It weakens in misses ("Rings. More rings."), in some closers ("It is only a plate."), and in toasts that fall back to system words.

---

## Missing reactivity

The dialogue context already carries `c.s` (full state) and `c.race`, so all of the hooks below can read wounds, flags and race without new plumbing.

**Race**
- **Hadda's greeting** (dialogues.ts:196) is the same for every race. She calls the apprentice "the stone man" even to an Iskari player's face, and never reacts to a Sehari in a salvage camp. The apprentice notes the crew will stare, and nobody does.
- **Pell's offer** (dialogues.ts:272, 278) never changes for a Mi'naa player, who might know the band codes. The gully line "It sleeps like a stone" (377) is a free Iskari jab that nobody makes.
- **Mother Tarn** (dialogues.ts:457) offers stew to an Iskari, who does not eat by canon. Nothing reacts.
- **Digger barks** (dialogues.ts:1089; `bark()` at game.ts:939 picks by id only) have no race key. Suggested hook: look up `BARKS[`${script}:${race}`]` first in `runScript`, game.ts:841-843.
- **The Mi'naa hello** (dialogues.ts:28) is the only generic one of the three.
- **The collapse card** (game.ts:413-415) bandages an Iskari head. Race-aware lines belong there.
- **The Miner's tag** (state.ts:78): the Mi'naa can read numbers in the miner script (record r3), but the tag text never changes for them. Hook: `openChest` chest-4, game.ts:963.
- **Phase 2 defender:** the "sees what you are and attacks anyway" line needs a hook where the defender wakes. That is new code. The nearest current hook is the guardian's `z-ruin-mouth` handling, game.ts:1232-1246.

**Wounds**
- **No NPC notices a wound.** Hooks:
  - the apprentice hub (dialogues.ts:34)
  - Hadda's hub (202)
  - Pell's hub (293)
  - Tarn's start (457), where she could insist you eat
  - the hunter's start (1058)
  - All can test `c.s.wounds.light/moderate/severe`.
- **After a collapse** (game.ts:400-439) you wake in camp and nobody speaks. The card mentions Tarn's stew. A Tarn bark after `this.ui.fade('clear', 900)` at game.ts:436 is the natural spot.
- **The player has no pain barks.** Hook: `wound()` at game.ts:386-398 (after `floatText` at 395) and `applyHarm` at combat.ts:606-612.

**What you did to the Tel'sharin**
- Hadda reacts (asleep and dead choices, 211-212). Nobody else does.
  - **Digger barks** (game.ts:843) switch only on `hasArchive`. They need `telAsleep`, `telDead` and `crackClimbed` variants.
  - **The hunter's "hunt" line** (dialogues.ts:1069) says the animals went still. It never changes after the ded-waka sleeps or dies.
  - **Pell's hub** (dialogues.ts:293) still offers the starve deal after you killed it (`telDead`). The offer text (278) does not notice.
  - **The apprentice hub** (dialogues.ts:34) never asks how you got past it, if you come back mid-errand.
  - **Hadda's "Watch the east."** (261) is the same after the threat is gone.
- **Sneaking past and climbing the crack** leave no trace in any dialogue. Only the ending notices (ending.ts:14-15).
- **The Iskari ded-waka tie** ("The ded-waka know us, somehow.", 125) never pays off after the Iskari-only look (game.ts:1138).

**Whether you helped Pell**
- `pellTrust`, `pellReported`, `pellThreatened` and `scrapTo` are read only by Pell and the ending.
  - **Hadda's hub** (dialogues.ts:202) never reacts to the plating going west (`scrapTo === 'pell'`), to it coming back (`'camp'`), or to a fight in the gully (`'contested'` / `bandBeaten`).
  - **Tarn and the digger** never mention Pell leaving after `pellReported`.
  - **`pellThreatened`** is written (dialogues.ts:364) and never read. Pell's threat to withdraw the offer is empty. Hook: the `gully` choices at dialogues.ts:379.
- **Pell in the fight** (game.ts:782-804) has no line once combat starts.

**Flags set but never read (each is a reaction nobody wrote)**
- `apprenticeAfraid` (dialogues.ts:164): the only clue before the reveal. It could colour the tent (820) or the ending coda (ending.ts:39-40).
- `sehFeltNorth` (dialogues.ts:509; and the kid is unreachable anyway).
- `guardianAlerted` (dialogues.ts:622, 655): "something turns its head" and then nothing happens. For phase 2 this could prime the drone or defender.
- `ateStew` (dialogues.ts:471): Tarn never remembers feeding you.
- `readRings` (dialogues.ts:716).
- `dogsCalmed` feeds only the ending. Tarn, whose scraps the dogs now follow, never mentions them.

**Combat barks (none exist)**
- **Fight start:** combat.ts:74, the `banner` call. An enemy or player line could fire here, such as Pell's "the old way" follow-up or the dogs.
- **Hit landed on an enemy:** `hurt()` combat.ts:418-431.
- **Enemy down:** `down()` combat.ts:434-446. The ded-waka falling should not read the same as a dog.
- **The Tel'sharin feeds mid-fight:** combat.ts:531-532, a strong moment told as "Feeds +1".
- **The player is hit or wounded:** `applyHarm` combat.ts:600-615.
- **A player miss:** combat.ts:340-345.
- **Escaped or won:** game.ts:1494-1499 (toasts only).

**Stealth barks (none exist)**
- **Full stealth success:** game.ts:1349-1352 floats "?" only.
- **Partial:** game.ts:1354-1362 gives one generic toast, "It heard something...".
- **Spotted:** game.ts:1339-1345 and 1364-1366 float "!" only.
- **Sneak toggle:** game.ts:491-497 gives a tutorial toast every time.
- **Noise near the heaps:** `noise()` game.ts:1046-1060 plays a growl and gives no text.
- **Ability hide:** game.ts:1595 ("You are hidden for a few breaths.") and combat.ts:414.

**Look-at text that does not exist**
- **Right click on any non-enemy** shows only the name (game.ts:529), though help promises "Look closer". This is the single cheapest place to add flavour. Suggested: a `LOOK` table keyed by entity id, used at game.ts:529.
- **Lamps** toggle in silence (game.ts:881-887).
- **Crates, the spring and gourds** have use text but no look text.
- **The apprentice after the reveal:** `runScript` returns with no text (game.ts:829).
- **Returning to camp** with the plate (game.ts:1249-1254) sets only an objective. No NPC calls out that the apprentice is gone until you click them.
