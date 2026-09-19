import type { LevelData, LevelEntity } from '../core/contracts';
import type { Feature, LevelBundle } from './layout';

// Level 1: The Keeper's errand.
// South: the Mi'naa salvage camp. Middle: a rock ridge with two ways through,
// the easy gap past the Maker wreck (and the Tel'sharin), or a narrow crack in the west.
// North: open Ash Reach sand, a lone spire-root, the fallen spire, and the Aza'los ruin
// on the lip of the Scar, which runs along the whole northern edge.

const W = 64;
const H = 56;

const entities: LevelEntity[] = [
  // ---- camp
  { id: 'apprentice', kind: 'npc-apprentice', tile: { x: 11, y: 41 }, facing: 4, faction: 'neutral', name: "The Keeper's apprentice", script: 'apprentice', opts: { state: 'seated', body: 'male', look: 'apprentice' } },
  { id: 'tent-apprentice', kind: 'prop-tent', tile: { x: 9, y: 39 }, facing: 3, faction: 'neutral', name: "The apprentice's tent", script: 'tent-apprentice' },
  { id: 'scav1', kind: 'npc-scavenger', tile: { x: 22, y: 42 }, facing: 2, faction: 'neutral', name: 'Salvager', script: 'scav1', opts: { body: 'male', look: 'pell' } },
  { id: 'npc-cook', kind: 'npc-minaa', tile: { x: 14, y: 41 }, facing: 4, faction: 'neutral', name: 'Cook', script: 'npc-cook', opts: { seed: 3, body: 'female', look: 'tarn' } },
  { id: 'npc-lookout', kind: 'npc-minaa', tile: { x: 24, y: 38 }, facing: 1, faction: 'neutral', name: 'Lookout', script: 'npc-lookout', opts: { seed: 7, body: 'female', look: 'hadda' } },
  { id: 'npc-digger', kind: 'npc-minaa', tile: { x: 7, y: 44 }, facing: 2, faction: 'neutral', name: 'Digger', script: 'npc-digger', opts: { seed: 11, body: 'male', look: 'digger' } },
  { id: 'spring1', kind: 'prop-spring', tile: { x: 15, y: 46 }, faction: 'neutral', name: 'Spring', script: 'spring1' },
  { id: 'lamp-1', kind: 'prop-lamp', tile: { x: 12, y: 43 }, faction: 'neutral', name: 'Lamp', script: 'lamp-1' },
  { id: 'lamp-2', kind: 'prop-lamp', tile: { x: 19, y: 42 }, faction: 'neutral', name: 'Lamp', script: 'lamp-2' },
  { id: 'lamp-3', kind: 'prop-lamp', tile: { x: 9, y: 42 }, faction: 'neutral', name: 'Lamp', script: 'lamp-3' },
  { id: 'chest-1', kind: 'prop-chest', tile: { x: 21, y: 40 }, facing: 4, faction: 'neutral', name: 'Salvage crate', script: 'chest-1' },
  { id: 'chest-2', kind: 'prop-chest', tile: { x: 6, y: 42 }, facing: 2, faction: 'neutral', name: 'Supply crate', script: 'chest-2' },
  { id: 'sign-1', kind: 'prop-sign', tile: { x: 25, y: 44 }, faction: 'neutral', name: 'Signboard', script: 'sign-1' },
  { id: 'gourd1', kind: 'prop-barrel-gourd', tile: { x: 29, y: 46 }, faction: 'neutral', name: 'Barrel-gourd', script: 'gourd1' },

  // ---- the wreck and the gap
  { id: 'tel1', kind: 'telsharin', tile: { x: 41, y: 33 }, facing: 1, faction: 'hostile', name: "Tel'sharin", script: 'tel1', tags: ['starving'] },
  { id: 'metal1', kind: 'prop-metal-pile', tile: { x: 39, y: 34 }, faction: 'neutral', name: 'Scrap metal', script: 'metal1', tags: ['metal', 'feeds:tel1'] },
  { id: 'metal2', kind: 'prop-metal-pile', tile: { x: 42, y: 36 }, faction: 'neutral', name: 'Scrap metal', script: 'metal2', tags: ['metal', 'feeds:tel1'] },
  { id: 'metal3', kind: 'prop-metal-pile', tile: { x: 43, y: 31 }, faction: 'neutral', name: 'Scrap metal', script: 'metal3', tags: ['metal', 'feeds:tel1'] },
  { id: 'metal4', kind: 'prop-metal-pile', tile: { x: 39, y: 30 }, faction: 'neutral', name: 'Scrap metal', script: 'metal4', tags: ['metal', 'feeds:tel1'] },
  { id: 'dog1', kind: 'dog', tile: { x: 33, y: 38 }, facing: 5, faction: 'hostile', name: 'Feral dog', script: 'dog1' },
  { id: 'dog2', kind: 'dog', tile: { x: 35, y: 40 }, facing: 6, faction: 'hostile', name: 'Feral dog', script: 'dog2' },
  { id: 'chest-3', kind: 'prop-chest', tile: { x: 45, y: 38 }, facing: 0, faction: 'neutral', name: "Salvage crew's crate", script: 'chest-3' },

  // ---- the Ash Reach
  { id: 'npc-hunter', kind: 'npc-sehari', tile: { x: 11, y: 20 }, facing: 2, faction: 'neutral', name: 'Sehari hunter', script: 'npc-hunter', opts: { body: 'female', look: 'hunter' } },
  { id: 'crystal-buried', kind: 'prop-crystal', tile: { x: 16, y: 19 }, faction: 'neutral', name: 'Buried crystal', script: 'crystal-buried', tags: ['hidden'], opts: { colour: 'pale' } },
  { id: 'crystal-pale', kind: 'prop-crystal', tile: { x: 26, y: 15 }, faction: 'neutral', name: 'Pale crystal', script: 'crystal-pale', opts: { colour: 'pale' } },
  { id: 'crystal-crimson', kind: 'prop-crystal', tile: { x: 5, y: 26 }, faction: 'neutral', name: 'Crimson crystal', script: 'crystal-crimson', opts: { colour: 'crimson' } },
  { id: 'gourd2', kind: 'prop-barrel-gourd', tile: { x: 33, y: 25 }, faction: 'neutral', name: 'Barrel-gourd', script: 'gourd2' },
  { id: 'gourd3', kind: 'prop-barrel-gourd', tile: { x: 18, y: 25 }, faction: 'neutral', name: 'Barrel-gourd', script: 'gourd3' },
  { id: 'chest-4', kind: 'prop-chest', tile: { x: 10, y: 13 }, facing: 2, faction: 'neutral', name: 'Old miner locker', script: 'chest-4' },

  // ---- the ruin
  // the repair drone tends three half-mended cracks on the court wall (A-005); when it dies, its code runs to the niche
  { id: 'drone1', kind: 'drone', tile: { x: 42, y: 17 }, facing: 4, faction: 'hostile', name: "Aza'los repair drone", script: 'drone1', opts: { patrol: [{ x: 35, y: 10 }, { x: 34, y: 18 }, { x: 38, y: 22 }, { x: 42, y: 17 }] } },
  { id: 'niche1', kind: 'prop-niche', tile: { x: 51, y: 14 }, facing: 6, faction: 'neutral', name: 'Wall niche', script: 'niche1' },
  { id: 'defender1', kind: 'defender', tile: { x: 51, y: 14 }, facing: 6, faction: 'neutral', name: 'Stone figure', script: 'defender1', opts: { state: 'dormant' } },
  { id: 'lever-a', kind: 'prop-lever', tile: { x: 36, y: 15 }, faction: 'neutral', name: 'Crystal socket', script: 'lever-a' },
  { id: 'lever-b', kind: 'prop-lever', tile: { x: 48, y: 15 }, faction: 'neutral', name: 'Crystal socket', script: 'lever-b' },
  { id: 'lever-c', kind: 'prop-lever', tile: { x: 42, y: 21 }, faction: 'neutral', name: 'Crystal socket', script: 'lever-c' },
  { id: 'sign-rings', kind: 'prop-sign', tile: { x: 38, y: 19 }, facing: 1, faction: 'neutral', name: 'Carved rings', script: 'sign-rings', opts: { look: 'stele' } },
  { id: 'inner-door', kind: 'prop-symbol-door', tile: { x: 42, y: 10 }, facing: 4, faction: 'neutral', name: 'Inner door', script: 'inner-door' },
  { id: 'crystal-amber', kind: 'prop-crystal', tile: { x: 49, y: 18 }, faction: 'neutral', name: 'Amber crystal', script: 'crystal-amber', opts: { colour: 'amber' } },
  { id: 'symbol-door', kind: 'prop-symbol-door', tile: { x: 42, y: 13 }, facing: 4, faction: 'neutral', name: 'Symbol door', script: 'symbol-door' },
  { id: 'archive', kind: 'prop-archive', tile: { x: 42, y: 7 }, facing: 4, faction: 'neutral', name: 'Keeper archive', script: 'archive' },
];

