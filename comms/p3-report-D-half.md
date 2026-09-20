# Phase 3, agent D's half of the joint report (people)

Written for the user. C writes the world half, and we sign one report together.

## What I changed, and how it was judged

Every round: one change, shots from fixed cameras, then a blind critic that reads all 50 art
images and ranks the versions without knowing which is new. Commit on a win, revert on a loss.

| Round | Result | What it did |
|---|---|---|
| Creation screen | user request | Compact cards, no scrolling at 1600x900, the six bodies still beside the panel |
| Creation portraits | user request | Head-and-shoulders crops from the concept art on the race cards and body buttons |
| Tel'sharin rebuild | won | Faceted dome, visor slit of red lights, plated limbs over a dark core, bone ribs in the torn chest |
| Tel'sharin round 2 | won, slightly | Gaunt limbs, longer backward hock, three-lens shoulder pod |
| Tel'sharin worn facets | **lost** | Per-facet tint. The critic and a pixel diff saw no difference. Reverted |
| Tel'sharin bolder pass | won | Darker teal-grey plates with bone rims, flush visor, longer backward lower leg |
| Mi'naa gear | won, slightly | Full mech arms, goggles at his neck, torn hems, brown knee patches |
| Mi'naa cloth | won, slightly | Her poncho off one shoulder, his ochre cloth one draped band, lighter skin |
| Sehari body | won, slightly | Arms "slightly long", bolder roots, greyer skin, cloth wrap, wide knotted sash, and a bald patch fixed |
| Sehari hair and roots | ranked first, equal at game zoom | Separate locks with fibre bindings, roots on arm, neck and cheek, gaunter faces |
| Iskari body | won, slightly | Pale bone stone, finer cracks, long necks, open vest, her short wrap skirt with a teal hem |
| Iskari legs and skulls | **lost twice** | Digitigrade legs. They raise the hips, so the kilt hangs below the knee. Reverted |
| Iskari trim | won, slightly | Real teal, a satchel on the strap, marks along her hem |
| Iskari colour | won, slightly | True violet vest, cooler paler stone |
| NPCs | won, slightly | Pell reads at game zoom: pale hood and cape, rust scarf, dark coat |
| Dogs and defender | won, slightly | Sun-dark dogs that stand out from the sand, pale defender plates |

Eleven rounds won, three lost and reverted, two user requests delivered.

## Honest state of the people

- **Close up:** clearly better than the phase started. Faces, hands, gear and markings all read.
- **At game zoom:** better, but modestly. A person is about 100 px tall there. What carries is
  outline, big colour blocks and value, and most of my wins were small at that size.
- The two changes that moved the game camera most were both silhouette or value, not texture:
  the Tel'sharin's digitigrade legs and dark plates, and the dogs' darker fur.

## What stays open on my half

- Iskari legs. Twice tried, twice lost. Any new try must re-cut the kilt and skirt in the same round.
- Iskari stone still sits near the Mi'naa's tan at game zoom. The rust bloom pulls it warm.
- Tel'sharin: both arms are the same, and damage is texture, not shape.
- Sehari: tunic shape, sash tails, faces still soft, no joint glow.
- Mi'naa: her build is heavier than the art, and skin could go lighter again.
- Dogs: no ribs or tucked belly.

## Checks

- Walked playthrough on the committed build: camp to ending, 16 shots, no console errors.
- Every body checked standing, walking, running and seated after each change.
- Frame rate: still unmeasured. It needs five minutes with the user's game tab closed.