const zones = [
  { id: 'z-camp', rect: { x: 3, y: 36, w: 23, h: 17 }, script: 'z-camp', label: 'The salvage camp' },
  { id: 'z-wreck-edge', rect: { x: 35, y: 29, w: 9, h: 9 }, script: 'z-wreck-edge', label: 'The Maker wreck' },
  { id: 'z-crack', rect: { x: 7, y: 29, w: 3, h: 3 }, script: 'z-crack', label: 'The crack in the ridge' },
  { id: 'z-spire-root', rect: { x: 13, y: 16, w: 5, h: 5 }, script: 'z-spire-root', label: 'A lone spire-root' },
  { id: 'z-scar-view', rect: { x: 18, y: 4, w: 10, h: 3 }, script: 'z-scar-view', label: 'The edge of the Scar' },
  { id: 'z-ruin-mouth', rect: { x: 38, y: 23, w: 9, h: 3 }, script: 'z-ruin-mouth', label: "The ruin's mouth" },
  { id: 'z-ruin-inner', rect: { x: 39, y: 6, w: 7, h: 7 }, script: 'z-ruin-inner', label: 'The inner hall' },
  { id: 'z-archive', rect: { x: 40, y: 6, w: 5, h: 3 }, script: 'z-archive', label: 'The archive' },
];

export const level1Data: LevelData = {
  id: 'keepers-errand',
  name: "The Keeper's errand",
  width: W,
  height: H,
  playerSpawn: { x: 12, y: 47 },
  playerFacing: 0,
  entities,
  zones,
};

const features: Feature[] = [
  // ---- ground paint
  { t: 'ground', kind: 'packed', rect: [4, 37, 21, 15] },
  { t: 'ground', kind: 'oasis', circle: [15.5, 46.5, 3.2] },
  { t: 'ground', kind: 'path', width: 2, line: [[12.5, 47], [13, 43.5], [16.5, 42.5], [24.5, 43.5], [30.5, 40.5], [36.5, 37.5], [40.5, 33.5], [40.5, 27.5], [42.5, 24.5]] },
  { t: 'ground', kind: 'path', width: 1.4, line: [[8.5, 36], [8.5, 27], [12, 22], [16, 19]] },
  { t: 'ground', kind: 'plaza', circle: [42.5, 14.5, 10.2] },
  { t: 'ground', kind: 'rock', rect: [36, 29, 18, 10] },

  // ---- borders (the world ends in rock and dune)
  { t: 'ridge', pts: [[0.5, 4], [1, 20], [0.5, 38], [1, 55]], width: 3.2, height: 3.5 },
  { t: 'ridge', pts: [[63, 4], [62.5, 22], [63, 40], [62.5, 55]], width: 3.2, height: 3.5 },
  { t: 'ridge', pts: [[0, 54.8], [20, 54.4], [40, 55], [64, 54.6]], width: 3.2, height: 3 },

  // ---- the Scar
  { t: 'chasm', rect: [0, 0, W, 4] },
  { t: 'scatter', rect: [2, 6.5, 60, 3], kind: 'twist-weed', count: 22 },

  // ---- the ridge that splits south from north, with the crack (x=8) and the gap (x 38..43)
  { t: 'ridge', pts: [[1, 31], [4, 30.5], [6.2, 31]], width: 3, height: 2.8 },
  { t: 'ridge', pts: [[10.3, 30.5], [16, 31.5], [22, 30.2], [28, 31.2], [33, 30.4], [36.6, 31.3]], width: 3, height: 3.2 },
  { t: 'ridge', pts: [[55, 31.5], [59, 30.5], [62, 31.2]], width: 3, height: 3 },

  // ---- the Maker wreck, east of the gap
  // the wreck lies north-south, its torn side facing west into the gap
  { t: 'wreck', at: [49.2, 34], len: 19, rot: 95, block: [[47, 25, 6, 18], [53, 29, 2, 5]] },
  { t: 'scaffold', at: [45.5, 36], w: 3, h: 3.2, rot: 90 },
  { t: 'block', rect: [45, 35, 1, 3] },
  { t: 'scatter', rect: [36, 30, 12, 10], kind: 'debris', count: 18 },
  // the drag trench it ploughed on the way in, from the south
  { t: 'trench', pts: [[48.2, 53], [49.0, 47], [49.6, 41.5]], width: 3.2, depth: 0.7 },

  // ---- camp buildings
  { t: 'block', rect: [8, 38, 2, 2] }, // the apprentice's tent is wider than its tile
  { t: 'crate', at: [11.5, 41.5], rot: 200 }, // the apprentice's seat, and a story beat
  { t: 'shack', at: [17, 38.5], w: 4, d: 3, rot: 0 },
  { t: 'shack', at: [5.5, 46.5], w: 3, d: 3, rot: 90 },
  { t: 'shack', at: [22, 47.5], w: 3, d: 3, rot: 180 },
  { t: 'miner-ruin', at: [10, 51], w: 6, d: 2.6, h: 3, rot: 0 },
  { t: 'plant', at: [11.4, 45.2], kind: 'sun-date', block: true },
  { t: 'plant', at: [18.5, 47], kind: 'sun-date', block: true },
  { t: 'plant', at: [17, 44.5], kind: 'reed-cane' },
  { t: 'plant', at: [13.5, 45], kind: 'reed-cane' },
  { t: 'plant', at: [16.5, 48.5], kind: 'reed-cane' },
  { t: 'rock', at: [26, 50], size: 2 },
  { t: 'rock', at: [3.5, 38], size: 1.6 },
  { t: 'scatter', rect: [4, 37, 21, 15], kind: 'debris', count: 14 },
  // phase 2: the spring is walled into a cistern (the prop), shaded by torn canvas, fed by a pipe
  // from the old miner ruin; water jars and cut stone about; a tower at the edge with a stilt hut
  { t: 'block', rect: [14, 45, 3, 3] },
  { t: 'canopy', at: [15.5, 46.4], w: 4.4, d: 3.6, h: 2.5, rot: 8 },
  { t: 'pipe', pts: [[12.6, 50.3], [13.5, 49.5], [14.35, 48.9]], h: 0.35 },
  { t: 'jars', at: [13.2, 46.7] },
  { t: 'jars', at: [17.7, 45.4] },
  { t: 'jars', at: [20.4, 40.9] },
  { t: 'jars', at: [7.6, 44.3] },
  { t: 'blocks', at: [17.8, 48.1] },
  { t: 'blocks', at: [19.9, 44.9] },
  { t: 'great-tower', at: [28.4, 37.0], r: 1.0, h: 13, block: 1.8, broken: true, doors: 1, char: 0.3 },
  { t: 'stilt-hut', at: [26.9, 38.7], h: 3.2, rot: 41 },
  // agent B's character-creation line-up stands here (B-008): keep it free of scatter and cover
  { t: 'clear', rect: [31, 40, 9, 3] },
  { t: 'scatter', rect: [25, 36, 10, 16], kind: 'dust-aloe', count: 8 },
  { t: 'scatter', rect: [25, 36, 10, 16], kind: 'rock-small', count: 10 },

  // ---- the Ash Reach
  { t: 'plant', at: [15.5, 18.5], kind: 'spire-root', block: true },
  // rot 0 runs the spire with its base west and its tip east. The user wants the broken base
  // nearest the ruin (it fell outward from the city), so rot 184: base east, tip pointing west.
  { t: 'fallen-spire', at: [22, 12], len: 16, rot: 184 },
  { t: 'block', rect: [15, 10, 15, 5] },
  // the wide base now lies at the east end and reaches half a metre past x=30
  { t: 'block', rect: [30, 10, 1, 5] },
  { t: 'miner-ruin', at: [7, 9.5], w: 6, d: 4, h: 4, rot: 12 },
  // gazetteer: a half-buried ancient miner ship in the Ash Reach, a long dark geometric shape
  { t: 'miner-hull', at: [25.2, 22.6], len: 11, rot: 0 },
  { t: 'block', rect: [19, 21, 14, 3] },
  // an Aza'los star-vessel, grown not built, sunk in the east sand
  { t: 'azalos-vessel', at: [58.2, 21], len: 17, rot: 84 },
  // the furrow it ploughed coming down, from the north, stopping at its bow
  { t: 'trench', pts: [[58.9, 5.8], [58.7, 9.2], [58.4, 12.8]], width: 3.4, depth: 0.8 },
  { t: 'block', rect: [56, 12, 5, 18] },
  { t: 'rock', at: [28, 25], size: 2.2 },
  { t: 'rock', at: [33, 8], size: 1.8 },
  { t: 'rock', at: [22, 20], size: 1.4 },
  { t: 'scatter', rect: [3, 6, 30, 22], kind: 'field-moss', count: 30 },
  { t: 'scatter', rect: [3, 6, 30, 22], kind: 'glass-thistle', count: 10 },
  { t: 'scatter', rect: [3, 6, 58, 22], kind: 'rock-small', count: 24 },
  { t: 'scatter', rect: [12, 15, 8, 8], kind: 'glow-bloom', count: 6 },
  { t: 'scatter', rect: [52, 6, 10, 20], kind: 'digger-tuber', count: 6 },

  // ---- the Aza'los ruin, a raised circle on the lip of the Scar (canon: compact raised circular
  // platform, a crowning cluster of broken towers, towers spread across the whole wheel)
  { t: 'floor-disc', at: [42.5, 14.5], r: 10, raise: 0.6 },
  { t: 'azalos-ring', c: [42.5, 14.5], r: 10, h: 4.2, from: 0, to: 360, gapsDeg: [[168, 192], [262, 272], [86, 94]] },
  { t: 'azalos-ring', c: [42.5, 9.5], r: 4, h: 5, from: 0, to: 360, gapsDeg: [[170, 190]] },
  { t: 'azalos-wall', pts: [[38.6, 9.8], [40.4, 10.55], [41.85, 10.6]], h: 3.6 },
  { t: 'azalos-wall', pts: [[43.15, 10.6], [44.6, 10.55], [46.4, 9.8]], h: 3.6 },
  // the crown: three tall towers behind the inner hall, one snapped by the war
  { t: 'great-tower', at: [43.3, 4.7], r: 1.02, h: 30.8, block: 1.4 },
  { t: 'great-tower', at: [37.8, 6.0], r: 0.90, h: 22.4, block: 1.9, broken: true, doors: 1, char: 0.6 },
  { t: 'great-tower', at: [47.6, 5.8], r: 0.94, h: 25.9, block: 1.9, doors: 1 },
  // towers round the wheel
  { t: 'great-tower', at: [35.4, 7.6], r: 0.78, h: 16.8, block: 2.1, broken: true },
  { t: 'great-tower', at: [50.4, 8.4], r: 0.74, h: 14.7, block: 2.0, broken: true, char: 0.8 },
  { t: 'great-tower', at: [35.4, 21.6], r: 0.70, h: 12.6, block: 1.9, broken: true, char: 0.5 },
  { t: 'great-tower', at: [49.6, 21.6], r: 0.86, h: 19.6, block: 2.2, doors: 1 },
  { t: 'arch', at: [42.5, 24.5], span: 3.4, h: 4.5, rot: 0 },
  // the defender's niche sits in the east wall (the prop builds the alcove); keep the wall solid behind it
  { t: 'block', rect: [52, 14, 2, 1] },
  // cracks the repair drone tends, on the inner face of the ring
  { t: 'wall-crack', at: [34.3, 9.8], rot: 120 },
  { t: 'wall-crack', at: [33.95, 18.5], rot: 65 },
  { t: 'wall-crack', at: [38.5, 23.05], rot: 25 },
];

export const level1: LevelBundle = {
  data: level1Data,
  features,
  // sun low in the north-west: side light from the left of the default view, long shadows to the right
  sky: { sunAzimuth: 315, sunElevation: 19 },
};
